"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

type ToolAction =
  | "analyze-file"
  | "analyze-image"
  | "search-knowledge"
  | "troubleshooting"
  | "device-suggestion"
  | "catalyst-suggestion";

const tools: {
  label: string;
  description: string;
  action: ToolAction;
}[] = [
  {
    label: "آپلود فایل برای تحلیل",
    description: "تحلیل Excel، CSV یا PDF گزارش تست",
    action: "analyze-file",
  },
  {
    label: "آپلود عکس برای تحلیل",
    description: "تحلیل عکس خطای دستگاه، نمودار یا کروماتوگرام",
    action: "analyze-image",
  },
  {
    label: "جست‌وجوی تخصصی",
    description: "پرسیدن سوال تخصصی بر اساس دانش آرتین آزما",
    action: "search-knowledge",
  },
  {
    label: "عیب‌یابی تجهیزات",
    description: "ساخت قالب سوال برای خطا یا مشکل دستگاه",
    action: "troubleshooting",
  },
  {
    label: "پیشنهاد دستگاه",
    description: "ساخت قالب سوال برای انتخاب تجهیز مناسب",
    action: "device-suggestion",
  },
  {
    label: "پیشنهاد کاتالیست",
    description: "ساخت قالب سوال برای انتخاب یا بررسی کاتالیست",
    action: "catalyst-suggestion",
  },
];

export default function AssistantPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    setShowTools(false);

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
    setShowTools(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const domainLabel = useMemo(() => {
    if (domain === "catalyst") return "کاتالیست";
    if (domain === "equipment") return "تجهیزات";
    if (domain === "chromatography") return "کروماتوگرافی";
    if (domain === "mercury-analysis") return "آنالیز جیوه";
    if (domain === "sulfur-analysis") return "آنالیز سولفور";
    if (domain === "troubleshooting") return "عیب‌یابی";
    if (domain === "analysis") return "آنالیز و تست";
    return "تشخیص خودکار";
  }, [domain]);
  async function uploadAndAnalyzeFile(file: File) {
  setShowTools(false);

  const userMessage: ChatMessage = {
    role: "user",
    content: `فایل برای تحلیل ارسال شد: ${file.name}`,
  };

  const previousMessages = messages;

  setMessages([...previousMessages, userMessage]);
  setLoading(true);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(apiUrl("/analyze-file"), {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content:
        data.ai_analysis ||
        data.error ||
        "فایل دریافت شد، اما تحلیل مشخصی برگردانده نشد.",
      detected_domain: "file-analysis",
    };

    setMessages([...previousMessages, userMessage, assistantMessage]);
  } catch {
    const errorMessage: ChatMessage = {
      role: "assistant",
      content: "خطا در آپلود یا تحلیل فایل.",
    };

    setMessages([...previousMessages, userMessage, errorMessage]);
  } finally {
    setLoading(false);
  }
}

function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];

  if (!file) return;

  uploadAndAnalyzeFile(file);

  e.target.value = "";
}

async function uploadAndAnalyzeImage(file: File) {
  setShowTools(false);

  const userMessage: ChatMessage = {
    role: "user",
    content: `عکس برای تحلیل ارسال شد: ${file.name}`,
  };

  const previousMessages = messages;

  setMessages([...previousMessages, userMessage]);
  setLoading(true);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(apiUrl("/analyze-image"), {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content:
        data.ai_analysis ||
        data.error ||
        "عکس دریافت شد، اما تحلیل مشخصی برگردانده نشد.",
      detected_domain: "image-analysis",
    };

    setMessages([...previousMessages, userMessage, assistantMessage]);
  } catch {
    const errorMessage: ChatMessage = {
      role: "assistant",
      content: "خطا در آپلود یا تحلیل عکس.",
    };

    setMessages([...previousMessages, userMessage, errorMessage]);
  } finally {
    setLoading(false);
  }
}

function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];

  if (!file) return;

  uploadAndAnalyzeImage(file);

  e.target.value = "";
}
 function handleToolClick(action: ToolAction) {
  setShowTools(false);

  if (action === "analyze-file") {
  fileInputRef.current?.click();
  return;
}
  if (action === "analyze-image") {
  imageInputRef.current?.click();
  return;
}
  if (action === "search-knowledge") {
    setDomain("auto");
    setMessage(
      "در بانک دانش آرتین آزما درباره این موضوع جست‌وجو کن و پاسخ تخصصی بده: "
    );
    return;
  }

  if (action === "troubleshooting") {
    setDomain("troubleshooting");
    setMessage(
      "برای عیب‌یابی این مشکل دستگاه، علت‌های احتمالی و چک‌لیست مرحله‌ای بده: "
    );
    return;
  }

  if (action === "device-suggestion") {
    setDomain("equipment");
    setMessage(
      "برای این کاربرد یا نوع نمونه، دستگاه/تجهیز مناسب آرتین آزما را پیشنهاد بده: "
    );
    return;
  }

  if (action === "catalyst-suggestion") {
    setDomain("catalyst");
    setMessage(
      "برای این فرایند یا مشکل، کاتالیست مناسب یا تست‌های لازم برای بررسی کاتالیست را پیشنهاد بده: "
    );
    return;
  }
}
  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-[#f7f7f8]">
      <input
  ref={fileInputRef}
  type="file"
  accept=".xlsx,.xls,.csv,.pdf"
  onChange={handleFileChange}
  className="hidden"
/>
<input
  ref={imageInputRef}
  type="file"
  accept=".jpg,.jpeg,.png,.webp"
  onChange={handleImageChange}
  className="hidden"
/>
      <div className="shrink-0 border-b border-slate-200 bg-[#f7f7f8]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">آرتین</h1>
            <p className="mt-1 text-sm text-slate-500">
              دستیار تخصصی آرتین آزما برای پاسخ‌گویی، تحلیل تست و مشاوره فنی
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="auto">تشخیص خودکار</option>
              <option value="catalyst">کاتالیست</option>
              <option value="equipment">تجهیزات</option>
              <option value="chromatography">کروماتوگرافی</option>
              <option value="mercury-analysis">آنالیز جیوه</option>
              <option value="sulfur-analysis">آنالیز سولفور</option>
              <option value="troubleshooting">عیب‌یابی</option>
              <option value="analysis">آنالیز و تست</option>
            </select>

            <button
              onClick={clearChat}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50"
            >
              گفتگوی جدید
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 pb-8 pt-8">
          {messages.length === 0 ? (
            <div className="flex min-h-[calc(100vh-300px)] flex-col items-center justify-center text-center">
              <h2 className="text-5xl font-bold text-slate-900">آرتین</h2>

              <p className="mt-4 max-w-2xl leading-8 text-slate-600">
                سوال تخصصی خود را درباره تجهیزات، کاتالیست، آنالیز، تست‌های
                آزمایشگاهی یا عیب‌یابی دستگاه‌ها بپرسید.
              </p>

              <div className="mt-8 grid w-full max-w-3xl gap-3 md:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="rounded-3xl border border-slate-200 bg-white p-5 text-right text-sm leading-7 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                حوزه فعال: {domainLabel}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-7">
              {messages.map((item, index) => (
                <div
                  key={index}
                  className={`flex ${
                    item.role === "user" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-5 py-4 leading-8 shadow-sm ${
                      item.role === "user"
                        ? "bg-blue-700 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-[15px]">
                      {item.content}
                    </div>

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
                            <div className="mb-3 text-sm font-bold">
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
                                    امتیاز ارتباط: {source.score.toFixed(3)}
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
              ))}

              {loading && (
                <div className="flex justify-end">
                  <div className="rounded-3xl bg-white px-5 py-4 text-slate-500 shadow-sm">
                    آرتین در حال پردازش پاسخ است...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-[#f7f7f8]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-6 py-4">
          <div className="relative mx-auto max-w-4xl">
            {showTools && (
              <div className="absolute bottom-full right-0 z-20 mb-3 w-[260px] rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="space-y-1">
                  {tools.map((tool) => (
  <button
    key={tool.action}
    onClick={() => handleToolClick(tool.action)}
    className="block w-full rounded-2xl px-4 py-3 text-right hover:bg-slate-50"
  >
    <div className="text-sm font-semibold text-slate-800">
      {tool.label}
    </div>
    <div className="mt-1 text-xs leading-5 text-slate-500">
      {tool.description}
    </div>
  </button>
))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-slate-300 bg-white shadow-lg">
              <div className="flex items-end gap-3 px-3 py-3">
                <button
                  onClick={() => setShowTools((prev) => !prev)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 text-2xl text-slate-700 hover:bg-slate-50"
                >
                  +
                </button>

                <textarea
                  className="max-h-40 min-h-[48px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[16px] outline-none"
                  placeholder="از آرتین بپرسید"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !message.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:opacity-40"
                >
                  ↑
                </button>
              </div>
            </div>

            <p className="mt-3 text-center text-xs leading-6 text-slate-500">
              آرتین می‌تواند نیاز فنی شما را تحلیل کند؛ برای تصمیم‌های مهم، پاسخ
              را با کارشناس بررسی کنید.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
