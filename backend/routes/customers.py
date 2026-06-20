import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from schemas.models import (
    CustomerRequestCreate,
    CustomerRequestStatusUpdate,
    CustomerRequestCrmUpdate,
    CustomerRegisterRequest,
    CustomerLoginRequest,
    CustomerProfileUpdateRequest,
    CustomerChangePasswordRequest,
    CustomerSessionCreateRequest,
    CustomerSessionUpdateRequest,
    CustomerChatMessageCreateRequest,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    MemorySearchRequest,
)
from utils.deps import limiter, require_admin

from db_service import (
    save_customer_request,
    get_customer_requests,
    get_customer_requests_for_contact,
    get_customer_request_for_contact_by_id,
    save_customer_request_update,
    get_customer_request_updates,
    get_customer_request_by_id,
    update_customer_request_status,
    update_customer_request_crm_fields,
    get_customer_request_stats,
    get_setting,
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    get_customer_by_contact,
    update_customer_profile,
    change_customer_password,
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    search_customer_chat_history,
    update_chat_session_title,
    delete_chat_session,
    delete_all_customer_chat_sessions,
    get_connection,
    save_customer_notification,
    get_customer_notifications,
    mark_notifications_read,
    get_unread_notification_count,
    save_push_subscription,
    remove_push_subscription,
    search_user_memories,
    get_user_memory_stats,
)
from telegram_service import (
    notify_new_customer,
    notify_new_request,
    notify_request_status_changed,
)
import threading
from auth_service import (
    create_access_token,
    get_current_customer,
    require_customer_match,
    set_jwt_cookie,
    clear_jwt_cookie,
)
from ws_ticket_service import create_ticket
from security_middleware import login_tracker

logger = logging.getLogger("artin_scheduler")

router = APIRouter()

REQUEST_UPDATE_UPLOAD_DIR = Path("uploads") / "customer_request_updates"
REQUEST_UPDATE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_REQUEST_UPDATE_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".csv",
    ".xlsx",
    ".xls",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}
MAX_REQUEST_UPDATE_FILE_SIZE = 10 * 1024 * 1024


REQUEST_STATUS_LABELS = {
    "new": "جدید",
    "reviewing": "در حال بررسی",
    "pricing": "قیمت‌گذاری",
    "sent": "ارسال‌شده",
    "closed": "بسته‌شده",
}


# -- Memory endpoints ---------------------------------------------------------

@router.post("/memory/search")
def memory_search(request: MemorySearchRequest):
    return {
        "memories": search_user_memories(
            user_id=request.user_id, query=request.query, limit=request.limit
        )
    }


@router.get("/memory/stats/{user_id}")
def memory_stats(user_id: str):
    return get_user_memory_stats(user_id)


# -- Customer Requests --------------------------------------------------------

@router.post("/customer-requests", tags=["Customers"], summary="Submit inquiry/request")
def create_customer_request(request: CustomerRequestCreate):
    request_id = save_customer_request(
        full_name=request.full_name,
        company=request.company,
        phone=request.phone,
        email=request.email,
        request_type=request.request_type,
        subject=request.subject,
        message=request.message,
    )
    notify_new_request(
        full_name=request.full_name,
        company=request.company or "",
        phone=request.phone or "",
        subject=request.subject or "",
        request_type=request.request_type or "",
    )

    # Fire-and-forget email notifications (non-blocking)
    if request.email and request.email.strip():
        def _send_confirmation():
            try:
                from email_service import get_email_settings, send_customer_request_confirmation
                settings = get_email_settings(get_setting)
                send_customer_request_confirmation(
                    settings=settings,
                    to_addr=request.email.strip(),
                    full_name=request.full_name or "",
                    subject=request.subject or "",
                    request_type=request.request_type or "general",
                )
            except Exception as exc:
                logger.warning("Confirmation email error: %s", exc)
        threading.Thread(target=_send_confirmation, daemon=True).start()

    def _send_admin_alert():
        try:
            from email_service import get_email_settings, send_new_customer_request_admin_alert
            settings = get_email_settings(get_setting)
            send_new_customer_request_admin_alert(
                settings=settings,
                request_id=request_id,
                full_name=request.full_name or "",
                company=request.company or "",
                phone=request.phone or "",
                email=request.email or "",
                request_type=request.request_type or "",
                subject=request.subject or "",
                message=request.message or "",
            )
        except Exception as exc:
            logger.warning("Admin request alert email error: %s", exc)

    threading.Thread(target=_send_admin_alert, daemon=True).start()

    return {
        "success": True,
        "request_id": request_id,
        "message": "Request submitted successfully.",
    }


@router.get("/customer-requests", tags=["Admin"], summary="List customer requests")
def customer_requests(limit: int = 100, _=Depends(require_admin)):
    return {"requests": get_customer_requests(limit=limit)}


@router.patch("/customer-requests/{request_id}/status")
def customer_request_status(request_id: int, request: CustomerRequestStatusUpdate, _=Depends(require_admin)):
    updated = update_customer_request_status(request_id=request_id, status=request.status)
    if not updated:
        return {"success": False, "message": "Request not found."}

    updated_request = get_customer_request_by_id(request_id)
    if updated_request:
        status_label = REQUEST_STATUS_LABELS.get(
            updated_request.get("status", ""),
            updated_request.get("status", ""),
        )
        notify_request_status_changed(
            request_id=request_id,
            full_name=updated_request.get("full_name", ""),
            subject=updated_request.get("subject", ""),
            status_label=status_label,
        )
        customer = get_customer_by_contact(
            email=updated_request.get("email", ""),
            phone=updated_request.get("phone", ""),
        )
        if customer:
            subject = updated_request.get("subject") or f"#{request_id}"
            save_customer_notification(
                customer["id"],
                f"وضعیت درخواست «{subject}» به «{status_label}» تغییر کرد.",
                sender="system",
            )

    return {"success": True, "message": "Status updated."}


@router.patch("/customer-requests/{request_id}/crm")
def customer_request_crm(request_id: int, request: CustomerRequestCrmUpdate, _=Depends(require_admin)):
    updated = update_customer_request_crm_fields(
        request_id=request_id,
        priority=request.priority,
        internal_note=request.internal_note,
        assigned_to=request.assigned_to,
        follow_up_at=request.follow_up_at,
    )
    if not updated:
        return {"success": False, "message": "Request not found."}

    return {"success": True, "message": "CRM fields updated."}


@router.get("/customer-requests/stats")
def customer_requests_stats(_=Depends(require_admin)):
    return get_customer_request_stats()


# -- Customer Auth & Profile --------------------------------------------------

@router.get("/customers/stats")
def customers_stats():
    with get_connection() as conn:
        cursor = conn.cursor()
        total_customers = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
        total_sessions = cursor.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]
        total_messages = cursor.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
        new_requests = cursor.execute(
            "SELECT COUNT(*) FROM customer_requests WHERE status='new'"
        ).fetchone()[0]
    return {
        "total_customers": total_customers,
        "total_sessions": total_sessions,
        "total_messages": total_messages,
        "new_requests": new_requests,
    }


@router.post("/customers/register", tags=["Customers"], summary="Register new customer")
@limiter.limit("5/minute")
def customer_register(body: CustomerRegisterRequest, request: Request):
    if not body.full_name.strip():
        return {"success": False, "message": "Full name is required."}
    if not body.email.strip():
        return {"success": False, "message": "Email is required."}
    if len(body.password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters."}

    result = create_customer(
        full_name=body.full_name,
        email=body.email,
        password=body.password,
        company=body.company,
        phone=body.phone,
    )
    if not result.get("success"):
        return result

    customer = get_customer_by_id(result["customer_id"])
    notify_new_customer(
        full_name=body.full_name,
        email=body.email,
        company=body.company or "",
    )
    token = create_access_token(customer_id=result["customer_id"], email=body.email)

    response = JSONResponse({
        "success": True,
        "message": "Registration successful.",
        "customer": customer,
        "access_token": token,
        "token_type": "bearer",
    })
    set_jwt_cookie(response, token)
    return response


@router.post("/customers/login", tags=["Customers"], summary="Customer login")
@limiter.limit("10/minute")
def customer_login(body: CustomerLoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"

    if login_tracker.is_locked(ip):
        remaining = login_tracker.get_remaining_lockout(ip)
        return {
            "success": False,
            "message": f"Too many failed attempts. Please wait {remaining // 60} minutes.",
            "locked": True,
            "retry_after": remaining,
        }

    customer = authenticate_customer(email=body.email, password=body.password)
    if not customer:
        login_tracker.record_failure(ip)
        return {"success": False, "message": "Invalid email or password."}

    if customer.get("blocked"):
        return {"success": False, "message": "Account is blocked. Please contact support."}

    login_tracker.record_success(ip)
    token = create_access_token(customer_id=customer["id"], email=customer["email"])

    response = JSONResponse({
        "success": True,
        "message": "Login successful.",
        "customer": customer,
        "access_token": token,
        "token_type": "bearer",
    })
    set_jwt_cookie(response, token)
    return response


@router.post("/customers/ws-ticket", tags=["Customers"], summary="Issue one-time WebSocket ticket")
def customer_ws_ticket(current_user: dict = Depends(get_current_customer)):
    """Return a short-lived one-time ticket for WebSocket authentication."""
    ticket = create_ticket(
        customer_id=current_user["customer_id"],
        email=current_user["email"],
    )
    return {"ticket": ticket}


@router.post("/customers/logout", tags=["Customers"], summary="Customer logout")
def customer_logout():
    """Clear the JWT cookie to log the customer out."""
    response = JSONResponse({"success": True, "message": "Logged out successfully."})
    clear_jwt_cookie(response)
    return response


@router.get("/customers/{customer_id}", tags=["Customers"], summary="Get customer profile")
def customer_profile(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"success": False, "message": "Customer not found."}
    return {"success": True, "customer": customer}


@router.patch("/customers/{customer_id}", tags=["Customers"], summary="Update customer profile")
def customer_profile_update(customer_id: int, request: CustomerProfileUpdateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    updated_customer = update_customer_profile(
        customer_id=customer_id,
        full_name=request.full_name,
        company=request.company,
        phone=request.phone,
    )
    if not updated_customer:
        return {"success": False, "message": "Customer not found or name missing."}
    return {
        "success": True,
        "message": "Profile updated successfully.",
        "customer": updated_customer,
    }


@router.post("/customers/{customer_id}/change-password", tags=["Customers"], summary="Change password")
def customer_change_password(customer_id: int, request: CustomerChangePasswordRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    result = change_customer_password(
        customer_id=customer_id,
        current_password=request.current_password,
        new_password=request.new_password,
    )
    return result


@router.get("/customers/{customer_id}/requests", tags=["Customers"], summary="List customer request history")
def customer_request_history(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"success": False, "requests": [], "total": 0}

    requests = get_customer_requests_for_contact(
        email=customer.get("email", ""),
        phone=customer.get("phone", ""),
        limit=20,
    )
    return {"success": True, "requests": requests, "total": len(requests)}


def _customer_request_timeline(request_data: dict) -> list[dict]:
    status = request_data.get("status", "new")
    timeline = [
        {
            "key": "created",
            "label": "درخواست ثبت شد",
            "description": "درخواست شما در سامانه آرتین آزما ثبت شد.",
            "at": request_data.get("created_at", ""),
            "state": "done",
        }
    ]

    if status != "new":
        timeline.append({
            "key": "status",
            "label": REQUEST_STATUS_LABELS.get(status, status),
            "description": "وضعیت درخواست توسط تیم آرتین آزما به‌روزرسانی شده است.",
            "at": request_data.get("updated_at") or request_data.get("created_at", ""),
            "state": "done",
        })
    else:
        timeline.append({
            "key": "status",
            "label": "در انتظار بررسی",
            "description": "تیم آرتین آزما درخواست شما را بررسی خواهد کرد.",
            "at": "",
            "state": "current",
        })

    if request_data.get("follow_up_at"):
        timeline.append({
            "key": "follow_up",
            "label": "موعد پیگیری",
            "description": "برای این درخواست زمان پیگیری داخلی ثبت شده است.",
            "at": request_data.get("follow_up_at", ""),
            "state": "planned",
        })

    if status == "closed":
        timeline.append({
            "key": "closed",
            "label": "پرونده بسته شد",
            "description": "پیگیری این درخواست پایان یافته است.",
            "at": request_data.get("updated_at") or request_data.get("created_at", ""),
            "state": "done",
        })

    return timeline


def _safe_request_update_filename(file_name: str) -> str:
    suffix = Path(file_name or "").suffix.lower()
    if suffix not in ALLOWED_REQUEST_UPDATE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    base = Path(file_name).stem[:80] or "attachment"
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-") or "attachment"
    return f"{uuid.uuid4().hex}_{base}{suffix}"


@router.get("/customers/{customer_id}/requests/{request_id}", tags=["Customers"], summary="Get customer request detail")
def customer_request_detail(customer_id: int, request_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"success": False, "message": "Customer not found."}

    request_data = get_customer_request_for_contact_by_id(
        request_id=request_id,
        email=customer.get("email", ""),
        phone=customer.get("phone", ""),
    )
    if not request_data:
        raise HTTPException(status_code=404, detail="Request not found")

    return {
        "success": True,
        "request": request_data,
        "updates": get_customer_request_updates(request_id),
        "timeline": _customer_request_timeline(request_data),
    }


@router.post("/customers/{customer_id}/requests/{request_id}/updates", tags=["Customers"], summary="Add customer request update")
async def customer_request_update_create(
    customer_id: int,
    request_id: int,
    message: str = Form(""),
    file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_customer),
):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"success": False, "message": "Customer not found."}

    request_data = get_customer_request_for_contact_by_id(
        request_id=request_id,
        email=customer.get("email", ""),
        phone=customer.get("phone", ""),
    )
    if not request_data:
        raise HTTPException(status_code=404, detail="Request not found")
    if request_data.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Closed requests cannot be updated.")

    clean_message = (message or "").strip()
    if len(clean_message) < 3 and not file:
        raise HTTPException(status_code=400, detail="Message or file is required.")

    file_name = ""
    file_url = ""
    if file and file.filename:
        safe_name = _safe_request_update_filename(file.filename)
        content = await file.read()
        if len(content) > MAX_REQUEST_UPDATE_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File is too large.")
        file_path = REQUEST_UPDATE_UPLOAD_DIR / safe_name
        file_path.write_bytes(content)
        file_name = file.filename
        file_url = f"/uploads/customer_request_updates/{safe_name}"

    update_id = save_customer_request_update(
        request_id=request_id,
        customer_id=customer_id,
        message=clean_message or "فایل تکمیلی ارسال شد.",
        file_name=file_name,
        file_url=file_url,
    )
    save_customer_notification(
        customer_id,
        f"توضیح تکمیلی شما برای درخواست #{request_id} ثبت شد.",
        sender="system",
    )

    return {"success": True, "update_id": update_id, "message": "Update submitted."}


# -- Chat Sessions ------------------------------------------------------------

@router.get("/customers/{customer_id}/chat-sessions", tags=["Chat Sessions"], summary="List chat sessions")
def customer_chat_sessions(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return {"success": True, "sessions": get_customer_chat_sessions(customer_id)}


@router.get("/customers/{customer_id}/chat-history/search", tags=["Chat Sessions"], summary="Search chat history")
def customer_chat_history_search(
    customer_id: int,
    q: str = "",
    limit: int = 20,
    current_user: dict = Depends(get_current_customer),
):
    require_customer_match(current_user["customer_id"], customer_id)
    results = search_customer_chat_history(customer_id, q, limit=limit)
    return {"success": True, "query": q, "total": len(results), "results": results}


@router.post("/customers/chat-sessions", tags=["Chat Sessions"], summary="Create chat session")
def customer_chat_session_create(request: CustomerSessionCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], request.customer_id)
    session_id = create_chat_session(
        customer_id=request.customer_id, title=request.title.strip() or "New Chat"
    )
    return {"success": True, "session_id": session_id}


@router.get("/customers/{customer_id}/analytics")
def customer_analytics(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    conn = get_connection()
    try:
        sessions = conn.execute(
            "SELECT COUNT(*) as cnt FROM chat_sessions WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()
        messages = conn.execute(
            "SELECT COUNT(*) as cnt FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.id WHERE cs.customer_id = ?",
            (customer_id,),
        ).fetchone()
        last_activity = conn.execute(
            "SELECT MAX(updated_at) as last FROM chat_sessions WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()
        return {
            "success": True,
            "total_sessions": sessions["cnt"] if sessions else 0,
            "total_messages": messages["cnt"] if messages else 0,
            "last_activity": last_activity["last"] if last_activity else None,
        }
    finally:
        conn.close()


@router.get("/customers/{customer_id}/chat-sessions/{session_id}/messages")
def customer_chat_session_messages(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return {
        "success": True,
        "messages": get_chat_messages(session_id=session_id, customer_id=customer_id),
    }


@router.post("/customers/chat-messages")
def customer_chat_message_create(request: CustomerChatMessageCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], request.customer_id)
    message_id = save_chat_message(
        session_id=request.session_id,
        role=request.role,
        content=request.content,
        metadata=request.metadata,
    )
    return {"success": True, "message_id": message_id}


@router.patch("/customers/chat-sessions/{session_id}")
def customer_chat_session_update(
    session_id: int, request: CustomerSessionUpdateRequest, current_user: dict = Depends(get_current_customer)
):
    require_customer_match(current_user["customer_id"], request.customer_id)
    updated = update_chat_session_title(
        session_id=session_id, customer_id=request.customer_id, title=request.title
    )
    if not updated:
        return {"success": False, "message": "Session not found."}
    return {"success": True, "message": "Session title updated."}


@router.delete("/customers/{customer_id}/chat-sessions/{session_id}")
def customer_chat_session_delete(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    deleted = delete_chat_session(session_id=session_id, customer_id=customer_id)
    if not deleted:
        return {"success": False, "message": "Session not found."}
    return {"success": True, "message": "Session deleted."}


@router.delete("/customers/{customer_id}/chat-sessions")
def customer_chat_sessions_delete_all(customer_id: int, _=Depends(require_admin)):
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    deleted_sessions = delete_all_customer_chat_sessions(customer_id)
    return {
        "success": True,
        "message": "All sessions deleted.",
        "deleted_sessions": deleted_sessions,
    }


# -- Notifications ------------------------------------------------------------

@router.get("/customers/{customer_id}/notifications")
def customer_notifications(customer_id: int, unread_only: bool = False, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    notifs = get_customer_notifications(customer_id, unread_only=unread_only)
    unread_count = get_unread_notification_count(customer_id)
    return {"notifications": notifs, "unread_count": unread_count}


@router.post("/customers/{customer_id}/notifications/read")
def mark_customer_notifications_read(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    mark_notifications_read(customer_id)
    return {"success": True}


# -- Push Notifications -------------------------------------------------------

@router.post("/customers/push-subscribe", tags=["Notifications"], summary="Subscribe to push notifications")
def push_subscribe(body: PushSubscribeRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], body.customer_id)
    sub_id = save_push_subscription(body.customer_id, body.subscription)
    return {"success": True, "subscription_id": sub_id}


@router.post("/customers/push-unsubscribe", tags=["Notifications"], summary="Unsubscribe from push notifications")
def push_unsubscribe(body: PushUnsubscribeRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], body.customer_id)
    remove_push_subscription(body.customer_id)
    return {"success": True}
