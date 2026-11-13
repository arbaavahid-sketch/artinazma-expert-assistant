// Types and pure helpers shared by the knowledge admin page and its sections.

export type KnowledgeFileDetail = {
  file_name: string;
  title: string;
  category: string;
  categories: string[];
  chunks: number;
  embedding_status?: "embedded" | "partial" | "missing";
  embedded_chunks?: number;
  missing_embedding_chunks?: number;
  source_exists?: boolean;
  source_size_kb?: number;
  source_updated_at?: string;
};

export type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
  file_details?: KnowledgeFileDetail[];
  category_breakdown?: { category: string; chunks: number; percent: number }[];
  backend?: string;
  embedding_model?: string;
  vector_store_exists?: boolean;
  vector_store_size_mb?: number;
  vector_store_updated_at?: string;
  last_sync?: string;
  last_sync_result?: string;
};

export type KnowledgeSearchResult = {
  title: string;
  file_name: string;
  category: string;
  score: number;
  score_reason?: string;
  score_breakdown?: Record<string, unknown>;
  content: string;
};

export type GroupedKnowledgeSearchResult = {
  title: string;
  file_name: string;
  category: string;
  bestScore: number;
  chunks: KnowledgeSearchResult[];
};
export type AuditEntry = {
  id: number;
  action: string;
  file_name: string;
  title: string;
  category: string;
  detail: string;
  performed_by: string;
  created_at: string;
};

export type DriveSyncResult = {
  success: boolean;
  status?: "added" | "unchanged" | "skipped";
  title: string;
  file_name?: string;
  category?: string;
  chunks_added?: number;
  message?: string;
  reason?: string;
  mime_type?: string;
  source_type?: string;
};

export type DriveSyncSummary = {
  generated_at?: string;
  by_status?: Record<string, number>;
  skipped_by_reason?: Record<string, number>;
  by_category?: Record<string, number>;
  has_errors?: boolean;
};

export function formatDateTime(value?: string, locale = "fa") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-US" : "fa-IR");
}

export function getEmbeddingLabel(status?: KnowledgeFileDetail["embedding_status"], locale = "fa") {
  const isEn = locale === "en";
  if (status === "partial") return isEn ? "Partial" : "ناقص";
  if (status === "missing") return isEn ? "Missing" : "ندارد";
  return isEn ? "Ready" : "آماده";
}

export function getEmbeddingBadgeClass(status?: KnowledgeFileDetail["embedding_status"]) {
  if (status === "partial") return "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  if (status === "missing") return "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]";
  return "bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
}

export function formatScoreBreakdown(breakdown?: Record<string, unknown>) {
  if (!breakdown || Object.keys(breakdown).length === 0) return "";
  const fields = [
    ["algorithm", "alg"],
    ["vector_score", "vector"],
    ["vector_rank", "v-rank"],
    ["keyword_score", "keyword"],
    ["keyword_rank", "k-rank"],
    ["bm25_score", "bm25"],
    ["exact_code_boost", "exact"],
    ["astm_boost", "astm"],
  ];
  return fields
    .filter(([key]) => breakdown[key] !== undefined && breakdown[key] !== null && breakdown[key] !== "")
    .map(([key, label]) => `${label}: ${String(breakdown[key])}`)
    .join(" · ");
}

export function normalizeSearchScore(score: number) {
  const value = Number(score || 0);
  return value > 1 ? value : value * 100;
}

export function getDriveStatusLabel(status?: string, success?: boolean, locale = "fa") {
  const isEn = locale === "en";
  if (status === "unchanged") return isEn ? "Unchanged" : "بدون تغییر";
  if (status === "added" || success) return isEn ? "Added" : "اضافه شد";
  return isEn ? "Skipped" : "رد شد";
}

export function buildDriveSyncSummary(results: DriveSyncResult[]): DriveSyncSummary {
  const by_status: Record<string, number> = {};
  const skipped_by_reason: Record<string, number> = {};
  const by_category: Record<string, number> = {};

  for (const item of results) {
    const status = item.status || (item.success ? "added" : "skipped");
    by_status[status] = (by_status[status] || 0) + 1;
    const category = item.category || "general";
    by_category[category] = (by_category[category] || 0) + 1;
    if (!item.success) {
      const reason = item.reason || item.message || "unknown";
      skipped_by_reason[reason] = (skipped_by_reason[reason] || 0) + 1;
    }
  }

  return {
    by_status,
    skipped_by_reason,
    by_category,
    has_errors: Object.keys(skipped_by_reason).length > 0,
  };
}
