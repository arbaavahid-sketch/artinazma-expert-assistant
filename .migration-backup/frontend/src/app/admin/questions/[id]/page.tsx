"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/api";
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  Copy,
  Database,
  FileText,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";

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

function getStatusClass(status: string) {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }

  if (status === "needs_edit") {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700 border-red-100";
  }

  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getDomainLabel(domain: string) {
  if (domain === "catalyst") return "کاتالیست";
  if (domain === "equipment") return "تجهیزات";
  if (domain === "chromatography") return "کروماتوگرافی";
  if (domain === "mercury-analysis") return "آنالیز جیوه";
  if (domain === "sulfur-analysis") return "آنالیز سولفور";
  if (domain === "troubleshooting") return "عیب‌یابی";
  if (domain === "analysis") return "آنالیز و تست";
  return domain || "تشخیص خودکار";
}

function formatDate(value?: string | null) {
  if (!value) return "نامشخص";

  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
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
  const [saveMessageType, setSaveMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [addingToKnowledge, setAddingToKnowledge] = useState(false);
  const [addKnowledgeMessage, setAddKnowledgeMessage] = useState("");
  const [addKnowledgeType, setAddKnowledgeType] = useState<
    "success" | "error" | ""
  >("");

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setSaveMessage("");
    setAddKnowledgeMessage("");

    try {
      const res = await fetch(apiUrl(`/questions/${questionId}`), {
        cache: "no-store",
      });

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
  }, [questionId]);

  async function saveReview() {
    setSaving(true);
    setSaveMessage("");
    setSaveMessageType("");

    try {
      const res = await fetch(apiUrl(`/questions/${questionId}/review`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expert_status: expertStatus,
          expert_note: expertNote,
          reviewed_answer: reviewedAnswer,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveMessageType("success");
        setSaveMessage("بررسی کارشناس با موفقیت ذخیره شد.");
        await loadQuestion();
      } else {
        setSaveMessageType("error");
        setSaveMessage(data.message || "خطا در ذخیره بررسی.");
      }
    } catch {
      setSaveMessageType("error");
      setSaveMessage("خطا در اتصال به سرور.");
    } finally {
      setSaving(false);
    }
  }

  async function addToKnowledgeBase() {
    setAddingToKnowledge(true);
    setAddKnowledgeMessage("");
    setAddKnowledgeType("");

    try {
      const res = await fetch(
        apiUrl(`/questions/${questionId}/add-to-knowledge`),
        {
          method: "POST",
        },
      );

      const data = await res.json();

      if (data.success) {
        setAddKnowledgeType("success");
        setAddKnowledgeMessage(
          `با موفقیت به بانک دانش اضافه شد. تعداد بخش‌های اضافه‌شده: ${data.chunks_added}`,
        );
      } else {
        setAddKnowledgeType("error");
        setAddKnowledgeMessage(data.message || "خطا در افزودن به بانک دانش.");
      }
    } catch {
      setAddKnowledgeType("error");
      setAddKnowledgeMessage("خطا در اتصال به سرور.");
    } finally {
      setAddingToKnowledge(false);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  useEffect(() => {
    loadQuestion();
  }, [loadQuestion]);

  if (loading) {
    return (
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-purple-700"
            size={28}
          />
          <div className="font-bold text-slate-700">
            در حال دریافت اطلاعات سوال...
          </div>
        </div>
      </section>
    );
  }

  if (!question) {
    return (
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          سوال موردنظر پیدا نشد.
          <Link
            href="/admin/questions"
            className="mt-5 inline-flex rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
          >
            بازگشت به سوالات
          </Link>
        </div>
      </section>
    );
  }

  const sources = question.sources || [];

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/admin/questions"
                  className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ArrowRight size={17} />
                  بازگشت به سوالات
                </Link>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                    سوال #{question.id}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                      question.expert_status,
                    )}`}
                  >
                    {getStatusLabel(question.expert_status)}
                  </span>

                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                    {getDomainLabel(question.detected_domain)}
                  </span>
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  جزئیات بررسی سوال کاربر
                </h1>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={15} />
                    ثبت: {formatDate(question.created_at)}
                  </span>

                  {question.updated_at && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={15} />
                      بروزرسانی: {formatDate(question.updated_at)}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={loadQuestion}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw size={18} />
                بروزرسانی
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <MessageSquareText size={22} />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  سوال کاربر
                </h2>
              </div>

              <div className="whitespace-pre-wrap rounded-3xl bg-slate-50 p-5 leading-8 text-slate-800">
                {question.question}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                    <FileText size={22} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    پاسخ اولیه آرتین
                  </h2>
                </div>

                <button
                  onClick={() => copyText(question.answer)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={16} />
                  کپی
                </button>
              </div>

              <div className="whitespace-pre-wrap rounded-3xl bg-slate-50 p-5 leading-8 text-slate-800">
                {question.answer || "پاسخی ثبت نشده است."}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    منابع استفاده‌شده
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    منابعی که هنگام پاسخ‌گویی از بانک دانش پیدا شده‌اند.
                  </p>
                </div>
              </div>

              {sources.length > 0 ? (
                <div className="space-y-3">
                  {sources.map((source, index) => (
                    <div
                      key={index}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="font-black text-slate-900">
                        {source.title || "بدون عنوان"}
                      </div>

                      <div className="mt-3 grid gap-2 text-sm leading-7 text-slate-600 md:grid-cols-3">
                        <div>
                          <span className="font-bold text-slate-900">
                            فایل:
                          </span>{" "}
                          {source.file_name || "-"}
                        </div>

                        <div>
                          <span className="font-bold text-slate-900">
                            دسته:
                          </span>{" "}
                          {source.category || "-"}
                        </div>

                        <div>
                          <span className="font-bold text-slate-900">
                            امتیاز:
                          </span>{" "}
                          {typeof source.score === "number"
                            ? source.score.toFixed(3)
                            : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-center text-slate-500">
                  برای این پاسخ منبعی از بانک دانش پیدا نشده است.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <BookOpenCheck size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    بررسی کارشناس
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    پاسخ را تایید، اصلاح یا رد کنید.
                  </p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-slate-700">
                وضعیت بررسی
              </label>

              <select
                value={expertStatus}
                onChange={(e) => setExpertStatus(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none transition focus:border-purple-600"
              >
                <option value="pending">در انتظار بررسی</option>
                <option value="approved">تایید شده</option>
                <option value="needs_edit">نیازمند اصلاح</option>
                <option value="rejected">رد شده</option>
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                پاسخ اصلاح‌شده کارشناس
              </label>

              <textarea
                value={reviewedAnswer}
                onChange={(e) => setReviewedAnswer(e.target.value)}
                className="h-72 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none transition focus:border-purple-600"
                placeholder="پاسخ نهایی و تاییدشده کارشناس را اینجا وارد کنید..."
              />

              <div className="mt-2 text-xs leading-6 text-slate-500">
                این متن در صورت تایید می‌تواند به بانک دانش اضافه شود.
              </div>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                یادداشت داخلی کارشناس
              </label>

              <textarea
                value={expertNote}
                onChange={(e) => setExpertNote(e.target.value)}
                className="h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none transition focus:border-purple-600"
                placeholder="مثلاً: پاسخ خوب است اما برای مشتری باید مدل دستگاه دقیق‌تر مشخص شود."
              />

              <button
                onClick={saveReview}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? "در حال ذخیره..." : "ذخیره بررسی"}
              </button>

              {saveMessage && (
                <div
                  className={`mt-4 rounded-2xl p-4 leading-7 ${
                    saveMessageType === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {saveMessage}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    افزودن به بانک دانش
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    فقط پاسخ تاییدشده را به بانک دانش اضافه کنید.
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                وقتی وضعیت سوال روی «تایید شده» ذخیره شود، می‌توانید پاسخ
                اصلاح‌شده را وارد بانک دانش کنید تا آرتین در پاسخ‌های بعدی از آن
                استفاده کند.
              </div>

              <button
                onClick={addToKnowledgeBase}
                disabled={
                  addingToKnowledge || question.expert_status !== "approved"
                }
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                <Database size={18} />
                {addingToKnowledge ? "در حال افزودن..." : "افزودن به بانک دانش"}
              </button>

              {question.expert_status !== "approved" && (
                <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                  برای فعال شدن این دکمه، ابتدا وضعیت را روی «تایید شده» بگذارید
                  و بررسی را ذخیره کنید.
                </div>
              )}

              {addKnowledgeMessage && (
                <div
                  className={`mt-4 rounded-2xl p-4 leading-7 ${
                    addKnowledgeType === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {addKnowledgeMessage}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-black text-slate-900">
                روند پیشنهادی بررسی
              </h3>

              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3">
                  1. پاسخ اولیه آرتین را با سوال کاربر مقایسه کنید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  2. اگر لازم بود پاسخ اصلاح‌شده را کامل‌تر کنید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  3. وضعیت را روی تایید شده یا نیازمند اصلاح بگذارید.
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  4. پاسخ تاییدشده را به بانک دانش اضافه کنید.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
