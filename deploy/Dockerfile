# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f deploy/Dockerfile -t room-climate-monitor .

# 1. Web app → static files
FROM node:26.13.0-alpine AS web
# Node 25+ no longer ships corepack, so install the pinned pnpm directly.
RUN npm install -g pnpm@12.3.4
WORKDIR /src/web
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# 2. Python virtualenv with the server package (uv stays in this stage only)
FROM python:3.14.10-slim AS server
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /src/server
COPY server/pyproject.toml server/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY server/src ./src
RUN uv sync --frozen --no-dev --no-editable

# 3. Runtime
FROM python:3.14.10-slim
RUN useradd --system --uid 10001 --no-create-home rcm && mkdir /data && chown 10001:10001 /data
COPY --from=server /app/.venv /app/.venv
COPY --from=web /src/web/dist /app/static
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    RCM_DB_PATH=/data/rcm.sqlite3 \
    RCM_STATIC_DIR=/app/static
USER 10001
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=3).status == 200 else 1)"]
CMD ["rcm", "serve"]
