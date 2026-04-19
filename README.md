# RedLedger

A self-hosted offensive security engagement management tool. Track scope, assets, findings, credentials, tool output, checklists, and reports — with an optional local LLM assistant — all from a single container.

---

## Quick Start

Supports both **Docker** and **Podman**.

```bash
# Docker
docker compose up --build

# Podman
podman compose up --build
```

Open **http://localhost:8000** in your browser.

> **Apple Silicon / ARM64:** The `Dockerfile` defaults to `linux/arm64`. On x86_64/AMD64, remove the `--platform=linux/arm64` lines or build explicitly:
> ```bash
> docker build --platform linux/amd64 -t redledger .
> ```

---

## Features

| Area | What you get |
|---|---|
| **Engagements** | Multiple engagements with client info, dates, status, and rules of engagement |
| **Scope** | In-scope / out-of-scope narrative plus structured scope entries |
| **Assets** | Hosts and web pages with notes, screenshots, tags, recon hints, linked findings, and linked credentials |
| **Findings** | Severity, CVSS, status workflow, Markdown fields, templates, affected assets, and evidence screenshots |
| **Credentials** | Per-engagement credential store with masked secrets and linked assets |
| **Tool Output** | Paste or attach output; import **Nmap XML** to create host assets; **Burp** import supported |
| **Checklists** | Per-phase items with PTES-aligned defaults |
| **Activity Log** | Timeline of all engagement actions |
| **Phase Guides** | In-app reference for Reconnaissance through Reporting (`/guides`) |
| **Reports** | Generate **HTML** or **PDF** reports (WeasyPrint); Markdown saved under `data/reports/` |
| **Assistant** | Chat UI proxied to a local OpenAI-compatible API (Ollama or LM Studio) |
| **Settings** | Themes, accent colors, assistant system prompt, and full engagement backup (export/import) |

---

## Architecture

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** React + Tailwind CSS (served by FastAPI in production)
- **Container:** Single OCI image, multi-stage build (Node → Python)
- **Data:** SQLite + uploads + generated reports in a mounted volume (`./data/` by default)

---

## Configuration

### Environment Variables

| Variable | Purpose |
|---|---|
| `DATA_DIR` | Directory for the DB, uploads, and reports. Default: `./data` locally, `/app/data` in the image |
| `LLM_PROXY_URL` | Base URL for the Assistant (no trailing slash). e.g. `http://host.docker.internal:11434` for Ollama from inside Docker |
| `LM_API_TOKEN` / `LMSTUDIO_API_TOKEN` | Optional bearer token for LM Studio's native `/api/v0/models` endpoint |
| `API_PROXY` | Dev only — backend URL for the dev proxy (default: `http://127.0.0.1:8000`) |

### Local LLM (Assistant)

1. Run **Ollama** or **LM Studio** with an OpenAI-compatible server on your host machine.
2. Set `LLM_PROXY_URL` to that base URL in `docker-compose.yml`. If you are not using the assistant, omit or comment out this variable.
3. Inside Docker, `localhost` refers to the container — use `host.docker.internal` (Docker Desktop) or your host's IP instead.

The assistant calls `/v1/models` and `/v1/chat/completions` through the backend proxy. Model context lengths are surfaced when the runtime exposes them (LM Studio `/api/v0/models` or Ollama `/api/show`).

---

## Data & Storage

All data lives under `DATA_DIR`:

```
data/
  offsec.db       # SQLite database
  uploads/        # Screenshots and uploaded files
  reports/        # Generated reports
```

The directory is created on startup and survives container restarts. The volume mount uses `:Z` for SELinux relabeling (common with Podman on Fedora/RHEL) — harmless when SELinux is not enforcing.

> **Security note:** Credentials and other sensitive fields are stored **unencrypted** in SQLite. For highly sensitive material, use a dedicated vault and reference it in notes. Protect `./data/offsec.db` with filesystem permissions and full-disk encryption (FileVault, LUKS, BitLocker).

---

## Export & Import

Go to **Settings → Engagement Backup** to move an engagement between instances or create cold backups.

### Export

1. Select an engagement from the dropdown.
2. Click **Export**. The browser downloads a `.zip` named after the engagement.

The archive contains:
- `manifest.json` — All engagement data: metadata, scope, assets, findings, credentials, tool output, checklist items, and activity log.
- `files/` — Screenshot and attachment binaries.
- `files/reports/` — Any saved report files for that engagement.

API: `GET /api/engagements/{id}/export`

### Import

1. Click **Select .zip to import** and choose a RedLedger export archive.
2. A **new** engagement is created with new database IDs — existing engagements are not modified.
3. Tags are merged by name with the global tag table.
4. On success, the UI opens the newly imported engagement.

API: `POST /api/engagements/import` with multipart form field `file` set to the zip.

### Deleting an Engagement

Deleting an engagement removes its database rows **and** deletes its uploaded files and generated reports from disk.

---

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on **http://localhost:5173** and proxies `/api` to the backend. For production-like testing, run `npm run build` in `frontend/` and use the single-port FastAPI server.

---

## Customization

### Port Recon Hints (`frontend/src/data/portRecommendations.js`)

The Assets view displays "Recommended Enumeration" blocks based on an asset's port summary (e.g. `22/tcp (ssh), 80/tcp (http)`). This file controls what commands are suggested.

**To add or change a port:**

1. Open `frontend/src/data/portRecommendations.js`.
2. Add or edit an entry in `PORT_RECOMMENDATIONS`. Keys are numeric port numbers (`22`, `443`, `8080`, etc.).
3. Each entry has this shape:
   - **`service`** — Short label shown in the UI (e.g. `SSH`, `HTTP`).
   - **`items`** — Array of steps; each step has a `title` (string) and `commands` (array of strings).
4. Command strings support two placeholders:
   - **`{target}`** — Replaced with the asset's hostname or IP.
   - **`{port}`** — Replaced with the port number.
5. **`SERVICE_ALIASES`** maps service names (as Nmap prints them, lowercase) to a port key. Use this if your summary includes a service name but your block is keyed only by port number (e.g. `ssh` → `22`).
6. **`GENERIC_RECOMMENDATION`** is the fallback shown when no port-specific entry matches.

After editing, run `npm run build` in `frontend/` (or let the dev server reload automatically). For Docker, rebuild the image so the updated bundle is included.

---

### Phase Guides (`backend/guides/`)

The in-app **Guides** page (`/guides`) loads Markdown files from `backend/guides/`.

- Files are named `{slug}.md`, matching the phase slugs defined in `backend/routers/phases.py`:
  `reconnaissance`, `scanning_and_enumeration`, `exploitation`, `post_exploitation`, `reporting`
- Edit any `.md` file to update wording, checklists, tooling notes, or methodology to match your org's standards.
- Content is standard Markdown and is rendered in the UI.

No frontend rebuild is needed for guide changes. With `uvicorn --reload`, saving the file is enough; otherwise restart the API process.

**To rename a phase or add a new one:** Update the `PHASES` list in `backend/routers/phases.py` (slug + display name) and add a matching `{slug}.md` under `backend/guides/`. The Guides page builds its tabs dynamically from `/api/phases`.

---

## Podman Notes

- Podman is often rootless; the image creates writable paths under `DATA_DIR`.
- Volume mounts use `:Z` for SELinux relabeling.
- Image references in the Dockerfile use fully qualified names (e.g. `docker.io/library/...`) to avoid ambiguous registry prompts.
- If `./data` is not writable: `chmod -R a+rwX ./data`
