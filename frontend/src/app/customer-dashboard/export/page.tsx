"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Loader2, Printer } from "lucide-react";
import { apiUrl, customerFetch } from "@/lib/api";
import { getSavedCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";

type ExportMessage = {
  role: "user" | "assistant" | string;
  content: string;
};

type SavedCustomer = {
  id: number;
  full_name?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeFileName(value: string) {
  return (value || "artinazma-chat")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function buildExportHtml({
  title,
  customerName,
  date,
  messages,
  isEn,
}: {
  title: string;
  customerName: string;
  date: string;
  messages: ExportMessage[];
  isEn: boolean;
}) {
  const msgHtml = messages
    .map((msg) => {
      const safe = escapeHtml(msg.content || "")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br/>");
      const isUser = msg.role === "user";
      return `<div class="bubble ${isUser ? "user" : "artin"}"><div class="label">${isUser ? (isEn ? "User" : "کاربر") : (isEn ? "Artin" : "آرتین")}</div><p>${safe}</p></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="${isEn ? "ltr" : "rtl"}" lang="${isEn ? "en" : "fa"}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} - ArtinAzma</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Tahoma, Arial, 'Segoe UI', sans-serif; background: #fff; color: #1e293b; padding: 40px; font-size: 13px; direction: ${isEn ? "ltr" : "rtl"}; }
  .header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 28px; }
  .header h1 { font-size: 18px; font-weight: 900; color: #1d4ed8; }
  .header .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
  .bubble { margin-bottom: 20px; padding: 14px 16px; border-radius: 16px; page-break-inside: avoid; }
  .bubble.user { background: #dbeafe; ${isEn ? "border-left" : "border-right"}: 4px solid #1d4ed8; }
  .bubble.artin { background: #f1f5f9; ${isEn ? "border-left" : "border-right"}: 4px solid #0ea5e9; }
  .label { font-size: 10px; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.05em; }
  .bubble.user .label { color: #1d4ed8; }
  .bubble.artin .label { color: #0ea5e9; }
  p { line-height: 2; white-space: pre-wrap; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media (max-width: 640px) { body { padding: 24px 18px; } }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${isEn ? "Customer" : "مشتری"}: ${escapeHtml(customerName)} | ${isEn ? "Date" : "تاریخ"}: ${escapeHtml(date)}</div>
</div>
${msgHtml}
<div class="footer">${isEn ? "ArtinAzma Mehr" : "آرتین آزما مهر"} - artinazma.net</div>
</body>
</html>`;
}

function CustomerDashboardExportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const sessionId = searchParams.get("session_id");
  const [customer, setCustomer] = useState<SavedCustomer | null>(null);
  const [messages, setMessages] = useState<ExportMessage[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getSavedCustomer();
    if (!saved) {
      router.replace("/customer-login");
      return;
    }
    const savedCustomer = saved;
    setCustomer(savedCustomer);

    if (!sessionId) {
      setError(isEn ? "Conversation was not selected." : "گفتگو انتخاب نشده است.");
      setLoading(false);
      return;
    }

    async function loadMessages() {
      setLoading(true);
      setError("");
      try {
        const res = await customerFetch(
          apiUrl(`/customers/${savedCustomer.id}/chat-sessions/${sessionId}/messages`),
          { cache: "no-store" },
        );
        const data = await res.json();
        setMessages(data.messages || []);
        setTitle(
          data.session?.title ||
            data.title ||
            (isEn ? "Conversation export" : "خروجی گفتگو"),
        );
      } catch {
        setError(isEn ? "Error loading conversation messages." : "خطا در بارگذاری پیام‌های گفتگو.");
      } finally {
        setLoading(false);
      }
    }

    void loadMessages();
  }, [isEn, router, sessionId]);

  const date = useMemo(
    () =>
      new Date().toLocaleDateString(isEn ? "en-US" : "fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [isEn],
  );

  const customerName = (customer?.full_name || "").trim() || (isEn ? "Customer" : "مشتری");

  function handleBack() {
    router.push("/customer-dashboard");
  }

  function downloadHtml() {
    const html = buildExportHtml({ title, customerName, date, messages, isEn });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(title)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  return (
    <section className="min-h-full bg-white px-4 py-5 print:bg-white" dir={dir}>
      <style jsx global>{`
        @media print {
          aside,
          .export-actions,
          .export-backdrop-hidden {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-3xl">
        <div className="export-actions sticky top-3 z-20 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white/95 p-2 shadow-lg shadow-slate-200/70 backdrop-blur">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
          >
            <ArrowLeft size={15} />
            {isEn ? "Back" : "بازگشت"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadHtml}
              disabled={loading || messages.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Download size={15} />
              {isEn ? "Save file" : "ذخیره فایل"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={loading || messages.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <Printer size={15} />
              {isEn ? "Print / PDF" : "چاپ / PDF"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
            <Loader2 size={22} className="animate-spin" />
            <span className="mx-2 text-sm font-bold">{isEn ? "Loading export..." : "در حال آماده‌سازی خروجی..."}</span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : (
          <article className="rounded-[26px] bg-white print:rounded-none">
            <header className="border-b-2 border-blue-700 pb-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 print:hidden">
                <FileText size={14} />
                {isEn ? "Conversation export" : "خروجی گفتگو"}
              </div>
              <h1 className="text-2xl font-black leading-10 text-blue-700">{title}</h1>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {isEn ? "Customer" : "مشتری"}: {customerName} | {isEn ? "Date" : "تاریخ"}: {date}
              </p>
            </header>

            <div className="mt-7 space-y-5">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={`${msg.role}-${index}`}
                    className={`rounded-3xl p-4 text-sm leading-8 ${
                      isUser
                        ? "border-r-4 border-blue-700 bg-blue-100 text-slate-800"
                        : "border-r-4 border-cyan-500 bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className={`mb-2 text-xs font-black ${isUser ? "text-blue-700" : "text-cyan-600"}`}>
                      {isUser ? (isEn ? "User" : "کاربر") : (isEn ? "Artin" : "آرتین")}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                );
              })}
            </div>

            <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-[11px] font-semibold text-slate-400">
              {isEn ? "ArtinAzma Mehr" : "آرتین آزما مهر"} - artinazma.net
            </footer>
          </article>
        )}
      </div>
    </section>
  );
}

export default function CustomerDashboardExportPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDashboardExportInner />
    </Suspense>
  );
}
