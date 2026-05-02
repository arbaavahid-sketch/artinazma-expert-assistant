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
  description: "تحلیل عکس خطای دستگاه، نمودار یا کروماتوگرام؛ فرمت‌های مجاز: JPG, PNG, WEBP",
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
  return testTypes.find((item) => item.value === value)?.label || "گزارش عمومی آزمایشگاهی";
}

function getImageTypeLabel(value: string) {
  return imageTypes.find((item) => item.value === value)?.label || "تصویر عمومی";
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
formData.append("image_type", chatImageType);
formData.append("user_note", chatImageNote);
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

    setMessages([...previousMessages, userMessage, assistantMessage]);
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
      {showFileOptions && pendingFile && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
    <div className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-900">
        تنظیمات تحلیل فایل
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        فایل انتخاب‌شده: <span className="font-bold">{pendingFile.name}</span>
      </p>

      <label className="mb-2 mt-5 block text-sm font-bold">
        نوع تست یا گزارش
      </label>

      <select
        value={chatTestType}
        onChange={(e) => setChatTestType(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
      >
        {testTypes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <label className="mb-2 mt-5 block text-sm font-bold">
        توضیح اختیاری درباره نمونه یا شرایط تست
      </label>

      <textarea
        value={chatUserNote}
        onChange={(e) => setChatUserNote(e.target.value)}
        className="h-28 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none focus:border-blue-600"
        placeholder="مثلاً: نمونه LPG است، baseline نوسان دارد، تست کاتالیست در دمای 350 درجه انجام شده..."
      />

      <div className="mt-6 flex gap-3">
        <button
          onClick={confirmFileAnalysis}
          className="flex-1 rounded-2xl bg-blue-700 px-5 py-4 font-medium text-white"
        >
          شروع تحلیل
        </button>

        <button
          onClick={cancelFileAnalysis}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-4 font-medium text-slate-700"
        >
          انصراف
        </button>
      </div>
    </div>
  </div>
)}
{showImageOptions && pendingImage && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
    <div className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-900">
        تنظیمات تحلیل عکس
      </h2>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        عکس انتخاب‌شده: <span className="font-bold">{pendingImage.name}</span>
      </p>

      <label className="mb-2 mt-5 block text-sm font-bold">
        نوع تصویر
      </label>

      <select
        value={chatImageType}
        onChange={(e) => setChatImageType(e.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none focus:border-blue-600"
      >
        {imageTypes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <label className="mb-2 mt-5 block text-sm font-bold">
        توضیح اختیاری درباره تصویر
      </label>

      <textarea
        value={chatImageNote}
        onChange={(e) => setChatImageNote(e.target.value)}
        className="h-28 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none focus:border-blue-600"
        placeholder="مثلاً: این عکس مربوط به ارور دستگاه GC است، یا کروماتوگرام نمونه LPG است، یا نمودار افت فعالیت کاتالیست است..."
      />

      <div className="mt-6 flex gap-3">
        <button
          onClick={confirmImageAnalysis}
          className="flex-1 rounded-2xl bg-blue-700 px-5 py-4 font-medium text-white"
        >
          شروع تحلیل عکس
        </button>

        <button
          onClick={cancelImageAnalysis}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-4 font-medium text-slate-700"
        >
          انصراف
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
        فرمت‌های مجاز: JPG, PNG, WEBP
      </div>
    </div>
  </div>
)}
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
                    {item.attachment && (
  <div
    className={`mt-4 rounded-2xl p-4 text-sm leading-7 ${
      item.role === "user"
        ? "bg-white/15 text-white"
        : "bg-slate-50 text-slate-700"
    }`}
  >
    <div className="font-bold">
      {item.attachment.kind === "image" ? "تصویر پیوست‌شده" : "فایل پیوست‌شده"}
    </div>
   {item.attachment.kind === "image" && item.attachment.previewUrl && (
  <div className="mb-3 overflow-hidden rounded-2xl bg-black/10">
    <img
      src={item.attachment.previewUrl}
      alt={item.attachment.name}
      className="max-h-72 w-full object-contain"
    />
  </div>
)}
    <div className="mt-2">
      نام: {item.attachment.name}
    </div>

    {item.attachment.analysisType && (
      <div>
        نوع تحلیل: {item.attachment.analysisType}
      </div>
    )}

    {item.attachment.note && (
      <div>
        توضیح کاربر: {item.attachment.note}
      </div>
    )}

    <div>
      وضعیت:{" "}
      {loading && item.attachment.status === "analyzing"
        ? "در حال تحلیل"
        : "ارسال شد"}
    </div>
  </div>
)}
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
