"""Proxy to local OpenAI-compatible APIs (Ollama, LM Studio). Set LLM_PROXY_URL."""

import asyncio
import json
import os
from typing import Any, AsyncIterator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/assistant", tags=["assistant"])

DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=15.0)
# Shorter timeouts for optional metadata (LM Studio /api/v0/models, Ollama /api/show).
META_TIMEOUT = httpx.Timeout(12.0, connect=4.0)


def _llm_base_url() -> str | None:
    raw = os.environ.get("LLM_PROXY_URL", "").strip()
    if not raw:
        return None
    return raw.rstrip("/")


def _lm_studio_auth_headers() -> dict[str, str]:
    token = (os.environ.get("LM_API_TOKEN") or os.environ.get("LMSTUDIO_API_TOKEN") or "").strip()
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _valid_context_length(value: Any) -> bool:
    return isinstance(value, int) and value >= 1024


def _parse_ollama_show_context_length(payload: dict[str, Any]) -> int | None:
    mi = payload.get("model_info")
    if not isinstance(mi, dict):
        return None
    found: int | None = None
    for k, v in mi.items():
        if isinstance(k, str) and k.endswith(".context_length") and isinstance(v, int) and v > 0:
            found = v if found is None else max(found, v)
    return found


async def _fetch_lm_studio_context_map(client: httpx.AsyncClient, base: str) -> dict[str, int]:
    """GET /api/v0/models — LM Studio native REST (0.3.6+)."""
    try:
        r = await client.get(
            f"{base}/api/v0/models",
            headers=_lm_studio_auth_headers(),
            timeout=META_TIMEOUT,
        )
    except httpx.RequestError:
        return {}
    if r.status_code != 200:
        return {}
    try:
        body = r.json()
    except Exception:
        return {}
    data = body.get("data")
    if not isinstance(data, list):
        return {}
    out: dict[str, int] = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        mid = item.get("id")
        mcl = item.get("max_context_length")
        if isinstance(mid, str) and isinstance(mcl, int) and mcl > 0:
            out[mid] = mcl
    return out


async def _ollama_show_context_length(client: httpx.AsyncClient, base: str, model_id: str) -> int | None:
    try:
        r = await client.post(
            f"{base}/api/show",
            json={"model": model_id},
            timeout=META_TIMEOUT,
        )
    except httpx.RequestError:
        return None
    if r.status_code != 200:
        return None
    try:
        payload = r.json()
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    return _parse_ollama_show_context_length(payload)


async def _enrich_models_with_context_lengths(client: httpx.AsyncClient, base: str, body: Any) -> Any:
    """Attach OpenAI-style extension field `context_length` (tokens) when discoverable."""
    if not isinstance(body, dict):
        return body
    models = body.get("data")
    if not isinstance(models, list):
        return body

    lm_map = await _fetch_lm_studio_context_map(client, base)
    for m in models:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        if isinstance(mid, str) and mid in lm_map:
            m["context_length"] = lm_map[mid]

    missing = [
        m["id"]
        for m in models
        if isinstance(m, dict) and isinstance(m.get("id"), str) and not _valid_context_length(m.get("context_length"))
    ]
    if not missing:
        return body

    sem = asyncio.Semaphore(8)

    async def one(mid: str) -> tuple[str, int | None]:
        async with sem:
            ctx = await _ollama_show_context_length(client, base, mid)
            return mid, ctx

    pairs = await asyncio.gather(*(one(mid) for mid in missing))
    by_id = {mid: ctx for mid, ctx in pairs if ctx is not None}

    for m in models:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        if isinstance(mid, str) and "context_length" not in m and mid in by_id:
            m["context_length"] = by_id[mid]

    return body


@router.get("/models")
async def list_models():
    """Proxy GET /v1/models from the local runtime, enriched with `context_length` when available."""
    base = _llm_base_url()
    if not base:
        return {"object": "list", "data": []}
    url = f"{base}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url)
            if r.status_code >= 400:
                raise HTTPException(502, f"Local LLM returned HTTP {r.status_code}")
            try:
                body = r.json()
            except Exception as e:
                raise HTTPException(502, "Local LLM returned invalid JSON for /v1/models") from e

            body = await _enrich_models_with_context_lengths(client, base, body)
    except httpx.ConnectError as e:
        raise HTTPException(
            502,
            "Cannot connect to local LLM. Check LLM_PROXY_URL and that Ollama or LM Studio is running.",
        ) from e
    except httpx.TimeoutException as e:
        raise HTTPException(504, "Local LLM request timed out.") from e

    return body


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = Field(default=True)


@router.post("/chat")
async def chat_completions(body: ChatRequest):
    """Stream POST /v1/chat/completions to the local runtime (SSE pass-through)."""
    base = _llm_base_url()
    if not base:
        raise HTTPException(
            503,
            "LLM_PROXY_URL is not set. Example: http://127.0.0.1:11434 (Ollama) or http://127.0.0.1:1234 (LM Studio). "
            "In Docker, use http://host.docker.internal:11434 to reach the host.",
        )

    upstream = f"{base}/v1/chat/completions"
    payload = body.model_dump()

    async def passthrough() -> AsyncIterator[bytes]:
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    upstream,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                ) as response:
                    if response.status_code >= 400:
                        err_text = (await response.aread()).decode(errors="replace")[:800]
                        # Single SSE-style error chunk the UI can surface
                        msg = json.dumps({"error": {"message": err_text or str(response.status_code)}})
                        yield f"data: {msg}\n\n".encode()
                        return
                    async for chunk in response.aiter_bytes():
                        yield chunk
        except httpx.ConnectError:
            msg = json.dumps(
                {"error": {"message": "Connection refused — is Ollama/LM Studio running at LLM_PROXY_URL?"}}
            )
            yield f"data: {msg}\n\n".encode()
        except httpx.TimeoutException:
            msg = json.dumps({"error": {"message": "Request timed out."}})
            yield f"data: {msg}\n\n".encode()

    return StreamingResponse(
        passthrough(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
