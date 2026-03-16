# RedLedger

A self-hosted offensive security engagement management tool. Track scope, assets, findings, credentials, tool output, and generate reports — all from a single container.

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

## Features

- **Engagement management** — Create and manage multiple pentest engagements with client info, dates, and rules of engagement
- **Scope definition** — Track in-scope and out-of-scope targets with structured scope entries
- **Asset tracking** — Hosts and web pages with notes, screenshots, tags, and inline port/OS editing
- **Findings tracker** — CVSS scoring, severity ratings, status workflow, evidence screenshots, affected assets
- **Credentials vault** — Store harvested credentials with masked display and reveal-on-click
- **Tool output** — Paste or import output from any tool; Nmap XML import auto-creates host assets
- **Methodology checklists** — Interactive per-phase checklists seeded from PTES-aligned defaults
- **Activity log** — Timeline of engagement actions (manual and auto-generated)
- **Phase guides** — In-app reference guides for Reconnaissance, Scanning, Exploitation, Post-Exploitation, and Reporting
- **Report generation** — Generate Markdown reports from engagement data
- **Tagging** — Organize assets, findings, and tool output with color-coded tags
- **Dark / Light mode** — Toggle between dark and light themes; preference persisted in browser

## Architecture

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **Frontend:** React + Vite + Tailwind CSS
- **Container:** Single OCI image, multi-stage build (Node -> Python)
- **Data:** SQLite database + file uploads stored in a mounted volume (`./data/`)

## Data Persistence

All data is stored in the `./data/` directory (bind-mounted into the container):

```
data/
  offsec.db       # SQLite database
  uploads/        # Screenshots and uploaded files
  reports/        # Generated reports
```

This directory is created automatically and persists across container restarts.

The volume mount uses the `:Z` SELinux relabel flag, which is required for Podman on SELinux-enabled systems (Fedora, RHEL, etc.) and is harmless on systems without SELinux.

## Security Note

Credentials stored in RedLedger are saved **unencrypted** in the local SQLite database. This is acceptable for most local pentest workflows, but for extra-sensitive secrets (domain admin passwords, production API keys, etc.) you should store them in a dedicated password vault (e.g., KeePassXC, 1Password, Bitwarden) and reference the vault entry in RedLedger's notes field instead.

The database file lives in `./data/offsec.db` on your host. Ensure your disk is encrypted (FileVault, LUKS, BitLocker) for at-rest protection.

## Development

### Backend (without containers)

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```

### Frontend (dev server with hot reload)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on port 5173 and proxies `/api` requests to the backend on port 8000.

## Podman Notes

- Podman is rootless by default. The Dockerfile sets open permissions on the data directory so the mapped UID can write to it.
- The `docker-compose.yml` uses the `:Z` volume flag for SELinux compatibility.
- Image references use fully-qualified names (`docker.io/library/...`) so Podman doesn't prompt for a registry.
- If you encounter permission issues on the host `./data` directory, run: `chmod -R a+rwX ./data`
