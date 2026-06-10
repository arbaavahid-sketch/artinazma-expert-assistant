"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { apiUrl, backendFetch, getCsrfToken } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";
import { getSavedCustomer } from "@/lib/customer";
import {
  Plus,
  Download,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { findRelatedDevices } from "@/lib/device-assets";
import {
  shouldShowRelatedDeviceCards,
  testTypes,
  imageTypes,
  getTestTypeLabel,
  getImageTypeLabel,
} from "@/lib/chat-helpers";
const MessageBubble = dynamic(() => import("@/components/MessageBubble"), { ssr: false });
const UploadModal = dynamic(() => import("@/components/UploadModal"), { ssr: false });
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTTS } from "@/hooks/useTTS";
import { useExportChat } from "@/hooks/useExportChat";
import { useStagedImage } from "@/hooks/useStagedImage";
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
import AssistantWelcome from "@/app/assistant/AssistantWelcome";
import AssistantQuickActions from "@/app/assistant/AssistantQuickActions";
import DropOverlay from "@/app/assistant/DropOverlay";
import ScrollToBottomButton from "@/app/assistant/ScrollToBottomButton";
import ChatComposer from "@/app/assistant/ChatComposer";
import HeroComposer from "@/app/assistant/HeroComposer";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale, dir } = useI18n();
  const isEn = locale === "en";
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
  const [rateLimitTotal, setRateLimitTotal] = useState(60);
  const {
    stagedImage,
    stagedImageUrl,
    isDragOver,
    stageImageFile,
    clearStagedImage,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useStagedImage();
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
  const lastPromptRef = useRef<{ actual: string; visible: string } | null>(null);
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

  const { voiceState, toggleVoice, isSupported: isVoiceSupported } = useVoiceInput(
    (transcript) => setMessage((prev) => prev ? prev + " " + transcript : transcript)
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
    setMessage(savedMsgRef.current);
    setMessages((prev) => prev.slice(0, -2)); // remove user msg + placeholder
  }

  function stopStreaming() {
    if (!abortControllerRef.current) return;
    abortIntentRef.current = "stop";
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setCanUndo(false);
  }

  function regenerateLastResponse() {
    if (loading) return;
    const lastPrompt = lastPromptRef.current;
    if (!lastPrompt) return;

    const lastAssistantIndex = [...messages].reverse().findIndex((item) => item.role === "assistant");
    if (lastAssistantIndex === -1) return;
    const indexFromStart = messages.length - 1 - lastAssistantIndex;
    const baseMessages = messages.slice(0, Math.max(0, indexFromStart - 1));
    setMessages(baseMessages);

    sendMessage(lastPrompt.actual, lastPrompt.visible, baseMessages);
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

  async function sendMessage(customMessage?: string, displayMessage?: string, historyOverride?: ChatMessage[]) {
    if (loading) return;
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

    const previousMessages = historyOverride || messages;
    const userId = getOrCreateUserId();
    lastPromptRef.current = { actual: finalMessage, visible: visibleMessage };

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
    abortIntentRef.current = null;
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

    let accumulatedText = "";
    let finalAssistantMsg: ChatMessage = { role: "assistant", content: "" };

    try {
      const res = await fetch(apiUrl("/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: abortControllerRef.current?.signal,
      });

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
          } catch {
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
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (aborted && abortIntentRef.current === "undo") {
        return;
      }
      if (aborted && abortIntentRef.current === "stop") {
        const stoppedContent = accumulatedText.trim()
          ? `${accumulatedText}\n\n_پاسخ متوقف شد._`
          : "پاسخ متوقف شد.";
        setMessages([
          ...previousMessages,
          userMessage,
          { ...finalAssistantMsg, content: stoppedContent },
        ]);
        return;
      }
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
      setCanUndo(false);
      abortControllerRef.current = null;
      abortIntentRef.current = null;
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
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
    // Ctrl+Enter or Cmd+Enter also sends
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
      const res = await backendFetch(apiUrl("/analyze-file"), {
        method: "POST",
        body: formData,
      });

      const data = await readAnalysisResponse(res);

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
        isEn
          ? "For troubleshooting this equipment issue, provide likely causes and a step-by-step checklist: "
          : "برای عیب‌یابی این مشکل دستگاه، علت‌های احتمالی و چک‌لیست مرحله‌ای بده: ",
      );
      return;
    }

    if (action === "device-suggestion") {
      setDomain("equipment");
      setMessage(
        isEn
          ? "For this application or sample type, suggest the suitable ArtinAzma device/equipment: "
          : "برای این کاربرد یا نوع نمونه، دستگاه/تجهیز مناسب آرتین آزما را پیشنهاد بده: ",
      );
      return;
    }

    if (action === "catalyst-suggestion") {
      setDomain("catalyst");
      setMessage(
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
  return (
    <section
      className={`relative flex h-full max-h-screen min-w-0 flex-col overflow-hidden bg-[#ffffff] transition-colors ${isDragOver ? "ring-2 ring-inset ring-blue-400 bg-blue-50/30" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      <header className="shrink-0 border-b border-slate-100 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/artin-avatar.png"
              alt={isEn ? "Artin" : "آرتین"}
              className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-[15px] font-bold text-slate-800">{isEn ? "Artin" : "آرتین"}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
              {isEn ? "Online" : "آنلاین"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Domain + mode — visible on desktop, hidden on mobile */}
            <select
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
              onClick={() => setShowMobileSettings((v) => !v)}
              title={isEn ? "Settings" : "تنظیمات"}
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
                  title={isEn ? "Export chat" : "خروجی گفتگو"}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Download size={13} />
                  {isEn ? "Download" : "دانلود"}
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
              {isEn ? "New" : "جدید"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile settings panel — slides in below header on small screens */}
      {showMobileSettings && (
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 md:hidden" dir={dir}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-500">{isEn ? "Domain:" : "حوزه:"}</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
            <label className="text-xs font-bold text-slate-500">{isEn ? "Answer:" : "پاسخ:"}</label>
            <select
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="auto">{responseModeLabels.auto}</option>
              <option value="brief">{responseModeLabels.brief}</option>
              <option value="technical">{responseModeLabels.technical}</option>
              <option value="checklist">{responseModeLabels.checklist}</option>
            </select>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleChatScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {loadingSavedSession && (
          <div className="ui-alert ui-alert-info mx-auto mt-6 max-w-xl text-center text-sm font-bold">
            {isEn ? "Loading saved conversation..." : "در حال بارگذاری گفتگوی ذخیره‌شده..."}
          </div>
        )}
        <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[calc(100vh-130px)] max-w-4xl flex-col items-center justify-center px-4 text-center">
              <AssistantWelcome isEn={isEn} />

              <RateLimitBanner countdown={rateLimitCountdown} total={rateLimitTotal} isEn={isEn} />

              <HeroComposer
                showTools={showTools}
                onToggleTools={() => setShowTools((prev) => !prev)}
                onToolSelect={handleToolClick}
                chatInputRef={chatInputRef}
                message={message}
                onMessageChange={setMessage}
                onKeyDown={handleKeyDown}
                isVoiceSupported={isVoiceSupported}
                onToggleVoice={toggleVoice}
                voiceState={voiceState}
                loading={loading}
                onStop={stopStreaming}
                onSend={() => sendMessage()}
                rateLimitActive={rateLimitCountdown > 0}
              />

              <AssistantQuickActions
                isEn={isEn}
                onUpload={() => handleToolClick("upload")}
                onRequest={() => handleToolClick("customer-request")}
              />

              {/* سوال‌های پیشنهادی آماده */}
              <StarterQuestions onSelect={(q) => sendMessage(q, q)} />
            </div>
          ) : (
            <div
              className="mx-auto w-full max-w-5xl space-y-5 pb-4 md:space-y-7"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label={isEn ? "Conversation" : "گفتگو"}
            >
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
                  onRegenerate={regenerateLastResponse}
                  canRegenerate={!loading && item.role === "assistant" && index === messages.length - 1}
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
                        alt={isEn ? "Artin" : "آرتین"}
                        className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 object-cover"
                      />
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900">
                        <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{isEn ? "Artin" : "آرتین"}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-persian text-slate-500 dark:text-slate-400">
                          {isEn ? "Typing" : "در حال تایپ"}
                        </span>
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
      <ScrollToBottomButton
        show={showScrollBtn && messages.length > 0}
        onClick={scrollToBottom}
        isEn={isEn}
      />

      {messages.length > 0 && (
        <ChatComposer
          isEn={isEn}
          showTools={showTools}
          onToggleTools={() => setShowTools((prev) => !prev)}
          onToolSelect={handleToolClick}
          isDragOver={isDragOver}
          stagedImage={stagedImage}
          stagedImageUrl={stagedImageUrl}
          onClearStagedImage={clearStagedImage}
          onStageImage={stageImageFile}
          chatInputRef={chatInputRef}
          message={message}
          onMessageChange={setMessage}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          isVoiceSupported={isVoiceSupported}
          onToggleVoice={toggleVoice}
          voiceState={voiceState}
          loading={loading}
          onStop={stopStreaming}
          onSend={() => sendMessage()}
        />
      )}
    </section>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantPageInner />
    </Suspense>
  );
}
