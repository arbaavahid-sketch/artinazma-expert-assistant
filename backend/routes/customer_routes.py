"""
روت‌های مشتریان — ثبت‌نام، ورود، پروفایل، چت‌ها، اعلان‌ها.
اندپوینت‌های محافظت‌شده نیاز به JWT دارند.
"""

from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from db_service import (
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    update_customer_profile,
    change_customer_password,
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    update_chat_session_title,
    delete_chat_session,
    get_customer_notifications,
    mark_notifications_read,
    get_unread_notification_count,
)
from auth_service import (
    create_access_token,
    get_current_customer,
    require_customer_match,
)
from telegram_service import notify_new_customer

router = APIRouter(prefix="/customers", tags=["customers"])


# ─── Models ────────────────────────────────────────────────────────────────

class CustomerRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    company: str = ""
    phone: str = ""

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        import re as _re
        if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("آدرس ایمیل معتبر نیست.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("رمز عبور باید حداقل ۶ کاراکتر باشد.")
        return v


class CustomerLoginRequest(BaseModel):
    email: str
    password: str


class CustomerProfileUpdateRequest(BaseModel):
    full_name: str
    company: str = ""
    phone: str = ""


class CustomerChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد.")
        return v


class CustomerSessionCreateRequest(BaseModel):
    customer_id: int
    title: str = "گفتگوی جدید"


class CustomerSessionUpdateRequest(BaseModel):
    customer_id: int
    title: str


class CustomerChatMessageCreateRequest(BaseModel):
    customer_id: int
    session_id: int
    role: str
    content: str
    metadata: dict = {}


# ─── Auth Endpoints ────────────────────────────────────────────────────────

@router.post("/register")
def customer_register(body: CustomerRegisterRequest, request: Request):
    if not body.full_name.strip():
        return {"success": False, "message": "نام و نام خانوادگی الزامی است."}
    if not body.email.strip():
        return {"success": False, "message": "ایمیل الزامی است."}
    if len(body.password) < 6:
        return {"success": False, "message": "رمز عبور باید حداقل ۶ کاراکتر باشد."}

    result = create_customer(
        full_name=body.full_name, email=body.email, password=body.password,
        company=body.company, phone=body.phone,
    )
    if not result.get("success"):
        return result

    customer = get_customer_by_id(result["customer_id"])
    token = create_access_token(customer_id=result["customer_id"], email=body.email)

    notify_new_customer(full_name=body.full_name, email=body.email, company=body.company or "")

    return {"success": True, "message": "ثبت‌نام با موفقیت انجام شد.", "customer": customer, "access_token": token, "token_type": "bearer"}


@router.post("/login")
def customer_login(body: CustomerLoginRequest, request: Request):
    customer = authenticate_customer(email=body.email, password=body.password)
    if not customer:
        return {"success": False, "message": "ایمیل یا رمز عبور اشتباه است."}
    if customer.get("blocked"):
        return {"success": False, "message": "حساب شما مسدود شده است. لطفاً با پشتیبانی تماس بگیرید."}

    token = create_access_token(customer_id=customer["id"], email=customer["email"])
    return {"success": True, "message": "ورود با موفقیت انجام شد.", "customer": customer, "access_token": token, "token_type": "bearer"}


# ─── Profile ───────────────────────────────────────────────────────────────

@router.get("/{customer_id}")
def customer_profile(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"success": False, "message": "مشتری پیدا نشد."}
    return {"success": True, "customer": customer}


@router.patch("/{customer_id}")
def customer_profile_update(customer_id: int, body: CustomerProfileUpdateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    updated = update_customer_profile(customer_id=customer_id, full_name=body.full_name, company=body.company, phone=body.phone)
    if not updated:
        return {"success": False, "message": "مشتری پیدا نشد یا نام وارد نشده است."}
    return {"success": True, "message": "اطلاعات حساب با موفقیت بروزرسانی شد.", "customer": updated}


@router.post("/{customer_id}/change-password")
def customer_change_password(customer_id: int, body: CustomerChangePasswordRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return change_customer_password(customer_id=customer_id, current_password=body.current_password, new_password=body.new_password)


# ─── Chat Sessions ─────────────────────────────────────────────────────────

@router.get("/{customer_id}/chat-sessions")
def customer_chat_sessions(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return {"success": True, "sessions": get_customer_chat_sessions(customer_id)}


@router.post("/chat-sessions")
def customer_chat_session_create(body: CustomerSessionCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], body.customer_id)
    session_id = create_chat_session(customer_id=body.customer_id, title=body.title.strip() or "گفتگوی جدید")
    return {"success": True, "session_id": session_id}


@router.get("/{customer_id}/chat-sessions/{session_id}/messages")
def customer_chat_session_messages(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    return {"success": True, "messages": get_chat_messages(session_id=session_id, customer_id=customer_id)}


@router.post("/chat-messages")
def customer_chat_message_create(body: CustomerChatMessageCreateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], body.customer_id)
    message_id = save_chat_message(session_id=body.session_id, role=body.role, content=body.content, metadata=body.metadata)
    return {"success": True, "message_id": message_id}


@router.patch("/chat-sessions/{session_id}")
def customer_chat_session_update(session_id: int, body: CustomerSessionUpdateRequest, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], body.customer_id)
    updated = update_chat_session_title(session_id=session_id, customer_id=body.customer_id, title=body.title)
    if not updated:
        return {"success": False, "message": "گفتگوی موردنظر پیدا نشد."}
    return {"success": True, "message": "نام گفتگو تغییر کرد."}


@router.delete("/{customer_id}/chat-sessions/{session_id}")
def customer_chat_session_delete(customer_id: int, session_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    deleted = delete_chat_session(session_id=session_id, customer_id=customer_id)
    if not deleted:
        return {"success": False, "message": "گفتگوی موردنظر پیدا نشد."}
    return {"success": True, "message": "گفتگو حذف شد."}


# ─── Notifications ─────────────────────────────────────────────────────────

@router.get("/{customer_id}/notifications")
def customer_notifications(customer_id: int, unread_only: bool = False, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    notifs = get_customer_notifications(customer_id, unread_only=unread_only)
    unread_count = get_unread_notification_count(customer_id)
    return {"notifications": notifs, "unread_count": unread_count}


@router.post("/{customer_id}/notifications/read")
def mark_customer_notifications_read_route(customer_id: int, current_user: dict = Depends(get_current_customer)):
    require_customer_match(current_user["customer_id"], customer_id)
    mark_notifications_read(customer_id)
    return {"success": True}
