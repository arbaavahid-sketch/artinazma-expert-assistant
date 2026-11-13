// Data shapes and label/format helpers for the admin dashboard.

export type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

export type QuestionDomain = {
  domain: string;
  count: number;
};

export type RecentQuestion = {
  id: number;
  question: string;
  detected_domain: string;
  created_at: string;
};

export type QuestionStats = {
  total_questions: number;
  domains: QuestionDomain[];
  recent_questions: RecentQuestion[];
};

export type RequestStatus = {
  status: string;
  count: number;
};

export type RequestType = {
  request_type: string;
  count: number;
};

export type RequestStats = {
  total_requests: number;
  statuses: RequestStatus[];
  types: RequestType[];
  reminder_summary?: {
    overdue_follow_ups: number;
    due_today: number;
    stale_open: number;
    unassigned_open: number;
    total_attention: number;
  };
  reminders?: RequestReminder[];
};

export type RequestReminder = {
  id: number;
  full_name: string;
  company: string;
  request_type: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string;
  follow_up_at: string;
  created_at: string;
  updated_at: string;
  reason: string;
};

export type DailyCount = { day: string; count: number };
export type Keyword    = { word: string; count: number };
export type AnalyticsData = {
  daily:        DailyCount[];
  top_keywords: Keyword[];
  feedback:     { status: string; count: number }[];
  hourly:       { hour: number; count: number }[];
};

export type CacheStats = {
  total_entries: number;
  max_entries:   number;
  fill_pct:      number;
  ttl_hours:     number;
};

export type FeedbackStats = {
  total_questions: number;
  rated: number;
  up: number;
  down: number;
  unrated: number;
  satisfaction_pct: number | null;
};

export type ResponseTimeStats = {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  total_answered: number;
};

export type CustomerStats = {
  total_customers: number;
  total_sessions: number;
  total_messages: number;
  new_requests: number;
};

export type BusinessAnalytics = {
  days: number;
  frequent_questions: {
    question: string;
    count: number;
    domain: string;
    latest_question_id: number;
    latest_at: string;
  }[];
  top_products: { label: string; count: number }[];
  active_customers: {
    id: number;
    full_name: string;
    email: string;
    company: string;
    session_count: number;
    message_count: number;
    request_count: number;
    last_active: string | null;
    score: number;
  }[];
};

export const REQUEST_STATUS_LABELS: Record<string, { fa: string; en: string }> = {
  new: { fa: "جدید", en: "New" },
  reviewing: { fa: "در حال بررسی", en: "Reviewing" },
  pricing: { fa: "قیمت‌گذاری", en: "Pricing" },
  sent: { fa: "ارسال‌شده", en: "Sent" },
  closed: { fa: "بسته‌شده", en: "Closed" },
};

export function normalizeRequestStatus(status: string) {
  if (status === "in_progress") return "reviewing";
  if (status === "done") return "sent";
  return REQUEST_STATUS_LABELS[status] ? status : "new";
}

export function getStatusLabel(status: string, locale = "fa") {
  const label = REQUEST_STATUS_LABELS[normalizeRequestStatus(status)] || REQUEST_STATUS_LABELS.new;
  return locale === "en" ? label.en : label.fa;
}

export function getTypeLabel(type: string, locale = "fa") {
  const isEn = locale === "en";
  if (type === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (type === "chemical") return isEn ? "Chemicals / additives" : "مواد شیمیایی / افزودنی‌ها";
  if (type === "catalyst") return isEn ? "Catalyst / adsorbent" : "کاتالیست / جاذب";
  if (type === "test-analysis") return isEn ? "Test analysis" : "تحلیل تست";
  if (type === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (type === "price-inquiry") return isEn ? "Price inquiry" : "استعلام قیمت";
  return isEn ? "Technical consultation" : "مشاوره فنی";
}

export function getDomainLabel(domain: string, locale = "fa") {
  const isEn = locale === "en";
  if (domain === "general") return isEn ? "General" : "عمومی";
  if (domain === "catalyst") return isEn ? "Catalyst" : "کاتالیست";
  if (domain === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (domain === "chromatography") return isEn ? "Chromatography" : "کروماتوگرافی";
  if (domain === "mercury-analysis") return isEn ? "Mercury analysis" : "آنالیز جیوه";
  if (domain === "sulfur-analysis") return isEn ? "Sulfur analysis" : "آنالیز سولفور";
  if (domain === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (domain === "analysis") return isEn ? "Analysis and testing" : "آنالیز و تست";
  if (domain === "sales") return isEn ? "Sales" : "فروش";
  if (domain === "petroleum") return isEn ? "Petroleum" : "نفت و پتروشیمی";
  if (domain === "technical_general") return isEn ? "Technical general" : "فنی عمومی";
  return domain || (isEn ? "Auto detected" : "تشخیص خودکار");
}

export function getCategoryLabel(category: string, locale = "fa") {
  const isEn = locale === "en";
  if (category === "general") return isEn ? "General" : "عمومی";
  if (category === "catalyst") return isEn ? "Catalyst" : "کاتالیست";
  if (category === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (category === "chromatography") return isEn ? "Chromatography" : "کروماتوگرافی";
  if (category === "mercury-analysis") return isEn ? "Mercury analysis" : "آنالیز جیوه";
  if (category === "sulfur-analysis") return isEn ? "Sulfur analysis" : "آنالیز سولفور";
  if (category === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (category === "application-note") return isEn ? "Application note" : "اپلیکیشن نوت";
  if (category === "ASTM Standards") return isEn ? "ASTM Standards" : "استانداردهای ASTM";
  if (category === "expert-faq") return isEn ? "Approved FAQ" : "FAQ تاییدشده";
  return category || (isEn ? "Uncategorized" : "بدون دسته‌بندی");
}

export function formatDate(value?: string, locale = "fa") {
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

export function getStatusCount(stats: RequestStats | null, status: string) {
  const normalizedTarget = normalizeRequestStatus(status);
  return stats?.statuses?.reduce((total, item) => {
    return normalizeRequestStatus(item.status) === normalizedTarget
      ? total + item.count
      : total;
  }, 0) ?? 0;
}

export function getReminderReasonLabel(reason: string, locale = "fa") {
  const isEn = locale === "en";
  if (reason === "overdue_follow_up") return isEn ? "Overdue" : "موعد گذشته";
  if (reason === "due_today") return isEn ? "Due today" : "پیگیری امروز";
  if (reason === "stale_open") return isEn ? "Stale" : "معطل‌مانده";
  return isEn ? "Needs follow-up" : "نیازمند پیگیری";
}

export function getReminderReasonClass(reason: string) {
  if (reason === "overdue_follow_up") return "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]";
  if (reason === "due_today") return "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]";
  return "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]";
}

export function getPriorityLabel(priority: string, locale = "fa") {
  const isEn = locale === "en";
  if (priority === "urgent") return isEn ? "Urgent" : "فوری";
  if (priority === "high") return isEn ? "High" : "بالا";
  if (priority === "low") return isEn ? "Low" : "کم";
  return isEn ? "Normal" : "عادی";
}
