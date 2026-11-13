"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { getCategoryLabel } from "./knowledge-constants";
import {
  formatScoreBreakdown,
  normalizeSearchScore,
  type GroupedKnowledgeSearchResult,
  type KnowledgeSearchResult,
} from "./knowledge-types";

/** Results of the semantic search tester, grouped by source file. */
export default function KnowledgeSearchResults({
  results,
  onClear,
}: {
  results: KnowledgeSearchResult[];
  onClear: () => void;
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  const groupedTestResults = useMemo<GroupedKnowledgeSearchResult[]>(() => {
    const map = new Map<string, GroupedKnowledgeSearchResult>();

    for (const item of results) {
      const key = item.file_name || item.title;

      if (!map.has(key)) {
        map.set(key, {
          title: item.title,
          file_name: item.file_name,
          category: item.category,
          bestScore: Number(item.score || 0),
          chunks: [],
        });
      }

      const group = map.get(key)!;
      group.bestScore = Math.max(group.bestScore, Number(item.score || 0));
      group.chunks.push(item);
    }

    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [results]);

  return (
              <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[var(--foreground)]">
                      {isEn ? "Semantic Search Results" : "نتایج جست‌وجوی معنایی"}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-subtle)]">
                      {isEn
                        ? `${results.length} chunks from ${groupedTestResults.length} files, sorted by semantic similarity`
                        : `${results.length} chunk از ${groupedTestResults.length} فایل — مرتب‌شده بر اساس شباهت معنایی`}
                    </p>
                  </div>
                  <button
                    onClick={onClear}
                    className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                  >
                    {isEn ? "Clear" : "پاک کردن"}
                  </button>
                </div>

                <div className="space-y-4">
                  {groupedTestResults.map((group, gi) => {
                    const normalizedBestScore = normalizeSearchScore(group.bestScore);
                    const scoreColor =
                      normalizedBestScore >= 70 ? "bg-emerald-500" :
                      normalizedBestScore >= 40 ? "bg-[var(--brand-fill)]" :
                      normalizedBestScore >= 20 ? "bg-amber-500" : "bg-slate-400";
                    const scorePct = Math.min(100, Math.round(normalizedBestScore));
                    return (
                      <div
                        key={group.file_name}
                        className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5"
                      >
                        {/* Header row */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-info-bg)] text-xs font-black text-[var(--color-info-text)]">
                                {gi + 1}
                              </span>
                              <span className="text-base font-black text-[var(--foreground)] leading-snug">
                                {group.title || (isEn ? "Untitled" : "بدون عنوان")}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-subtle)]">
                              <span className="break-all">{group.file_name}</span>
                              <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 font-bold text-[var(--color-info-text)]">
                                {getCategoryLabel(group.category, locale)}
                              </span>
                              <span className="font-bold text-[var(--text-muted)]">
                                {isEn ? `${group.chunks.length} chunks` : `${group.chunks.length} chunk`}
                              </span>
                            </div>
                          </div>
                          {/* Score badge */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs font-bold text-[var(--text-subtle)]">
                              {isEn ? "Semantic similarity" : "شباهت معنایی"}
                            </span>
                            <span className="text-lg font-black text-[var(--foreground)]">
                              {normalizedBestScore.toFixed(1)}{isEn ? "%" : "٪"}
                            </span>
                          </div>
                        </div>
                        {/* Score bar */}
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                          <div
                            className={`h-full rounded-full transition-all ${scoreColor}`}
                            style={{ width: `${scorePct}%` }}
                          />
                        </div>
                        {/* Chunks */}
                        <div className="mt-4 space-y-3">
                          {group.chunks.slice(0, 3).map((chunk, index) => (
                            <div
                              key={`${group.file_name}-${index}`}
                              className="rounded-2xl bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--text-muted)]"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[var(--text-subtle)]">
                                  {isEn ? `Section ${index + 1}` : `بخش ${index + 1}`}
                                </span>
                                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-bold text-[var(--text-subtle)]">
                                  {normalizeSearchScore(Number(chunk.score)).toFixed(1)}{isEn ? "%" : "٪"}
                                </span>
                              </div>
                              {(chunk.score_reason || chunk.score_breakdown) && (
                                <div className="mb-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-[11px] leading-6 text-[var(--text-subtle)]">
                                  {chunk.score_reason && (
                                    <div className="font-bold text-[var(--text-muted)]">{chunk.score_reason}</div>
                                  )}
                                  {formatScoreBreakdown(chunk.score_breakdown) && (
                                    <div>{formatScoreBreakdown(chunk.score_breakdown)}</div>
                                  )}
                                </div>
                              )}
                              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-7">
                                {chunk.content}
                              </div>
                            </div>
                          ))}
                          {group.chunks.length > 3 && (
                            <div className="text-center text-xs text-[var(--text-subtle)]">
                              {isEn
                                ? `+${group.chunks.length - 3} more chunks in this file`
                                : `+${group.chunks.length - 3} chunk دیگر در این فایل`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
  );
}
