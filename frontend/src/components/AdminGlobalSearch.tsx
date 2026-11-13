"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Loader2, Search, Users, Inbox } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type QResult = { id: number; question: string; detected_domain: string; created_at: string };
type CResult = { id: number; full_name: string; email: string; company: string };
type RResult = { id: number; full_name: string; subject: string; status: string; created_at: string };

type SearchResults = {
  questions: QResult[];
  customers: CResult[];
  requests: RResult[];
};

const EMPTY: SearchResults = { questions: [], customers: [], requests: [] };

export default function AdminGlobalSearch() {
  const router = useRouter();
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalResults =
    results.questions.length + results.customers.length + results.requests.length;

  // Fetch with debounce
  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(adminUrl(`/admin/search?q=${encodeURIComponent(q)}&limit=5`));
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults(EMPTY);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xs" dir={dir}>
      {/* Trigger */}
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex w-full items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-subtle)] shadow-sm transition hover:border-[var(--color-info-border)] hover:bg-[var(--surface)] dark:border-[var(--border-soft)] dark:bg-[var(--surface-raised)] dark:text-[var(--text-subtle)]"
      >
        <Search size={15} />
        <span className="flex-1 text-right">{isEn ? "Search..." : "جستجو..."}</span>
        <kbd className="hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-subtle)] dark:border-[var(--border-soft)] dark:bg-[var(--surface-raised-2)] sm:inline">
          Ctrl K
        </kbd>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-[200] mt-2 w-80 overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-2xl dark:border-[var(--border-soft)] dark:bg-[var(--surface)]">
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3 dark:border-[var(--border-soft)]">
            {loading ? (
              <Loader2 size={16} className="shrink-0 animate-spin text-[var(--color-info-text)]" />
            ) : (
              <Search size={16} className="shrink-0 text-[var(--text-subtle)]" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isEn ? "Search questions, customers, requests..." : "جستجو در سوالات، مشتریان، درخواست‌ها..."}
              className="flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-subtle)] dark:text-[var(--foreground)]"
              autoComplete="off"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults(EMPTY); inputRef.current?.focus(); }}
                aria-label={isEn ? "Clear search" : "پاک کردن جستجو"}
                className="shrink-0 text-xs text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query.length < 2 ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--text-subtle)]">
                {isEn ? "Enter at least 2 characters" : "حداقل ۲ کاراکتر وارد کنید"}
              </p>
            ) : !loading && totalResults === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[var(--text-subtle)]">
                {isEn ? "No results found" : "نتیجه‌ای یافت نشد"}
              </p>
            ) : (
              <div className="p-2">
                {/* Questions */}
                {results.questions.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase text-[var(--text-subtle)]">
                      <FileQuestion size={11} />
                      {isEn ? "Questions" : "سوالات"}
                    </div>
                    {results.questions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => navigate(`/admin/questions/${q.id}`)}
                        className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-right transition hover:bg-[var(--color-info-bg)]"
                      >
                        <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--color-info-bg)] px-1.5 py-0.5 text-[10px] font-black text-[var(--color-info-text)]">
                          #{q.id}
                        </span>
                        <span className="line-clamp-2 text-xs text-[var(--text-muted)] dark:text-[var(--text-subtle)]">
                          {q.question}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Customers */}
                {results.customers.length > 0 && (
                  <div className="mb-2">
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase text-[var(--text-subtle)]">
                      <Users size={11} />
                      {isEn ? "Customers" : "مشتریان"}
                    </div>
                    {results.customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/admin/customers`)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right transition hover:bg-[var(--color-info-bg)] dark:hover:bg-teal-950"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-info-bg)] text-xs font-black text-[var(--color-info-text)]">
                          {c.full_name?.[0] || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--foreground)] dark:text-[var(--foreground)]">
                            {c.full_name}
                          </p>
                          <p className="truncate text-[10px] text-[var(--text-subtle)]">{c.email || c.company}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Requests */}
                {results.requests.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase text-[var(--text-subtle)]">
                      <Inbox size={11} />
                      {isEn ? "Requests" : "درخواست‌ها"}
                    </div>
                    {results.requests.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/admin/requests`)}
                        className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-right transition hover:bg-[var(--color-success-bg)] dark:hover:bg-emerald-950"
                      >
                        <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--color-success-bg)] px-1.5 py-0.5 text-[10px] font-black text-[var(--color-success-text)]">
                          #{r.id}
                        </span>
                        <span className="line-clamp-1 text-xs text-[var(--text-muted)] dark:text-[var(--text-subtle)]">
                          {r.full_name} — {r.subject || (isEn ? "Request" : "درخواست")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
