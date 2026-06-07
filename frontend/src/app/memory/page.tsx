"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";
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

    const userId = getOrCreateUserId();

    try {
      const res = await fetch(apiUrl("/memory/search"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
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
    const userId = getOrCreateUserId();

    try {
      const res = await fetch(apiUrl(`/memory/stats/${userId}`));
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
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 text-sm font-bold text-blue-700">
            {isEn ? "Artin personal memory" : "حافظه شخصی آرتین"}
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            {isEn ? "My previous answers" : "جواب‌های قبلی من"}
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-slate-600">
            {isEn
              ? "This section shows answers you received from Artin in this browser. You can search through your previous questions and answers."
              : "این بخش جواب‌هایی را نشان می‌دهد که با همین مرورگر از آرتین گرفته‌اید. می‌توانید بین سوالات و پاسخ‌های قبلی خودتان جست‌وجو کنید."}
          </p>
        </div>

        <div className="mb-6 rounded-3xl bg-slate-50 p-5">
          <div className="mb-3 text-sm text-slate-600">
            {isEn ? "Saved answers:" : "تعداد پاسخ‌های ذخیره‌شده:"}{" "}
            <span className="font-bold">{totalMemories}</span>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
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
              className="rounded-2xl border border-slate-300 bg-white px-6 py-4 font-medium text-slate-700"
            >
              {isEn ? "Show all" : "نمایش همه"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
            {isEn ? "Loading memory..." : "در حال دریافت حافظه..."}
          </div>
        ) : memories.length > 0 ? (
          <div className="space-y-4">
            {memories.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{isEn ? "Domain:" : "حوزه:"} {item.detected_domain || "general"}</span>
                  <span>{isEn ? "Time:" : "زمان:"} {item.created_at}</span>
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <div className="mb-2 text-sm font-bold text-slate-500">
                    {isEn ? "Question" : "سوال"}
                  </div>
                  <div className="leading-8 text-slate-900">
                    {item.question}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4">
                  <div className="mb-2 text-sm font-bold text-slate-500">
                    {isEn ? "Artin answer" : "پاسخ آرتین"}
                  </div>
                  <div className="whitespace-pre-wrap leading-8 text-slate-900">
                    {item.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
            {isEn ? "No answers have been saved in your memory yet." : "هنوز پاسخی در حافظه شما ذخیره نشده است."}
          </div>
        )}
      </div>
    </section>
  );
}
