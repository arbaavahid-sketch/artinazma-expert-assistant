"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { apiUrl } from "@/lib/api";
type QuestionItem = {
  id: number;
  question: string;
  detected_domain: string;
  expert_status: string;
  created_at: string;
  updated_at: string | null;
};

function getStatusLabel(status: string) {
  if (status === "approved") return "تایید شده";
  if (status === "needs_edit") return "نیازمند اصلاح";
  if (status === "rejected") return "رد شده";
  return "در انتظار بررسی";
}

function getStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  if (status === "needs_edit") return "bg-amber-100 text-amber-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadQuestions() {
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/questions?limit=100"));
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">سوالات کاربران</h1>
            <p className="mt-2 text-slate-600">
              سوالات ثبت‌شده، حوزه تشخیص داده‌شده و وضعیت بررسی کارشناس.
            </p>
          </div>

          <button
            onClick={loadQuestions}
            className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-medium text-white"
          >
            بروزرسانی
          </button>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-slate-500">در حال دریافت سوالات...</p>
          ) : questions.length > 0 ? (
            <div className="space-y-3">
              {questions.map((item) => (
                <Link
                  key={item.id}
                  href={`/questions/${item.id}`}
                  className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-blue-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-medium leading-8">
                        {item.question}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                        <span>شناسه: {item.id}</span>
                        <span>حوزه: {item.detected_domain}</span>
                        <span>زمان: {item.created_at}</span>
                      </div>
                    </div>

                    <span
                      className={`rounded-xl px-3 py-1 text-sm font-bold ${getStatusClass(
                        item.expert_status
                      )}`}
                    >
                      {getStatusLabel(item.expert_status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">هنوز سوالی ثبت نشده است.</p>
          )}
        </div>
      </section>
    </main>
  );
}