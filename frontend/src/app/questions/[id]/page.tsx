"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppNav from "@/components/AppNav";
import { apiUrl } from "@/lib/api";
type Source = {
  title: string;
  file_name: string;
  category: string;
  score: number;
};

type QuestionDetail = {
  id: number;
  question: string;
  answer: string;
  detected_domain: string;
  sources: Source[];
  expert_status: string;
  expert_note: string;
  reviewed_answer: string;
  created_at: string;
  updated_at: string | null;
};

function getStatusLabel(status: string) {
  if (status === "approved") return "تایید شده";
  if (status === "needs_edit") return "نیازمند اصلاح";
  if (status === "rejected") return "رد شده";
  return "در انتظار بررسی";
}

export default function QuestionDetailPage() {
  const params = useParams();
  const questionId = params.id as string;

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expertStatus, setExpertStatus] = useState("pending");
  const [expertNote, setExpertNote] = useState("");
  const [reviewedAnswer, setReviewedAnswer] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [addingToKnowledge, setAddingToKnowledge] = useState(false);
  const [addKnowledgeMessage, setAddKnowledgeMessage] = useState("");

  async function loadQuestion() {
    setLoading(true);
    setSaveMessage("");
    setAddKnowledgeMessage("");

    try {
      const res = await fetch(apiUrl(`/questions/${questionId}`))
      const data = await res.json();

      if (data.error) {
        setQuestion(null);
      } else {
        setQuestion(data);
        setExpertStatus(data.expert_status || "pending");
        setExpertNote(data.expert_note || "");
        setReviewedAnswer(data.reviewed_answer || data.answer || "");
      }
    } catch {
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveReview() {
    setSaving(true);
    setSaveMessage("");

    try {
      const res = await fetch(
        apiUrl(`/questions/${questionId}/review`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expert_status: expertStatus,
            expert_note: expertNote,
            reviewed_answer: reviewedAnswer,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setSaveMessage("بررسی کارشناس با موفقیت ذخیره شد.");
        await loadQuestion();
      } else {
        setSaveMessage(data.message || "خطا در ذخیره بررسی.");
      }
    } catch {
      setSaveMessage("خطا در اتصال به سرور.");
    } finally {
      setSaving(false);
    }
  }

  async function addToKnowledgeBase() {
    setAddingToKnowledge(true);
    setAddKnowledgeMessage("");

    try {
      const res = await fetch(
       apiUrl(`/questions/${questionId}/add-to-knowledge`),
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (data.success) {
        setAddKnowledgeMessage(
          `با موفقیت به بانک دانش اضافه شد. تعداد بخش‌های اضافه‌شده: ${data.chunks_added}`
        );
      } else {
        setAddKnowledgeMessage(data.message || "خطا در افزودن به بانک دانش.");
      }
    } catch {
      setAddKnowledgeMessage("خطا در اتصال به سرور.");
    } finally {
      setAddingToKnowledge(false);
    }
  }

  useEffect(() => {
    loadQuestion();
  }, [questionId]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-6xl px-6 py-10">
        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            در حال دریافت اطلاعات...
          </div>
        ) : !question ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            سوال موردنظر پیدا نشد.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold">
                  جزئیات سوال #{question.id}
                </h1>

                <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold">
                  {getStatusLabel(question.expert_status)}
                </span>
              </div>

              <div className="text-sm text-slate-500">
                حوزه: {question.detected_domain} | زمان ثبت:{" "}
                {question.created_at}
              </div>

              {question.updated_at && (
                <div className="mt-1 text-sm text-slate-500">
                  آخرین بروزرسانی: {question.updated_at}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">سوال کاربر</h2>
              <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-8">
                {question.question}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">پاسخ اولیه AI</h2>
              <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-8">
                {question.answer}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">منابع استفاده‌شده</h2>

              {question.sources.length > 0 ? (
                <div className="space-y-3">
                  {question.sources.map((source, index) => (
                    <div
                      key={index}
                      className="rounded-2xl bg-slate-50 p-4 text-sm"
                    >
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
              ) : (
                <p className="text-slate-500">
                  برای این پاسخ منبعی از بانک دانش پیدا نشده است.
                </p>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">بررسی کارشناس</h2>

              <label className="mb-2 block text-sm font-bold">
                وضعیت بررسی
              </label>

              <select
                value={expertStatus}
                onChange={(e) => setExpertStatus(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-blue-500"
              >
                <option value="pending">در انتظار بررسی</option>
                <option value="approved">تایید شده</option>
                <option value="needs_edit">نیازمند اصلاح</option>
                <option value="rejected">رد شده</option>
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold">
                پاسخ اصلاح‌شده کارشناس
              </label>

              <textarea
                value={reviewedAnswer}
                onChange={(e) => setReviewedAnswer(e.target.value)}
                className="h-72 w-full rounded-2xl border border-slate-300 p-4 leading-8 outline-none focus:border-blue-500"
              />

              <label className="mb-2 mt-5 block text-sm font-bold">
                یادداشت داخلی کارشناس
              </label>

              <textarea
                value={expertNote}
                onChange={(e) => setExpertNote(e.target.value)}
                className="h-32 w-full rounded-2xl border border-slate-300 p-4 leading-8 outline-none focus:border-blue-500"
                placeholder="مثلاً: پاسخ خوب است اما برای مشتری باید مدل دستگاه دقیق‌تر مشخص شود."
              />

              <button
                onClick={saveReview}
                disabled={saving}
                className="mt-5 rounded-2xl bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {saving ? "در حال ذخیره..." : "ذخیره بررسی"}
              </button>

              {saveMessage && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  {saveMessage}
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-2 font-bold">
                  افزودن پاسخ تاییدشده به بانک دانش
                </h3>

                <p className="mb-4 text-sm leading-7 text-slate-600">
                  وقتی پاسخ توسط کارشناس تایید شد، می‌توانید آن را به بانک دانش
                  اضافه کنید تا دستیار در پاسخ‌های بعدی از آن استفاده کند.
                </p>

                <button
                  onClick={addToKnowledgeBase}
                  disabled={
                    addingToKnowledge || question.expert_status !== "approved"
                  }
                  className="rounded-2xl bg-purple-700 px-5 py-3 font-medium text-white disabled:opacity-50"
                >
                  {addingToKnowledge
                    ? "در حال افزودن..."
                    : "افزودن به بانک دانش"}
                </button>

                {question.expert_status !== "approved" && (
                  <div className="mt-3 text-sm text-amber-700">
                    برای فعال شدن این دکمه، ابتدا وضعیت سوال را روی «تایید
                    شده» بگذارید و ذخیره کنید.
                  </div>
                )}

                {addKnowledgeMessage && (
                  <div className="mt-4 rounded-2xl bg-white p-4">
                    {addKnowledgeMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}