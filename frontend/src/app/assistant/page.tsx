"use client";

import { useState } from "react";
import AppNav from "@/components/AppNav";
import { apiUrl } from "@/lib/api";

type Source = {
  title: string;
  file_name: string;
  category: string;
  score: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  detected_domain?: string;
  question_id?: number;
};

const quickPrompts = [
  "برای آنالیز سولفور در LPG چه راهکاری پیشنهاد می‌کنید؟",
  "علت نوسان baseline در GC چیست؟",
  "برای بررسی افت فعالیت کاتالیست چه تست‌هایی لازم است؟",
  "برای اندازه‌گیری جیوه در آب و خاک چه تجهیزاتی مناسب است؟",
];

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(customMessage?: string) {
    const finalMessage = customMessage || message;

    if (!finalMessage.trim()) return;

    const previousMessages = messages;

    const userMessage: ChatMessage = {
      role: "user",
      content: finalMessage,
    };

    setMessages([...previousMessages, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: finalMessage,
          domain,
          history: previousMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.answer || "پاسخی دریافت نشد.",
        sources: data.sources || [],
        detected_domain: data.detected_domain,
        question_id: data.question_id,
      };

      setMessages([...previousMessages, userMessage, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "خطا در اتصال به سرور.",
      };

      setMessages([...previousMessages, userMessage, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppNav />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold">
                دستیار فنی آرتین آزما
              </h1>
              <p className="max-w-3xl leading-8 text-slate-600">
                سوالات تخصصی درباره تجهیزات، کاتالیست، آنالیز، عیب‌یابی و
                انتخاب راهکار را اینجا بپرسید. این صفحه اکنون گفت‌وگوی چندمرحله‌ای
                را پشتیبانی می‌کند.
              </p>
            </div>

            <button
              onClick={clearChat}
              className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-medium text-white"
            >
              پاک کردن گفتگو
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-bold">گفتگو</h2>

              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="rounded-2xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="auto">تشخیص خودکار حوزه</option>
                <option value="catalyst">کاتالیست</option>
                <option value="equipment">تجهیزات</option>
                <option value="chromatography">کروماتوگرافی</option>
                <option value="mercury-analysis">آنالیز جیوه</option>
                <option value="sulfur-analysis">آنالیز سولفور</option>
                <option value="troubleshooting">عیب‌یابی</option>
                <option value="analysis">آنالیز و تست</option>
              </select>
            </div>

            <div className="min-h-[420px] space-y-4 rounded-3xl bg-slate-50 p-4">
              {messages.length === 0 ? (
                <div className="flex h-[380px] items-center justify-center text-center text-slate-500">
                  هنوز گفتگویی شروع نشده است.
                  <br />
                  یک سوال تخصصی بپرسید یا از نمونه سوال‌ها استفاده کنید.
                </div>
              ) : (
                messages.map((item, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      item.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl p-5 leading-8 shadow-sm ${
                        item.role === "user"
                          ? "bg-blue-700 text-white"
                          : "bg-white text-slate-900"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{item.content}</div>

                      {item.role === "assistant" && (
                        <div className="mt-4 space-y-3">
                          {item.detected_domain && (
                            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                              حوزه پاسخ: {item.detected_domain}
                            </div>
                          )}

                          {item.question_id && (
                            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                              شناسه سوال ثبت‌شده: {item.question_id}
                            </div>
                          )}

                          {item.sources && item.sources.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 font-bold">
                                منابع استفاده‌شده
                              </div>

                              <div className="space-y-2">
                                {item.sources.map((source, sourceIndex) => (
                                  <div
                                    key={sourceIndex}
                                    className="rounded-2xl bg-white p-3 text-sm"
                                  >
                                    <div className="font-bold">
                                      {source.title}
                                    </div>
                                    <div className="text-slate-600">
                                      فایل: {source.file_name}
                                    </div>
                                    <div className="text-slate-600">
                                      دسته‌بندی: {source.category}
                                    </div>
                                    <div className="text-slate-500">
                                      امتیاز ارتباط:{" "}
                                      {source.score.toFixed(3)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-white p-5 text-slate-500 shadow-sm">
                    در حال پردازش پاسخ...
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5">
              <textarea
                className="h-32 w-full rounded-2xl border border-slate-300 p-4 leading-8 outline-none focus:border-blue-500"
                placeholder="سوال خود را بنویسید. برای ارسال Enter و برای خط جدید Shift + Enter بزنید."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || !message.trim()}
                className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {loading ? "در حال پردازش..." : "ارسال سوال"}
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-bold">نمونه سوال‌ها</h3>

              <div className="space-y-3">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="w-full rounded-2xl bg-slate-50 p-4 text-right text-sm leading-7 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-bold">راهنمای استفاده</h3>

              <ul className="list-inside list-disc space-y-2 text-sm leading-7 text-slate-600">
                <li>برای سوالات تخصصی، نوع نمونه و محدوده اندازه‌گیری را بنویسید.</li>
                <li>برای عیب‌یابی، مدل دستگاه و متن خطا را وارد کنید.</li>
                <li>برای کاتالیست، شرایط تست و داده‌های عملکرد را توضیح دهید.</li>
                <li>اگر پاسخ مهم است، بعداً از بخش سوالات آن را بررسی و تایید کنید.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}