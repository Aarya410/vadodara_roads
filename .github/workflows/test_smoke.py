"""Smoke tests for CI. They need NO database: the FastAPI lifespan (which
connects to MongoDB) is not triggered because TestClient is used without
a `with` block, and only DB-free endpoints are called."""
from fastapi.testclient import TestClient

from app.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_frontend_is_served():
    r = client.get("/")
    assert r.status_code == 200
    assert "html" in r.headers["content-type"]


def test_password_hash_roundtrip():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_roundtrip():
    token = create_access_token({"sub": "user@example.com"})
    assert isinstance(token, str)
    assert decode_token(token) is not None


def test_protected_route_requires_auth():
    r = client.get("/api/auth/me")
    assert r.status_code == 401
