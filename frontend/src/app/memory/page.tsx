"use client";

import { useEffect, useState } from "react";
import { apiUrl, customerFetch } from "@/lib/api";
import { getSavedCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";

type MemoryItem = {
  id: number;
  question: string;
  answer: string;
  detected_domain: string;
  created_at: string;
};

export default function MemoryPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMemories, setTotalMemories] = useState(0);

  async function loadMemories(searchQuery = "") {
    setLoading(true);

    try {
      // The backend scopes results to the signed-in customer; POST needs the CSRF header.
      const res = await customerFetch(apiUrl("/memory/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "",
          query: searchQuery,
          limit: 50,
        }),
      });

      const data = await res.json();
      setMemories(data.memories || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const customer = getSavedCustomer();
    if (!customer) {
      setTotalMemories(0);
      return;
    }

    try {
      const res = await customerFetch(apiUrl(`/memory/stats/customer_${customer.id}`));
      const data = await res.json();
      setTotalMemories(data.total_memories || 0);
    } catch {
      setTotalMemories(0);
    }
  }

  useEffect(() => {
    loadMemories("");
    loadStats();
  }, []);

  function search() {
    loadMemories(query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      search();
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10" dir={dir}>
      <div className="rounded-[32px] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 text-sm font-bold text-[var(--color-info-text)]">
            {isEn ? "Artin personal memory" : "حافظه شخصی آرتین"}
          </div>

          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            {isEn ? "My previous answers" : "جواب‌های قبلی من"}
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-[var(--text-muted)]">
            {isEn
              ? "This section shows answers you received from Artin in this browser. You can search through your previous questions and answers."
              : "این بخش جواب‌هایی را نشان می‌دهد که با همین مرورگر از آرتین گرفته‌اید. می‌توانید بین سوالات و پاسخ‌های قبلی خودتان جست‌وجو کنید."}
          </p>
        </div>

        <div className="mb-6 rounded-3xl bg-[var(--surface-soft)] p-5">
          <div className="mb-3 text-sm text-[var(--text-muted)]">
            {isEn ? "Saved answers:" : "تعداد پاسخ‌های ذخیره‌شده:"}{" "}
            <span className="font-bold">{totalMemories}</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 outline-none focus:border-blue-600"
              placeholder={isEn ? "Example: sulfur, catalyst, baseline, mercury..." : "مثلاً: سولفور، کاتالیست، baseline، جیوه..."}
            />

            <button
              onClick={search}
              className="rounded-2xl bg-blue-700 px-6 py-4 font-medium text-white"
            >
              {isEn ? "Search" : "جست‌وجو"}
            </button>

            <button
              onClick={() => {
                setQuery("");
                loadMemories("");
              }}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-6 py-4 font-medium text-[var(--text-muted)]"
            >
              {isEn ? "Show all" : "نمایش همه"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-[var(--text-subtle)]">
            {isEn ? "Loading memory..." : "در حال دریافت حافظه..."}
          </div>
        ) : memories.length > 0 ? (
          <div className="space-y-4">
            {memories.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5"
              >
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--text-subtle)]">
                  <span>{isEn ? "Domain:" : "حوزه:"} {item.detected_domain || "general"}</span>
                  <span>{isEn ? "Time:" : "زمان:"} {item.created_at}</span>
                </div>

                <div className="rounded-2xl bg-[var(--surface)] p-4">
                  <div className="mb-2 text-sm font-bold text-[var(--text-subtle)]">
                    {isEn ? "Question" : "سوال"}
                  </div>
                  <div className="leading-8 text-[var(--foreground)]">
                    {item.question}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[var(--surface)] p-4">
                  <div className="mb-2 text-sm font-bold text-[var(--text-subtle)]">
                    {isEn ? "Artin answer" : "پاسخ آرتین"}
                  </div>
                  <div className="whitespace-pre-wrap leading-8 text-[var(--foreground)]">
                    {item.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-[var(--text-subtle)]">
            {isEn ? "No answers have been saved in your memory yet." : "هنوز پاسخی در حافظه شما ذخیره نشده است."}
          </div>
        )}
      </div>
    </section>
  );
}
