"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";

type Source = {
  title: string;
  file_name: string;
  category: string;
  score: number;
};

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      setAnswer(data.answer || "پاسخی دریافت نشد.");
      setSources(data.sources || []);
    } catch {
      setAnswer("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold">دستیار فنی آرتین آزما</h1>
          <p className="mb-6 text-slate-600">
            سوالات تخصصی درباره تجهیزات، کاتالیست، آنالیز، عیب‌یابی و انتخاب
            راهکار را اینجا بپرسید.
          </p>

          <textarea
            className="h-44 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-blue-500"
            placeholder="مثلاً: برای آنالیز سولفور در LPG چه راهکاری پیشنهاد می‌کنید؟"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "در حال پردازش..." : "ارسال سوال"}
          </button>

          {answer && (
            <div className="mt-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-8">
              {answer}
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-bold">منابع استفاده‌شده</h3>

              <div className="space-y-3">
                {sources.map((source, index) => (
                  <div key={index} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="font-bold">{source.title}</div>
                    <div className="mt-1 text-slate-600">
                      فایل: {source.file_name}
                    </div>
                    <div className="text-slate-600">
                      دسته‌بندی: {source.category}
                    </div>
                    <div className="text-slate-500">
                      امتیاز ارتباط: {source.score.toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}