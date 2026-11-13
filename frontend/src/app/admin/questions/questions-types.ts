// Data shapes, filter options and label/format helpers for the admin questions list.

export type QuestionItem = {
  id: number;
  question: string;
  detected_domain: string;
  metadata?: QuestionMetadata;
  expert_status: string;
  user_rating: string;
  created_at: string;
  updated_at: string | null;
};

export type QuestionMetadata = {
  question_intent?: string;
  question_intent_label?: string;
  search_mode?: string;
  best_score?: number;
  web_search_used?: boolean;
  source_count?: number;
  answer_mode?: string;
  response_time_ms?: number;
  // Asker identity (set at save time from /chat and /analyze-*).
  user_id?: string;
  customer_id?: number | null;
  customer_name?: string;
  customer_email?: string;
  // Set for image/file analyses submitted from the assistant (analyze-image / analyze-file).
  analysis_type?: "image" | "file";
  image_url?: string;
  image_type_label?: string;
  file_url?: string;
  file_name?: string;
  test_type_label?: string;
};

export const statusOptions = [
  { value: "all", label: "همه وضعیت‌ها", labelEn: "All statuses" },
  { value: "pending", label: "در انتظار بررسی", labelEn: "Pending review" },
  { value: "approved", label: "تایید شده", labelEn: "Approved" },
  { value: "needs_edit", label: "نیازمند اصلاح", labelEn: "Needs edit" },
  { value: "rejected", label: "رد شده", labelEn: "Rejected" },
];

export const domainOptions = [
  { value: "all", label: "همه حوزه‌ها", labelEn: "All domains" },
  { value: "general", label: "عمومی", labelEn: "General" },
  { value: "catalyst", label: "کاتالیست", labelEn: "Catalyst" },
  { value: "equipment", label: "تجهیزات", labelEn: "Equipment" },
  { value: "chromatography", label: "کروماتوگرافی", labelEn: "Chromatography" },
  { value: "mercury-analysis", label: "آنالیز جیوه", labelEn: "Mercury analysis" },
  { value: "sulfur-analysis", label: "آنالیز سولفور", labelEn: "Sulfur analysis" },
  { value: "troubleshooting", label: "عیب‌یابی", labelEn: "Troubleshooting" },
  { value: "analysis", label: "آنالیز و تست", labelEn: "Analysis and testing" },
  { value: "sales", label: "فروش", labelEn: "Sales" },
  { value: "petroleum", label: "نفت و پتروشیمی", labelEn: "Petroleum" },
  { value: "technical_general", label: "فنی عمومی", labelEn: "Technical general" },
];

export const ratingOptions = [
  { value: "all", label: "همه امتیازها", labelEn: "All ratings" },
  { value: "up", label: "پسندیده شده", labelEn: "Liked" },
  { value: "down", label: "نپسندیده شده", labelEn: "Disliked" },
  { value: "unrated", label: "بدون امتیاز", labelEn: "Unrated" },
];

export function getStatusLabel(status: string, locale: "fa" | "en" = "fa") {
  if (status === "approved") return locale === "en" ? "Approved" : "تایید شده";
  if (status === "needs_edit") return locale === "en" ? "Needs edit" : "نیازمند اصلاح";
  if (status === "rejected") return locale === "en" ? "Rejected" : "رد شده";
  return locale === "en" ? "Pending review" : "در انتظار بررسی";
}

export function getStatusClass(status: string) {
  if (status === "approved")
    return "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]";
  if (status === "needs_edit")
    return "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]";
  if (status === "rejected") return "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]";
  return "bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-soft)]";
}

export function getDomainLabel(domain: string, locale: "fa" | "en" = "fa") {
  const found = domainOptions.find((d) => d.value === domain);
  if (found && found.value !== "all") return locale === "en" ? found.labelEn : found.label;
  return domain || (locale === "en" ? "Auto detected" : "تشخیص خودکار");
}

export function getAskerLabel(metadata?: QuestionMetadata, locale: "fa" | "en" = "fa") {
  if (metadata?.customer_name) return metadata.customer_name;
  if (metadata?.customer_email) return metadata.customer_email;
  if (metadata?.customer_id) return locale === "en" ? `Customer #${metadata.customer_id}` : `مشتری #${metadata.customer_id}`;
  const uid = metadata?.user_id || "";
  if (uid.startsWith("customer_")) return locale === "en" ? `Customer #${uid.slice(9)}` : `مشتری #${uid.slice(9)}`;
  if (!uid || uid === "anonymous") return locale === "en" ? "Guest" : "مهمان";
  return uid.length > 14 ? `${uid.slice(0, 12)}…` : uid;
}

export function getIntentLabel(metadata?: QuestionMetadata, locale: "fa" | "en" = "fa") {
  const intent = metadata?.question_intent || "";
  if (locale === "fa") return metadata?.question_intent_label || intent || "-";

  const labels: Record<string, string> = {
    sales: "Sales",
    technical_general: "Technical general",
    equipment_recommendation: "Equipment recommendation",
    troubleshooting: "Troubleshooting",
    lab_analysis: "Lab analysis",
    product_info: "Product information",
    price_inquiry: "Price inquiry",
    customer_request: "Customer request",
    general: "General",
  };

  return labels[intent] || intent.replace(/_/g, " ") || "-";
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

export function formatScore(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function formatMs(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}
