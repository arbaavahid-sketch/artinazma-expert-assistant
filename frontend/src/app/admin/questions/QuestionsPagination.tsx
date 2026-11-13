"use client";

import { formatNumber, useI18n } from "@/lib/i18n";

/** Page buttons with ellipses: always the first and last page, and two on each side of the current one. */
export default function QuestionsPagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => onChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 2,
                )
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                    acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-[var(--text-subtle)]">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => onChange(p as number)}
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm transition ${
                        currentPage === p
                          ? "border-[var(--color-info-border)] bg-[var(--brand-fill)] text-white"
                          : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
                      }`}
                    >
                      {formatNumber(p as number, locale)}
                    </button>
                  ),
                )}

              <button
                onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              <span className="mr-2 text-sm text-[var(--text-subtle)]">
                {isEn ? `Page ${currentPage} of ${totalPages}` : `صفحه ${formatNumber(currentPage, locale)} از ${formatNumber(totalPages, locale)}`}
              </span>
            </div>
  );
}
