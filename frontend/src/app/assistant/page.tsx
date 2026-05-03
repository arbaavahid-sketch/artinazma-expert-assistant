"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";

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
  attachment?: {
    name: string;
    kind: "file" | "image";
    analysisType?: string;
    note?: string;
    status?: "uploaded" | "analyzing" | "done" | "error";
    previewUrl?: string;
  };
};

type ToolAction =
  | "analyze-file"
  | "analyze-image"
  | "search-knowledge"
  | "troubleshooting"
  | "device-suggestion"
  | "catalyst-suggestion"
  | "customer-request";

const quickPrompts = [
  {
    title: "آنالیز سولفور",
    text: "برای آنالیز سولفور در LPG چه راهکاری پیشنهاد می‌کنید؟",
  },
  {
    title: "عیب‌یابی GC",
    text: "علت نوسان baseline در GC چیست؟",
  },
  {
    title: "بررسی کاتالیست",
    text: "برای بررسی افت فعالیت کاتالیست چه تست‌هایی لازم است؟",
  },
  {
    title: "آنالیز جیوه",
    text: "برای اندازه‌گیری جیوه در آب و خاک چه تجهیزاتی مناسب است؟",
  },
];

const tools: {
  label: string;
  description: string;
  action: ToolAction;
  icon: string;
}[] = [
  {
    label: "آپلود فایل برای تحلیل",
    description: "تحلیل Excel، CSV یا PDF گزارش تست",
    action: "analyze-file",
    icon: "📄",
  },
  {
    label: "آپلود عکس برای تحلیل",
    description: "تحلیل عکس خطا، نمودار یا کروماتوگرام",
    action: "analyze-image",
    icon: "🖼️",
  },
  {
    label: "جست‌وجوی تخصصی",
    description: "پرسش بر اساس دانش فنی آرتین آزما",
    action: "search-knowledge",
    icon: "🔎",
  },
  {
    label: "عیب‌یابی تجهیزات",
    description: "ساخت قالب سوال برای خطا یا مشکل دستگاه",
    action: "troubleshooting",
    icon: "🛠️",
  },
  {
    label: "پیشنهاد دستگاه",
    description: "انتخاب تجهیز مناسب برای کاربرد یا نمونه",
    action: "device-suggestion",
    icon: "⚙️",
  },
  {
    label: "پیشنهاد کاتالیست",
    description: "بررسی کاتالیست یا تست‌های تکمیلی",
    action: "catalyst-suggestion",
    icon: "🧪",
  },
  {
    label: "ثبت درخواست مشاوره",
    description: "ارسال اطلاعات تماس برای پیگیری کارشناس",
    action: "customer-request",
    icon: "👤",
  },
];

const testTypes = [
  { value: "general", label: "گزارش عمومی آزمایشگاهی" },
  { value: "catalyst", label: "تست کاتالیست" },
  { value: "chromatography", label: "کروماتوگرافی GC/HPLC" },
  { value: "mercury", label: "آنالیز جیوه" },
  { value: "sulfur", label: "آنالیز سولفور" },
  { value: "metals", label: "آنالیز عنصری / فلزات" },
];

const imageTypes = [
  { value: "general", label: "تصویر عمومی" },
  { value: "device-error", label: "خطای دستگاه" },
  { value: "chromatogram", label: "کروماتوگرام" },
  { value: "chart", label: "نمودار تست" },
  { value: "software-screen", label: "صفحه نرم‌افزار دستگاه" },
  { value: "lab-report", label: "گزارش تصویری آزمایشگاهی" },
];

function getTestTypeLabel(value: string) {
  return (
    testTypes.find((item) => item.value === value)?.label ||
    "گزارش عمومی آزمایشگاهی"
  );
}

function getImageTypeLabel(value: string) {
  return imageTypes.find((item) => item.value === value)?.label || "تصویر عمومی";
}

function getDomainLabel(domain: string) {
  if (domain === "catalyst") return "کاتالیست";
  if (domain === "equipment") return "تجهیزات";
  if (domain === "chromatography") return "کروماتوگرافی";
  if (domain === "mercury-analysis") return "آنالیز جیوه";
  if (domain === "sulfur-analysis") return "آنالیز سولفور";
  if (domain === "troubleshooting") return "عیب‌یابی";
  if (domain === "analysis") return "آنالیز و تست";
  return "تشخیص خودکار";
}
function cleanMarkdownText(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

function hasPersianText(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function getTextDirection(text: string) {
  return hasPersianText(text) ? "rtl" : "ltr";
}

function getTextFont(text: string) {
  return hasPersianText(text)
    ? "var(--font-persian)"
    : "var(--font-english)";
}
export default function AssistantPage() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [chatTestType, setChatTestType] = useState("general");
  const [chatUserNote, setChatUserNote] = useState("");

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [chatImageType, setChatImageType] = useState("general");
  const [chatImageNote, setChatImageNote] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
  if (!messagesEndRef.current) return;

  messagesEndRef.current.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}, [messages.length, loading]);

  const domainLabel = useMemo(() => getDomainLabel(domain), [domain]);

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }
 function typeAssistantMessage(
  previousMessages: ChatMessage[],
  userMessage: ChatMessage,
  assistantMessage: ChatMessage
) {
  const fullText = assistantMessage.content || "";
  let index = 0;

  const emptyAssistantMessage: ChatMessage = {
    ...assistantMessage,
    content: "",
  };

  setMessages([...previousMessages, userMessage, emptyAssistantMessage]);

  const interval = window.setInterval(() => {
    index += 8;

    setMessages([
      ...previousMessages,
      userMessage,
      {
        ...assistantMessage,
        content: fullText.slice(0, index),
      },
    ]);

    if (index >= fullText.length) {
      window.clearInterval(interval);
      setMessages([...previousMessages, userMessage, assistantMessage]);
    }
  }, 18);
}
  async function sendMessage(customMessage?: string) {
    const finalMessage = customMessage || message;

    if (!finalMessage.trim()) return;

    const previousMessages = messages;
    const userId = getOrCreateUserId();

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
          user_id: userId,
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

      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch {
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: "خطا در اتصال به سرور. لطفاً Backend را بررسی کنید.",
        },
      ]);
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

  async function uploadAndAnalyzeFile(file: File) {
    setShowTools(false);

    const userMessage: ChatMessage = {
      role: "user",
      content: "فایل برای تحلیل ارسال شد.",
      attachment: {
        name: file.name,
        kind: "file",
        analysisType: getTestTypeLabel(chatTestType),
        note: chatUserNote,
        status: "analyzing",
      },
    };

    const previousMessages = messages;

    setMessages([...previousMessages, userMessage]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("test_type", chatTestType);
    formData.append("user_note", chatUserNote);

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

      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch {
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: "خطا در آپلود یا تحلیل فایل.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setPendingFile(file);
    setShowFileOptions(true);
    setChatTestType("general");
    setChatUserNote("");

    e.target.value = "";
  }

  async function uploadAndAnalyzeImage(file: File) {
    setShowTools(false);

    const previewUrl = URL.createObjectURL(file);

    const userMessage: ChatMessage = {
      role: "user",
      content: "عکس برای تحلیل ارسال شد.",
      attachment: {
        name: file.name,
        kind: "image",
        analysisType: getImageTypeLabel(chatImageType),
        note: chatImageNote,
        status: "analyzing",
        previewUrl,
      },
    };

    const previousMessages = messages;

    setMessages([...previousMessages, userMessage]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", chatImageType);
    formData.append("user_note", chatImageNote);

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
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: "خطا در آپلود یا تحلیل عکس.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    setPendingImage(file);
    setShowImageOptions(true);
    setChatImageType("general");
    setChatImageNote("");

    e.target.value = "";
  }

  function confirmFileAnalysis() {
    if (!pendingFile) return;

    setShowFileOptions(false);
    uploadAndAnalyzeFile(pendingFile);
    setPendingFile(null);
  }

  function cancelFileAnalysis() {
    setShowFileOptions(false);
    setPendingFile(null);
    setChatUserNote("");
    setChatTestType("general");
  }

  function confirmImageAnalysis() {
    if (!pendingImage) return;

    setShowImageOptions(false);
    uploadAndAnalyzeImage(pendingImage);
    setPendingImage(null);
  }

  function cancelImageAnalysis() {
    setShowImageOptions(false);
    setPendingImage(null);
    setChatImageNote("");
    setChatImageType("general");
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

    if (action === "customer-request") {
      router.push("/customer-request");
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
    }
  }

  return (
    <section className="flex h-full max-h-screen min-w-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eaf4ff,transparent_38%),#f7f7f8]">
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

      {showFileOptions && pendingFile && (
        <UploadModal
          title="تنظیمات تحلیل فایل"
          fileName={pendingFile.name}
          label="نوع تست یا گزارش"
          selectValue={chatTestType}
          onSelectChange={setChatTestType}
          options={testTypes}
          noteValue={chatUserNote}
          onNoteChange={setChatUserNote}
          noteLabel="توضیح اختیاری درباره نمونه یا شرایط تست"
          placeholder="مثلاً: نمونه LPG است، baseline نوسان دارد، تست کاتالیست در دمای 350 درجه انجام شده..."
          confirmLabel="شروع تحلیل فایل"
          onConfirm={confirmFileAnalysis}
          onCancel={cancelFileAnalysis}
        />
      )}

      {showImageOptions && pendingImage && (
        <UploadModal
          title="تنظیمات تحلیل عکس"
          fileName={pendingImage.name}
          label="نوع تصویر"
          selectValue={chatImageType}
          onSelectChange={setChatImageType}
          options={imageTypes}
          noteValue={chatImageNote}
          onNoteChange={setChatImageNote}
          noteLabel="توضیح اختیاری درباره تصویر"
          placeholder="مثلاً: این عکس مربوط به ارور دستگاه GC است یا کروماتوگرام نمونه LPG است..."
          confirmLabel="شروع تحلیل عکس"
          onConfirm={confirmImageAnalysis}
          onCancel={cancelImageAnalysis}
          footer="فرمت‌های مجاز تصویر: JPG, PNG, WEBP"
        />
      )}

      <header className="shrink-0 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-blue-200 blur-lg" />
              <img
  src="/images/artin-avatar.png"
  alt="آرتین"
  className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 object-cover"
/>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">آرتین</h1>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  آنلاین
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                دستیار تخصصی آرتین آزما برای تحلیل، پاسخ‌گویی و مشاوره فنی
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500"
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
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              گفتگوی جدید
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-4 pt-5">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[320px] max-w-4xl flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-[36px] bg-white p-4 shadow-sm">
                <img
                  src="/images/artin-avatar.png"
                  alt="آرتین"
                  className="h-full w-full rounded-full object-cover"
                />
              </div>

              <h2 className="text-4xl font-black leading-[1.4] text-slate-900">
              چطور می‌توانم کمک کنم؟
              </h2>

              <p className="mt-3 max-w-2xl leading-8 text-slate-600">
                سوال تخصصی بپرسید، فایل تست یا عکس خطا ارسال کنید، یا برای
                پیگیری تخصصی درخواست مشاوره ثبت کنید.
              </p>

              <div className="mt-6 grid w-full max-w-3xl gap-3 md:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() => sendMessage(prompt.text)}
                    disabled={loading}
                    className="group rounded-3xl border border-slate-200 bg-white px-5 py-4 text-right shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md disabled:opacity-50"
                  >
                    <div className="text-sm font-black text-slate-900">
                      {prompt.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600 group-hover:text-slate-800">
                      {prompt.text}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                حوزه فعال: <span className="font-bold">{domainLabel}</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-6">
              {messages.map((item, index) => (
                <MessageBubble
                  key={index}
                  item={item}
                  loading={loading}
                  onCopy={copyText}
                  onRequest={() => router.push("/customer-request")}
                />
              ))}

              {loading && (
  <div className="flex justify-start">
    <div className="flex max-w-[80%] flex-row-reverse items-center gap-3 rounded-[28px] bg-white px-5 py-4 text-slate-600 shadow-sm">
      <img
        src="/images/artin-avatar.png"
        alt="آرتین"
        className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 object-cover"
      />
      <span className="font-persian">آرتین در حال تحلیل و آماده‌سازی پاسخ است...</span>
      <span className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:240ms]" />
      </span>
    </div>
  </div>
)}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-6 py-3">
          <div className="relative mx-auto max-w-4xl">
            {showTools && (
              <div className="absolute bottom-full left-0 right-auto z-20 mb-3 max-h-[420px] w-[330px] max-w-[calc(100vw-48px)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-3 shadow-2xl md:left-auto md:right-0">
                <div className="space-y-1">
                  {tools.map((tool) => (
                    <button
                      key={tool.action}
                      onClick={() => handleToolClick(tool.action)}
                      className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-right hover:bg-slate-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg">
                        {tool.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-black text-slate-800">
                          {tool.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {tool.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="flex items-end gap-3 px-3 py-3">
                <button
                  onClick={() => setShowTools((prev) => !prev)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-2xl text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  +
                </button>

                <textarea
                  dir="auto"
                  style={{ fontFamily: getTextFont(message || "فارسی") }}
                  className="max-h-40 min-h-[52px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[18px] leading-8 outline-none"
                  placeholder="از آرتین بپرسید..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !message.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xl text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-300"
                >
                  ↑
                </button>
              </div>
            </div>

            <p className="mt-2 text-center text-xs leading-5 text-slate-500">
              آرتین پاسخ را بر اساس بانک دانش و تحلیل فنی ارائه می‌کند؛ برای
              تصمیم‌های مهم، امکان ثبت درخواست مشاوره وجود دارد.
            </p>
          </div>
        </div>
      </footer>
    </section>
  );
}

function UploadModal({
  title,
  fileName,
  label,
  selectValue,
  onSelectChange,
  options,
  noteValue,
  onNoteChange,
  noteLabel,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
  footer,
}: {
  title: string;
  fileName: string;
  label: string;
  selectValue: string;
  onSelectChange: (value: string) => void;
  options: { value: string; label: string }[];
  noteValue: string;
  onNoteChange: (value: string) => void;
  noteLabel: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  footer?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[36px] bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            فایل انتخاب‌شده: <span className="font-bold">{fileName}</span>
          </p>
        </div>

        <label className="mb-2 block text-sm font-bold">{label}</label>

        <select
          value={selectValue}
          onChange={(e) => onSelectChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
        >
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="mb-2 mt-5 block text-sm font-bold">
          {noteLabel}
        </label>

        <textarea
          value={noteValue}
          onChange={(e) => onNoteChange(e.target.value)}
          className="h-28 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none focus:border-blue-600"
          placeholder={placeholder}
        />

        {footer && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            {footer}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-blue-700 px-5 py-4 font-bold text-white hover:bg-blue-800"
          >
            {confirmLabel}
          </button>

          <button
            onClick={onCancel}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-4 font-bold text-slate-700 hover:bg-slate-50"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  item,
  loading,
  onCopy,
  onRequest,
}: {
  item: ChatMessage;
  loading: boolean;
  onCopy: (text: string) => void;
  onRequest: () => void;
}) {
  const isUser = item.role === "user";
  const displayContent = isUser ? item.content : cleanMarkdownText(item.content);
  const direction = getTextDirection(displayContent);
  const fontFamily = getTextFont(displayContent);

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      dir="ltr"
    >
      <div
        className={`flex max-w-[88%] gap-3 ${
          isUser ? "flex-row-reverse" : "flex-row-reverse"
        }`}
      >
        {!isUser && (
          <img
            src="/images/artin-avatar.png"
            alt="آرتین"
            className="mt-1 h-11 w-11 shrink-0 rounded-full border border-slate-200 bg-white object-cover p-1 shadow-sm"
          />
        )}

        <div
          className={`rounded-[30px] px-6 py-5 shadow-sm ${
            isUser
              ? "bg-blue-700 text-white"
              : "border border-slate-100 bg-white text-slate-900"
          }`}
        >
          <div
            dir={direction}
            style={{ fontFamily }}
            className={`whitespace-pre-wrap ${
              direction === "rtl"
                ? "chat-answer text-right"
                : "chat-answer-en text-left"
            }`}
          >
            {displayContent}
          </div>

          {item.attachment && (
            <div
              className={`mt-4 rounded-3xl p-4 text-sm leading-7 ${
                isUser ? "bg-white/15 text-white" : "bg-slate-50 text-slate-700"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-black">
                  {item.attachment.kind === "image"
                    ? "تصویر پیوست‌شده"
                    : "فایل پیوست‌شده"}
                </div>

                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                  {loading && item.attachment.status === "analyzing"
                    ? "در حال تحلیل"
                    : "ارسال شد"}
                </span>
              </div>

              {item.attachment.kind === "image" &&
                item.attachment.previewUrl && (
                  <div className="mb-3 overflow-hidden rounded-2xl bg-black/10">
                    <img
                      src={item.attachment.previewUrl}
                      alt={item.attachment.name}
                      className="max-h-80 w-full object-contain"
                    />
                  </div>
                )}

              <div>نام: {item.attachment.name}</div>

              {item.attachment.analysisType && (
                <div>نوع تحلیل: {item.attachment.analysisType}</div>
              )}

              {item.attachment.note && (
                <div>توضیح کاربر: {item.attachment.note}</div>
              )}
            </div>
          )}

          {!isUser && (
            <div className="mt-4 space-y-3">
              {item.detected_domain && (
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  حوزه پاسخ: {item.detected_domain}
                </div>
              )}

              {item.sources && item.sources.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-black">
                    منابع استفاده‌شده
                  </div>

                  <div className="space-y-2">
                    {item.sources.map((source, sourceIndex) => (
                      <div
                        key={sourceIndex}
                        className="rounded-2xl bg-white p-3 text-sm"
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
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => onCopy(displayContent)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  کپی پاسخ
                </button>

                <button
                  onClick={onRequest}
                  className="rounded-2xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                >
                  ثبت درخواست مشاوره
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}