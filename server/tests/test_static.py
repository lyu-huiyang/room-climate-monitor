import pytest
from conftest import INDEX_HTML
from fastapi.testclient import TestClient

from rcm.api import create_app
from rcm.config import Settings


def test_index_served_at_root(static_client):
    r = static_client.get("/")
    assert r.status_code == 200
    assert r.text == INDEX_HTML
    assert r.headers["content-type"].startswith("text/html")
    assert r.headers["cache-control"] == "no-cache"


def test_asset_served_with_immutable_cache(static_client):
    r = static_client.get("/assets/app-abc123.js")
    assert r.status_code == 200
    assert r.text == "console.log(1)"
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_root_file_served_without_long_cache(static_client):
    r = static_client.get("/manifest.webmanifest")
    assert r.status_code == 200
    assert r.text == "{}"
    assert r.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", ["/rooms/living-room", "/nope", "/missing.js"])
def test_unknown_path_falls_back_to_index(static_client, path):
    r = static_client.get(path)
    assert r.status_code == 200
    assert r.text == INDEX_HTML
    assert r.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("path", ["/assets/missing.js", "/assets/old-chunk-abc123.css", "/assets/sub/x.js"])
def test_missing_asset_is_404_not_index(static_client, path):
    # A page left open across an upgrade asks for old hashed chunks; HTML in their place breaks import().
    r = static_client.get(path)
    assert r.status_code == 404
    assert r.text != INDEX_HTML
    assert "immutable" not in r.headers.get("cache-control", "")


@pytest.mark.parametrize(
    "path",
    [
        "/../secret.txt",
        "/%2E%2E/secret.txt",
        "/..%2Fsecret.txt",
        "/assets/..%2F..%2Fsecret.txt",
        "/..%2F..%2Fetc%2Fpasswd",
        "/../pyproject.toml",
        "/assets/../../x",
        "/link.txt",
        "/foo%00bar",
        "/assets/%00.js",
    ],
)
def test_path_traversal_never_escapes_static_dir(static_client, path):
    r = static_client.get(path)
    assert r.status_code in (200, 404)
    assert "TOP-SECRET" not in r.text
    assert "root:" not in r.text
    if r.status_code == 200:
        assert r.text == INDEX_HTML


@pytest.mark.parametrize("path", ["/api/nope", "/api", "/api/rooms/x/history/extra"])
def test_api_unknown_still_json_404(static_client, path):
    r = static_client.get(path)
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_api_routes_still_work_with_static(static_client):
    assert static_client.get("/api/health").json()["ok"] is True
    assert static_client.get("/api/rooms").json() == []


def test_without_static_dir_root_is_404(client):
    assert client.get("/").status_code == 404


def test_missing_static_dir_is_not_mounted(tmp_path):
    settings = Settings(tmp_path / "x.sqlite3", "127.0.0.1", 8080, static_dir=tmp_path / "does-not-exist")
    with TestClient(create_app(settings)) as c:
        assert c.get("/").status_code == 404
        assert c.get("/api/health").status_code == 200
