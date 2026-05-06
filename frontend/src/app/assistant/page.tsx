"use client";
import ReactMarkdown from "react-markdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";
import {
  Paperclip,
  Wrench,
  Settings,
  FlaskConical,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { findRelatedDevices, type DeviceAsset } from "@/lib/device-assets";
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
  relatedDevices?: DeviceAsset[];
  resource_links?: ResourceLink[];
  resource_images?: ResourceImage[];
  attachment?: {
    name: string;
    kind: "file" | "image";
    analysisType?: string;
    note?: string;
    status?: "uploaded" | "analyzing" | "done" | "error";
    previewUrl?: string;
  };
};
type Customer = {
  id: number;
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
};
type ResourceLink = {
  title: string;
  url: string;
  source?: string;
  score?: number;
};

type ResourceImage = {
  title: string;
  url: string;
  page_url?: string;
  source?: string;
};
type SavedChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: {
  sources?: Source[];
  detected_domain?: string;
  question_id?: number;
  relatedDevices?: DeviceAsset[];
  resource_links?: ResourceLink[];
  resource_images?: ResourceImage[];
  attachment?: ChatMessage["attachment"];

  file_name?: string;
  file_url?: string;
  file_type?: string;

  test_type?: string;
  test_type_label?: string;

  image_type?: string;
  image_type_label?: string;
};
  created_at: string;
};
type ToolAction =
  | "upload"
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
    label: "آپلود فایل یا عکس",
    description: "تحلیل PDF، Excel، CSV، عکس خطا یا کروماتوگرام",
    action: "upload",
    icon: "📎",
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
function getToolIcon(action: ToolAction): LucideIcon {
  if (action === "upload") return Paperclip;
  if (action === "troubleshooting") return Wrench;
  if (action === "device-suggestion") return Settings;
  if (action === "catalyst-suggestion") return FlaskConical;
  return UserRound;
}
function ToolMenu({
  onSelect,
}: {
  onSelect: (action: ToolAction) => void;
}) {
  
  return (
    <div className="w-[245px] overflow-hidden rounded-[18px] border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-300/40">
      {tools.map((tool, index) => {
        const Icon = getToolIcon(tool.action);
   
        return (
          <button
            key={tool.action}
            onClick={() => onSelect(tool.action)}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-[13px] font-medium text-slate-800 transition hover:bg-slate-50 ${
              index === 0 || index === 3 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-700">
              <Icon size={17} strokeWidth={1.9} />
            </span>

            <span className="flex-1">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}
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
function shouldShowRelatedDeviceCards(userText: string, selectedDomain: string) {
  const text = userText.toLowerCase();

  if (selectedDomain === "equipment") return true;

  const intentKeywords = [
    "دستگاه",
    "تجهیز",
    "تجهیزات",
    "آنالایزر",
    "مدل",
    "برند",
    "عکس",
    "تصویر",
    "کاتالوگ",
    "پیشنهاد دستگاه",
    "چه دستگاهی",
    "چه تجهیزی",
    "دستگاه مناسب",
    "تجهیز مناسب",
    "خرید",
    "استعلام",
    "قیمت",
    "موجودی",
    "device",
    "equipment",
    "instrument",
    "analyzer",
    "model",
    "brand",
    "image",
    "photo",
    "picture",
    "catalog",
    "price",
    "quotation",
    "availability",
  ];

  return intentKeywords.some((keyword) => text.includes(keyword));
}
function ArtinazmaResourceCards({
  links,
  images,
}: {
  links?: ResourceLink[];
  images?: ResourceImage[];
}) {
  const hasLinks = links && links.length > 0;
  const hasImages = images && images.length > 0;

  if (!hasLinks && !hasImages) return null;

  return (
    <div className="mt-4 space-y-3">
      {hasImages && (
        <div className="grid gap-3 md:grid-cols-2">
          {images.map((image) => (
            <a
              key={image.url}
              href={image.page_url || image.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-[4/3] bg-slate-100">
                <img
                  src={image.url}
                  alt={image.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>

              <div className="p-3 text-sm font-bold text-slate-800">
                {image.title}
              </div>
            </a>
          ))}
        </div>
      )}

      {hasLinks && (
        <div className="rounded-[18px] border border-blue-100 bg-blue-50 p-3">
          <div className="mb-2 text-xs font-black text-blue-800">
            صفحه مرتبط در سایت آرتین آزما
          </div>

          <div className="space-y-1">
            {links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="block text-sm font-bold text-blue-700 hover:text-blue-900"
              >
                {link.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function RelatedDeviceCards({ devices }: { devices?: DeviceAsset[] }) {
  if (!devices || devices.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {devices.map((device) => (
        <div
          key={device.id}
          className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex gap-4 p-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              <img
                src={device.image}
                alt={device.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900">
                {device.title}
              </div>

              <div className="mt-2 text-xs leading-6 text-slate-500">
                {device.subtitle}
              </div>

              <div className="mt-3 rounded-full bg-blue-50 px-3 py-1 text-center text-xs font-bold text-blue-700">
                دستگاه مرتبط پیشنهادی
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default function AssistantPage() {
  const router = useRouter();
  const [sessionIdParam, setSessionIdParam] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [loadingSavedSession, setLoadingSavedSession] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showFileOptions, setShowFileOptions] = useState(false);
  const [chatTestType, setChatTestType] = useState("general");
  const [chatUserNote, setChatUserNote] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [chatImageType, setChatImageType] = useState("general");
  const [chatImageNote, setChatImageNote] = useState("");
  const [checkingCustomerLogin, setCheckingCustomerLogin] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const domainLabel = useMemo(() => getDomainLabel(domain), [domain]);

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }
  function makeSessionTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (!clean) return "گفتگوی جدید";

  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function getSavedCustomer(): Customer | null {
  try {
    const raw = localStorage.getItem("artin_customer");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function createCustomerChatSession(title: string) {
  const activeCustomer = customer || getSavedCustomer();

  if (!activeCustomer) return null;

  try {
    const res = await fetch(apiUrl("/customers/chat-sessions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: activeCustomer.id,
        title: makeSessionTitle(title),
      }),
    });

    const data = await res.json();

    if (!data.success || !data.session_id) return null;

    const newSessionId = Number(data.session_id);

    setCustomer(activeCustomer);
    setActiveSessionId(newSessionId);

    window.history.replaceState(null, "", `/assistant?session_id=${newSessionId}`);

    return newSessionId;
  } catch {
    return null;
  }
}

async function ensureCustomerSession(titleSource: string) {
  const activeCustomer = customer || getSavedCustomer();

  if (!activeCustomer) return null;

  if (!customer) {
    setCustomer(activeCustomer);
  }

  if (activeSessionId) return activeSessionId;

  return createCustomerChatSession(titleSource);
}

async function saveCustomerChatMessage(
  sessionId: number | null,
  role: "user" | "assistant",
  content: string,
  metadata: Record<string, unknown> = {}
) {
  const activeCustomer = customer || getSavedCustomer();

  if (!activeCustomer || !sessionId || !content.trim()) return;

  try {
    await fetch(apiUrl("/customers/chat-messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: activeCustomer.id,
        session_id: sessionId,
        role,
        content,
        metadata,
      }),
    });
  } catch {
    // ذخیره گفتگو نباید باعث خراب شدن چت اصلی شود
  }
}

async function loadSavedChatSession(customerId: number, sessionId: number) {
  setLoadingSavedSession(true);

  try {
    const res = await fetch(
      apiUrl(`/customers/${customerId}/chat-sessions/${sessionId}/messages`)
    );

    const data = await res.json();

    const savedMessages: ChatMessage[] = (data.messages || []).map(
      (item: SavedChatMessage) => ({
        role: item.role === "user" ? "user" : "assistant",
        content: item.content,
        sources: item.metadata?.sources || [],
        detected_domain: item.metadata?.detected_domain,
        question_id: item.metadata?.question_id,
        relatedDevices: item.metadata?.relatedDevices || [],
        resource_links: item.metadata?.resource_links || [],
        resource_images: item.metadata?.resource_images || [],
        attachment: item.metadata?.attachment
  ? {
      ...item.metadata.attachment,
      previewUrl:
        item.metadata.attachment.previewUrl ||
        (item.metadata.file_url
          ? apiUrl(item.metadata.file_url as string)
          : undefined),
    }
  : undefined,
      })
    );

    setMessages(savedMessages);
    setActiveSessionId(sessionId);
  } catch {
    setMessages([]);
  } finally {
    setLoadingSavedSession(false);
  }
}
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  setSessionIdParam(params.get("session_id"));
}, []);
useEffect(() => {
  const savedCustomer = getSavedCustomer();

  if (!savedCustomer) {
    router.replace("/customer-login");
    return;
  }

  setCustomer(savedCustomer);
  setCheckingCustomerLogin(false);

  if (sessionIdParam) {
    const sessionId = Number(sessionIdParam);

    if (!Number.isNaN(sessionId)) {
      loadSavedChatSession(savedCustomer.id, sessionId);
    }
  }
}, [router, sessionIdParam]);
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
   const customerSessionId = await ensureCustomerSession(finalMessage);

await saveCustomerChatMessage(customerSessionId, "user", finalMessage, {
  domain,
});
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
    history: previousMessages.map((item) => {
  let content = item.content;

  if (item.attachment) {
    content += `

اطلاعات فایل/عکس قبلی:
نام: ${item.attachment.name}
نوع: ${item.attachment.kind}
دسته‌بندی تحلیل: ${item.attachment.analysisType || ""}
توضیح کاربر: ${item.attachment.note || ""}
`;
  }

  return {
    role: item.role,
    content,
  };
}),
  }),
});

const rawText = await res.text();

if (!res.ok) {
  let serverMessage = "خطا در دریافت پاسخ از سرور.";

  try {
    const errorData = JSON.parse(rawText);
    serverMessage = errorData.message || errorData.error || serverMessage;
  } catch {}

  throw new Error(serverMessage);
}

let data;

try {
  data = JSON.parse(rawText);
} catch {
  throw new Error("پاسخ سرور معتبر نبود.");
}

const relatedDevices: DeviceAsset[] = [];

const assistantMessage: ChatMessage = {
  role: "assistant",
  content: data.answer || "پاسخی دریافت نشد.",
  sources: data.sources || [],
  detected_domain: data.detected_domain,
  question_id: data.question_id,
  relatedDevices,
  resource_links: data.resource_links || [],
  resource_images: data.resource_images || [],
};

await saveCustomerChatMessage(
  customerSessionId,
  "assistant",
  assistantMessage.content,
  {
    sources: assistantMessage.sources || [],
    detected_domain: assistantMessage.detected_domain,
    question_id: assistantMessage.question_id,
    relatedDevices,
    resource_links: assistantMessage.resource_links || [],
    resource_images: assistantMessage.resource_images || [],
  }
);

typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch (error) {
  console.error("CHAT ERROR:", error);

  setMessages([
    ...previousMessages,
    userMessage,
    {
      role: "assistant",
      content:
  "در حال حاضر ارتباط با سرویس پاسخ‌گویی دچار اختلال شده است. لطفاً چند لحظه بعد دوباره تلاش کنید.",
    },
  ]);
}
 finally {
      setLoading(false);
    }
  }

  function clearChat() {
  setMessages([]);
  setMessage("");
  setShowTools(false);
  setActiveSessionId(null);
  router.replace("/assistant");
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
    const customerSessionId = await ensureCustomerSession(`تحلیل فایل ${file.name}`);

await saveCustomerChatMessage(
  customerSessionId,
  "user",
  `فایل برای تحلیل ارسال شد: ${file.name}`,
  {
    attachment: userMessage.attachment,
  }
);
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

      const relatedDevices = shouldShowRelatedDeviceCards(
  `${file.name}\n${chatUserNote}`,
  domain
)
  ? findRelatedDevices(
      `${file.name}\n${chatUserNote}\n${data.ai_analysis || data.error || ""}`,
      2
    )
  : [];

const assistantMessage: ChatMessage = {
  role: "assistant",
  content:
    data.ai_analysis ||
    data.error ||
    "فایل دریافت شد، اما تحلیل مشخصی برگردانده نشد.",
  detected_domain: "file-analysis",
  relatedDevices,
};

await saveCustomerChatMessage(
  customerSessionId,
  "assistant",
  assistantMessage.content,
  {
    detected_domain: "file-analysis",
    file_name: data.file_name,
    file_url: data.file_url,
    file_type: data.file_type,
    test_type: data.test_type,
    test_type_label: data.test_type_label,
    relatedDevices,
  }
);


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
    const customerSessionId = await ensureCustomerSession(`تحلیل عکس ${file.name}`);

await saveCustomerChatMessage(
  customerSessionId,
  "user",
  `عکس برای تحلیل ارسال شد: ${file.name}`,
  {
    attachment: userMessage.attachment,
  }
);
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

      const relatedDevices = shouldShowRelatedDeviceCards(
  `${file.name}\n${chatImageNote}`,
  domain
)
  ? findRelatedDevices(
      `${file.name}\n${chatImageNote}\n${data.ai_analysis || data.error || ""}`,
      2
    )
  : [];

const assistantMessage: ChatMessage = {
  role: "assistant",
  content:
    data.ai_analysis ||
    data.error ||
    "عکس دریافت شد، اما تحلیل مشخصی برگردانده نشد.",
  detected_domain: "image-analysis",
  relatedDevices,
};

await saveCustomerChatMessage(
  customerSessionId,
  "assistant",
  assistantMessage.content,
  {
    detected_domain: "image-analysis",
    file_name: data.file_name,
    file_url: data.file_url,
    file_type: data.file_type,
    image_type: data.image_type,
    image_type_label: data.image_type_label,
    relatedDevices,
  }
);

typeAssistantMessage(previousMessages, userMessage, assistantMessage);
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
  function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];

  if (!file) return;

  const fileName = file.name.toLowerCase();
  const ext = fileName.split(".").pop() || "";

  if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
    setPendingImage(file);
    setShowImageOptions(true);
    setChatImageType("general");
    setChatImageNote("");
  } else {
    setPendingFile(file);
    setShowFileOptions(true);
    setChatTestType("general");
    setChatUserNote("");
  }

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
    if (action === "upload") {
  uploadInputRef.current?.click();
  return;
}    
    if (action === "customer-request") {
      router.push("/customer-request");
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
   if (checkingCustomerLogin) {
  return (
    <section className="flex h-full items-center justify-center bg-white px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-lg font-bold text-slate-900">
          در حال بررسی ورود مشتری...
        </div>

        <div className="mt-3 text-sm text-slate-500">
          برای استفاده از آرتین باید وارد حساب کاربری شوید.
        </div>
      </div>
    </section>
  );
}
  return (
     <section className="flex h-full max-h-screen min-w-0 flex-col overflow-hidden bg-[#ffffff]">      <input
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
      <input
         ref={uploadInputRef}
         type="file"
         accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
         onChange={handleUploadChange}
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
        {loadingSavedSession && (
  <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-blue-50 p-4 text-center text-sm font-bold text-blue-700">
    در حال بارگذاری گفتگوی ذخیره‌شده...
  </div>
)}
        <div className="mx-auto w-full max-w-6xl px-6 pb-6 pt-6">
          {messages.length === 0 ? (
  <div className="mx-auto flex min-h-[calc(100vh-130px)] max-w-4xl flex-col items-center justify-center px-4 text-center">
    <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
      امروز چه کمکی از آرتین می‌خواهید؟
    </h2>

    <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
      سوال تخصصی بپرسید، فایل تست یا عکس خطا ارسال کنید، یا درخواست مشاوره ثبت کنید.
    </p>

    <div className="relative mt-8 w-full max-w-3xl">
      {showTools && (
  <div className="absolute top-full right-0 z-50 mt-2">
    <ToolMenu onSelect={handleToolClick} />
  </div>
)}

      <div className="rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setShowTools((prev) => !prev)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
          >
            +
          </button>

          <textarea
            dir="auto"
            style={{ fontFamily: getTextFont(message || "فارسی") }}
            className="max-h-32 min-h-[46px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[17px] leading-7 outline-none"
            placeholder="از آرتین بپرسید..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={() => sendMessage()}
            disabled={loading || !message.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xl text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-300"
          >
            ↑
          </button>
        </div>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <button
  onClick={() => handleToolClick("upload")}
  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
>
  آپلود فایل یا عکس
</button>

      <button
        onClick={() => handleToolClick("customer-request")}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
      >
        درخواست مشاوره
      </button>
    </div>
  </div>
) : (
            <div className="mx-auto w-full max-w-5xl space-y-7 pb-4">
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
      {messages.length > 0 && (
      <footer className="shrink-0 border-t border-slate-200/70 bg-white/75 backdrop-blur-xl">
        
        <div className="mx-auto w-full max-w-6xl px-6 py-3">
          <div className="relative mx-auto max-w-4xl">
            {showTools && (
  <div className="absolute bottom-full left-0 right-auto z-50 mb-2 md:left-auto md:right-0">
    <ToolMenu onSelect={handleToolClick} />
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
      )}
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
  {isUser ? (
    displayContent
  ) : (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900"
          >
            {children}
          </a>
        ),
      }}
    >
      {displayContent}
    </ReactMarkdown>
  )}
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
  <ArtinazmaResourceCards
    links={item.resource_links}
    images={item.resource_images}
  />
)}
          {!isUser && (
            <div className="mt-4 space-y-3">
              
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