"""
WebSocket chat endpoint for real-time streaming AI responses.
Supports: typing indicators, heartbeat, auto-reconnect, and session management.
"""
import json
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from ai_service import ask_expert_assistant_stream
from intent_service import detect_question_intent
from knowledge_service import search_knowledge_base
from local_search_service import local_search_knowledge_base
from site_resource_service import find_artinazma_resources
from db_service import (
    save_expert_question,
    save_user_memory,
    detect_domain,
    save_chat_message,
    get_customer_cross_session_context,
)
from auth_service import verify_access_token
from ws_ticket_service import consume_ticket

logger = logging.getLogger("artin_ws")

router = APIRouter()

_active_connections: dict[str, WebSocket] = {}


def _safe_json(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False)


async def _send_safe(ws: WebSocket, data: dict):
    try:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.send_text(_safe_json(data))
    except Exception:
        pass


async def _authenticate_ws(
    ws: WebSocket,
    ticket: Optional[str],
    token: Optional[str],
) -> Optional[dict]:
    """
    Authenticate a WebSocket connection.
    Preferred: one-time ticket -- keeps JWT out of server logs.
    Fallback:  raw JWT token -- kept for backwards-compat.
    """
    if ticket:
        return consume_ticket(ticket)
    if token:
        try:
            return verify_access_token(token)
        except Exception:
            return None
    return None


async def _heartbeat(ws: WebSocket, interval: int = 25):
    try:
        while ws.client_state == WebSocketState.CONNECTED:
            await asyncio.sleep(interval)
            await _send_safe(ws, {"type": "ping", "ts": asyncio.get_event_loop().time()})
    except Exception:
        pass


@router.websocket("/ws/chat")
async def websocket_chat(
    ws: WebSocket,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
):
    await ws.accept()

    customer = await _authenticate_ws(ws, ticket, token)
    customer_id = str(customer.get("sub", customer.get("customer_id", ""))) if customer else None
    conn_id = f"ws_{id(ws)}"

    _active_connections[conn_id] = ws
    logger.info("WS connected: %s (customer: %s)", conn_id, customer_id or "anonymous")

    await _send_safe(ws, {
        "type": "connected",
        "customer_id": customer_id,
        "conn_id": conn_id,
    })

    heartbeat_task = asyncio.create_task(_heartbeat(ws))

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send_safe(ws, {"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "chat")

            if msg_type == "pong":
                continue
            if msg_type == "typing":
                continue
            if msg_type == "chat":
                await _handle_chat_message(ws, msg, customer_id)
                continue

            await _send_safe(ws, {"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WS disconnected: %s", conn_id)
    except Exception as e:
        logger.error("WS error: %s -- %s", conn_id, e)
    finally:
        heartbeat_task.cancel()
        _active_connections.pop(conn_id, None)


async def _handle_chat_message(ws: WebSocket, msg: dict, customer_id: Optional[str]):
    message = (msg.get("message") or "").strip()
    if not message:
        await _send_safe(ws, {"type": "error", "message": "Empty message"})
        return

    session_id = msg.get("session_id")
    history = msg.get("history") or []
    request_id = msg.get("request_id", "")

    await _send_safe(ws, {"type": "typing_start", "request_id": request_id})

    try:
        intent_result = detect_question_intent(message)
        question_intent = intent_result.get("intent", "general")
        question_intent_label = intent_result.get("label", "general")
        detected_domain = detect_domain(message)

        local_results = local_search_knowledge_base(message)
        local_score = local_results[0]["score"] if local_results else 0
        related_docs = local_results[:3] if local_score >= 10 else []

        sources = []
        context = ""
        search_mode = "none"

        if local_score >= 10:
            search_mode = "local"
            context = "\n\n---\n\n".join(
                f"[{d['filename']}]\n{d['content']}" for d in related_docs
            )
            sources = list({d["filename"] for d in related_docs})
        elif local_score >= 5:
            try:
                ai_results = search_knowledge_base(message, top_k=3)
                if ai_results:
                    search_mode = "ai_vector"
                    context = "\n\n---\n\n".join(
                        f"[{d['filename']}]\n{d['content']}" for d in ai_results
                    )
                    sources = list({d["filename"] for d in ai_results})
                    related_docs = ai_results
            except Exception:
                pass

        resource_links = []
        resource_images = []
        try:
            site_res = find_artinazma_resources(message)
            resource_links = site_res.get("links", [])[:5]
            resource_images = site_res.get("images", [])[:3]
        except Exception:
            pass

        customer_context = ""
        if customer_id:
            try:
                customer_context = get_customer_cross_session_context(int(customer_id))
            except Exception:
                pass

        allow_web_search = question_intent in (
            "technical_general", "troubleshooting", "standard_method",
            "comparison", "equipment_recommendation",
        )

        await _send_safe(ws, {
            "type": "meta",
            "request_id": request_id,
            "detected_domain": detected_domain,
            "sources": sources,
            "resource_links": resource_links,
            "resource_images": resource_images,
            "search_mode": search_mode,
            "web_search_used": allow_web_search,
            "question_intent": question_intent,
            "question_intent_label": question_intent_label,
        })

        full_answer = ""
        try:
            for chunk in ask_expert_assistant_stream(
                message=message,
                context=context,
                history=history,
                domain=detected_domain,
                allow_web_search=allow_web_search,
                customer_context=customer_context,
            ):
                full_answer += chunk
                await _send_safe(ws, {
                    "type": "chunk",
                    "request_id": request_id,
                    "text": chunk,
                })
        except Exception as exc:
            err_msg = f"Server error: {type(exc).__name__}"
            await _send_safe(ws, {"type": "error", "request_id": request_id, "message": err_msg})
            full_answer = err_msg

        question_id = None
        memory_id = None
        try:
            question_id = save_expert_question(
                question=message,
                answer=full_answer,
                sources=sources,
                detected_domain=detected_domain,
            )
            if customer_id and customer_id != "anonymous":
                memory_id = save_user_memory(
                    user_id=customer_id,
                    question=message,
                    answer=full_answer,
                    detected_domain=detected_domain,
                    memory_type="chat",
                    metadata={"question_id": question_id, "sources": sources},
                )
            if session_id and customer_id:
                save_chat_message(int(session_id), "user", message)
                save_chat_message(int(session_id), "assistant", full_answer)
        except Exception as e:
            logger.warning("DB save error: %s", e)

        await _send_safe(ws, {
            "type": "done",
            "request_id": request_id,
            "question_id": question_id,
            "memory_id": memory_id,
        })

    except Exception as e:
        logger.error("Chat processing error: %s", e)
        await _send_safe(ws, {
            "type": "error",
            "request_id": request_id,
            "message": "Internal server error",
        })
    finally:
        await _send_safe(ws, {"type": "typing_stop", "request_id": request_id})


def get_active_connection_count() -> int:
    return len(_active_connections)
