"""Proxy to local OpenAI-compatible APIs (Ollama, LM Studio). Set LLM_PROXY_URL."""

import json
import os
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/assistant", tags=["assistant"])

DEFAULT_TIMEOUT = httpx.Timeout(120.0, connect=15.0)


def _llm_base_url() -> str | None:
    raw = os.environ.get("LLM_PROXY_URL", "").strip()
    if not raw:
        return None
    return raw.rstrip("/")


@router.get("/models")
async def list_models():
    """Proxy GET /v1/models from the local runtime."""
    base = _llm_base_url()
    if not base:
        return {"object": "list", "data": []}
    url = f"{base}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            r = await client.get(url)
    except httpx.ConnectError as e:
        raise HTTPException(
            502,
            "Cannot connect to local LLM. Check LLM_PROXY_URL and that Ollama or LM Studio is running.",
        ) from e
    except httpx.TimeoutException as e:
        raise HTTPException(504, "Local LLM request timed out.") from e

    if r.status_code >= 400:
        raise HTTPException(502, f"Local LLM returned HTTP {r.status_code}")
    return r.json()


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
