// Customer data shapes and label/format helpers for the admin customers page.

export type Customer = {
  id: number;
  full_name: string;
  email: string;
  company: string;
  phone: string;
  created_at: string;
  session_count: number;
  message_count: number;
  last_active?: string | null;
  is_blocked?: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  last_message_preview?: string | null;
};

export type Session = {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  last_message_at?: string | null;
  first_user_message?: string | null;
};

export type CustomerSummary = {
  summary: {
    session_count: number;
    message_count: number;
    last_active: string | null;
    total_requests: number;
    open_requests: number;
    urgent_requests: number;
    overdue_follow_ups: number;
    due_today: number;
    unassigned_open: number;
    latest_request: {
      id: number;
      subject: string;
      request_type: string;
      status: string;
      priority: string;
      assigned_to: string;
      follow_up_at: string;
      created_at: string;
    } | null;
  };
  next_action: {
    title: string;
    reason: string;
    tone: "urgent" | "warning" | "success" | "neutral";
  };
};

export function formatDate(value?: string, locale = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function getActionToneClass(tone?: string) {
  if (tone === "urgent") return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  if (tone === "warning") return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  if (tone === "success") return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  return "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]";
}

export function getRequestStatusLabel(status: string, locale = "fa") {
  const isEn = locale === "en";
  if (status === "reviewing") return isEn ? "Reviewing" : "در حال بررسی";
  if (status === "pricing") return isEn ? "Pricing" : "قیمت‌گذاری";
  if (status === "sent") return isEn ? "Sent" : "ارسال‌شده";
  if (status === "closed") return isEn ? "Closed" : "بسته‌شده";
  return isEn ? "New" : "جدید";
}

export function getPriorityLabel(priority: string, locale = "fa") {
  const isEn = locale === "en";
  if (priority === "urgent") return isEn ? "Urgent" : "فوری";
  if (priority === "high") return isEn ? "High" : "بالا";
  if (priority === "low") return isEn ? "Low" : "کم";
  return isEn ? "Normal" : "عادی";
}
