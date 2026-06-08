import re as _re
from typing import Optional, List
from pydantic import BaseModel, field_validator


class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryMessage]] = None
    domain: Optional[str] = "auto"
    response_mode: Optional[str] = "auto"
    user_id: Optional[str] = "anonymous"
    customer_id: Optional[int] = None
    context: Optional[str] = None  # External context (e.g. from analyze page)


class SuggestQuestionsRequest(BaseModel):
    question: str
    answer: str
    domain: str = "auto"


class GoogleDriveSyncRequest(BaseModel):
    root_folder_id: str = ""
    max_files: int = 200
    force_resync: bool = False


class KnowledgeSearchRequest(BaseModel):
    message: str
    domain: Optional[str] = "auto"
    history: Optional[List[ChatHistoryMessage]] = None
    category: Optional[str] = None   # filter by category (None = all)
    top_k: Optional[int] = 10        # number of results


class ChunkUpdateRequest(BaseModel):
    chunk_index: int  # global index in store
    content: str
    title: str | None = None


class MemorySearchRequest(BaseModel):
    user_id: str
    query: str = ""
    limit: int = 50


class QuestionReviewRequest(BaseModel):
    expert_status: str
    expert_note: str = ""
    reviewed_answer: str = ""


class FeedbackRequest(BaseModel):
    rating: str  # "up" or "down"
    comment: str = ""


class CustomerRequestCreate(BaseModel):
    full_name: str
    company: str = ""
    phone: str
    email: str = ""
    request_type: str = "consultation"
    subject: str = ""
    message: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not _re.match(r"^[0-9+\-() ]{7,20}$", v):
            raise ValueError("شماره تماس معتبر نیست.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if v:
            if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
                raise ValueError("آدرس ایمیل معتبر نیست.")
        return v

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("متن پیام باید حداقل ۱۰ کاراکتر باشد.")
        return v


class CustomerRequestStatusUpdate(BaseModel):
    status: str


class CustomerRequestCrmUpdate(BaseModel):
    priority: str = "normal"
    internal_note: str = ""
    assigned_to: str = ""
    follow_up_at: str = ""


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
        if not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("آدرس ایمیل معتبر نیست.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("رمز عبور باید حداقل ۶ کاراکتر باشد.")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if v:
            if not _re.match(r"^[0-9+\-() ]{7,20}$", v):
                raise ValueError("شماره تماس معتبر نیست.")
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


class CustomerNotifyRequest(BaseModel):
    message: str


class PushSubscribeRequest(BaseModel):
    customer_id: int
    subscription: dict


class PushUnsubscribeRequest(BaseModel):
    customer_id: int


class GDriveSyncScheduleRequest(BaseModel):
    interval_hours: float  # 0 = disabled


class EmailSettingsRequest(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    from_addr: str = ""
    to_addr: str = ""
    weekly_enabled: bool = False
    request_alerts_enabled: bool = True


class TelegramSettingsRequest(BaseModel):
    bot_token: str = ""
    chat_id: str = ""
