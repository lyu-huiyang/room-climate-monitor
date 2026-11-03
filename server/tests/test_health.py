def test_health_reports_ok_and_version(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "version": "0.1.0"}


def test_openapi_is_served_under_api(client):
    assert client.get("/api/openapi.json").status_code == 200
    assert client.get("/openapi.json").status_code == 404
