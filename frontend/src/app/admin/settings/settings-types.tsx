// Data shapes and status helpers for the admin settings page.

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

export type SystemStatus = {
  backend_status: string;
  openai_configured: boolean;
  openai_status: string;
  openai_error: string;
  local_fallback_enabled: boolean;
  knowledge_stats: KnowledgeStats;
};

export function getAiStatusLabel(status: string, locale: string) {
  const isEn = locale === "en";
  if (status === "connected") return isEn ? "Connected" : "متصل";
  if (status === "failed") return isEn ? "Connection failed" : "خطا در اتصال";
  if (status === "not_configured") return isEn ? "Not configured" : "تنظیم نشده";
  if (status === "unknown") return isEn ? "Unknown" : "نامشخص";
  return isEn ? "Not tested" : "تست نشده";
}

export function getAiStatusClass(status: string) {
  if (status === "connected") {
    return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  }

  if (status === "failed") {
    return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  }

  if (status === "not_configured") {
    return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  }

  return "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)]";
}

export function getCategoryLabel(category: string, locale: string) {
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

export function getHealthTone(check?: DeepHealthCheck) {
  if (!check) return "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--text-muted)]";
  if (check.ok) return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  if (check.status === "not_configured") return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  return "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
}

export function getHealthIcon(check?: DeepHealthCheck) {
  if (!check) return <Clock size={16} />;
  if (check.ok) return <CheckCircle2 size={16} />;
  return <AlertCircle size={16} />;
}

export type GDriveSchedule = {
  interval_hours: number;
  enabled: boolean;
  last_sync: string;
  last_sync_result: string;
  folder_id_configured: boolean;
  sync_status?: string;
  sync_started_at?: string;
  sync_finished_at?: string;
};

export type DeepHealthCheck = {
  ok: boolean;
  status: string;
  configured?: boolean;
  enabled?: boolean;
  error?: string;
};

export type DeepHealth = {
  ok: boolean;
  response_ms: number;
  checks: Record<string, DeepHealthCheck>;
};

