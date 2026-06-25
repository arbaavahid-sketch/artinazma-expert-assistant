"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminUrl } from "@/lib/api";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
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
  metadata?: QuestionMetadata;
  expert_status: string;
  expert_note: string;
  reviewed_answer: string;
  created_at: string;
  updated_at: string | null;
};

type QuestionMetadata = {
  question_intent?: string;
  question_intent_label?: string;
  search_mode?: string;
  best_score?: number;
  web_search_used?: boolean;
  source_count?: number;
  resource_link_count?: number;
  resource_image_count?: number;
  response_mode?: string;
  answer_mode?: string;
  response_time_ms?: number;
};

function getStatusLabel(status: string, locale = "fa") {
  const isEn = locale === "en";
  if (status === "approved") return isEn ? "Approved" : "تایید شده";
  if (status === "needs_edit") return isEn ? "Needs edit" : "نیازمند اصلاح";
  if (status === "rejected") return isEn ? "Rejected" : "رد شده";
  return isEn ? "Pending review" : "در انتظار بررسی";
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

function getDomainLabel(domain: string, locale = "fa") {
  const isEn = locale === "en";
  if (domain === "general") return isEn ? "General" : "عمومی";
  if (domain === "catalyst") return isEn ? "Catalyst" : "کاتالیست";
  if (domain === "equipment") return isEn ? "Equipment" : "تجهیزات";
  if (domain === "chromatography") return isEn ? "Chromatography" : "کروماتوگرافی";
  if (domain === "mercury-analysis") return isEn ? "Mercury analysis" : "آنالیز جیوه";
  if (domain === "sulfur-analysis") return isEn ? "Sulfur analysis" : "آنالیز سولفور";
  if (domain === "troubleshooting") return isEn ? "Troubleshooting" : "عیب‌یابی";
  if (domain === "analysis") return isEn ? "Analysis and testing" : "آنالیز و تست";
  if (domain === "sales") return isEn ? "Sales" : "فروش";
  if (domain === "petroleum") return isEn ? "Petroleum" : "نفت و پتروشیمی";
  if (domain === "technical_general") return isEn ? "Technical general" : "فنی عمومی";
  return domain || (isEn ? "Auto detected" : "تشخیص خودکار");
}

function getIntentLabel(metadata?: QuestionMetadata, locale = "fa") {
  const intent = metadata?.question_intent || "";
  if (locale === "fa") return metadata?.question_intent_label || intent || "-";

  const labels: Record<string, string> = {
    sales: "Sales",
    technical_general: "Technical general",
    equipment_recommendation: "Equipment recommendation",
    troubleshooting: "Troubleshooting",
    lab_analysis: "Lab analysis",
    product_info: "Product information",
    price_inquiry: "Price inquiry",
    customer_request: "Customer request",
    general: "General",
  };

  return labels[intent] || intent.replace(/_/g, " ") || "-";
}

function formatDate(value?: string | null, locale = "fa") {
  if (!value) return locale === "en" ? "Unknown" : "نامشخص";

  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatScore(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function formatMs(value?: number) {
  if (typeof value !== "number") return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

export default function QuestionDetailPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
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
      const res = await fetch(adminUrl(`/questions/${questionId}`), {
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
      const res = await fetch(adminUrl(`/questions/${questionId}/review`), {
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
        setSaveMessage(isEn ? "Expert review saved successfully." : "بررسی کارشناس با موفقیت ذخیره شد.");
        await loadQuestion();
      } else {
        setSaveMessageType("error");
        setSaveMessage(data.message || (isEn ? "Failed to save the review." : "خطا در ذخیره بررسی."));
      }
    } catch {
      setSaveMessageType("error");
      setSaveMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
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
        adminUrl(`/questions/${questionId}/add-to-knowledge`),
        {
          method: "POST",
        },
      );

      const data = await res.json();

      if (data.success) {
        setAddKnowledgeType("success");
        setAddKnowledgeMessage(
          isEn
            ? `Added to the knowledge base successfully. Added chunks: ${data.chunks_added}`
            : `با موفقیت به بانک دانش اضافه شد. تعداد بخش‌های اضافه‌شده: ${data.chunks_added}`,
        );
      } else {
        setAddKnowledgeType("error");
        setAddKnowledgeMessage(data.message || (isEn ? "Failed to add to the knowledge base." : "خطا در افزودن به بانک دانش."));
      }
    } catch {
      setAddKnowledgeType("error");
      setAddKnowledgeMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
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
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
        <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <RefreshCw
            className="mx-auto mb-4 animate-spin text-purple-700"
            size={28}
          />
          <div className="font-bold text-slate-700">
            {isEn ? "Loading question details..." : "در حال دریافت اطلاعات سوال..."}
          </div>
        </div>
      </section>
    );
  }

  if (!question) {
    return (
      <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
        <div className="mx-auto max-w-7xl rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          {isEn ? "Question not found." : "سوال موردنظر پیدا نشد."}
          <Link
            href="/admin/questions"
            className="mt-5 inline-flex rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
          >
            {isEn ? "Back to questions" : "بازگشت به سوالات"}
          </Link>
        </div>
      </section>
    );
  }

  const sources = question.sources || [];

  return (
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-purple-50 via-white to-slate-50 p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher variant="purple" />
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Link
                  href="/admin/questions"
                  className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ArrowRight size={17} />
                  {isEn ? "Back to questions" : "بازگشت به سوالات"}
                </Link>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700">
                    {isEn ? "Question" : "سوال"} #{question.id}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                      question.expert_status,
                    )}`}
                  >
                    {getStatusLabel(question.expert_status, locale)}
                  </span>

                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                    {getDomainLabel(question.detected_domain, locale)}
                  </span>
                </div>

                <h1 className="text-3xl font-black text-slate-900">
                  {isEn ? "User Question Review Details" : "جزئیات بررسی سوال کاربر"}
                </h1>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={15} />
                    {isEn ? "Created" : "ثبت"}: {formatDate(question.created_at, locale)}
                  </span>

                  {question.updated_at && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={15} />
                      {isEn ? "Updated" : "بروزرسانی"}: {formatDate(question.updated_at, locale)}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={loadQuestion}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <RefreshCw size={18} />
                {isEn ? "Refresh" : "بروزرسانی"}
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
                  {isEn ? "User Question" : "سوال کاربر"}
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
                    {isEn ? "Artin's Initial Answer" : "پاسخ اولیه آرتین"}
                  </h2>
                </div>

                <button
                  onClick={() => copyText(question.answer)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={16} />
                  {isEn ? "Copy" : "کپی"}
                </button>
              </div>

              <div className="whitespace-pre-wrap rounded-3xl bg-slate-50 p-5 leading-8 text-slate-800">
                {question.answer || (isEn ? "No answer has been registered." : "پاسخی ثبت نشده است.")}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Used Sources" : "منابع استفاده‌شده"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isEn
                      ? "Sources found in the knowledge base while answering."
                      : "منابعی که هنگام پاسخ‌گویی از بانک دانش پیدا شده‌اند."}
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
                        {source.title || (isEn ? "Untitled" : "بدون عنوان")}
                      </div>

                      <div className="mt-3 grid gap-2 text-sm leading-7 text-slate-600 md:grid-cols-3">
                        <div>
                          <span className="font-bold text-slate-900">
                            {isEn ? "File" : "فایل"}:
                          </span>{" "}
                          {source.file_name || "-"}
                        </div>

                        <div>
                          <span className="font-bold text-slate-900">
                            {isEn ? "Category" : "دسته"}:
                          </span>{" "}
                          {source.category || "-"}
                        </div>

                        <div>
                          <span className="font-bold text-slate-900">
                            {isEn ? "Score" : "امتیاز"}:
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
                  {isEn ? "No knowledge base source was found for this answer." : "برای این پاسخ منبعی از بانک دانش پیدا نشده است."}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {isEn ? "Answer Quality Metadata" : "متادیتای کیفیت پاسخ"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isEn
                      ? "Response-route data for reviewing quality, sources, and search mode."
                      : "داده‌های مسیر پاسخ‌دهی برای بررسی کیفیت، منابع و حالت جستجو."}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Intent", getIntentLabel(question.metadata, locale)],
                  ["Search mode", question.metadata?.search_mode || "-"],
                  ["Best score", formatScore(question.metadata?.best_score)],
                  ["Web search", question.metadata?.web_search_used ? "on" : "off"],
                  ["Sources", String(question.metadata?.source_count ?? sources.length)],
                  ["Resources", `${question.metadata?.resource_link_count ?? 0} links / ${question.metadata?.resource_image_count ?? 0} images`],
                  ["Answer mode", question.metadata?.answer_mode || "-"],
                  ["Response mode", question.metadata?.response_mode || "-"],
                  ["Response time", formatMs(question.metadata?.response_time_ms)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-xs font-bold uppercase text-slate-400">
                      {label}
                    </div>
                    <div className="mt-2 break-words text-sm font-black text-slate-800">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
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
                    {isEn ? "Expert Review" : "بررسی کارشناس"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isEn ? "Approve, edit, or reject the answer." : "پاسخ را تایید، اصلاح یا رد کنید."}
                  </p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-bold text-slate-700">
                {isEn ? "Review status" : "وضعیت بررسی"}
              </label>

              <select
                value={expertStatus}
                onChange={(e) => setExpertStatus(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none transition focus:border-purple-600"
              >
                <option value="pending">{isEn ? "Pending review" : "در انتظار بررسی"}</option>
                <option value="approved">{isEn ? "Approved" : "تایید شده"}</option>
                <option value="needs_edit">{isEn ? "Needs edit" : "نیازمند اصلاح"}</option>
                <option value="rejected">{isEn ? "Rejected" : "رد شده"}</option>
              </select>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                {isEn ? "Expert revised answer" : "پاسخ اصلاح‌شده کارشناس"}
              </label>

              <textarea
                value={reviewedAnswer}
                onChange={(e) => setReviewedAnswer(e.target.value)}
                className="h-72 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none transition focus:border-purple-600"
                placeholder={isEn ? "Enter the final expert-approved answer here..." : "پاسخ نهایی و تاییدشده کارشناس را اینجا وارد کنید..."}
              />

              <div className="mt-2 text-xs leading-6 text-slate-500">
                {isEn ? "If approved, this text can be added to the knowledge base." : "این متن در صورت تایید می‌تواند به بانک دانش اضافه شود."}
              </div>

              <label className="mb-2 mt-5 block text-sm font-bold text-slate-700">
                {isEn ? "Internal expert note" : "یادداشت داخلی کارشناس"}
              </label>

              <textarea
                value={expertNote}
                onChange={(e) => setExpertNote(e.target.value)}
                className="h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none transition focus:border-purple-600"
                placeholder={isEn ? "Example: The answer is good, but the device model should be clarified for the customer." : "مثلاً: پاسخ خوب است اما برای مشتری باید مدل دستگاه دقیق‌تر مشخص شود."}
              />

              <button
                onClick={saveReview}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white transition hover:bg-purple-800 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? (isEn ? "Saving..." : "در حال ذخیره...") : (isEn ? "Save review" : "ذخیره بررسی")}
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
                    {isEn ? "Add to Knowledge Base" : "افزودن به بانک دانش"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isEn ? "Only add approved answers to the knowledge base." : "فقط پاسخ تاییدشده را به بانک دانش اضافه کنید."}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                {isEn
                  ? "After the question status is saved as Approved, you can add the revised answer to the knowledge base for Artin to use in future answers."
                  : "وقتی وضعیت سوال روی «تایید شده» ذخیره شود، می‌توانید پاسخ اصلاح‌شده را وارد بانک دانش کنید تا آرتین در پاسخ‌های بعدی از آن استفاده کند."}
              </div>

              <button
                onClick={addToKnowledgeBase}
                disabled={
                  addingToKnowledge || question.expert_status !== "approved"
                }
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
              >
                <Database size={18} />
                {addingToKnowledge ? (isEn ? "Adding..." : "در حال افزودن...") : (isEn ? "Add to knowledge base" : "افزودن به بانک دانش")}
              </button>

              {question.expert_status !== "approved" && (
                <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">
                  {isEn
                    ? "To enable this button, first set the status to Approved and save the review."
                    : "برای فعال شدن این دکمه، ابتدا وضعیت را روی «تایید شده» بگذارید و بررسی را ذخیره کنید."}
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
                {isEn ? "Suggested Review Flow" : "روند پیشنهادی بررسی"}
              </h3>

              <div className="space-y-3 text-sm leading-7 text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-3">
                  {isEn ? "1. Compare Artin's initial answer with the user's question." : "1. پاسخ اولیه آرتین را با سوال کاربر مقایسه کنید."}
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  {isEn ? "2. Complete the revised answer if needed." : "2. اگر لازم بود پاسخ اصلاح‌شده را کامل‌تر کنید."}
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  {isEn ? "3. Set the status to Approved or Needs edit." : "3. وضعیت را روی تایید شده یا نیازمند اصلاح بگذارید."}
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  {isEn ? "4. Add the approved answer to the knowledge base." : "4. پاسخ تاییدشده را به بانک دانش اضافه کنید."}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
