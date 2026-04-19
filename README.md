# RedLedger

A self-hosted offensive security engagement management tool. Track scope, assets, findings, credentials, tool output, checklists, activity, and reports — with an optional local LLM assistant — from a single container.

## Quick Start

Works with both **Docker** and **Podman**.

### Docker

```bash
docker compose up --build
```

### Podman

```bash
podman-compose up --build
# or, if using podman with the compose plugin:
podman compose up --build
```

Open **http://localhost:8000** in your browser.

### Docker image platform

The `Dockerfile` pins **`linux/arm64`** (Apple Silicon). On **x86_64 / AMD64**, either remove the `--platform=linux/arm64` lines from the Dockerfile or build with an explicit platform, for example:

```bash
docker build --platform linux/amd64 -t redledger .
```

## Features

- **Engagement management** — Multiple engagements with client info, dates, status, and rules of engagement
- **Scope** — In-scope / out-of-scope narrative plus structured scope entries
- **Assets** — Hosts and web pages with notes, screenshots, tags, inline editing, recon hints from port summaries, **linked findings** and **linked credentials** (click through to detail)
- **Findings** — Severity, CVSS, status workflow, phase, Markdown fields, finding templates, affected assets, evidence screenshots, dedicated **finding detail** view
- **Credentials** — Per-engagement store with masked secrets, linked assets, **credential detail** page (edit, delete, navigate from list or asset)
- **Tool output** — Paste or attach output; **Nmap XML** import can create host assets; **Burp** import support
- **Checklists** — Per-phase items with PTES-aligned defaults
- **Activity log** — Timeline of engagement actions
- **Phase guides** — In-app reference at `/guides` (Reconnaissance through Reporting)
- **Reports** — Generate engagement reports as **Markdown** (saved under `data/reports/`), download **HTML** or **PDF** (WeasyPrint)
- **Assistant** — Chat UI that proxies to a local **OpenAI-compatible** API (Ollama or LM Studio); optional context window from the runtime; see [Local LLM](#local-llm-assistant) below
- **Settings** — Theme (light/dark), accent colors, Assistant system prompt, optional manual context budget for the usage ring; **[export / import](#export-and-import)** for full engagement backup (zip) at the bottom of Settings
- **Tagging** — Color-coded tags on assets, findings, tool output, and notes

## Architecture

- **Backend:** FastAPI + SQLAlchemy + SQLite (`offsec.db` under `DATA_DIR`)
- **Frontend:** React + Vite + Tailwind CSS (production build served by FastAPI)
- **Container:** Single OCI image, multi-stage build (Node → Python)
- **Data:** SQLite + uploads + generated reports in a mounted volume (`./data/` by default)

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATA_DIR` | Compose / runtime | Directory for DB, `uploads/`, `reports/` (default: `./data` locally, `/app/data` in the image) |
| `LLM_PROXY_URL` | Compose / runtime | Base URL for the Assistant (no trailing path), e.g. `http://127.0.0.1:11434` (Ollama) or `http://127.0.0.1:1234` (LM Studio). From Docker on the host, use `http://host.docker.internal:11434` (or `:1234`) |
| `LM_API_TOKEN` / `LMSTUDIO_API_TOKEN` | Optional | Bearer token for LM Studio native `/api/v0/models` when listing model context sizes |
| `API_PROXY` | Vite dev only | Backend URL for the dev proxy (default `http://127.0.0.1:8000`) |

## Local LLM (Assistant)

1. Run **Ollama** or **LM Studio** with an OpenAI-compatible server on your machine.
2. Set **`LLM_PROXY_URL`** to that base URL (see commented examples in `docker-compose.yml`). If you are not using the Assistant, **omit or comment out** `LLM_PROXY_URL` so the backend does not point at a non-existent server.
3. In Docker, `localhost` inside the container is not your host — use **`host.docker.internal`** (Docker Desktop) or your host IP.

The Assistant calls your runtime’s `/v1/models` and `/v1/chat/completions` through the backend proxy. Model list responses may be enriched with **`context_length`** when the runtime exposes it (LM Studio `/api/v0/models` or Ollama `/api/show`).

## Data persistence

All data lives under the configured **`DATA_DIR`** (Compose bind-mounts `./data` → `/app/data`):

```
data/
  offsec.db       # SQLite database
  uploads/        # Screenshots and uploaded files
  reports/        # Generated reports (e.g. engagement_<id>_report.md)
```

Created on startup; survives container restarts.

The volume mount uses the `:Z` SELinux relabel flag where present (common with Podman on Fedora/RHEL). It is harmless when SELinux is not enforcing.

## Export and import

Use **Settings** (page `/settings`) — section **Engagement backup** at the **bottom** — to move a whole engagement between instances or keep cold backups.

### Export

1. Choose an engagement in the dropdown.
2. Click **Export**. The browser downloads a **`.zip`** whose name includes the engagement name and id.

The archive contains:

- **`manifest.json`** — Engagement metadata, scope, scope entries, assets (notes, tags, screenshots), findings (including evidence file references), credentials, tool output, checklist items, activity log, and a `reports` list describing bundled report files.
- **`files/`** — Screenshot and attachment binaries from `uploads/` (flat filenames as stored on disk).
- **`files/reports/`** — Any saved generated report files for that engagement (e.g. `engagement_<id>_report.md` and matching `engagement_<id>_report*` names).

API equivalent: **`GET /api/engagements/{id}/export`** (response body is the zip).

### Import

1. Click **Select .zip to import** and choose an archive produced by RedLedger export.
2. The app creates a **new** engagement with new database ids; existing engagements are unchanged.
3. **Tags** are merged **by name** with the global tag table (same name reuses the existing tag).
4. After success, the UI opens the new engagement.

API equivalent: **`POST /api/engagements/import`** with multipart form field **`file`** set to the zip.

Imports from older exports without a `reports` array in the manifest still work; report files are optional in the zip.

### Deleting an engagement

Deleting an engagement from the dashboard removes its database rows **and** deletes that engagement’s files under **`uploads/`** (screenshots tied to its assets/findings) and **`reports/`** (`engagement_<id>_report*`).

## Security note

Credentials (and other fields) are stored **unencrypted** in SQLite. For highly sensitive material, use a dedicated vault and reference it in notes instead.

Protect **`./data/offsec.db`** and use full-disk encryption (FileVault, LUKS, BitLocker) for at-rest protection.

## Development

### Backend (no container)

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```

### Frontend (Vite + hot reload)

```bash
cd frontend
npm install
npm run dev
```

Vite serves on **http://localhost:5173** and proxies **`/api`** to the backend (override with `API_PROXY` if the API is not on port 8000).

With the backend on 8000 and Vite on 5173, open the Vite URL during UI work; production-like testing uses the single-port app from `uvicorn` after `npm run build` in `frontend/`.

## Customization

### Port recon hints (`frontend/src/data/portRecommendations.js`)

The **Assets** view uses this file to show “Recommended Enumeration” blocks from an asset’s **Ports summary** (the comma-separated lines produced by imports or manual entry, e.g. `22/tcp (ssh), 80/tcp (http)`).

**Add or change a port**

1. Open `frontend/src/data/portRecommendations.js`.
2. Add or edit an entry on `PORT_RECOMMENDATIONS`. Keys are **numeric ports** (JavaScript object keys: `22`, `443`, `8080`, …).
3. Each entry has this shape:

   - **`service`** — Short label shown in the UI (e.g. `SSH`, `HTTP`).
   - **`items`** — Array of steps; each step has **`title`** (string) and **`commands`** (array of command strings).

4. In command strings you can use:
   - **`{target}`** — Replaced with the asset’s target (hostname or IP).
   - **`{port}`** — Replaced with the port number for that row.

   Placeholders such as `<domain>` in examples are left as-is for you to fill in manually.

5. **`SERVICE_ALIASES`** maps **service names** (lowercase, as Nmap often prints them) to a **port number** that exists in `PORT_RECOMMENDATIONS`. If the summary includes a service name but your block is keyed only by port, add an alias (e.g. `ssh` → `22`) so the right block is found.

6. **`GENERIC_RECOMMENDATION`** is the fallback when no port-specific entry matches; edit it to change default suggestions.

After editing, run **`npm run build`** in `frontend/` (or let Vite reload in dev). For the **Docker** image, rebuild the image so the updated bundle is included, unless you mount a custom `frontend/dist`.

### Phase guides (`backend/guides/`)

The in-app **Guides** page (`/guides`) loads Markdown from the backend directory **`backend/guides/`**.

- Each file is named **`{slug}.md`**, matching the phase slugs in **`backend/routers/phases.py`** (`reconnaissance`, `scanning_and_enumeration`, `exploitation`, `post_exploitation`, `reporting`).
- Edit the corresponding `.md` file to change wording, checklists, tooling notes, or methodology to match **your** org’s standards.
- Content is normal **Markdown** (headings, lists, code fences, etc.) and is rendered in the UI.

If the backend runs with **`uvicorn --reload`**, saving a guide file is enough. Otherwise restart the API process. No frontend rebuild is required for guide text.

**Renaming phases or adding a phase** is a small code change: update the `PHASES` list in `backend/routers/phases.py` (slug + display name) and add a matching **`{slug}.md`** under `backend/guides/`. The Guides page builds its tabs from `/api/phases`.

## Podman notes

- Podman is often rootless; the image creates writable paths under `DATA_DIR`.
- Compose uses `:Z` on the data volume for SELinux.
- Image references in the Dockerfile use fully qualified names (`docker.io/library/...`) where applicable to avoid ambiguous registry prompts.
- If the host `./data` tree is not writable, try: `chmod -R a+rwX ./data`

## Repository hygiene

`.gitignore` excludes `node_modules/`, build output, Python caches, virtualenvs, `data/`, local `.env*` files, test coverage artifacts, and **`.claude/settings.local.json`** (machine-local agent settings).
