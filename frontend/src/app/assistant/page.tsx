"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";
import {
  Loader,
  Paperclip,
  Wrench,
  Settings,
  FlaskConical,
  UserRound,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Plus,
  Mic,
  MicOff,
  Download,
  ImagePlus,
  X as XIcon,
  Volume2,
  VolumeX,
  SlidersHorizontal,
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
function ToolMenu({ onSelect }: { onSelect: (action: ToolAction) => void }) {
  return (
    <div className="ui-card w-[245px] overflow-hidden rounded-[18px] py-1.5 shadow-xl shadow-slate-300/40">
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
  return (
    imageTypes.find((item) => item.value === value)?.label || "تصویر عمومی"
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanMarkdownText(text: string) {
  if (!text) return "";

  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s*---+\s*$/gm, "")
    .trim();
  // اگر مدل جدول را داخل code block برگرداند، آن را از حالت کد خارج می‌کنیم
  cleaned = cleaned
    .replace(/```(?:markdown|md)?\s*\n([\s\S]*?\|[\s\S]*?)\n```/gi, "$1")
    .replace(/```\s*\n([\s\S]*?\|[\s\S]*?)\n```/g, "$1");

  // اگر خطوط جدول با فاصله شروع شده باشند، Markdown آن را code block حساب می‌کند.
  // این بخش فقط خطوط جدول را trim می‌کند تا remark-gfm بتواند جدول را رندر کند.
  cleaned = cleaned
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      const looksLikeTableLine =
        trimmed.includes("|") &&
        (trimmed.startsWith("|") ||
          trimmed.endsWith("|") ||
          /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed));

      return looksLikeTableLine ? trimmed : line;
    })
    .join("\n");
  const sectionTitles = [
    "جمع‌بندی کاربردی",
    "جمع بندی کاربردی",
    "جمع‌بندی",
    "جمع بندی",
    "تفاوت بنیادی",
    "مقایسه فنی و عملیاتی",
    "مقایسه فنی",
    "روش‌ها یا دستگاه‌های مناسب",
    "روش ها یا دستگاه های مناسب",
    "معیار انتخاب",
    "نکات نمونه‌برداری",
    "نکات نمونه برداری",
    "آماده‌سازی نمونه",
    "آماده سازی نمونه",
    "کنترل کیفیت",
    "QC",
    "محدودیت‌ها و خطاهای رایج",
    "محدودیت‌ها",
    "محدودیت ها",
    "خطاهای رایج",
    "سناریوی انتخاب",
    "پیشنهاد عملی",
    "اقدام بعدی",
    "اطلاعات لازم برای تصمیم قطعی",
    "اطلاعات تکمیلی موردنیاز",
    "اطلاعات تکمیلی مورد نیاز",
  ];

  for (const title of sectionTitles) {
    const pattern = new RegExp(
      `^\\s*(?:[-*]\\s*)?(?:\\*\\*\\s*)?${escapeRegExp(title)}(?:\\s*\\*\\*)?(?:\\s*:)?\\s*$`,
      "gmi",
    );

    cleaned = cleaned.replace(pattern, `## ${title}`);
  }

  // تبدیل بولت فارسی/یونیکدی به markdown واقعی
  cleaned = cleaned.replace(/\s*[•●▪]\s*/g, "\n- ");

  // اگر مدل چند بولت را پشت سر هم در یک خط داده باشد
  cleaned = cleaned.replace(/([^\n])\s+-\s+/g, "$1\n- ");

  // توجه: بولد خودکار "کلید:" باعث به‌هم‌ریختگی bidi در متن فارسی/لاتین می‌شد.
  // برای پایداری چیدمان، ساختار لیست را بدون دستکاری بولد نگه می‌داریم.

  // اصلاح فاصله‌های اضافه
  cleaned = cleaned
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  // پایدارسازی جهت نمایش توکن‌های لاتین داخل متن فارسی
  // با قرار دادن FSI/PDI دور واژه‌های لاتین، جابه‌جایی بصری در RTL کمتر می‌شود.
  if (hasPersianText(cleaned)) {
    cleaned = cleaned
      // عبارت‌های انگلیسی داخل پرانتز را یکپارچه LTR نگه می‌دارد
      .replace(/\(([A-Za-z][A-Za-z0-9.+/\-\s]{1,})\)/g, "(\u2066$1\u2069)")
      // مخفف‌های فنی مثل XRF, ICP, ICP-OES, GC-MS را LTR نگه می‌دارد
      .replace(/\b([A-Z]{2,}(?:-[A-Z0-9]+)?)\b/g, "\u2066$1\u2069");
  }

  return cleaned;
}

function hasPersianText(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function getTextDirection(text: string) {
  return hasPersianText(text) ? "rtl" : "ltr";
}

function getTextFont(text: string) {
  return hasPersianText(text) ? "var(--font-persian)" : "var(--font-english)";
}
function shouldShowRelatedDeviceCards(
  userText: string,
  selectedDomain: string,
) {
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

// Voice Input Hook — uses MediaRecorder + OpenAI Whisper (works without Google services)
type VoiceState = "idle" | "listening" | "processing" | "unsupported";

function useVoiceInput(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported =
    typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    // transcription happens in onstop
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) { setVoiceState("unsupported"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceState("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const formData = new FormData();
          formData.append("file", blob, `recording.${ext}`);
          const res = await fetch(
            (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000") + "/transcribe",
            { method: "POST", body: formData }
          );
          if (res.ok) {
            const data = await res.json() as { transcript?: string };
            if (data.transcript?.trim()) onTranscript(data.transcript.trim());
          }
        } catch (err) {
          console.error("Whisper transcription failed:", err);
        } finally {
          setVoiceState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState("listening");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // User chose undo — state already restored in undoSend()
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        alert("دسترسی به میکروفون رد شده. لطفاً از تنظیمات مرورگر مجوز میکروفون را فعال کنید.");
      }
      setVoiceState("idle");
    }
  }, [isSupported, onTranscript]);

  const toggleVoice = useCallback(() => {
    if (voiceState === "listening") stopAndTranscribe();
    else if (voiceState === "idle") startListening();
  }, [voiceState, startListening, stopAndTranscribe]);

  return { voiceState, toggleVoice, isSupported };
}

function AssistantPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("session_id");
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [responseMode, setResponseMode] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<number, string>>({},);
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
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [stagedImageUrl, setStagedImageUrl] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsNote, setTtsNote] = useState<string>("");
  const [canUndo, setCanUndo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedMsgRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const { voiceState, toggleVoice, isSupported: isVoiceSupported } = useVoiceInput(
    (transcript) => setMessage((prev) => prev ? prev + " " + transcript : transcript)
  );

  function stageImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setStagedImage(file);
    const url = URL.createObjectURL(file);
    setStagedImageUrl(url);
  }

  function clearStagedImage() {
    setStagedImage(null);
    if (stagedImageUrl) URL.revokeObjectURL(stagedImageUrl);
    setStagedImageUrl("");
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        stageImageFile(file);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    const hasImage = Array.from(e.dataTransfer.types).includes("Files");
    if (hasImage) { e.preventDefault(); setIsDragOver(true); }
  }

  function handleDragLeave() { setIsDragOver(false); }

  function handleDrop(e: React.DragEvent) {
    setIsDragOver(false);
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      stageImageFile(file);
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function sendQuickAction(
    action: "shorter" | "technical" | "table",
    answerText: string,
  ) {
    const cleanAnswer = answerText.trim();

    const prompts = {
      shorter: `این متن را خلاصه‌تر، کاربردی‌تر و منظم‌تر بازنویسی کن. فقط نسخه نهایی را بده و مقدمه اضافه نکن:

${cleanAnswer}`,

      technical: `این متن را فنی‌تر، دقیق‌تر و کامل‌تر بازنویسی کن. توضیح باید منظم، قابل فهم و مناسب کارشناس آزمایشگاه باشد. فقط نسخه نهایی را بده و مقدمه اضافه نکن:

${cleanAnswer}`,

      table: `درخواست امن و مجاز: فقط متن فنی زیر را از حالت توضیحی به جدول Markdown تبدیل کن.
هیچ اطلاعات جدیدی اضافه نکن.
اگر متن درباره روش‌های آزمایشگاهی، دستگاه، استاندارد یا نمونه است، همان اطلاعات موجود را در جدول خلاصه کن.
خروجی فقط فارسی باشد.
ابتدا جدول Markdown بده، سپس یک جمع‌بندی کوتاه یک‌خطی بنویس.

متن برای تبدیل به جدول:
${cleanAnswer}`,
    };

    const visibleMessages = {
      shorter: "خلاصه‌تر کن",
      technical: "فنی‌تر توضیح بده",
      table: "تبدیل به جدول",
    };

    sendMessage(prompts[action], visibleMessages[action]);
  }

  function makeSessionTitle(text: string) {
    const clean = text.replace(/\s+/g, " ").trim();

    if (!clean) return "گفتگوی جدید";

    return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
  }

  // Undo send — abort in-flight request and restore message
  // Edit & Retry: truncate history to before the edited message, re-send
  function handleEditMessage(msgIndex: number, newText: string) {
    // Keep only messages before this user message
    const history = messages.slice(0, msgIndex);
    setMessages(history);
    sendMessage(newText, newText);
  }

  function undoSend() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setCanUndo(false);
    setLoading(false);
    setMessage(savedMsgRef.current);
    setMessages((prev) => prev.slice(0, -2)); // remove user msg + placeholder
  }

  const _ttsKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function _clearTtsKeepAlive() {
    if (_ttsKeepAliveRef.current) {
      clearInterval(_ttsKeepAliveRef.current);
      _ttsKeepAliveRef.current = null;
    }
  }

  function speakMessage(text: string, index: number) {
    if (!("speechSynthesis" in window)) {
      setTtsNote("مرورگر شما از قابلیت خواندن متن پشتیبانی نمی‌کند.");
      setTimeout(() => setTtsNote(""), 5000);
      return;
    }

    // Toggle off if already speaking this message
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      _clearTtsKeepAlive();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    _clearTtsKeepAlive();

    // Strip markdown for cleaner TTS
    const clean = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*_]{3,}/g, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 3000);

    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      const utter = new SpeechSynthesisUtterance(clean);

      // Prefer Persian → Arabic → default → any available voice
      const bestVoice =
        voices.find((v) => v.lang.startsWith("fa")) ||
        voices.find((v) => v.lang.startsWith("ar")) ||
        voices.find((v) => v.default) ||
        voices[0];

      if (bestVoice) utter.voice = bestVoice;
      // Use voice's own lang to prevent Chrome from rejecting utterance
      // (forcing fa-IR with no Persian voice causes immediate error)
      utter.lang = bestVoice?.lang ?? "fa-IR";
      utter.rate = 0.85;
      utter.pitch = 1;

      utter.onstart = () => {
        // Clear any previous note once speech actually starts
        setTtsNote("");
      };
      utter.onend = () => {
        _clearTtsKeepAlive();
        setSpeakingIndex(null);
      };
      utter.onerror = (e) => {
        _clearTtsKeepAlive();
        setSpeakingIndex(null);
        if (e.error !== "interrupted") {
          setTtsNote(
            "صدای فارسی روی سیستم شما نصب نیست. برای نصب: Settings → Time & Language → Speech → Add voices → Persian"
          );
          setTimeout(() => setTtsNote(""), 12000);
        }
      };

      setSpeakingIndex(index);
      window.speechSynthesis.speak(utter);

      // Chrome bug: pauses itself after ~15s — keep alive with pause/resume
      _ttsKeepAliveRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          _clearTtsKeepAlive();
          setSpeakingIndex(null);
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 10000);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak(window.speechSynthesis.getVoices());
      };
      // Fallback: some browsers never fire onvoiceschanged
      setTimeout(() => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) doSpeak(v);
      }, 600);
    }
  }

  async function sendAnswerFeedback(
    questionId: number | undefined,
    rating: "up" | "down",
    comment?: string,
  ) {
    if (!questionId) return;
    // Optimistic update
    setFeedbackStatus((prev) => ({ ...prev, [questionId]: rating }));
    try {
      await fetch(apiUrl(`/questions/${questionId}/feedback`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || "" }),
      });
    } catch {
      // خطای بازخورد نباید چت را خراب کند
    }
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

      window.history.replaceState(
        null,
        "",
        `/assistant?session_id=${newSessionId}`,
      );

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
    metadata: Record<string, unknown> = {},
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
        apiUrl(`/customers/${customerId}/chat-sessions/${sessionId}/messages`),
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
        }),
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

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setTimeout(() => setRateLimitCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  function typeAssistantMessage(
    previousMessages: ChatMessage[],
    userMessage: ChatMessage,
    assistantMessage: ChatMessage,
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

  async function sendMessage(customMessage?: string, displayMessage?: string) {
    // If there's a staged image, route to image analysis instead
    if (stagedImage && !customMessage) {
      const imgFile = stagedImage;
      const note = message.trim();
      clearStagedImage();
      setMessage("");
      uploadAndAnalyzeImage(imgFile, note, "general");
      return;
    }

    const finalMessage = customMessage || message;
    const visibleMessage = displayMessage || finalMessage;

    if (!finalMessage.trim()) return;

    const previousMessages = messages;
    const userId = getOrCreateUserId();

    const userMessage: ChatMessage = {
      role: "user",
      content: visibleMessage,
    };

    const customerSessionId = await ensureCustomerSession(visibleMessage);

    await saveCustomerChatMessage(customerSessionId, "user", visibleMessage, {
      domain,
      response_mode: responseMode,
      actual_prompt: displayMessage ? finalMessage : undefined,
    });

    savedMsgRef.current = finalMessage;
    setMessages([...previousMessages, userMessage]);
    setMessage("");
    setLoading(true);
    setShowTools(false);
    // Undo window: 5 seconds before Artin responds
    abortControllerRef.current = new AbortController();
    setCanUndo(true);
    undoTimerRef.current = setTimeout(() => { setCanUndo(false); }, 5000);

    setSuggestedQuestions([]);
    // پیام placeholder خالی برای نمایش حین streaming
    const placeholderMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...previousMessages, userMessage, placeholderMsg]);

    const activeCustomer = customer || getSavedCustomer();

    const bodyPayload = {
      message: finalMessage,
      domain,
      response_mode: responseMode,
      user_id: activeCustomer ? `customer_${activeCustomer.id}` : userId,
      customer_id: activeCustomer ? activeCustomer.id : undefined,
      history: previousMessages.map((item) => {
        let content = item.content;
        if (item.attachment) {
          content += `\n\nاطلاعات فایل/عکس قبلی:\nنام: ${item.attachment.name}\nنوع: ${item.attachment.kind}\nدسته‌بندی تحلیل: ${item.attachment.analysisType || ""}\nتوضیح کاربر: ${item.attachment.note || ""}`;
        }
        return { role: item.role, content };
      }),
    };

    try {
      const res = await fetch(apiUrl("/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: abortControllerRef.current?.signal,
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        setRateLimitCountdown(isNaN(retryAfter) ? 60 : retryAfter);
        setMessages([
          ...previousMessages,
          userMessage,
          {
            role: "assistant",
            content: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.",
          },
        ]);
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error("خطا در دریافت پاسخ از سرور.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let metaData: Record<string, unknown> = {};
      let finalAssistantMsg: ChatMessage = { role: "assistant", content: "" };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "meta") {
              metaData = event;
              finalAssistantMsg = {
                role: "assistant",
                content: accumulatedText,
                sources: (event.sources as Source[]) || [],
                detected_domain: event.detected_domain as string,
                resource_links: (event.resource_links as ResourceLink[]) || [],
                resource_images: (event.resource_images as ResourceImage[]) || [],
              };
            } else if (event.type === "chunk") {
              accumulatedText += event.text as string;
              setMessages([
                ...previousMessages,
                userMessage,
                { ...finalAssistantMsg, content: accumulatedText },
              ]);
            } else if (event.type === "done") {
              finalAssistantMsg = {
                ...finalAssistantMsg,
                content: accumulatedText,
                question_id: event.question_id as number,
              };
              setMessages([...previousMessages, userMessage, finalAssistantMsg]);

              // ذخیره در session مشتری
              await saveCustomerChatMessage(
                customerSessionId,
                "assistant",
                finalAssistantMsg.content,
                {
                  sources: finalAssistantMsg.sources || [],
                  detected_domain: finalAssistantMsg.detected_domain,
                  question_id: finalAssistantMsg.question_id,
                  resource_links: finalAssistantMsg.resource_links || [],
                  resource_images: finalAssistantMsg.resource_images || [],
                },
              );
            } else if (event.type === "error") {
              throw new Error(event.message as string || "خطا در دریافت پاسخ.");
            }
          } catch (parseErr) {
            // ادامه parsing خطوط دیگر
          }
        }
      }

      setLoading(false);
      setCanUndo(false);
      if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
      abortControllerRef.current = null;
      void metaData; // suppress unused warning

      // پیشنهاد سوالات مرتبط (non-blocking)
      if (accumulatedText.length > 100) {
        fetch(apiUrl("/chat/suggest-questions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: finalMessage,
            answer: accumulatedText,
            domain: finalAssistantMsg.detected_domain || "auto",
          }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.questions?.length) setSuggestedQuestions(d.questions); })
          .catch(() => {});
      }
    } catch (error) {
      console.error("CHAT ERROR:", error);
      const isOffline = !navigator.onLine;
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: isOffline
            ? "اتصال اینترنت شما قطع است. پس از برقراری مجدد اتصال، دوباره تلاش کنید."
            : "در حال حاضر ارتباط با سرویس پاسخ‌گویی دچار اختلال شده است. لطفاً چند لحظه بعد دوباره تلاش کنید.",
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
    setActiveSessionId(null);
    router.replace("/assistant");
  }

  function exportChat() {
    if (messages.length === 0) return;
    const html = _buildExportHtml(false);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    setShowExportMenu(false);
  }

  function _buildExportHtml(forWord: boolean): string {
    const now = new Date().toLocaleDateString("fa-IR", {
      year: "numeric", month: "long", day: "numeric",
    });
    const msgHtml = messages.map((msg) => {
      if (msg.role === "user") {
        const attachLine = msg.attachment
          ? `<div class="attachment">📎 پیوست: ${msg.attachment.name}</div>`
          : "";
        const body = msg.content
          ? `<p>${msg.content.replace(/\n/g, "<br/>")}</p>`
          : "";
        return `<div class="bubble user"><div class="label">کاربر</div>${attachLine}${body}</div>`;
      } else {
        const safe = msg.content
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/^#{1,3}\s+(.+)$/gm, "<b>$1</b><br/>")
          .replace(/\n/g, "<br/>");
        return `<div class="bubble artin"><div class="label">آرتین</div><p>${safe}</p></div>`;
      }
    }).join("");
    const font = forWord ? "Arial, sans-serif" : "'Vazirmatn', sans-serif";
    const fontLink = forWord ? "" : `<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;900&display=swap"/>`;
    const printScript = forWord ? "" : `<script>window.onload=function(){window.print();}\u003c/script>`;
    return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8"/>
<title>گفتگو با آرتین — آرتین آزما</title>
${fontLink}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${font}; background: #fff; color: #1e293b; padding: 40px; font-size: 13px; direction: rtl; }
  .header { border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 28px; }
  .header h1 { font-size: 20px; font-weight: 900; color: #7c3aed; }
  .header .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
  .bubble { margin-bottom: 20px; padding: 14px 16px; border-radius: 16px; page-break-inside: avoid; }
  .bubble.user { background: #ede9fe; border-right: 4px solid #7c3aed; }
  .bubble.artin { background: #f1f5f9; border-right: 4px solid #0ea5e9; }
  .label { font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; }
  .bubble.user .label { color: #7c3aed; }
  .bubble.artin .label { color: #0ea5e9; }
  p { line-height: 2; }
  .attachment { font-size: 11px; color: #64748b; margin-bottom: 6px; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>گفتگو با آرتین — دستیار هوشمند آرتین آزما</h1>
  <div class="meta">تاریخ: ${now} | تعداد پیام: ${messages.length}</div>
</div>
${msgHtml}
<div class="footer">آرتین آزما مهر — artinazma.net</div>
${printScript}
</body>
</html>`;
  }

  function exportChatWord() {
    if (messages.length === 0) return;
    const html = _buildExportHtml(true);
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `گفتگو-آرتین-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }

  function exportChatText() {
    if (messages.length === 0) return;
    const now = new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
    const lines: string[] = [
      "گفتگو با آرتین — دستیار هوشمند آرتین آزما",
      `تاریخ: ${now}`,
      "═══════════════════════════════════════",
      "",
    ];
    messages.forEach((msg, i) => {
      if (msg.role === "user") {
        lines.push(`── کاربر [${i + 1}] ──`);
        if (msg.attachment) lines.push(`📎 پیوست: ${msg.attachment.name}`);
        lines.push(msg.content);
      } else {
        lines.push(`── آرتین [${i + 1}] ──`);
        lines.push(msg.content.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/#{1,6}\s/g, ""));
      }
      lines.push("");
    });
    lines.push("───────────────────────────────────────");
    lines.push("آرتین آزما مهر — artinazma.net");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `گفتگو-آرتین-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
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
    const customerSessionId = await ensureCustomerSession(
      `تحلیل فایل ${file.name}`,
    );

    await saveCustomerChatMessage(
      customerSessionId,
      "user",
      `فایل برای تحلیل ارسال شد: ${file.name}`,
      {
        attachment: userMessage.attachment,
      },
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
        domain,
      )
        ? findRelatedDevices(
            `${file.name}\n${chatUserNote}\n${data.ai_analysis || data.error || ""}`,
            2,
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
        },
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

  async function uploadAndAnalyzeImage(file: File, noteOverride?: string, typeOverride?: string) {
    setShowTools(false);

    const note = noteOverride !== undefined ? noteOverride : chatImageNote;
    const imgType = typeOverride || chatImageType;
    const previewUrl = URL.createObjectURL(file);

    const userMessage: ChatMessage = {
      role: "user",
      content: note ? `عکس برای تحلیل ارسال شد — توضیح: ${note}` : "عکس برای تحلیل ارسال شد.",
      attachment: {
        name: file.name,
        kind: "image",
        analysisType: getImageTypeLabel(imgType),
        note,
        status: "analyzing",
        previewUrl,
      },
    };

    const previousMessages = messages;
    const customerSessionId = await ensureCustomerSession(
      `تحلیل عکس ${file.name}`,
    );

    await saveCustomerChatMessage(
      customerSessionId,
      "user",
      `عکس برای تحلیل ارسال شد: ${file.name}`,
      {
        attachment: userMessage.attachment,
      },
    );
    setMessages([...previousMessages, userMessage]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", imgType);
    formData.append("user_note", note);

    try {
      const res = await fetch(apiUrl("/analyze-image"), {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      const relatedDevices = shouldShowRelatedDeviceCards(
        `${file.name}\n${note}`,
        domain,
      )
        ? findRelatedDevices(
            `${file.name}\n${note}\n${data.ai_analysis || data.error || ""}`,
            2,
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
        },
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
        "برای عیب‌یابی این مشکل دستگاه، علت‌های احتمالی و چک‌لیست مرحله‌ای بده: ",
      );
      return;
    }

    if (action === "device-suggestion") {
      setDomain("equipment");
      setMessage(
        "برای این کاربرد یا نوع نمونه، دستگاه/تجهیز مناسب آرتین آزما را پیشنهاد بده: ",
      );
      return;
    }

    if (action === "catalyst-suggestion") {
      setDomain("catalyst");
      setMessage(
        "برای این فرایند یا مشکل، کاتالیست مناسب یا تست‌های لازم برای بررسی کاتالیست را پیشنهاد بده: ",
      );
    }
  }
  if (checkingCustomerLogin) {
    return (
      <section className="flex h-full items-center justify-center bg-white px-6">
        <div className="ui-card rounded-[28px] p-8 text-center shadow-sm">
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
    <section
      className={`flex h-full max-h-screen min-w-0 flex-col overflow-hidden bg-[#ffffff] transition-colors ${isDragOver ? "ring-2 ring-inset ring-blue-400 bg-blue-50/30" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 rounded-[32px] border-2 border-dashed border-blue-400 bg-white/90 px-10 py-8 shadow-xl">
            <ImagePlus size={40} className="text-blue-500" />
            <span className="text-lg font-black text-blue-600">عکس را اینجا رها کنید</span>
          </div>
        </div>
      )}
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

      {voiceState === "listening" && (
        <div className="flex items-center justify-center gap-2 bg-red-50 py-2 text-sm font-medium text-red-600" dir="rtl">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          در حال ضبط صدا... صحبت کنید
        </div>
      )}

      <header className="shrink-0 border-b border-slate-100 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/artin-avatar.png"
              alt="آرتین"
              className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-[15px] font-bold text-slate-800">آرتین</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
              آنلاین
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Domain + mode — visible on desktop, hidden on mobile */}
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none md:block"
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
            <select
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value)}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none md:block"
            >
              <option value="auto">پاسخ هوشمند</option>
              <option value="brief">خلاصه</option>
              <option value="technical">فنی کامل</option>
              <option value="checklist">چک‌لیست</option>
            </select>
            {/* Mobile settings toggle — only on mobile */}
            <button
              onClick={() => setShowMobileSettings((v) => !v)}
              title="تنظیمات"
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition md:hidden ${
                showMobileSettings
                  ? "border-blue-300 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>
            {messages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  title="خروجی گفتگو"
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Download size={13} />
                  دانلود
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:left-0 max-[400px]:left-auto max-[400px]:right-0">
                      <button
                        onClick={exportChat}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-purple-50 hover:text-purple-700"
                      >
                        <span className="text-base">📄</span>
                        PDF (چاپ)
                      </button>
                      <button
                        onClick={exportChatWord}
                        className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <span className="text-base">📝</span>
                        Word (.doc)
                      </button>
                      <button
                        onClick={exportChatText}
                        className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <span className="text-base">📋</span>
                        متن ساده (.txt)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Plus size={13} />
              جدید
            </button>
          </div>
        </div>
      </header>

      {/* Mobile settings panel — slides in below header on small screens */}
      {showMobileSettings && (
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 md:hidden" dir="rtl">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-500">حوزه:</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
            <label className="text-xs font-bold text-slate-500">پاسخ:</label>
            <select
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="auto">پاسخ هوشمند</option>
              <option value="brief">خلاصه</option>
              <option value="technical">فنی کامل</option>
              <option value="checklist">چک‌لیست</option>
            </select>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingSavedSession && (
          <div className="ui-alert ui-alert-info mx-auto mt-6 max-w-xl text-center text-sm font-bold">
            در حال بارگذاری گفتگوی ذخیره‌شده...
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[calc(100vh-130px)] max-w-4xl flex-col items-center justify-center px-4 text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                امروز چه کمکی از آرتین می‌خواهید؟
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
                سوال تخصصی بپرسید، فایل تست یا عکس خطا ارسال کنید، یا درخواست
                مشاوره ثبت کنید.
              </p>

              {rateLimitCountdown > 0 && (
                <div className="mb-3 flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-700">
                  <span className="text-lg">⏳</span>
                  <span>محدودیت ارسال فعال است — لطفاً</span>
                  <span className="rounded-xl bg-amber-100 px-3 py-1 text-base font-black tabular-nums">
                    {rateLimitCountdown}
                  </span>
                  <span>ثانیه دیگر تلاش کنید.</span>
                </div>
              )}

              <div className="relative mt-5 w-full max-w-3xl px-1 md:mt-8 md:px-0">
                {showTools && (
                  <div className="absolute top-full right-0 z-50 mt-2">
                    <ToolMenu onSelect={handleToolClick} />
                  </div>
                )}

                <div className="ui-card rounded-[32px] shadow-xl shadow-slate-200/70">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => setShowTools((prev) => !prev)}
                      className="ui-btn ui-btn-ghost flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-2xl"
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

                    {isVoiceSupported && (
                      <button
                        onClick={toggleVoice}
                        title={voiceState === "listening" ? "توقف ضبط" : "ورودی صوتی"}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                          voiceState === "listening"
                            ? "animate-pulse bg-red-100 text-red-500"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      >
                        {voiceState === "listening" ? <MicOff size={18} /> : voiceState === "processing" ? <Loader size={18} /> : <Mic size={18} />}
                      </button>
                    )}
                    <button
                      onClick={() => sendMessage()}
                      disabled={loading || !message.trim() || rateLimitCountdown > 0}
                      className="ui-btn ui-btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-xl shadow-sm disabled:bg-slate-300"
                    >
                      ↑
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-nowrap justify-start gap-2 overflow-x-auto pb-1 md:mt-5 md:flex-wrap md:justify-center md:gap-3">
                <button
                  onClick={() => handleToolClick("upload")}
                  className="ui-btn ui-btn-ghost rounded-full px-4 py-2 text-sm shadow-sm"
                >
                  آپلود فایل یا عکس
                </button>

                <button
                  onClick={() => handleToolClick("customer-request")}
                  className="ui-btn ui-btn-ghost rounded-full px-4 py-2 text-sm shadow-sm"
                >
                  درخواست مشاوره
                </button>
              </div>

              {/* سوال‌های پیشنهادی آماده */}
              <StarterQuestions onSelect={(q) => sendMessage(q, q)} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-5 pb-4 md:space-y-7">
              {messages.map((item, index) => (
                <MessageBubble
                  key={index}
                  item={item}
                  index={index}
                  loading={loading}
                  onCopy={copyText}
                  onRequest={() => router.push("/customer-request")}
                  onQuickAction={sendQuickAction}
                  onFeedback={sendAnswerFeedback}
                  feedbackValue={
                    item.question_id
                      ? feedbackStatus[item.question_id]
                      : undefined
                  }
                  onSpeak={speakMessage}
                  isSpeaking={speakingIndex === index}
                  onEdit={handleEditMessage}
                />
              ))}

              {/* راهنمای نصب صدای TTS */}
              {ttsNote && (
                <div className="mx-2 mt-1 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <Volume2 size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>{ttsNote}</span>
                  <button onClick={() => setTtsNote("")} className="mr-auto shrink-0 text-amber-400 hover:text-amber-600">✕</button>
                </div>
              )}

              {/* سوالات پیشنهادی */}
              {!loading && suggestedQuestions.length > 0 && (
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 pt-1 md:flex-wrap">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSuggestedQuestions([]);
                        sendMessage(q, q);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {canUndo && (
                <div className="flex justify-end px-1">
                  <button
                    onClick={undoSend}
                    className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                    لغو ارسال
                  </button>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[80%] flex-row-reverse items-center gap-3 rounded-[28px] bg-[--surface] px-5 py-4 text-slate-600 dark:text-slate-300 shadow-sm border border-[--border-soft]">
                    <div className="relative shrink-0">
                      <img
                        src="/images/artin-avatar.png"
                        alt="آرتین"
                        className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 object-cover"
                      />
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">آرتین</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-persian text-slate-500 dark:text-slate-400">در حال تایپ</span>
                        <span className="flex gap-1 pb-1">
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-blue-500" style={{animationDelay: "0ms"}} />
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-blue-500" style={{animationDelay: "200ms"}} />
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-blue-500" style={{animationDelay: "400ms"}} />
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      {messages.length > 0 && (
        <footer className="shrink-0 border-t border-slate-100 bg-white pb-2 pt-3">
          <div className="mx-auto w-full max-w-3xl px-4">
            <div className="relative">
              {showTools && (
                <div className="absolute bottom-full left-0 right-auto z-50 mb-2 md:left-auto md:right-0">
                  <ToolMenu onSelect={handleToolClick} />
                </div>
              )}

              <div className={`rounded-2xl border bg-white shadow-sm transition-colors ${isDragOver ? "border-blue-400 bg-blue-50/20" : "border-slate-200"}`}>
                {/* Staged image preview strip */}
                {stagedImage && (
                  <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
                    <img
                      src={stagedImageUrl}
                      alt="پیش‌نمایش عکس"
                      className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-bold text-slate-700">{stagedImage.name}</div>
                      <div className="text-[11px] text-slate-400">عکس آماده ارسال — پیام خود را بنویسید یا مستقیم ارسال کنید</div>
                    </div>
                    <button
                      onClick={clearStagedImage}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2 px-3 py-2.5">
                  <button
                    onClick={() => setShowTools((prev) => !prev)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Quick image button */}
                  <button
                    onClick={() => {
                      const inp = document.createElement("input");
                      inp.type = "file";
                      inp.accept = "image/*";
                      inp.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) stageImageFile(file);
                      };
                      inp.click();
                    }}
                    title="ارسال عکس (یا Ctrl+V برای Paste)"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-500 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    <ImagePlus size={18} />
                  </button>

                  <textarea
                    dir="auto"
                    style={{ fontFamily: getTextFont(message || "فارسی") }}
                    className="max-h-40 min-h-[44px] flex-1 resize-none border-none bg-transparent px-1 py-2 text-[15px] leading-7 text-slate-800 placeholder-slate-400 outline-none"
                    placeholder={stagedImage ? "توضیحی برای عکس بنویسید (اختیاری)..." : "از آرتین بپرسید..."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                  />

                  {isVoiceSupported && (
                    <button
                      onClick={toggleVoice}
                      title={voiceState === "listening" ? "توقف ضبط" : "ورودی صوتی"}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                        voiceState === "listening"
                          ? "animate-pulse bg-red-100 text-red-500"
                          : voiceState === "processing"
                          ? "animate-spin text-emerald-500"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      }`}
                    >
                      {voiceState === "listening" ? <MicOff size={18} /> : voiceState === "processing" ? <Loader size={18} /> : <Mic size={18} />}
                    </button>
                  )}

                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || (!message.trim() && !stagedImage)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition disabled:bg-slate-200 disabled:text-slate-400 ${stagedImage ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-800 hover:bg-slate-700"}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  </button>
                </div>
              </div>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                آرتین ممکن است اشتباه کند. برای تصمیم‌های مهم مشاوره کارشناسی ثبت کنید.
              </p>
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}


const STARTER_QUESTIONS: { category: string; icon: string; questions: string[] }[] = [
  {
    category: "کروماتوگرافی",
    icon: "📊",
    questions: [
      "تفاوت GC-FID و GC-TCD در آنالیز گاز طبیعی چیست؟",
      "علت نوسان baseline در کروماتوگراف چیست و چطور رفع می‌شود؟",
    ],
  },
  {
    category: "کاتالیست",
    icon: "⚗️",
    questions: [
      "کاتالیست مناسب فرایند ریفرمینگ نفتا چه ویژگی‌هایی دارد؟",
      "روش ارزیابی فعالیت کاتالیست هیدروکراکینگ چیست؟",
    ],
  },
  {
    category: "استانداردها",
    icon: "📋",
    questions: [
      "استاندارد ASTM D5453 برای اندازه‌گیری سولفور را توضیح دهید",
      "برای تعیین آروماتیک‌ها در بنزین کدام استاندارد ASTM مناسب است؟",
    ],
  },
  {
    category: "تجهیزات",
    icon: "🔬",
    questions: [
      "برای اندازه‌گیری جیوه در نفت خام چه دستگاهی پیشنهاد می‌کنید؟",
      "تفاوت XRF و ICP-OES در آنالیز عنصری چیست؟",
    ],
  },
];

function StarterQuestions({ onSelect }: { onSelect: (q: string) => void }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allQuestions = STARTER_QUESTIONS.flatMap((c) => c.questions);
  const displayQuestions =
    activeCategory
      ? (STARTER_QUESTIONS.find((c) => c.category === activeCategory)?.questions ?? [])
      : allQuestions.slice(0, 4);

  return (
    <div className="mt-8 w-full max-w-3xl px-1 md:px-0" dir="rtl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold text-slate-400 ml-1">موضوع:</span>
        {STARTER_QUESTIONS.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              activeCategory === cat.category
                ? "bg-violet-100 text-violet-700"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            }`}
          >
            {cat.icon} {cat.category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {displayQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="group flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
          >
            <svg
              className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-violet-400"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="leading-6">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantPageInner />
    </Suspense>
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
      <div className="ui-card w-full max-w-xl rounded-[36px] p-6 shadow-2xl">
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
          className="ui-select rounded-2xl p-4 text-sm"
        >
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="mb-2 mt-5 block text-sm font-bold">{noteLabel}</label>

        <textarea
          value={noteValue}
          onChange={(e) => onNoteChange(e.target.value)}
          className="ui-textarea h-28 w-full rounded-2xl p-4 leading-8"
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
            className="ui-btn ui-btn-primary flex-1 rounded-2xl px-5 py-4"
          >
            {confirmLabel}
          </button>

          <button
            onClick={onCancel}
            className="ui-btn ui-btn-ghost rounded-2xl border-slate-300 px-5 py-4"
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
  index,
  loading,
  onCopy,
  onRequest,
  onQuickAction,
  onFeedback,
  feedbackValue,
  onSpeak,
  isSpeaking,
  onEdit,
}: {
  item: ChatMessage;
  loading: boolean;
  onCopy: (text: string) => void;
  onRequest: () => void;
  onQuickAction: (
    action: "shorter" | "technical" | "table",
    answerText: string,
  ) => void;
  onFeedback: (
    questionId: number | undefined,
    rating: "up" | "down",
    comment?: string,
  ) => void;
  feedbackValue?: string;
  onSpeak: (text: string, index: number) => void;
  isSpeaking?: boolean;
  index: number;
  onEdit: (index: number, newText: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.content);
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const isUser = item.role === "user";

  const FEEDBACK_REASONS = [
    "پاسخ ناقص بود",
    "اطلاعات اشتباه داشت",
    "ربطی به سوالم نداشت",
    "خیلی طولانی بود",
    "خیلی کوتاه بود",
    "دیگر",
  ];
  const displayContent = isUser
    ? item.content
    : cleanMarkdownText(item.content);
  const direction = getTextDirection(displayContent);
  const fontFamily = getTextFont(displayContent);

  function handleCopy(text: string) {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className={`group flex w-full ${isUser ? "justify-end" : "justify-start"}`}
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
          className={`shadow-sm ${
            isUser
              ? "max-w-[760px] rounded-[26px] bg-blue-700 px-5 py-4 text-white"
              : "ai-message-card"
          }`}
        >
          <div
            dir={direction}
            style={{ fontFamily }}
            className={
              isUser
                ? "whitespace-pre-wrap text-right leading-8"
                : direction === "rtl"
                  ? "ai-markdown rtl-markdown"
                  : "ai-markdown ltr-markdown"
            }
          >
            {isUser ? (
              isEditing ? (
                <div className="flex flex-col gap-2" dir="rtl">
                  <textarea
                    className="w-full rounded-xl bg-white/20 p-2 text-sm text-white placeholder-white/60 outline-none ring-2 ring-white/40 focus:ring-white/70 resize-none"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (editText.trim()) {
                          onEdit(index, editText.trim());
                          setIsEditing(false);
                        }
                      }
                      if (e.key === "Escape") {
                        setEditText(item.content);
                        setIsEditing(false);
                      }
                    }}
                    rows={Math.max(2, editText.split("\n").length)}
                    autoFocus
                    dir="rtl"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setEditText(item.content); setIsEditing(false); }}
                      className="rounded-lg px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={() => {
                        if (editText.trim()) {
                          onEdit(index, editText.trim());
                          setIsEditing(false);
                        }
                      }}
                      className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30"
                    >
                      ارسال مجدد ↵
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/edit relative">
                  <span>{displayContent}</span>
                  <button
                    onClick={() => { setEditText(item.content); setIsEditing(true); }}
                    className="mr-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/50 opacity-0 transition hover:bg-white/20 hover:text-white group-hover/edit:opacity-100"
                    title="ویرایش پیام"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    ویرایش
                  </button>
                </div>
              )
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h2 className="ai-md-title">{children}</h2>
                  ),
                  h2: ({ children }) => (
                    <h2 className="ai-md-title">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="ai-md-section">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="ai-md-paragraph">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="ai-md-list">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="ai-md-list ai-md-ordered">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="ai-md-list-item">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="ai-md-strong">{children}</strong>
                  ),
                  code: ({ children }) => (
                    <code className="ai-md-code">{children}</code>
                  ),
                  a: ({ href, children }) => {
                    const isArtinLink = href && (
                      href.includes("artinazma.net") ||
                      href.includes("artinazma.com")
                    );
                    if (isArtinLink) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="not-prose my-1 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 hover:text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          <span className="flex-1 truncate">{children || href}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                        </a>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900"
                      >
                        {children}
                      </a>
                    );
                  },
                  table: ({ children }) => (
                    <div className="ai-md-table-wrap">
                      <table className="ai-md-table">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="ai-md-th">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="ai-md-td">{children}</td>
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
          {!isUser && !loading && (
            <div className="mt-2 flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 opacity-100 transition-opacity md:flex-wrap">
              <button
                onClick={() => handleCopy(displayContent)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Copy size={13} />
                {copied ? "کپی شد" : "کپی"}
              </button>
              <button
                onClick={() => onSpeak(displayContent, index)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] transition ${
                  isSpeaking
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
                title={isSpeaking ? "توقف" : "پخش صوتی"}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {isSpeaking ? "توقف" : "بخوان"}
              </button>
              <div className="mx-1 h-3.5 w-px bg-slate-200" />
              <button
                onClick={() => onQuickAction("shorter", item.content)}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                خلاصه‌تر
              </button>
              <button
                onClick={() => onQuickAction("technical", item.content)}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                فنی‌تر
              </button>
              <button
                onClick={() => onQuickAction("table", item.content)}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                جدول
              </button>
              <div className="mx-1 h-3.5 w-px bg-slate-200" />
              <button
                onClick={() => onFeedback(item.question_id, "up")}
                disabled={!!feedbackValue}
                className={`rounded-lg p-1.5 transition ${
                  feedbackValue === "up"
                    ? "text-emerald-600 bg-emerald-50"
                    : feedbackValue === "down"
                    ? "text-slate-300 cursor-default"
                    : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                }`}
                title="پاسخ مفید بود"
              >
                <ThumbsUp size={13} />
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    if (feedbackValue) return;
                    setShowFeedbackMenu((v) => !v);
                  }}
                  disabled={!!feedbackValue}
                  className={`rounded-lg p-1.5 transition ${
                    feedbackValue === "down"
                      ? "text-red-500 bg-red-50"
                      : feedbackValue === "up"
                      ? "text-slate-300 cursor-default"
                      : "text-slate-400 hover:bg-red-50 hover:text-red-500"
                  }`}
                  title="پاسخ نیاز به بهبود دارد"
                >
                  <ThumbsDown size={13} />
                </button>
                {showFeedbackMenu && !feedbackValue && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-1.5 px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      چه مشکلی داشت؟
                    </p>
                    {FEEDBACK_REASONS.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => {
                          onFeedback(item.question_id, "down", reason);
                          setShowFeedbackMenu(false);
                        }}
                        className="block w-full rounded-xl px-3 py-1.5 text-right text-xs text-slate-700 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950 dark:hover:text-red-400"
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowFeedbackMenu(false)}
                      className="mt-1 block w-full rounded-xl px-3 py-1 text-center text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      انصراف
                    </button>
                  </div>
                )}
              </div>
              <div className="mx-1 h-3.5 w-px bg-slate-200" />
              <button
                onClick={onRequest}
                className="rounded-lg px-2.5 py-1.5 text-[12px] text-blue-600 transition hover:bg-blue-50"
              >
                ثبت مشاوره
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 