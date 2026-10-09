"""Guest access regression tests; no AI or external network calls."""
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from guest_access import authorize_chat, COOKIE_NAME
from schemas.models import ChatRequest


@pytest.fixture
def client(tmp_path, monkeypatch):
    import repositories.base as base
    from routes import analysis, chat, tts, customers, knowledge
    from utils.deps import limiter

    monkeypatch.setattr(base, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setattr(limiter, "enabled", False)
    app = FastAPI()
    for router in (analysis.router, chat.router, tts.router, customers.router, knowledge.router):
        app.include_router(router)

    @app.post("/probe")
    def probe(body: ChatRequest = Depends(authorize_chat)):
        return body.model_dump()

    with TestClient(app) as instance:
        yield instance


@pytest.mark.parametrize("path,name", [
    ("/analyze-image", "photo.png"), ("/analyze-file", "results.csv"), ("/transcribe", "audio.webm"),
])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer fake-token"}])
def test_guest_upload_rejected_before_analysis(client, monkeypatch, path, name, headers):
    import routes.analysis as analysis
    ai = Mock(side_effect=AssertionError("AI must not run"))
    monkeypatch.setattr(analysis, "analyze_image_with_ai", ai)
    monkeypatch.setattr(analysis, "ask_expert_assistant", ai)
    res = client.post(path, files={"file": (name, b"test")},
                      data={"customer_id": "123", "user_id": "customer_123"}, headers=headers)
    assert res.status_code == 401
    ai.assert_not_called()


@pytest.mark.parametrize("path,body", [
    ("/tts", {"text": "hello"}),
    ("/chat/suggest-questions", {"question": "test", "answer": "test"}),
    ("/memory/search", {"user_id": "customer_123"}),
    ("/knowledge/search", {"message": "test"}),
    ("/customer-requests", {"full_name": "Guest Visitor", "phone": "123456789", "message": "test"}),
])
def test_guest_tools_require_login(client, path, body):
    assert client.post(path, json=body).status_code == 401


def test_four_questions_persist_and_ids_do_not_grant_access(client):
    res = client.get("/chat/access")
    assert res.json()["used"] == 0
    assert "httponly" in res.headers["set-cookie"].lower()
    for i in range(4):
        response = client.post("/probe", json={"message": "hello", "customer_id": 123,
            "user_id": f"customer_{i}", "context": "private analysis", "domain": "analysis"})
        assert response.status_code == 200
        assert response.json()["customer_id"] is None
        assert response.json()["user_id"].startswith("guest_")
        assert response.json()["context"] is None
    assert client.get("/chat/access").json()["used"] == 4
    # Both actual chat routes must block before running their AI pipelines.
    for path in ("/chat", "/chat/stream", "/probe"):
        res = client.post(path, json={"message": "fifth", "customer_id": 123, "guest_name": "Lead"})
        assert res.status_code == 403
        assert res.json()["detail"] == "registration_required"


def test_missing_or_fabricated_guest_session_cannot_chat(client):
    for path in ("/chat", "/chat/stream"):
        assert client.post(path, json={"message": "test"}).status_code == 401
    client.cookies.set(COOKIE_NAME, "fabricated")
    assert client.post("/probe", json={"message": "test"}).status_code == 403


def test_parallel_requests_cannot_exceed_quota(client):
    client.get("/chat/access")
    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses = list(pool.map(lambda _: client.post("/probe", json={"message": "test"}).status_code, range(8)))
    assert statuses.count(200) == 4
    assert statuses.count(403) == 4


def test_signed_in_customer_can_analyze_and_identity_is_server_owned(client, monkeypatch, tmp_path):
    import db_service
    import routes.analysis as analysis
    from auth_service import create_access_token
    monkeypatch.setattr(db_service, "get_customer_by_id", lambda _: {"id": 7, "approval_status": "approved"})
    client.headers["Authorization"] = "Bearer " + create_access_token(7, "customer@example.test")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(analysis, "_analysis_kb_context", lambda *a, **k: "")
    monkeypatch.setattr(analysis, "analyze_image_with_ai", lambda *a, **k: "Analysis")
    persist = Mock(return_value=1)
    monkeypatch.setattr(analysis, "_persist_analysis", persist)
    response = client.post("/analyze-image", files={"file": ("photo.png", b"test")},
                           data={"customer_id": "123", "user_id": "customer_123"})
    assert response.status_code == 200
    assert response.json()["ai_analysis"] == "Analysis"
    assert persist.call_args.kwargs["metadata"]["customer_id"] == 7
    assert persist.call_args.kwargs["user_id"] == "customer_7"
    for _ in range(6):
        response = client.post("/probe", json={"message": "test", "customer_id": 123})
        assert response.json()["customer_id"] == 7


@pytest.mark.parametrize("account", [None, {"is_blocked": True}, {"approval_status": "pending"}])
def test_unavailable_accounts_cannot_analyze(client, monkeypatch, account):
    import db_service
    from auth_service import create_access_token
    monkeypatch.setattr(db_service, "get_customer_by_id", lambda _: account)
    res = client.post("/analyze-image", files={"file": ("photo.png", b"test")},
                      headers={"Authorization": "Bearer " + create_access_token(7, "test@example.test")})
    assert res.status_code in (401, 403)


def test_websocket_guest_cannot_bypass_quota(client):
    from ws_chat import router
    from starlette.websockets import WebSocketDisconnect
    client.app.include_router(router)
    with client.websocket_connect("/ws/chat") as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 1008


@pytest.mark.parametrize("path", ["/chat", "/chat/stream"])
def test_real_chat_pipeline_receives_sanitized_identity(client, monkeypatch, path):
    import routes.chat as chat
    client.get("/chat/access")
    def pipeline(body, **kwargs):
        assert body.customer_id is None
        assert body.user_id.startswith("guest_")
        raise HTTPException(418, "Pipeline reached with validated identity")
    monkeypatch.setattr(chat, "_build_chat_pipeline", pipeline)
    response = client.post(path, json={"message": "test", "customer_id": 7, "user_id": "customer_7"})
    assert response.status_code == 418
