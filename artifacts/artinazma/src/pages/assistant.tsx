import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/api";
import { findRelatedDevices, type DeviceAsset } from "@/lib/device-assets";
import { FlaskConical, Paperclip, Settings, UserRound, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Source = { title: string; file_name: string; category: string; score: number; };
type ResourceLink = { title: string; url: string; source?: string; score?: number; };
type ResourceImage = { title: string; url: string; page_url?: string; source?: string; };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  detected_domain?: string;
  question_id?: number;
  relatedDevices?: DeviceAsset[];
  resource_links?: ResourceLink[];
  resource_images?: ResourceImage[];
  attachment?: { name: string; kind: "file" | "image"; analysisType?: string; note?: string; status?: string; previewUrl?: string; };
};
type Customer = { id: number; full_name: string; email: string; company?: string; phone?: string; };
type SavedChatMessage = {
  id: number; role: "user" | "assistant"; content: string;
  metadata?: { sources?: Source[]; detected_domain?: string; question_id?: number; relatedDevices?: DeviceAsset[]; resource_links?: ResourceLink[]; resource_images?: ResourceImage[]; attachment?: ChatMessage["attachment"]; file_url?: string; };
  created_at: string;
};
type ToolAction = "upload" | "troubleshooting" | "device-suggestion" | "catalyst-suggestion" | "customer-request";

const tools: { label: string; description: string; action: ToolAction; }[] = [
  { label: "آپلود فایل یا عکس", description: "تحلیل PDF، Excel، CSV، عکس خطا یا کروماتوگرام", action: "upload" },
  { label: "عیب‌یابی تجهیزات", description: "ساخت قالب سوال برای خطا یا مشکل دستگاه", action: "troubleshooting" },
  { label: "پیشنهاد دستگاه", description: "انتخاب تجهیز مناسب برای کاربرد یا نمونه", action: "device-suggestion" },
  { label: "پیشنهاد کاتالیست", description: "بررسی کاتالیست یا تست‌های تکمیلی", action: "catalyst-suggestion" },
  { label: "ثبت درخواست مشاوره", description: "ارسال اطلاعات تماس برای پیگیری کارشناس", action: "customer-request" },
];

function getToolIcon(action: ToolAction): LucideIcon {
  if (action === "upload") return Paperclip;
  if (action === "troubleshooting") return Wrench;
  if (action === "device-suggestion") return Settings;
  if (action === "catalyst-suggestion") return FlaskConical;
  return UserRound;
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
  return testTypes.find((item) => item.value === value)?.label || "گزارش عمومی آزمایشگاهی";
}
function getImageTypeLabel(value: string) {
  return imageTypes.find((item) => item.value === value)?.label || "تصویر عمومی";
}
function getOrCreateUserId() {
  let id = localStorage.getItem("artin_user_id");
  if (!id) { id = `u_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem("artin_user_id", id); }
  return id;
}
function hasPersianText(text: string) { return /[\u0600-\u06FF]/.test(text); }
function getTextDirection(text: string) { return hasPersianText(text) ? "rtl" : "ltr"; }

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function cleanMarkdownText(text: string) {
  if (!text) return "";
  let cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\s*---+\s*$/gm, "").trim();
  cleaned = cleaned.replace(/```(?:markdown|md)?\s*\n([\s\S]*?\|[\s\S]*?)\n```/gi, "$1").replace(/```\s*\n([\s\S]*?\|[\s\S]*?)\n```/g, "$1");
  cleaned = cleaned.split("\n").map((line) => {
    const trimmed = line.trim();
    const looksLikeTableLine = trimmed.includes("|") && (trimmed.startsWith("|") || trimmed.endsWith("|") || /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed));
    return looksLikeTableLine ? trimmed : line;
  }).join("\n");
  const sectionTitles = ["جمع‌بندی کاربردی","جمع بندی کاربردی","جمع‌بندی","جمع بندی","تفاوت بنیادی","مقایسه فنی و عملیاتی","مقایسه فنی","روش‌ها یا دستگاه‌های مناسب","معیار انتخاب","نکات نمونه‌برداری","آماده‌سازی نمونه","کنترل کیفیت","QC","محدودیت‌ها و خطاهای رایج","محدودیت‌ها","خطاهای رایج","سناریوی انتخاب","پیشنهاد عملی","اقدام بعدی","اطلاعات لازم برای تصمیم قطعی"];
  for (const title of sectionTitles) {
    const pattern = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*\\s*)?${escapeRegExp(title)}(?:\\s*\\*\\*)?(?:\\s*:)?\\s*$`, "gmi");
    cleaned = cleaned.replace(pattern, `## ${title}`);
  }
  cleaned = cleaned.replace(/\s*[•●▪]\s*/g, "\n- ").replace(/([^\n])\s+-\s+/g, "$1\n- ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  if (hasPersianText(cleaned)) {
    cleaned = cleaned.replace(/\(([A-Za-z][A-Za-z0-9.+/\-\s]{1,})\)/g, "(\u2066$1\u2069)").replace(/\b([A-Z]{2,}(?:-[A-Z0-9]+)?)\b/g, "\u2066$1\u2069");
  }
  return cleaned;
}

function shouldShowRelatedDeviceCards(userText: string, selectedDomain: string) {
  if (selectedDomain === "equipment") return true;
  const intentKeywords = ["دستگاه","تجهیز","تجهیزات","آنالایزر","مدل","برند","کاتالوگ","پیشنهاد دستگاه","چه دستگاهی","دستگاه مناسب","خرید","استعلام","قیمت","device","equipment","instrument","analyzer","model","brand","catalog","price"];
  return intentKeywords.some((keyword) => userText.toLowerCase().includes(keyword));
}

function ToolMenu({ onSelect }: { onSelect: (action: ToolAction) => void }) {
  return (
    <div className="ui-card w-[245px] overflow-hidden rounded-[18px] py-1.5 shadow-xl shadow-slate-300/40">
      {tools.map((tool, index) => {
        const Icon = getToolIcon(tool.action);
        return (
          <button key={tool.action} onClick={() => onSelect(tool.action)}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-[13px] font-medium text-slate-800 transition hover:bg-slate-50 ${index === 0 || index === 3 ? "border-b border-slate-100" : ""}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-700"><Icon size={17} strokeWidth={1.9} /></span>
            <span className="flex-1">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ArtinazmaResourceCards({ links, images }: { links?: ResourceLink[]; images?: ResourceImage[]; }) {
  const hasLinks = links && links.length > 0;
  const hasImages = images && images.length > 0;
  if (!hasLinks && !hasImages) return null;
  return (
    <div className="mt-4 space-y-3">
      {hasImages && (
        <div className="grid gap-3 md:grid-cols-2">
          {images!.map((image) => (
            <a key={image.url} href={image.page_url || image.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="aspect-[4/3] bg-slate-100">
                <img src={image.url} alt={image.title} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
              <div className="p-3 text-sm font-bold text-slate-800">{image.title}</div>
            </a>
          ))}
        </div>
      )}
      {hasLinks && (
        <div className="rounded-[18px] border border-blue-100 bg-blue-50 p-3">
          <div className="mb-2 text-xs font-black text-blue-800">صفحه مرتبط در سایت آرتین آزما</div>
          <div className="space-y-1">
            {links!.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="block text-sm font-bold text-blue-700 hover:text-blue-900">{link.title}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadModal({ title, fileName, label, selectValue, onSelectChange, options, noteValue, onNoteChange, noteLabel, placeholder, confirmLabel, onConfirm, onCancel, footer }: { title: string; fileName: string; label: string; selectValue: string; onSelectChange: (value: string) => void; options: { value: string; label: string }[]; noteValue: string; onNoteChange: (value: string) => void; noteLabel: string; placeholder: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; footer?: string; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="ui-card w-full max-w-xl rounded-[36px] p-6 shadow-2xl">
        <div className="mb-5">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">فایل انتخاب‌شده: <span className="font-bold">{fileName}</span></p>
        </div>
        <label className="mb-2 block text-sm font-bold">{label}</label>
        <select value={selectValue} onChange={(e) => onSelectChange(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none">
          {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="mb-2 mt-5 block text-sm font-bold">{noteLabel}</label>
        <textarea value={noteValue} onChange={(e) => onNoteChange(e.target.value)} className="h-28 w-full resize-none rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-8 outline-none" placeholder={placeholder} />
        {footer && <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{footer}</div>}
        <div className="mt-6 flex gap-3">
          <button onClick={onConfirm} className="flex-1 rounded-2xl bg-purple-700 px-5 py-4 font-bold text-white hover:bg-purple-800">{confirmLabel}</button>
          <button onClick={onCancel} className="rounded-2xl border border-slate-300 bg-white px-5 py-4 font-bold text-slate-700 hover:bg-slate-50">انصراف</button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ item, loading, onCopy, onRequest, onQuickAction, onFeedback, feedbackValue }: { item: ChatMessage; loading: boolean; onCopy: (text: string) => void; onRequest: () => void; onQuickAction: (action: "shorter" | "technical" | "table", answerText: string) => void; onFeedback: (questionId: number | undefined, status: "approved" | "needs_edit") => void; feedbackValue?: string; }) {
  const isUser = item.role === "user";
  const displayContent = isUser ? item.content : cleanMarkdownText(item.content);
  const direction = getTextDirection(displayContent);

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`} dir="ltr">
      <div className={`flex max-w-[88%] gap-3 flex-row-reverse`}>
        {!isUser && (
          <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-purple-700 text-white text-lg font-black shadow-sm">آ</div>
        )}
        <div className={`shadow-sm ${isUser ? "max-w-[760px] rounded-[26px] bg-blue-700 px-5 py-4 text-white" : "rounded-[26px] border border-slate-200 bg-white px-5 py-4"}`}>
          <div dir={direction} className={isUser ? "whitespace-pre-wrap text-right leading-8" : "assistant-content leading-8"}>
            {isUser ? displayContent : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h2 className="mb-2 mt-4 text-base font-black text-slate-900">{children}</h2>,
                  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-black text-slate-900">{children}</h2>,
                  h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-black text-slate-800">{children}</h3>,
                  p: ({ children }) => <p className="mb-3 leading-8">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pr-5">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pr-5">{children}</ol>,
                  li: ({ children }) => <li className="leading-8">{children}</li>,
                  strong: ({ children }) => <strong className="font-black">{children}</strong>,
                  code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-sm">{children}</code>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900">{children}</a>,
                  table: ({ children }) => <div className="my-3 overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full border-collapse text-sm">{children}</table></div>,
                  th: ({ children }) => <th className="border border-slate-200 bg-slate-50 p-3 text-right font-black">{children}</th>,
                  td: ({ children }) => <td className="border border-slate-100 p-3 text-right">{children}</td>,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>

          {item.attachment && (
            <div className={`mt-4 rounded-3xl p-4 text-sm leading-7 ${isUser ? "bg-white/15 text-white" : "bg-slate-50 text-slate-700"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-black">{item.attachment.kind === "image" ? "تصویر پیوست‌شده" : "فایل پیوست‌شده"}</div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{loading && item.attachment.status === "analyzing" ? "در حال تحلیل" : "ارسال شد"}</span>
              </div>
              {item.attachment.kind === "image" && item.attachment.previewUrl && (
                <div className="mb-3 overflow-hidden rounded-2xl bg-black/10">
                  <img src={item.attachment.previewUrl} alt={item.attachment.name} className="max-h-80 w-full object-contain" />
                </div>
              )}
              <div>نام: {item.attachment.name}</div>
              {item.attachment.analysisType && <div>نوع تحلیل: {item.attachment.analysisType}</div>}
              {item.attachment.note && <div>توضیح کاربر: {item.attachment.note}</div>}
            </div>
          )}

          {!isUser && <ArtinazmaResourceCards links={item.resource_links} images={item.resource_images} />}

          {!isUser && (
            <div className="mt-4 flex flex-wrap gap-2 pt-1">
              <button onClick={() => onQuickAction("shorter", item.content)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">خلاصه‌تر کن</button>
              <button onClick={() => onQuickAction("technical", item.content)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">فنی‌تر توضیح بده</button>
              <button onClick={() => onQuickAction("table", item.content)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">تبدیل به جدول</button>
              <button onClick={() => onCopy(displayContent)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">کپی پاسخ</button>
              <button onClick={onRequest} className="rounded-2xl bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800">ثبت درخواست مشاوره</button>
              <button onClick={() => onFeedback(item.question_id, "approved")} disabled={feedbackValue === "approved"} className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${feedbackValue === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"}`}>پاسخ خوب بود</button>
              <button onClick={() => onFeedback(item.question_id, "needs_edit")} disabled={feedbackValue === "needs_edit"} className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${feedbackValue === "needs_edit" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-700"}`}>نیاز به اصلاح دارد</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [, navigate] = useLocation();
  const [sessionIdParam, setSessionIdParam] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [responseMode, setResponseMode] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<number, string>>({});
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
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  async function copyText(text: string) { await navigator.clipboard.writeText(text); }

  function sendQuickAction(action: "shorter" | "technical" | "table", answerText: string) {
    const cleanAnswer = answerText.trim();
    const prompts = {
      shorter: `این متن را خلاصه‌تر، کاربردی‌تر و منظم‌تر بازنویسی کن. فقط نسخه نهایی را بده:\n\n${cleanAnswer}`,
      technical: `این متن را فنی‌تر، دقیق‌تر و کامل‌تر بازنویسی کن. فقط نسخه نهایی را بده:\n\n${cleanAnswer}`,
      table: `فقط متن فنی زیر را از حالت توضیحی به جدول Markdown تبدیل کن. هیچ اطلاعات جدیدی اضافه نکن. خروجی فقط فارسی باشد.\n\n${cleanAnswer}`,
    };
    const visibleMessages = { shorter: "خلاصه‌تر کن", technical: "فنی‌تر توضیح بده", table: "تبدیل به جدول" };
    sendMessage(prompts[action], visibleMessages[action]);
  }

  function makeSessionTitle(text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return "گفتگوی جدید";
    return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
  }

  async function sendAnswerFeedback(questionId: number | undefined, status: "approved" | "needs_edit") {
    if (!questionId) return;
    const expertNote = status === "approved" ? "کاربر پاسخ را مفید اعلام کرد." : "کاربر اعلام کرد پاسخ نیاز به اصلاح دارد.";
    try {
      const res = await fetch(apiUrl(`/questions/${questionId}/review`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expert_status: status, expert_note: expertNote, reviewed_answer: "" }) });
      const data = await res.json();
      if (data.success) setFeedbackStatus((prev) => ({ ...prev, [questionId]: status }));
    } catch {}
  }

  function getSavedCustomer(): Customer | null {
    try { const raw = localStorage.getItem("artin_customer"); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  async function createCustomerChatSession(title: string) {
    const activeCustomer = customer || getSavedCustomer();
    if (!activeCustomer) return null;
    try {
      const res = await fetch(apiUrl("/customers/chat-sessions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: activeCustomer.id, title: makeSessionTitle(title) }) });
      const data = await res.json();
      if (!data.success || !data.session_id) return null;
      const newSessionId = Number(data.session_id);
      setCustomer(activeCustomer);
      setActiveSessionId(newSessionId);
      window.history.replaceState(null, "", `/assistant?session_id=${newSessionId}`);
      return newSessionId;
    } catch { return null; }
  }

  async function ensureCustomerSession(titleSource: string) {
    const activeCustomer = customer || getSavedCustomer();
    if (!activeCustomer) return null;
    if (!customer) setCustomer(activeCustomer);
    if (activeSessionId) return activeSessionId;
    return createCustomerChatSession(titleSource);
  }

  async function saveCustomerChatMessage(sessionId: number | null, role: "user" | "assistant", content: string, metadata: Record<string, unknown> = {}) {
    const activeCustomer = customer || getSavedCustomer();
    if (!activeCustomer || !sessionId || !content.trim()) return;
    try {
      await fetch(apiUrl("/customers/chat-messages"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: activeCustomer.id, session_id: sessionId, role, content, metadata }) });
    } catch {}
  }

  async function loadSavedChatSession(customerId: number, sessionId: number) {
    setLoadingSavedSession(true);
    try {
      const res = await fetch(apiUrl(`/customers/${customerId}/chat-sessions/${sessionId}/messages`));
      const data = await res.json();
      const savedMessages: ChatMessage[] = (data.messages || []).map((item: SavedChatMessage) => ({
        role: item.role === "user" ? "user" : "assistant",
        content: item.content,
        sources: item.metadata?.sources || [],
        detected_domain: item.metadata?.detected_domain,
        question_id: item.metadata?.question_id,
        relatedDevices: item.metadata?.relatedDevices || [],
        resource_links: item.metadata?.resource_links || [],
        resource_images: item.metadata?.resource_images || [],
        attachment: item.metadata?.attachment ? { ...item.metadata.attachment, previewUrl: item.metadata.attachment.previewUrl || (item.metadata.file_url ? apiUrl(item.metadata.file_url as string) : undefined) } : undefined,
      }));
      setMessages(savedMessages);
      setActiveSessionId(sessionId);
    } catch { setMessages([]); }
    finally { setLoadingSavedSession(false); }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionIdParam(params.get("session_id"));
    const domainParam = params.get("domain");
    if (domainParam) setDomain(domainParam);
  }, []);

  useEffect(() => {
    const savedCustomer = getSavedCustomer();
    if (!savedCustomer) { navigate("/customer-login"); return; }
    setCustomer(savedCustomer);
    setCheckingCustomerLogin(false);
    if (sessionIdParam) {
      const sessionId = Number(sessionIdParam);
      if (!Number.isNaN(sessionId)) loadSavedChatSession(savedCustomer.id, sessionId);
    }
  }, [navigate, sessionIdParam]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function typeAssistantMessage(previousMessages: ChatMessage[], userMessage: ChatMessage, assistantMessage: ChatMessage) {
    const fullText = assistantMessage.content || "";
    let index = 0;
    setMessages([...previousMessages, userMessage, { ...assistantMessage, content: "" }]);
    const interval = window.setInterval(() => {
      index += 8;
      setMessages([...previousMessages, userMessage, { ...assistantMessage, content: fullText.slice(0, index) }]);
      if (index >= fullText.length) { window.clearInterval(interval); setMessages([...previousMessages, userMessage, assistantMessage]); }
    }, 18);
  }

  async function sendMessage(customMessage?: string, displayMessage?: string) {
    const finalMessage = customMessage || message;
    const visibleMessage = displayMessage || finalMessage;
    if (!finalMessage.trim()) return;
    const previousMessages = messages;
    const userId = getOrCreateUserId();
    const userMessage: ChatMessage = { role: "user", content: visibleMessage };
    const customerSessionId = await ensureCustomerSession(visibleMessage);
    await saveCustomerChatMessage(customerSessionId, "user", visibleMessage, { domain, response_mode: responseMode, actual_prompt: displayMessage ? finalMessage : undefined });
    setMessages([...previousMessages, userMessage]);
    setMessage("");
    setLoading(true);
    setShowTools(false);
    try {
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage, domain, response_mode: responseMode, user_id: userId,
          history: previousMessages.map((item) => ({ role: item.role, content: item.content + (item.attachment ? `\n\nاطلاعات فایل/عکس قبلی:\nنام: ${item.attachment.name}\nنوع: ${item.attachment.kind}\nدسته‌بندی تحلیل: ${item.attachment.analysisType || ""}\nتوضیح کاربر: ${item.attachment.note || ""}` : "") })),
        }),
      });
      const rawText = await res.text();
      if (!res.ok) {
        let serverMessage = "خطا در دریافت پاسخ از سرور.";
        try { const errorData = JSON.parse(rawText); serverMessage = errorData.message || errorData.error || serverMessage; } catch {}
        throw new Error(serverMessage);
      }
      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error("پاسخ سرور معتبر نبود."); }
      const relatedDevices: DeviceAsset[] = [];
      const assistantMessage: ChatMessage = { role: "assistant", content: data.answer || "پاسخی دریافت نشد.", sources: data.sources || [], detected_domain: data.detected_domain, question_id: data.question_id, relatedDevices, resource_links: data.resource_links || [], resource_images: data.resource_images || [] };
      await saveCustomerChatMessage(customerSessionId, "assistant", assistantMessage.content, { sources: assistantMessage.sources || [], detected_domain: assistantMessage.detected_domain, question_id: assistantMessage.question_id, relatedDevices, resource_links: assistantMessage.resource_links || [], resource_images: assistantMessage.resource_images || [] });
      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch (error) {
      console.error("CHAT ERROR:", error);
      setMessages([...previousMessages, userMessage, { role: "assistant", content: "در حال حاضر ارتباط با سرویس پاسخ‌گویی دچار اختلال شده است. لطفاً چند لحظه بعد دوباره تلاش کنید." }]);
    } finally { setLoading(false); }
  }

  function clearChat() { setMessages([]); setMessage(""); setShowTools(false); setActiveSessionId(null); window.history.replaceState(null, "", "/assistant"); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

  async function uploadAndAnalyzeFile(file: File) {
    setShowTools(false);
    const userMessage: ChatMessage = { role: "user", content: "فایل برای تحلیل ارسال شد.", attachment: { name: file.name, kind: "file", analysisType: getTestTypeLabel(chatTestType), note: chatUserNote, status: "analyzing" } };
    const previousMessages = messages;
    const customerSessionId = await ensureCustomerSession(`تحلیل فایل ${file.name}`);
    await saveCustomerChatMessage(customerSessionId, "user", `فایل برای تحلیل ارسال شد: ${file.name}`, { attachment: userMessage.attachment });
    setMessages([...previousMessages, userMessage]);
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file); formData.append("test_type", chatTestType); formData.append("user_note", chatUserNote);
    try {
      const res = await fetch(apiUrl("/analyze-file"), { method: "POST", body: formData });
      const data = await res.json();
      const relatedDevices = shouldShowRelatedDeviceCards(`${file.name}\n${chatUserNote}`, domain) ? findRelatedDevices(`${file.name}\n${chatUserNote}\n${data.ai_analysis || data.error || ""}`, 2) : [];
      const assistantMessage: ChatMessage = { role: "assistant", content: data.ai_analysis || data.error || "فایل دریافت شد، اما تحلیل مشخصی برگردانده نشد.", detected_domain: "file-analysis", relatedDevices };
      await saveCustomerChatMessage(customerSessionId, "assistant", assistantMessage.content, { detected_domain: "file-analysis", file_name: data.file_name, file_url: data.file_url, relatedDevices });
      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch { setMessages([...previousMessages, userMessage, { role: "assistant", content: "خطا در آپلود یا تحلیل فایل." }]); }
    finally { setLoading(false); }
  }

  async function uploadAndAnalyzeImage(file: File) {
    setShowTools(false);
    const previewUrl = URL.createObjectURL(file);
    const userMessage: ChatMessage = { role: "user", content: "عکس برای تحلیل ارسال شد.", attachment: { name: file.name, kind: "image", analysisType: getImageTypeLabel(chatImageType), note: chatImageNote, status: "analyzing", previewUrl } };
    const previousMessages = messages;
    const customerSessionId = await ensureCustomerSession(`تحلیل عکس ${file.name}`);
    await saveCustomerChatMessage(customerSessionId, "user", `عکس برای تحلیل ارسال شد: ${file.name}`, { attachment: userMessage.attachment });
    setMessages([...previousMessages, userMessage]);
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file); formData.append("image_type", chatImageType); formData.append("user_note", chatImageNote);
    try {
      const res = await fetch(apiUrl("/analyze-image"), { method: "POST", body: formData });
      const data = await res.json();
      const relatedDevices = shouldShowRelatedDeviceCards(`${file.name}\n${chatImageNote}`, domain) ? findRelatedDevices(`${file.name}\n${chatImageNote}\n${data.ai_analysis || data.error || ""}`, 2) : [];
      const assistantMessage: ChatMessage = { role: "assistant", content: data.ai_analysis || data.error || "عکس دریافت شد، اما تحلیل مشخصی برگردانده نشد.", detected_domain: "image-analysis", relatedDevices };
      await saveCustomerChatMessage(customerSessionId, "assistant", assistantMessage.content, { detected_domain: "image-analysis", file_name: data.file_name, file_url: data.file_url, relatedDevices });
      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch { setMessages([...previousMessages, userMessage, { role: "assistant", content: "خطا در آپلود یا تحلیل عکس." }]); }
    finally { setLoading(false); }
  }

  function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) { setPendingImage(file); setShowImageOptions(true); setChatImageType("general"); setChatImageNote(""); }
    else { setPendingFile(file); setShowFileOptions(true); setChatTestType("general"); setChatUserNote(""); }
    e.target.value = "";
  }
  function confirmFileAnalysis() { if (!pendingFile) return; setShowFileOptions(false); uploadAndAnalyzeFile(pendingFile); setPendingFile(null); }
  function cancelFileAnalysis() { setShowFileOptions(false); setPendingFile(null); setChatUserNote(""); setChatTestType("general"); }
  function confirmImageAnalysis() { if (!pendingImage) return; setShowImageOptions(false); uploadAndAnalyzeImage(pendingImage); setPendingImage(null); }
  function cancelImageAnalysis() { setShowImageOptions(false); setPendingImage(null); setChatImageNote(""); setChatImageType("general"); }

  function handleToolClick(action: ToolAction) {
    setShowTools(false);
    if (action === "upload") { uploadInputRef.current?.click(); return; }
    if (action === "customer-request") { navigate("/customer-request"); return; }
    if (action === "troubleshooting") { setDomain("troubleshooting"); setMessage("برای عیب‌یابی این مشکل دستگاه، علت‌های احتمالی و چک‌لیست مرحله‌ای بده: "); return; }
    if (action === "device-suggestion") { setDomain("equipment"); setMessage("برای این کاربرد یا نوع نمونه، دستگاه/تجهیز مناسب آرتین آزما را پیشنهاد بده: "); return; }
    if (action === "catalyst-suggestion") { setDomain("catalyst"); setMessage("برای این فرایند یا مشکل، کاتالیست مناسب یا تست‌های لازم برای بررسی کاتالیست را پیشنهاد بده: "); }
  }

  if (checkingCustomerLogin) {
    return (
      <section className="flex h-full items-center justify-center bg-white px-6">
        <div className="ui-card rounded-[28px] p-8 text-center shadow-sm">
          <div className="text-lg font-bold text-slate-900">در حال بررسی ورود مشتری...</div>
          <div className="mt-3 text-sm text-slate-500">برای استفاده از آرتین باید وارد حساب کاربری شوید.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-screen min-w-0 flex-col overflow-hidden bg-white">
      <input ref={uploadInputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp" onChange={handleUploadChange} className="hidden" />
      {showFileOptions && pendingFile && <UploadModal title="تنظیمات تحلیل فایل" fileName={pendingFile.name} label="نوع تست یا گزارش" selectValue={chatTestType} onSelectChange={setChatTestType} options={testTypes} noteValue={chatUserNote} onNoteChange={setChatUserNote} noteLabel="توضیح اختیاری درباره نمونه یا شرایط تست" placeholder="مثلاً: نمونه LPG است، baseline نوسان دارد..." confirmLabel="شروع تحلیل فایل" onConfirm={confirmFileAnalysis} onCancel={cancelFileAnalysis} />}
      {showImageOptions && pendingImage && <UploadModal title="تنظیمات تحلیل عکس" fileName={pendingImage.name} label="نوع تصویر" selectValue={chatImageType} onSelectChange={setChatImageType} options={imageTypes} noteValue={chatImageNote} onNoteChange={setChatImageNote} noteLabel="توضیح اختیاری درباره تصویر" placeholder="مثلاً: این عکس مربوط به ارور دستگاه GC است..." confirmLabel="شروع تحلیل عکس" onConfirm={confirmImageAnalysis} onCancel={cancelImageAnalysis} footer="فرمت‌های مجاز تصویر: JPG, PNG, WEBP" />}

      <header className="shrink-0 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-purple-700 text-white font-black shadow-sm text-lg">آ</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">آرتین</h1>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">آنلاین</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">دستیار تخصصی آرتین آزما برای تحلیل، پاسخ‌گویی و مشاوره فنی</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-600">
              <option value="auto">تشخیص خودکار</option>
              <option value="catalyst">کاتالیست</option>
              <option value="equipment">تجهیزات</option>
              <option value="chromatography">کروماتوگرافی</option>
              <option value="mercury-analysis">آنالیز جیوه</option>
              <option value="sulfur-analysis">آنالیز سولفور</option>
              <option value="troubleshooting">عیب‌یابی</option>
              <option value="analysis">آنالیز و تست</option>
            </select>
            <select value={responseMode} onChange={(e) => setResponseMode(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-purple-600">
              <option value="auto">نوع پاسخ: هوشمند</option>
              <option value="brief">خلاصه و کاربردی</option>
              <option value="technical">فنی کامل</option>
              <option value="checklist">چک‌لیست عملیاتی</option>
            </select>
            <button onClick={clearChat} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">گفتگوی جدید</button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingSavedSession && <div className="mx-auto mt-6 max-w-xl rounded-2xl bg-blue-50 p-4 text-center text-sm font-bold text-blue-700">در حال بارگذاری گفتگوی ذخیره‌شده...</div>}
        <div className="mx-auto w-full max-w-6xl px-6 pb-6 pt-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[calc(100vh-130px)] max-w-4xl flex-col items-center justify-center px-4 text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">امروز چه کمکی از آرتین می‌خواهید؟</h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">سوال تخصصی بپرسید، فایل تست یا عکس خطا ارسال کنید، یا درخواست مشاوره ثبت کنید.</p>
              <div className="relative mt-8 w-full max-w-3xl">
                {showTools && <div className="absolute top-full right-0 z-50 mt-2"><ToolMenu onSelect={handleToolClick} /></div>}
                <div className="ui-card rounded-[32px] shadow-xl shadow-slate-200/70">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => setShowTools((prev) => !prev)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xl font-bold text-slate-600 hover:bg-slate-100">+</button>
                    <textarea dir="auto" className="max-h-32 min-h-[46px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[17px] leading-7 outline-none" placeholder="از آرتین بپرسید..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} />
                    <button onClick={() => sendMessage()} disabled={loading || !message.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-700 text-xl text-white shadow-sm hover:bg-purple-800 disabled:bg-slate-300">↑</button>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <button onClick={() => handleToolClick("upload")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">آپلود فایل یا عکس</button>
                <button onClick={() => handleToolClick("customer-request")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">درخواست مشاوره</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-7 pb-4">
              {messages.map((item, index) => (
                <MessageBubble key={index} item={item} loading={loading} onCopy={copyText} onRequest={() => navigate("/customer-request")} onQuickAction={sendQuickAction} onFeedback={sendAnswerFeedback} feedbackValue={item.question_id ? feedbackStatus[item.question_id] : undefined} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[80%] flex-row-reverse items-center gap-3 rounded-[28px] bg-white px-5 py-4 text-slate-600 shadow-sm border border-slate-100">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-700 text-white font-black text-sm">آ</div>
                    <span>آرتین در حال تحلیل و آماده‌سازی پاسخ است...</span>
                    <span className="flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" /><span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:240ms]" /></span>
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
              {showTools && <div className="absolute bottom-full left-0 right-auto z-50 mb-2 md:left-auto md:right-0"><ToolMenu onSelect={handleToolClick} /></div>}
              <div className="ui-card rounded-[32px] shadow-xl shadow-slate-200/70">
                <div className="flex items-end gap-3 px-3 py-3">
                  <button onClick={() => setShowTools((prev) => !prev)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 text-xl font-bold text-slate-600 hover:bg-slate-100">+</button>
                  <textarea dir="auto" className="max-h-40 min-h-[52px] flex-1 resize-none border-none bg-transparent px-2 py-3 text-[18px] leading-8 outline-none" placeholder="از آرتین بپرسید..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} />
                  <button onClick={() => sendMessage()} disabled={loading || !message.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-700 text-xl text-white shadow-sm hover:bg-purple-800 disabled:bg-slate-300">↑</button>
                </div>
              </div>
              <p className="mt-2 text-center text-xs leading-5 text-slate-500">آرتین پاسخ را بر اساس بانک دانش و تحلیل فنی ارائه می‌کند؛ برای تصمیم‌های مهم، امکان ثبت درخواست مشاوره وجود دارد.</p>
            </div>
          </div>
        </footer>
      )}
    </section>
  );
}
