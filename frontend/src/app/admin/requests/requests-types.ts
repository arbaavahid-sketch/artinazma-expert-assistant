// Request data shapes, the status workflow, priorities, filters and helpers for the admin requests page.

export type CustomerRequest = {
  id: number;
  full_name: string;
  company: string;
  phone: string;
  email: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  internal_note: string;
  assigned_to: string;
  follow_up_at: string;
  created_at: string;
  updated_at: string | null;
  updates?: CustomerRequestUpdate[];
};

export type CustomerRequestUpdate = {
  id: number;
  message: string;
  file_name: string;
  file_url: string;
  created_at: string;
};

export const REQUEST_PRIORITIES = [
  {
    value: "low",
    label: "کم",
    labelEn: "Low",
    badgeClass: "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]",
    selectClass: "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)]",
  },
  {
    value: "normal",
    label: "عادی",
    labelEn: "Normal",
    badgeClass: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]",
    selectClass: "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  },
  {
    value: "high",
    label: "بالا",
    labelEn: "High",
    badgeClass: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    selectClass: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  },
  {
    value: "urgent",
    label: "فوری",
    labelEn: "Urgent",
    badgeClass: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]",
    selectClass: "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
  },
] as const;

export type RequestPriorityValue = (typeof REQUEST_PRIORITIES)[number]["value"];

export const PRIORITY_WEIGHT: Record<RequestPriorityValue, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

export const FOLLOW_UP_FILTERS = [
  { value: "all", label: "همه موعدها", labelEn: "All follow-ups" },
  { value: "overdue", label: "عقب‌افتاده", labelEn: "Overdue" },
  { value: "today", label: "امروز", labelEn: "Today" },
  { value: "upcoming", label: "آینده", labelEn: "Upcoming" },
  { value: "empty", label: "بدون موعد", labelEn: "No follow-up" },
] as const;

export const ASSIGNMENT_FILTERS = [
  { value: "all", label: "همه مسئول‌ها", labelEn: "All owners" },
  { value: "assigned", label: "مسئول‌دار", labelEn: "Assigned" },
  { value: "unassigned", label: "بدون مسئول", labelEn: "Unassigned" },
] as const;

export const REQUEST_SORT_OPTIONS = [
  { value: "follow_up_asc", label: "نزدیک‌ترین پیگیری", labelEn: "Nearest follow-up" },
  { value: "priority_desc", label: "اولویت بالاتر", labelEn: "Highest priority" },
  { value: "newest", label: "جدیدترین", labelEn: "Newest" },
  { value: "oldest", label: "قدیمی‌ترین", labelEn: "Oldest" },
] as const;

export type FollowUpFilterValue = (typeof FOLLOW_UP_FILTERS)[number]["value"];
export type AssignmentFilterValue = (typeof ASSIGNMENT_FILTERS)[number]["value"];
export type RequestSortValue = (typeof REQUEST_SORT_OPTIONS)[number]["value"];

export const REQUEST_WORKFLOW = [
  {
    value: "new",
    label: "جدید",
    labelEn: "New",
    actionLabel: "شروع بررسی",
    actionLabelEn: "Start review",
    badgeClass: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info-border)]",
    filterClass: "bg-[var(--color-info-bg)] text-[var(--color-info-text)] hover:bg-[var(--color-info-bg)]",
    activeClass: "bg-[var(--brand-fill)] text-white",
    cardClass: "border-[var(--color-info-border)] bg-[var(--color-info-bg)]/40 hover:bg-[var(--color-info-bg)]",
  },
  {
    value: "reviewing",
    label: "در حال بررسی",
    labelEn: "Reviewing",
    actionLabel: "ارسال به قیمت‌گذاری",
    actionLabelEn: "Send to pricing",
    badgeClass: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]",
    filterClass: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] hover:bg-[var(--color-warning-bg)]",
    activeClass: "bg-amber-500 text-white",
    cardClass: "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]/40 hover:bg-[var(--color-warning-bg)]",
  },
  {
    value: "pricing",
    label: "قیمت‌گذاری",
    labelEn: "Pricing",
    actionLabel: "ثبت ارسال پیشنهاد",
    actionLabelEn: "Mark proposal sent",
    badgeClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800",
    filterClass: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40",
    activeClass: "bg-purple-600 text-white",
    cardClass: "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40/30 hover:bg-purple-50 dark:hover:bg-purple-950/40",
  },
  {
    value: "sent",
    label: "ارسال‌شده",
    labelEn: "Sent",
    actionLabel: "بستن درخواست",
    actionLabelEn: "Close request",
    badgeClass: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]",
    filterClass: "bg-[var(--color-success-bg)] text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]",
    activeClass: "bg-emerald-600 text-white",
    cardClass: "border-[var(--color-success-border)] bg-[var(--color-success-bg)]/30 hover:bg-[var(--color-success-bg)]",
  },
  {
    value: "closed",
    label: "بسته‌شده",
    labelEn: "Closed",
    actionLabel: "بازگشایی",
    actionLabelEn: "Reopen",
    badgeClass: "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]",
    filterClass: "bg-[var(--surface-soft)] text-[var(--text-subtle)] hover:bg-[var(--surface-soft)]",
    activeClass: "bg-slate-500 text-white",
    cardClass: "border-[var(--border-soft)] bg-[var(--surface-soft)] hover:bg-[var(--surface)]",
  },
] as const;

export type RequestStatusValue = (typeof REQUEST_WORKFLOW)[number]["value"];

export const NEXT_STATUS: Partial<Record<RequestStatusValue, RequestStatusValue>> = {
  new: "reviewing",
  reviewing: "pricing",
  pricing: "sent",
  sent: "closed",
  closed: "new",
};

export function normalizeStatus(status: string): RequestStatusValue {
  if (status === "in_progress") return "reviewing";
  if (status === "done") return "sent";
  return REQUEST_WORKFLOW.some((item) => item.value === status)
    ? (status as RequestStatusValue)
    : "new";
}

export function getStatusMeta(status: string) {
  const normalized = normalizeStatus(status);
  return REQUEST_WORKFLOW.find((item) => item.value === normalized) || REQUEST_WORKFLOW[0];
}

export function getStatusLabel(status: string, locale: "fa" | "en" = "fa") {
  const meta = getStatusMeta(status);
  return locale === "en" ? meta.labelEn : meta.label;
}

export function getStatusClass(status: string) {
  return getStatusMeta(status).badgeClass;
}

export function normalizePriority(priority?: string): RequestPriorityValue {
  return REQUEST_PRIORITIES.some((item) => item.value === priority)
    ? (priority as RequestPriorityValue)
    : "normal";
}

export function getPriorityMeta(priority?: string) {
  const normalized = normalizePriority(priority);
  return REQUEST_PRIORITIES.find((item) => item.value === normalized) || REQUEST_PRIORITIES[1];
}

export function getTypeLabel(type: string, locale: "fa" | "en" = "fa") {
  const labels: Record<string, { fa: string; en: string }> = {
    equipment: { fa: "تجهیزات", en: "Equipment" },
    chemical: { fa: "مواد شیمیایی / افزودنی‌ها", en: "Chemicals / Additives" },
    catalyst: { fa: "کاتالیست / جاذب", en: "Catalyst / Adsorbent" },
    "test-analysis": { fa: "تحلیل تست", en: "Test analysis" },
    troubleshooting: { fa: "عیب‌یابی", en: "Troubleshooting" },
    "price-inquiry": { fa: "استعلام قیمت", en: "Price inquiry" },
  };
  return labels[type]?.[locale] || (locale === "en" ? "Technical consultation" : "مشاوره فنی");
}

export function formatDate(value?: string | null, locale: "fa" | "en" = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";

  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function getDateDayKey(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return date.toISOString().slice(0, 10);
}

export function getTodayDayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getFollowUpSortValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER - 1 : date.getTime();
}

/** Unsaved CRM edits for one request. */
export type CrmDraft = {
  priority: string;
  internal_note: string;
  assigned_to: string;
  follow_up_at: string;
};
