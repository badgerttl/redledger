FROM --platform=linux/arm64 docker.io/library/node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
COPY backend/wstg_checklist.json ../backend/wstg_checklist.json
COPY backend/scripts/download_wstg.mjs ../backend/scripts/download_wstg.mjs
RUN npm run build

FROM --platform=linux/arm64 docker.io/library/python:3.12-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev libcairo2 libpango1.0-dev && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/backend/guides/wstg ./backend/guides/wstg
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV DATA_DIR=/app/data
RUN mkdir -p /app/data/uploads /app/data/reports && \
    chmod 755 /app/data /app/data/uploads /app/data/reports

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
