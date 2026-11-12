"use client";
import { AssistantRuntimeProvider, MessagePrimitive, ThreadPrimitive, generateId, useExternalStoreRuntime } from "@assistant-ui/react";
import type { AttachmentAdapter, CreateAppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import { useEffect, useRef, useState, Suspense } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import ApprovedCustomerGate from "@/components/ApprovedCustomerGate";
import type {LibraryResources} from "@/lib/library-resources";
import {isAppEnvironment} from "@/lib/app-environment";
import { apiUrl, backendFetch, getCsrfToken } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";
import { getSavedCustomer } from "@/lib/customer";
import { GUEST_FREE_QUESTIONS } from "@/lib/guest-gate";
import {
  Plus,
  Download,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { findRelatedDevices } from "@/lib/device-assets";
import {
  shouldShowRelatedDeviceCards,
  isNonEquipmentTurn,
  cleanAssistantOutput,
  cleanMarkdownText,
  normalizeSuggestedQuestions,
  testTypes,
  imageTypes,
  getTestTypeLabel,
  getImageTypeLabel,
} from "@/lib/chat-helpers";
const MessageBubble = dynamic(() => import("@/components/MessageBubble"), { ssr: false });
import GuestContactCard from "@/components/GuestContactCard";
import GuestRegistrationCard from "@/components/GuestRegistrationCard";
const UploadModal = dynamic(() => import("@/components/UploadModal"), { ssr: false });
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTTS } from "@/hooks/useTTS";
import { useExportChat } from "@/hooks/useExportChat";
import { useScrollToBottom } from "@/hooks/useScrollToBottom";
import { useCustomerChatSession } from "@/hooks/useCustomerChatSession";
import StarterQuestions from "@/components/StarterQuestions";
import { useI18n } from "@/lib/i18n";
import type {
  Source,
  ChatMessage,
  Customer,
  ResourceLink,
  ResourceImage,
  ToolAction,
} from "@/lib/chat-types";

import RateLimitBanner from "@/app/assistant/RateLimitBanner";
import AssistantQuickActions from "@/app/assistant/AssistantQuickActions";
import DropOverlay from "@/app/assistant/DropOverlay";
import ScrollToBottomButton from "@/app/assistant/ScrollToBottomButton";
import ChatComposer from "@/app/assistant/ChatComposer";
import AssistantStart from "@/app/assistant/AssistantStart";
const LabChatLauncher = dynamic(() => import("@/app/calculators/workspace/LabAssistant"), { ssr: false });

const imageAttachmentAdapter: AttachmentAdapter = {
  accept: "image/*",
  async add({ file }) {
    return {
      id: generateId(),
      type: "image",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  },
  async send(attachment) {
    // The existing analysis endpoint accepts the original File in FormData.
    return { ...attachment, status: { type: "complete" }, content: [] };
  },
  async remove() {},
};

function convertChatMessage(item: ChatMessage): ThreadMessageLike {
  return {
    role: item.role,
    content: [{ type: "text", text: item.role === "assistant" ? cleanMarkdownText(item.content) : item.content }],
  };
}

type AnalysisResponse = Record<string, unknown> & {
  ai_analysis?: string;
  error?: string;
  detail?: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  test_type?: string;
  test_type_label?: string;
  image_type?: string;
  image_type_label?: string;
};

async function readAnalysisResponse(res: Response): Promise<AnalysisResponse> {
  let data: AnalysisResponse = {};

  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detail =
      data.detail ||
      data.error ||
      (res.status >= 500
        ? "Backend connection failed. Make sure the FastAPI server is running on port 8000."
        : `HTTP ${res.status}`);
    throw new Error(detail);
  }

  return data;
}

function formatAnalysisUploadError(error: unknown, kind: "file" | "image", isEn: boolean) {
  const message = error instanceof Error ? error.message : "";
  const looksLikeBackendDown =
    !message ||
    /failed to fetch|network error|econnrefused|econnreset|socket hang up|fetch failed|connection/i.test(message);

  if (looksLikeBackendDown) {
    return isEn
      ? "Could not connect to the analysis server. Please make sure the backend is running on port 8000, then try again."
      : "اتصال به سرور تحلیل برقرار نشد. لطفا مطمئن شوید بک‌اند روی پورت 8000 اجراست و دوباره امتحان کنید.";
  }

  const label = kind === "image"
    ? isEn ? "image" : "عکس"
    : isEn ? "file" : "فایل";

  return isEn
    ? `Upload or analysis failed for this ${label}: ${message}`
    : `خطا در آپلود یا تحلیل ${label}: ${message}`;
}

function AssistantPageInner() {
  const [appMode,setAppMode]=useState(false);
  useEffect(()=>{setAppMode(isAppEnvironment());},[]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const sessionIdParam = searchParams.get("session_id");
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
  const [accessCheckFailed, setAccessCheckFailed] = useState(false);
  const [guestUsed, setGuestUsed] = useState(0);
  const [guestIdentified, setGuestIdentified] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [rateLimitTotal, setRateLimitTotal] = useState(60);
  const [isDragOver, setIsDragOver] = useState(false);
  const { speakingIndex, ttsNote, setTtsNote, speakMessage } = useTTS();
  const [canUndo, setCanUndo] = useState(false);
  const { showExportMenu, setShowExportMenu, exportChat, exportChatWord, exportChatText } = useExportChat(messages);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const domainLabels = {
    auto: isEn ? "Auto detect" : "تشخیص خودکار",
    catalyst: isEn ? "Catalyst" : "کاتالیست",
    equipment: isEn ? "Equipment" : "تجهیزات",
    chromatography: isEn ? "Chromatography" : "کروماتوگرافی",
    "mercury-analysis": isEn ? "Mercury analysis" : "آنالیز جیوه",
    "sulfur-analysis": isEn ? "Sulfur analysis" : "آنالیز سولفور",
    troubleshooting: isEn ? "Troubleshooting" : "عیب‌یابی",
    analysis: isEn ? "Analysis & testing" : "آنالیز و تست",
  };
  const responseModeLabels = {
    auto: isEn ? "Smart answer" : "پاسخ هوشمند",
    brief: isEn ? "Brief" : "خلاصه",
    technical: isEn ? "Full technical" : "فنی کامل",
    checklist: isEn ? "Checklist" : "چک‌لیست",
  };
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortIntentRef = useRef<"undo" | "stop" | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedMsgRef = useRef<string>("");
  const {
    messagesEndRef,
    scrollContainerRef,
    showScrollBtn,
    handleChatScroll,
    scrollToBottom,
  } = useScrollToBottom(messages);
  const {
    ensureCustomerSession,
    saveCustomerChatMessage,
    loadSavedChatSession,
  } = useCustomerChatSession({
    customer,
    setCustomer,
    activeSessionId,
    setActiveSessionId,
    setMessages,
    setLoadingSavedSession,
  });
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageSelectionRef = useRef(0);

  function syncComposerMessage(value: string) {
    runtime.thread.composer.setText(value);
  }

  const { voiceState, toggleVoice, isSupported: isVoiceSupported } = useVoiceInput(
    (transcript) => {
      const currentText = chatInputRef.current?.value ?? runtime.thread.composer.getState().text;
      syncComposerMessage(currentText ? `${currentText} ${transcript}` : transcript);
    }
  );

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function sendQuickAction(
    action: "shorter" | "technical" | "table" | "sources",
    answerText: string,
  ) {
    const cleanAnswer = answerText.trim();

    const prompts: Record<typeof action, string> = isEn
      ? {
          shorter: `Rewrite the following answer in a shorter, more practical, well-structured form. Return only the final version and do not add an introduction:

${cleanAnswer}`,

          technical: `Rewrite the following answer in a more technical, precise, and complete form. It should be structured, clear, and suitable for a laboratory or process expert. Return only the final version and do not add an introduction:

${cleanAnswer}`,

          table: `Safe and allowed request: convert only the technical text below from prose into a Markdown table.
Do not add new facts.
If the text is about a laboratory method, device, standard, or sample, summarize only the existing information in the table.
Write the output in English.
First provide the Markdown table, then add one short one-line summary.

Text to convert:
${cleanAnswer}`,

          sources: `From the following answer, create a compact follow-up section in English with these headings:
1. Key technical points
2. Evidence or source hints already mentioned in the answer
3. Missing information to confirm
4. Recommended next action
Do not invent sources or facts. If the answer does not mention a source, say that no explicit source was included.

Answer:
${cleanAnswer}`,
        }
      : {
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

          sources: `از پاسخ زیر یک بخش پیگیری کوتاه و منظم به فارسی بساز، با این تیترها:
1. نکات فنی کلیدی
2. شواهد یا اشاره‌های منبعی که در خود پاسخ آمده
3. اطلاعات ناقص برای تأیید نهایی
4. اقدام بعدی پیشنهادی
منبع یا واقعیت جدید نساز. اگر در پاسخ منبع صریحی نیامده، بنویس منبع صریحی در پاسخ ذکر نشده است.

پاسخ:
${cleanAnswer}`,
        };

    const visibleMessages = {
      shorter: isEn ? "Make it shorter" : "خلاصه‌تر کن",
      technical: isEn ? "Make it more technical" : "فنی‌تر توضیح بده",
      table: isEn ? "Convert to table" : "تبدیل به جدول",
      sources: isEn ? "Extract sources and next steps" : "منابع و اقدام بعدی را استخراج کن",
    };

    sendMessage(prompts[action], visibleMessages[action]);
  }

  // «ثبت استعلام قیمت» از زیر یک پاسخ: سؤالِ کاربرِ همان گفتگو را به‌عنوان موضوع در
  // فرم درخواست پیش‌پُر می‌کند — از همان مکانیزم query paramِ موجودِ فرم (type + item).
  function startQuoteRequest(assistantIndex: number) {
    let subject = "";
    for (let i = assistantIndex; i >= 0; i--) {
      if (messages[i]?.role === "user" && messages[i].content.trim()) {
        subject = messages[i].content.trim().slice(0, 160);
        break;
      }
    }
    const params = new URLSearchParams({ type: "price-inquiry" });
    if (subject) params.set("item", subject);
    router.push(`/customer-request?${params.toString()}`);
  }

  function undoSend() {
    if (abortControllerRef.current) {
      abortIntentRef.current = "undo";
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setCanUndo(false);
    setLoading(false);
    syncComposerMessage(savedMsgRef.current);
    setMessages((prev) => prev.slice(0, -2)); // remove user msg + placeholder
  }

  function stopStreaming() {
    if (!abortControllerRef.current) return;
    abortIntentRef.current = "stop";
    abortControllerRef.current.abort();
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setCanUndo(false);
  }

  async function regenerateLastResponse(parentId: string | null): Promise<void> {
    const promptIndex = messages.length - 2;
    const prompt = messages[promptIndex];
    if (prompt?.role !== "user" || prompt.attachment || messages.at(-1)?.role !== "assistant") return;
    if (runtime.thread.getMessageByIndex(promptIndex).getState().id !== parentId) return;
    await sendMessage(prompt.actualPrompt || prompt.content, prompt.content, messages.slice(0, promptIndex));
  }

  async function editMessage(item: Exclude<CreateAppendMessage, string>): Promise<void> {
    const index = runtime.thread.getState().messages.findIndex((message) => message.id === item.sourceId);
    const original = messages[index];
    if (original?.role !== "user" || original.attachment) return;
    const prompt = item.content.map((part) => part.type === "text" ? part.text : "").join("").trim();
    await sendMessage(prompt, prompt, messages.slice(0, index));
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
        headers: { "Content-Type": "application/json", "X-CSRF-Token": getCsrfToken() },
        body: JSON.stringify({ rating, comment: comment || "" }),
      });
    } catch {
      // خطای بازخورد نباید چت را خراب کند
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const res = await backendFetch(apiUrl("/chat/access"), { cache: "no-store" });
        if (!res.ok) throw new Error("Access check failed");
        const access = await res.json();
        if (cancelled) return;
        const savedCustomer = getSavedCustomer();
        const verifiedCustomer = savedCustomer?.id === access.customer_id ? savedCustomer : null;
        setCustomer(verifiedCustomer);
        setGuestUsed(access.used);
        setGuestIdentified(!!access.identified);
        if (sessionIdParam && verifiedCustomer) {
          const sessionId = Number(sessionIdParam);
          if (!Number.isNaN(sessionId)) loadSavedChatSession(verifiedCustomer.id, sessionId);
        }
      } catch {
        if (!cancelled) setAccessCheckFailed(true);
      } finally {
        if (!cancelled) setCheckingCustomerLogin(false);
      }
    }
    void checkAccess();
    return () => { cancelled = true; };
  }, [loadSavedChatSession, sessionIdParam]);

  const needsContact = !customer && !appMode && guestUsed >= 1 && !guestIdentified;
  const guestOutOfQuestions = !customer && (appMode || guestUsed >= GUEST_FREE_QUESTIONS || needsContact);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const timer = setTimeout(() => setRateLimitCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      // "/" → focus chat input (only when not already typing)
      if (e.key === "/" && !isEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        chatInputRef.current?.focus();
        return;
      }

      // Escape → abort in-flight request
      if (e.key === "Escape" && abortControllerRef.current) {
        stopStreaming();
        return;
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

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

  async function sendMessage(finalMessage: string, displayMessage?: string, historyOverride?: ChatMessage[]) {
    if (loading || guestOutOfQuestions || rateLimitCountdown > 0) return;
    const visibleMessage = displayMessage || finalMessage;

    if (!finalMessage.trim()) return;

    const previousMessages = historyOverride || messages;
    const userId = getOrCreateUserId();

    const userMessage: ChatMessage = {
      role: "user",
      content: visibleMessage,
      actualPrompt: displayMessage ? finalMessage : undefined,
    };

    abortIntentRef.current = null;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    savedMsgRef.current = finalMessage;
    const placeholderMsg: ChatMessage = { role: "assistant", content: "" };
    const optimisticMessages = [...previousMessages, userMessage, placeholderMsg];

    flushSync(() => {
      syncComposerMessage("");
      setLoading(true);
      setShowTools(false);
      setCanUndo(true);
      setSuggestedQuestions([]);
      setMessages(optimisticMessages);
    });

    // Undo window: 5 seconds before Artin responds
    undoTimerRef.current = setTimeout(() => { setCanUndo(false); }, 5000);

    const activeCustomer = customer;

    const bodyPayload = {
      client_surface: isAppEnvironment()?'app':'web',
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

    let accumulatedText = "";
    let finalAssistantMsg: ChatMessage = { role: "assistant", content: "" };

    try {
      const customerSessionId = await ensureCustomerSession(visibleMessage);
      controller.signal.throwIfAborted();
      await saveCustomerChatMessage(customerSessionId, "user", visibleMessage, {
        domain,
        response_mode: responseMode,
        actual_prompt: displayMessage ? finalMessage : undefined,
      });
      controller.signal.throwIfAborted();

      const res = await fetch(apiUrl("/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        setCustomer(null);
        setGuestUsed(GUEST_FREE_QUESTIONS);
        setMessages(previousMessages);
        return;
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
        const totalSecs = isNaN(retryAfter) ? 60 : retryAfter;
        setRateLimitTotal(totalSecs);
        setRateLimitCountdown(totalSecs);
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

      if (!customer) setGuestUsed((used) => used + 1);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let metaData: Record<string, unknown> = {};

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
                content: cleanAssistantOutput(accumulatedText),
                sources: (event.sources as Source[]) || [],
                library_resources: event.library_resources as LibraryResources|undefined,
                detected_domain: event.detected_domain as string,
                question_intent: event.question_intent as string,
                resource_links: (event.resource_links as ResourceLink[]) || [],
                resource_images: (event.resource_images as ResourceImage[]) || [],
              };
            } else if (event.type === "chunk") {
              accumulatedText += event.text as string;
              const visibleAccumulatedText = cleanAssistantOutput(accumulatedText);
              setMessages([
                ...previousMessages,
                userMessage,
                { ...finalAssistantMsg, content: visibleAccumulatedText },
              ]);
            } else if (event.type === "done") {
              const finalContent = cleanAssistantOutput(accumulatedText);
              const relatedDevices = shouldShowRelatedDeviceCards(visibleMessage, domain)
                ? findRelatedDevices(finalMessage, finalContent, 2)
                : [];
              finalAssistantMsg = {
                ...finalAssistantMsg,
                content: finalContent,
                question_id: event.question_id as number,
                relatedDevices,
              };
              setMessages([...previousMessages, userMessage, finalAssistantMsg]);

              // ذخیره در session مشتری
              await saveCustomerChatMessage(
                customerSessionId,
                "assistant",
                finalAssistantMsg.content,
                {
                  sources: finalAssistantMsg.sources || [],
                  library_resources: finalAssistantMsg.library_resources,
                  detected_domain: finalAssistantMsg.detected_domain,
                  question_id: finalAssistantMsg.question_id,
                  resource_links: finalAssistantMsg.resource_links || [],
                  resource_images: finalAssistantMsg.resource_images || [],
                  relatedDevices,
                },
              );
            } else if (event.type === "error") {
              throw new Error(event.message as string || "خطا در دریافت پاسخ.");
            }
          } catch {
            // ادامه parsing خطوط دیگر
          }
        }
      }

      setLoading(false);
      setCanUndo(false);
      if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
      void metaData; // suppress unused warning

      // پیشنهاد سوالات مرتبط (non-blocking)
      const finalCleanAnswer = cleanAssistantOutput(accumulatedText);
      if (customer && finalCleanAnswer.length > 100) {
        backendFetch(apiUrl("/chat/suggest-questions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: finalMessage,
            answer: finalCleanAnswer,
            domain: finalAssistantMsg.detected_domain || "auto",
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            const questions = normalizeSuggestedQuestions(d.questions || []);
            if (questions.length) setSuggestedQuestions(questions);
          })
          .catch(() => {});
      }
    } catch (error) {
      if (abortControllerRef.current !== controller) return;
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (aborted && abortIntentRef.current === "undo") {
        return;
      }
      if (aborted && abortIntentRef.current === "stop") {
        const stoppedLabel = isEn ? "Response stopped." : "پاسخ متوقف شد.";
        const stoppedContent = accumulatedText.trim()
          ? `${accumulatedText}\n\n_${stoppedLabel}_`
          : stoppedLabel;
        setMessages([
          ...previousMessages,
          userMessage,
          { ...finalAssistantMsg, content: stoppedContent },
        ]);
        return;
      }
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
      if (abortControllerRef.current === controller) {
        setLoading(false);
        setCanUndo(false);
        abortControllerRef.current = null;
        abortIntentRef.current = null;
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }
      }
    }
  }

  function clearChat() {
    savedMsgRef.current = "";
    setMessages([]);
    syncComposerMessage("");
    imageSelectionRef.current++;
    void runtime.thread.composer.clearAttachments();
    setShowTools(false);
    setActiveSessionId(null);
    router.replace("/assistant");
  }

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: loading,
    isSendDisabled: guestOutOfQuestions,
    adapters: { attachments: customer ? imageAttachmentAdapter : undefined },
    onCancel: async () => { stopStreaming(); },
    onEdit: editMessage,
    onReload: regenerateLastResponse,
    convertMessage: convertChatMessage,
    onNew: async (item) => {
      if (loading || guestOutOfQuestions) return;
      const prompt = item.content.map((part) => part.type === "text" ? part.text : "").join("");
      const attachment = item.attachments?.[0];
      if (attachment?.file && customer) {
        const type = item.metadata.custom?.analysisType;
        const analysisType = typeof type === "string" ? type : "general";
        if (attachment.type === "image") {
          await uploadAndAnalyzeImage(attachment.file, prompt.trim(), analysisType);
        } else {
          await uploadAndAnalyzeFile(attachment.file, prompt, analysisType);
        }
      } else {
        await sendMessage(prompt);
      }
    },
  });

  async function stageImage(file: File) {
    if (!customer || !file.type.startsWith("image/")) return;
    const selection = ++imageSelectionRef.current;
    const composer = runtime.thread.composer;
    await composer.clearAttachments();
    if (selection === imageSelectionRef.current) await composer.addAttachment(file);
  }

  function handleImagePaste(event: React.ClipboardEvent) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))?.getAsFile()
      ?? Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (image) {
      event.preventDefault();
      void stageImage(image);
    }
  }

  async function uploadAndAnalyzeFile(file: File, note: string, testType: string) {
    if (!customer) { router.push("/customer-register"); return; }
    setLoading(true);
    setShowTools(false);

    const userMessage: ChatMessage = {
      role: "user",
      content: "فایل برای تحلیل ارسال شد.",
      attachment: {
        name: file.name,
        kind: "file",
        analysisType: getTestTypeLabel(testType),
        note,
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

    const _fileCustomer = customer || getSavedCustomer();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("test_type", testType);
    formData.append("user_note", note);
    formData.append("user_id", _fileCustomer ? `customer_${_fileCustomer.id}` : getOrCreateUserId());
    if (_fileCustomer) formData.append("customer_id", String(_fileCustomer.id));

    try {
      const res = await backendFetch(apiUrl("/analyze-file"), {
        method: "POST",
        body: formData,
      });

      const data = await readAnalysisResponse(res);

      const relatedDevices = shouldShowRelatedDeviceCards(
        `${file.name}\n${note}`,
        domain,
      )
        ? findRelatedDevices(
            `${file.name}\n${note}`,
            data.ai_analysis || data.error || "",
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
        question_id: data.question_id as number|undefined,
        relatedDevices,
      };

      await saveCustomerChatMessage(
        customerSessionId,
        "assistant",
        assistantMessage.content,
        {
          detected_domain: "file-analysis",
          question_id: data.question_id,
          file_name: data.file_name,
          file_url: data.file_url,
          file_type: data.file_type,
          test_type: data.test_type,
          test_type_label: data.test_type_label,
          relatedDevices,
        },
      );

      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch (error) {
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: formatAnalysisUploadError(error, "file", isEn),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function uploadAndAnalyzeImage(file: File, note: string, imgType: string) {
    if (!customer) { router.push("/customer-register"); return; }
    setLoading(true);
    setShowTools(false);

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

    const _imgCustomer = customer || getSavedCustomer();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("image_type", imgType);
    formData.append("user_note", note);
    formData.append("user_id", _imgCustomer ? `customer_${_imgCustomer.id}` : getOrCreateUserId());
    if (_imgCustomer) formData.append("customer_id", String(_imgCustomer.id));

    try {
      const res = await backendFetch(apiUrl("/analyze-image"), {
        method: "POST",
        body: formData,
      });

      const data = await readAnalysisResponse(res);

      const relatedDevices = shouldShowRelatedDeviceCards(
        `${file.name}\n${note}`,
        domain,
      )
        ? findRelatedDevices(
            `${file.name}\n${note}`,
            data.ai_analysis || data.error || "",
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
        question_id: data.question_id as number|undefined,
        relatedDevices,
      };

      await saveCustomerChatMessage(
        customerSessionId,
        "assistant",
        assistantMessage.content,
        {
          detected_domain: "image-analysis",
          question_id: data.question_id,
          file_name: data.file_name,
          file_url: data.file_url,
          file_type: data.file_type,
          image_type: data.image_type,
          image_type_label: data.image_type_label,
          relatedDevices,
        },
      );

      typeAssistantMessage(previousMessages, userMessage, assistantMessage);
    } catch (error) {
      setMessages([
        ...previousMessages,
        userMessage,
        {
          role: "assistant",
          content: formatAnalysisUploadError(error, "image", isEn),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!customer) { router.push("/customer-register"); return; }
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
  function appendAnalysis(file: File, type: "image" | "document", analysisType: string, note: string) {
    runtime.thread.append({
      role: "user",
      content: note ? [{ type: "text", text: note }] : [],
      attachments: [{
        id: generateId(),
        type,
        name: file.name,
        contentType: file.type,
        file,
        status: { type: "complete" },
        content: [],
      }],
      metadata: { custom: { analysisType } },
    });
  }

  function confirmFileAnalysis() {
    if (!pendingFile || loading) return;
    setShowFileOptions(false);
    appendAnalysis(pendingFile, "document", chatTestType, chatUserNote);
    setPendingFile(null);
  }

  function cancelFileAnalysis() {
    setShowFileOptions(false);
    setPendingFile(null);
    setChatUserNote("");
    setChatTestType("general");
  }

  function confirmImageAnalysis() {
    if (!pendingImage || loading) return;

    setShowImageOptions(false);
    appendAnalysis(pendingImage, "image", chatImageType, chatImageNote);
    setPendingImage(null);
  }

  function cancelImageAnalysis() {
    setShowImageOptions(false);
    setPendingImage(null);
    setChatImageNote("");
    setChatImageType("general");
  }

  function handleToolClick(action: ToolAction) {
    if (!customer) { router.push("/customer-register"); return; }
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
      syncComposerMessage(
        isEn
          ? "For troubleshooting this equipment issue, provide likely causes and a step-by-step checklist: "
          : "برای عیب‌یابی این مشکل دستگاه، علت‌های احتمالی و چک‌لیست مرحله‌ای بده: ",
      );
      return;
    }

    if (action === "device-suggestion") {
      setDomain("equipment");
      syncComposerMessage(
        isEn
          ? "For this application or sample type, suggest the suitable ArtinAzma device/equipment: "
          : "برای این کاربرد یا نوع نمونه، دستگاه/تجهیز مناسب آرتین آزما را پیشنهاد بده: ",
      );
      return;
    }

    if (action === "catalyst-suggestion") {
      setDomain("catalyst");
      syncComposerMessage(
        isEn
          ? "For this process or issue, suggest the suitable catalyst or the tests needed to evaluate the catalyst: "
          : "برای این فرایند یا مشکل، کاتالیست مناسب یا تست‌های لازم برای بررسی کاتالیست را پیشنهاد بده: ",
      );
    }
  }
  if (checkingCustomerLogin) {
    return (
      <section className="flex h-full items-center justify-center bg-white px-6">
        <div className="ui-card rounded-[28px] p-8 text-center shadow-sm">
          <div className="text-lg font-bold text-slate-900">
            {isEn ? "Checking customer login..." : "در حال بررسی ورود مشتری..."}
          </div>

          <div className="mt-3 text-sm text-slate-500">
            {isEn
              ? "You need to sign in to use Artin."
              : "برای استفاده از آرتین باید وارد حساب کاربری شوید."}
          </div>
        </div>
      </section>
    );
  }
  if (accessCheckFailed) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p>{isEn ? "Could not check your access. Please try again." : "بررسی دسترسی انجام نشد. لطفاً دوباره تلاش کنید."}</p>
        <button onClick={() => window.location.reload()} className="rounded-xl bg-[var(--brand-fill)] px-4 py-2 text-white">
          {isEn ? "Try again" : "تلاش دوباره"}
        </button>
      </section>
    );
  }
  const composer = (
    <ChatComposer
      welcome={messages.length === 0 && !loading}
      rateLimitActive={rateLimitCountdown > 0}
      toolsEnabled={!!customer}
      isEn={isEn}
      showTools={showTools}
      onToggleTools={() => setShowTools((prev) => !prev)}
      onToolSelect={handleToolClick}
      isDragOver={isDragOver}
      onStageImage={(file) => { void stageImage(file); }}
      chatInputRef={chatInputRef}
      onPaste={handleImagePaste}
      isVoiceSupported={!!customer && isVoiceSupported}
      onToggleVoice={toggleVoice}
      voiceState={voiceState}
      loading={loading}
    />
  );
  const startContent = (
    <>
      <RateLimitBanner countdown={rateLimitCountdown} total={rateLimitTotal} isEn={isEn} />
      {guestOutOfQuestions ? (
        <div className="w-full max-w-xl">
          {needsContact ? <GuestContactCard isEn={isEn} onDone={() => setGuestIdentified(true)} /> : <GuestRegistrationCard isEn={isEn} appMode={appMode} />}
        </div>
      ) : composer}
      {customer && (
        <AssistantQuickActions
          isEn={isEn}
          onUpload={() => handleToolClick("upload")}
          onRequest={() => handleToolClick("customer-request")}
        />
      )}
    </>
  );
  const starterQuestions = !guestOutOfQuestions && (
    <StarterQuestions onSelect={() => chatInputRef.current?.focus()} />
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root asChild>
    <section
      className={`artin-workspace relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden transition-colors ${isDragOver ? "ring-2 ring-inset ring-[var(--brand-focus-ring)] bg-[var(--color-info-bg)]/30" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (customer && Array.from(event.dataTransfer.types).includes("Files")) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const file = event.dataTransfer.files[0];
        if (file) void stageImage(file);
      }}
    >
      {searchParams.get('lab')==='1'&&<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-slate-100 px-3 py-2"><span className="text-xs text-slate-500">{isEn?'Attached laboratory project':'پروندهٔ منتقل‌شده از آزمایشگاه'}</span><ApprovedCustomerGate><LabChatLauncher en={isEn}/></ApprovedCustomerGate><Link className="text-xs underline" href="/assistant">{isEn?'Return to general chat':'بازگشت به چت عمومی'}</Link></div>}
      <DropOverlay show={isDragOver} isEn={isEn} />
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleUploadChange}
        className="hidden"
      />
      {showFileOptions && pendingFile && (
        <UploadModal
          title={isEn ? "File analysis settings" : "تنظیمات تحلیل فایل"}
          fileName={pendingFile.name}
          label={isEn ? "Test or report type" : "نوع تست یا گزارش"}
          selectValue={chatTestType}
          onSelectChange={setChatTestType}
          options={testTypes}
          noteValue={chatUserNote}
          onNoteChange={setChatUserNote}
          noteLabel={isEn ? "Optional note about the sample or test conditions" : "توضیح اختیاری درباره نمونه یا شرایط تست"}
          placeholder={
            isEn
              ? "Example: The sample is LPG, the baseline fluctuates, the catalyst test was run at 350 C..."
              : "مثلاً: نمونه LPG است، baseline نوسان دارد، تست کاتالیست در دمای 350 درجه انجام شده..."
          }
          confirmLabel={isEn ? "Start file analysis" : "شروع تحلیل فایل"}
          onConfirm={confirmFileAnalysis}
          onCancel={cancelFileAnalysis}
        />
      )}

      {showImageOptions && pendingImage && (
        <UploadModal
          title={isEn ? "Image analysis settings" : "تنظیمات تحلیل عکس"}
          fileName={pendingImage.name}
          label={isEn ? "Image type" : "نوع تصویر"}
          selectValue={chatImageType}
          onSelectChange={setChatImageType}
          options={imageTypes}
          noteValue={chatImageNote}
          onNoteChange={setChatImageNote}
          noteLabel={isEn ? "Optional note about the image" : "توضیح اختیاری درباره تصویر"}
          placeholder={
            isEn
              ? "Example: This image shows a GC instrument error or an LPG sample chromatogram..."
              : "مثلاً: این عکس مربوط به ارور دستگاه GC است یا کروماتوگرام نمونه LPG است..."
          }
          confirmLabel={isEn ? "Start image analysis" : "شروع تحلیل عکس"}
          onConfirm={confirmImageAnalysis}
          onCancel={cancelImageAnalysis}
          footer={isEn ? "Allowed image formats: JPG, PNG, WEBP" : "فرمت‌های مجاز تصویر: JPG, PNG, WEBP"}
        />
      )}

      {voiceState === "listening" && (
        <div className="flex items-center justify-center gap-2 bg-red-50 py-2 text-sm font-medium text-red-600" dir={dir}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          {isEn ? "Recording... speak now" : "در حال ضبط صدا... صحبت کنید"}
        </div>
      )}

      <header className="artin-workspace-header shrink-0 border-b">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/artin-avatar.png"
              alt={isEn ? "Artin" : "آرتین"}
              className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm sm:h-8 sm:w-8"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-[14px] font-bold text-[var(--foreground)] sm:text-[15px]">{isEn ? "Artin AI" : "آرتین AI"}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 sm:text-[11px]">
              {isEn ? "Online" : "آنلاین"}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            {!customer&&<><Link href="/customer-login?next=/assistant" className="shrink-0 rounded-lg bg-[var(--brand-fill)] px-3 py-2 text-xs font-bold text-white">{isEn?"Sign in":"ورود به حساب"}</Link><Link href="/customer-register" className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{isEn?"Register":"ثبت‌نام"}</Link></>}
            {/* Domain + mode — visible on desktop, hidden on mobile */}
            <select
              aria-label={isEn ? "Question domain" : "حوزهٔ پرسش"}
              disabled={!customer}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none md:block"
            >
              <option value="auto">{domainLabels.auto}</option>
              <option value="catalyst">{domainLabels.catalyst}</option>
              <option value="equipment">{domainLabels.equipment}</option>
              <option value="chromatography">{domainLabels.chromatography}</option>
              <option value="mercury-analysis">{domainLabels["mercury-analysis"]}</option>
              <option value="sulfur-analysis">{domainLabels["sulfur-analysis"]}</option>
              <option value="troubleshooting">{domainLabels.troubleshooting}</option>
              <option value="analysis">{domainLabels.analysis}</option>
            </select>
            <select
              aria-label={isEn ? "Response style" : "سبک پاسخ"}
              disabled={!customer}
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value)}
              className="hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none md:block"
            >
              <option value="auto">{responseModeLabels.auto}</option>
              <option value="brief">{responseModeLabels.brief}</option>
              <option value="technical">{responseModeLabels.technical}</option>
              <option value="checklist">{responseModeLabels.checklist}</option>
            </select>
            {/* Mobile settings toggle — only on mobile */}
            <button
              type="button"
              disabled={!customer}
              onClick={() => setShowMobileSettings((v) => !v)}
              aria-label={isEn ? "Chat settings" : "تنظیمات گفتگو"}
              aria-expanded={showMobileSettings}
              aria-controls={showMobileSettings ? "artin-mobile-chat-settings" : undefined}
              title={isEn ? "Chat settings" : "تنظیمات گفتگو"}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition md:hidden ${
                showMobileSettings
                  ? "border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>
            {customer && messages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  title={isEn ? "Export chat" : "خروجی گفتگو"}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
                  aria-label={isEn ? "Download" : "دانلود"}
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">{isEn ? "Download" : "دانلود"}</span>
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
                        className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)]"
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
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5"
              aria-label={isEn ? "New chat" : "گفتگوی جدید"}
            >
              <Plus size={13} />
              <span className="hidden sm:inline">{isEn ? "New" : "جدید"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile settings panel — slides in below header on small screens */}
      {showMobileSettings && (
        <div id="artin-mobile-chat-settings" className="artin-motion-panel shrink-0 border-b border-[var(--border-soft)] bg-[var(--surface)] px-3 py-3 md:hidden" dir={dir}>
          <div className="grid grid-cols-2 items-start gap-x-2 gap-y-1.5">
            <label htmlFor="artin-mobile-domain" className="text-xs font-semibold">{isEn ? "Question domain" : "حوزهٔ پرسش"}</label>
            <label htmlFor="artin-mobile-response-mode" className="text-xs font-semibold">{isEn ? "Response style" : "سبک پاسخ"}</label>
            <select
              id="artin-mobile-domain"
              disabled={!customer}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="min-h-10 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 text-xs"
            >
              <option value="auto">{domainLabels.auto}</option>
              <option value="catalyst">{domainLabels.catalyst}</option>
              <option value="equipment">{domainLabels.equipment}</option>
              <option value="chromatography">{domainLabels.chromatography}</option>
              <option value="mercury-analysis">{domainLabels["mercury-analysis"]}</option>
              <option value="sulfur-analysis">{domainLabels["sulfur-analysis"]}</option>
              <option value="troubleshooting">{domainLabels.troubleshooting}</option>
              <option value="analysis">{domainLabels.analysis}</option>
            </select>
            <select
              id="artin-mobile-response-mode"
              disabled={!customer}
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value)}
              className="min-h-10 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 text-xs"
            >
              <option value="auto">{responseModeLabels.auto}</option>
              <option value="brief">{responseModeLabels.brief}</option>
              <option value="technical">{responseModeLabels.technical}</option>
              <option value="checklist">{responseModeLabels.checklist}</option>
            </select>
          </div>
        </div>
      )}

      <ThreadPrimitive.Viewport
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
        autoScroll={false}
        scrollToBottomOnRunStart={false}
        scrollToBottomOnInitialize={false}
        scrollToBottomOnThreadSwitch={false}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {loadingSavedSession && (
          <div className="ui-alert ui-alert-info mx-auto mt-6 max-w-xl text-center text-sm font-bold">
            {isEn ? "Loading saved conversation..." : "در حال بارگذاری گفتگوی ذخیره‌شده..."}
          </div>
        )}
        <div className="mx-auto w-full max-w-5xl px-3 pb-3 pt-3 sm:px-3 sm:pb-4 sm:pt-4 md:px-6 md:pb-6 md:pt-6">
          {messages.length === 0 && !loading ? (
            <AssistantStart isEn={isEn} suggestions={starterQuestions}>
              {startContent}
            </AssistantStart>
          ) : (
            <div
              className="mx-auto w-full max-w-[780px] space-y-6 pb-3 sm:space-y-8"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label={isEn ? "Conversation" : "گفتگو"}
            >
              <ThreadPrimitive.Messages>
                {({ message: { index } }) => {
                  const item = messages[index];
                  if (!item) return null;
                  const prompt = messages[index - 1];
                  return (
                    <MessagePrimitive.Root>
                      <MessageBubble
                        toolsEnabled={!!customer}
                        item={item.relatedDevices?.length && prompt?.role === "user" &&
                          isNonEquipmentTurn(prompt.content) ? { ...item, relatedDevices: undefined } : item}
                        index={index}
                        loading={loading}
                        onCopy={copyText}
                        onRequest={() => router.push("/customer-request")}
                        onQuote={() => startQuoteRequest(index)}
                        onQuickAction={sendQuickAction}
                        onFeedback={sendAnswerFeedback}
                        feedbackValue={item.question_id ? feedbackStatus[item.question_id] : undefined}
                        onSpeak={speakMessage}
                        isSpeaking={speakingIndex === index}
                        canEdit={!loading && rateLimitCountdown === 0 && !guestOutOfQuestions}
                        canRegenerate={!loading && rateLimitCountdown === 0 && item.role === "assistant" &&
                          index === messages.length - 1 && prompt?.role === "user" && !prompt.attachment}
                      />
                      {item.role === "assistant" && item.question_id &&
                        ["file-analysis", "image-analysis"].includes(item.detected_domain ?? "") && (
                          <Link href={`/laboratory-imports?analysis=${item.question_id}`} className="mx-4 my-2 inline-flex rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm font-bold text-[var(--color-info-text)]">
                            {isEn ? "Review file data and calculate" : "بررسی داده‌های این فایل و اجرای محاسبه"}
                          </Link>
                        )}
                    </MessagePrimitive.Root>
                  );
                }}
              </ThreadPrimitive.Messages>

              {/* دروازه مهمان: یا سؤال تجاری پرسیده، یا سهمیه رایگانش تمام شده */}
              {guestOutOfQuestions && (
                needsContact ? <GuestContactCard isEn={isEn} onDone={() => setGuestIdentified(true)} /> : <GuestRegistrationCard isEn={isEn} appMode={appMode} />
              )}

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
                <div className="grid grid-cols-1 gap-2 pb-1 pt-1 md:grid-cols-3">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSuggestedQuestions([]);
                        sendMessage(q, q);
                      }}
                      className="inline-flex min-h-20 w-full items-center justify-center gap-1.5 whitespace-normal rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-center text-sm font-bold leading-6 text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)]"
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
                  <div className="flex max-w-[82%] flex-row-reverse items-center gap-2 rounded-2xl border border-[--border-soft] bg-[--surface] px-3.5 py-2.5 text-slate-600 shadow-sm dark:text-slate-300 sm:gap-3 sm:rounded-[28px] sm:px-5 sm:py-4">
                    <div className="relative shrink-0">
                      <img
                        src="/images/artin-avatar.png"
                        alt={isEn ? "Artin" : "آرتین"}
                        className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 object-cover sm:h-9 sm:w-9"
                      />
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--brand-fill)] ring-2 ring-white dark:ring-slate-900">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-[var(--color-info-text)] dark:text-teal-300">{isEn ? "Artin" : "آرتین"}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-persian text-slate-500 dark:text-slate-400">
                          {isEn ? "Typing" : "در حال تایپ"}
                        </span>
                        <span className="flex gap-1 pb-1">
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-fill)]" style={{animationDelay: "0ms"}} />
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-fill)]" style={{animationDelay: "200ms"}} />
                          <span className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-[var(--brand-fill)]" style={{animationDelay: "400ms"}} />
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
      </ThreadPrimitive.Viewport>
      <ScrollToBottomButton
        show={showScrollBtn && messages.length > 0}
        onClick={scrollToBottom}
        isEn={isEn}
      />

      {/* Out of free questions: hide the composer rather than leave a box that
          silently swallows what the visitor types. The contact card above is
          the way forward, and it comes back the moment they fill it in. */}
      {messages.length > 0 && !guestOutOfQuestions && (
        composer
      )}
    </section>
    </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantPageInner />
    </Suspense>
  );
}
