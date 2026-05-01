"use client";
import { apiUrl } from "@/lib/api";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import Link from "next/link";
type KnowledgeStats = {
  total_chunks: number;
  total_files: number;
  files: string[];
  categories: string[];
};

type QuestionDomain = {
  domain: string;
  count: number;
};

type RecentQuestion = {
  id: number;
  question: string;
  detected_domain: string;
  created_at: string;
};

type QuestionStats = {
  total_questions: number;
  domains: QuestionDomain[];
  recent_questions: RecentQuestion[];
};

export default function DashboardPage() {
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);

  async function loadStats() {
    try {
      const knowledgeRes = await fetch(apiUrl("/knowledge/stats"))
      const knowledgeData = await knowledgeRes.json();
      setKnowledgeStats(knowledgeData);

      const questionRes = await fetch(apiUrl("/questions/stats"))
      const questionData = await questionRes.json();
      setQuestionStats(questionData);
    } catch {
      setKnowledgeStats(null);
      setQuestionStats(null);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">داشبورد مدیریتی</h1>
            <p className="mt-2 text-slate-600">
              وضعیت بانک دانش، سوالات کاربران و حوزه‌های پرتکرار
            </p>
          </div>

          <button
            onClick={loadStats}
            className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-medium text-white"
          >
            بروزرسانی داشبورد
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">فایل‌های بانک دانش</div>
            <div className="mt-3 text-4xl font-bold">
              {knowledgeStats?.total_files ?? 0}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">بخش‌های متنی</div>
            <div className="mt-3 text-4xl font-bold">
              {knowledgeStats?.total_chunks ?? 0}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">کل سوالات ثبت‌شده</div>
            <div className="mt-3 text-4xl font-bold">
              {questionStats?.total_questions ?? 0}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="text-sm text-slate-500">حوزه‌های سوال</div>
            <div className="mt-3 text-4xl font-bold">
              {questionStats?.domains.length ?? 0}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">حوزه‌های پرتکرار سوالات</h2>

            {questionStats && questionStats.domains.length > 0 ? (
              <div className="space-y-3">
                {questionStats.domains.map((item) => (
                  <div
                    key={item.domain}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
                  >
                    <span className="font-medium">{item.domain}</span>
                    <span className="rounded-xl bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">هنوز سوالی ثبت نشده است.</p>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">دسته‌بندی‌های بانک دانش</h2>

            {knowledgeStats && knowledgeStats.categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {knowledgeStats.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-2xl bg-slate-100 px-4 py-2 text-sm"
                  >
                    {category}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">هنوز دسته‌بندی ثبت نشده است.</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">آخرین سوالات کاربران</h2>

          {questionStats && questionStats.recent_questions.length > 0 ? (
            <div className="space-y-3">
              {questionStats.recent_questions.map((item) => (
                <Link
  key={item.id}
  href={`/questions/${item.id}`}
  className="block rounded-2xl bg-slate-50 p-4 hover:bg-blue-50"
>
                  <div className="font-medium leading-8">{item.question}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                    <span>حوزه: {item.detected_domain}</span>
                    <span>زمان: {item.created_at}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">هنوز سوالی ثبت نشده است.</p>
          )}
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">فایل‌های ثبت‌شده در بانک دانش</h2>

          {knowledgeStats && knowledgeStats.files.length > 0 ? (
            <ul className="space-y-3">
              {knowledgeStats.files.map((file) => (
                <li key={file} className="rounded-2xl bg-slate-50 p-4">
                  {file}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">هنوز فایلی ثبت نشده است.</p>
          )}
        </div>
      </section>
    </main>
  );
}