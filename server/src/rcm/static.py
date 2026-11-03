"""Serve the built web app with SPA fallback (docs/design/server-web.md §3)."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

IMMUTABLE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"


def mount(app: FastAPI, static_dir: Path | None) -> None:
    """Register a catch-all GET route; call it after every /api route."""
    if static_dir is None or not static_dir.is_dir():
        return
    root = static_dir.resolve()
    index = root / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        # This route also matches unknown /api paths; keep those as JSON 404s.
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not Found")
        target = _existing_file(root, path)
        if target is not None:
            immutable = target.is_relative_to(root / "assets")
            return FileResponse(target, headers={"Cache-Control": IMMUTABLE if immutable else NO_CACHE})
        if path.startswith("assets/"):
            # An old page asking for a chunk from a previous build must get an error, not index.html:
            # HTML served as JavaScript breaks import() without saying why.
            raise HTTPException(404, "Not Found")
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})


def _existing_file(root: Path, path: str) -> Path | None:
    """The file `path` names inside `root`, or None for anything else (missing, outside, unrepresentable)."""
    if not path:
        return None
    try:
        # resolve() follows symlinks and "..", so the containment check sees the real target.
        target = (root / path).resolve()
        return target if target.is_relative_to(root) and target.is_file() else None
    except ValueError, OSError:
        # e.g. an embedded NUL byte or a name too long for the filesystem
        return None
