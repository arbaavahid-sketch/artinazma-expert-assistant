"use client";
/**
 * کامپوننت حباب پیام — استخراج‌شده از assistant/page.tsx
 */

import { useEffect, useRef, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  ListChecks,
  Mail,
  MessageCircle,
  MoreHorizontal,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Share2,
  Table2,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import Tooltip from "@/components/Tooltip";
import RelatedDeviceCards from "@/app/assistant/RelatedDeviceCards";
import { useI18n } from "@/lib/i18n";
import {
  cleanMarkdownText,
  getTextDirection,
  getTextFont,
} from "@/lib/chat-helpers";
import type { ChatMessage, ResourceLink, ResourceImage } from "@/lib/chat-types";

/* ── ArtinazmaResourceCards (فقط اینجا استفاده می‌شود) ── */
function ArtinazmaResourceCards({
  links,
  images,
}: {
  links?: ResourceLink[];
  images?: ResourceImage[];
}) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const hasLinks = links && links.length > 0;
  const hasImages = images && images.length > 0;
  if (!hasLinks && !hasImages) return null;

  const imageByPageUrl = new Map(
    (images || [])
      .filter((image) => image.page_url || image.url)
      .map((image) => [image.page_url || image.url, image]),
  );

  function pageKind(url: string) {
    if (url.includes("/product/") || url.includes("/en/product/")) {
      return isEn ? "Product page" : "صفحه محصول";
    }
    if (url.includes("/product_cat/")) {
      return isEn ? "Product category" : "دسته محصول";
    }
    if (url.includes("/portfolio/")) {
      return isEn ? "Portfolio" : "نمونه کار";
    }
    return isEn ? "ArtinAzma page" : "صفحه آرتین آزما";
  }

  function hostname(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "artinazma.net";
    }
  }

  return (
    <div className="mt-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">
            {isEn ? "Related ArtinAzma products/pages" : "محصولات و صفحه‌های مرتبط آرتین آزما"}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">
            {isEn ? "Matched from the ArtinAzma website index" : "بر اساس جستجو در ایندکس سایت آرتین آزما"}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
          {links?.length || images?.length || 0}
        </span>
      </div>

      {hasLinks ? (
        <div className="grid gap-3 md:grid-cols-2">
          {links.map((link) => {
            const image = imageByPageUrl.get(link.url);
            const score = typeof link.score === "number" ? Math.round(link.score) : null;

            return (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex min-h-[132px]">
                  <div className="relative w-28 shrink-0 bg-slate-100 sm:w-32">
                    {image?.url ? (
                      <img
                        src={image.url}
                        alt={image.title || link.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon size={28} strokeWidth={1.6} />
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                        {pageKind(link.url)}
                      </span>
                      {score !== null && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                          {isEn ? "match" : "تطابق"} {score}
                        </span>
                      )}
                    </div>

                    <div className="line-clamp-2 text-sm font-black leading-6 text-slate-900 group-hover:text-blue-700">
                      {link.title}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-400">
                      {hostname(link.url)}
                    </div>

                    <div className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-black text-blue-700">
                      {isEn ? "Open page" : "مشاهده صفحه"}
                      <ExternalLink size={13} />
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : hasImages ? (
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
      ) : null}
    </div>
  );
}

/* ── MessageBubble ── */
const FEEDBACK_REASONS = {
  fa: ["پاسخ ناقص بود", "اطلاعات اشتباه داشت", "ربطی به سوالم نداشت", "خیلی طولانی بود", "خیلی کوتاه بود", "دیگر"],
  en: ["The answer was incomplete", "It contained incorrect information", "It was not related to my question", "It was too long", "It was too short", "Other"],
};

interface MessageBubbleProps {
  item: ChatMessage;
  index: number;
  loading: boolean;
  onCopy: (text: string) => void;
  onRequest: () => void;
  onQuickAction: (
    action: "shorter" | "technical" | "table" | "sources",
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
  onEdit: (index: number, newText: string) => void;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
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
  onRegenerate,
  canRegenerate,
}: MessageBubbleProps) {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.content);
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const actionBarRef = useRef<HTMLDivElement | null>(null);
  const isUser = item.role === "user";

  const displayContent = isUser
    ? item.content
    : cleanMarkdownText(item.content);
  const direction = getTextDirection(displayContent);
  const fontFamily = getTextFont(displayContent);

  useEffect(() => {
    if (!showFeedbackMenu && !showActionsMenu && !showShareMenu) return;

    function closeMenus() {
      setShowFeedbackMenu(false);
      setShowActionsMenu(false);
      setShowShareMenu(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        actionBarRef.current?.contains(target)
      ) {
        return;
      }
      closeMenus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFeedbackMenu, showActionsMenu, showShareMenu]);

  function handleCopy(text: string) {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function getSharePayload() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = isEn ? "ArtinAzma Expert Assistant" : "دستیار تخصصی آرتین آزما";
    const textWithLink = url ? `${displayContent}\n\n${url}` : displayContent;
    return { title, url, text: displayContent, textWithLink };
  }

  async function handleShare() {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isWindows = /Windows/i.test(userAgent);
    const canUseNativeShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      !isWindows;

    if (canUseNativeShare) {
      try {
        const payload = getSharePayload();
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url || undefined,
        });
        return;
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "AbortError") return;
      }
    }
    setShowShareMenu((current) => !current);
  }

  function openShareTarget(target: "whatsapp" | "telegram" | "email" | "copy") {
    const payload = getSharePayload();
    setShowShareMenu(false);

    if (target === "copy") {
      handleCopy(payload.textWithLink);
      return;
    }

    const encodedText = encodeURIComponent(payload.textWithLink);
    const encodedTitle = encodeURIComponent(payload.title);
    const encodedUrl = encodeURIComponent(payload.url);
    const url =
      target === "whatsapp"
        ? `https://wa.me/?text=${encodedText}`
        : target === "telegram"
          ? `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(payload.text)}`
          : `mailto:?subject=${encodedTitle}&body=${encodedText}`;

    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
  }

  const actionLabels = {
    copy: copied ? (isEn ? "Copied" : "کپی شد") : (isEn ? "Copy" : "کپی"),
    speak: isSpeaking
      ? isEn
        ? "Stop"
        : "توقف"
      : isEn
      ? "Read aloud"
      : "پخش صوتی",
    shorter: isEn ? "Shorter" : "خلاصه‌تر",
    technical: isEn ? "More technical" : "فنی‌تر",
    table: isEn ? "Table" : "جدول",
    sources: isEn ? "Sources and next steps" : "منابع و اقدام بعدی",
    regenerate: isEn ? "Regenerate" : "تولید دوباره",
    request: isEn ? "Request consultation" : "ثبت مشاوره",
    share: isEn ? "Share" : "اشتراک‌گذاری",
    more: isEn ? "More" : "بیشتر",
    whatsapp: isEn ? "WhatsApp" : "واتساپ",
    telegram: isEn ? "Telegram" : "تلگرام",
    email: isEn ? "Email" : "ایمیل",
    copyShare: isEn ? "Copy text and link" : "کپی متن و لینک",
  };
  const actionButtonClass =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 sm:h-8 sm:w-8";
  const menuActionClass =
    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-right text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-700";

  return (
    <div
      className={`group flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      dir="ltr"
    >
      <div
        className={`flex min-w-0 gap-2 sm:gap-3 ${
            isUser
              ? "max-w-[88%] flex-row-reverse sm:max-w-[88%]"
              : "w-full max-w-full flex-row-reverse sm:w-auto sm:max-w-[88%]"
        }`}
      >
        {!isUser && (
          <img
            src="/images/artin-avatar.png"
            alt={isEn ? "Artin" : "آرتین"}
            className="mt-1 hidden h-11 w-11 shrink-0 rounded-full border border-slate-200 bg-white object-cover p-1 shadow-sm sm:block"
          />
        )}

        <div
          className={`min-w-0 shadow-sm ${
            isUser
              ? "max-w-[760px] rounded-[20px] bg-blue-700 px-3.5 py-2.5 text-white sm:rounded-[26px] sm:px-5 sm:py-4"
              : "ai-message-card w-full"
          }`}
        >
          <div
            dir={direction}
            style={{ fontFamily }}
            className={
              isUser
                ? "whitespace-pre-wrap break-words text-right text-sm leading-7 [overflow-wrap:anywhere] sm:text-base sm:leading-8"
                : direction === "rtl"
                  ? "ai-markdown rtl-markdown"
                  : "ai-markdown ltr-markdown"
            }
          >
            {isUser ? (
              isEditing ? (
                <div className="flex flex-col gap-2" dir={dir}>
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
                    dir={dir}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setEditText(item.content); setIsEditing(false); }}
                      className="rounded-lg px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      {isEn ? "Cancel" : "انصراف"}
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
                      {isEn ? "Resend ↵" : "ارسال مجدد ↵"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/edit relative">
                  <span>{displayContent}</span>
                  <button
                    onClick={() => { setEditText(item.content); setIsEditing(true); }}
                    className="mr-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/50 opacity-0 transition hover:bg-white/20 hover:text-white group-hover/edit:opacity-100"
                    title={isEn ? "Edit message" : "ویرایش پیام"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    {isEn ? "Edit" : "ویرایش"}
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
                    ? (isEn ? "Attached image" : "تصویر پیوست‌شده")
                    : (isEn ? "Attached file" : "فایل پیوست‌شده")}
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                  {loading && item.attachment.status === "analyzing"
                    ? (isEn ? "Analyzing" : "در حال تحلیل")
                    : (isEn ? "Sent" : "ارسال شد")}
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
              <div>{isEn ? "Name:" : "نام:"} {item.attachment.name}</div>
              {item.attachment.analysisType && (
                <div>{isEn ? "Analysis type:" : "نوع تحلیل:"} {item.attachment.analysisType}</div>
              )}
              {item.attachment.note && (
                <div>{isEn ? "User note:" : "توضیح کاربر:"} {item.attachment.note}</div>
              )}
            </div>
          )}
          {!isUser && (
            <ArtinazmaResourceCards
              links={item.resource_links}
              images={item.resource_images}
            />
          )}
          {!isUser && <RelatedDeviceCards devices={item.relatedDevices} />}
          {!isUser && !loading && (
            <div
              ref={actionBarRef}
              className="mt-1 flex flex-wrap items-center gap-0.5 opacity-100 transition-opacity sm:mt-2 sm:gap-1"
            >
              <Tooltip label={actionLabels.copy} position="top">
                <button
                  onClick={() => handleCopy(displayContent)}
                  className={actionButtonClass}
                  aria-label={actionLabels.copy}
                  title={actionLabels.copy}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </Tooltip>
              <Tooltip label={isEn ? "Helpful" : "مفید بود"} position="top">
                <button
                  onClick={() => onFeedback(item.question_id, "up")}
                  disabled={!!feedbackValue}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition sm:h-8 sm:w-8 ${
                    feedbackValue === "up"
                      ? "text-emerald-600 bg-emerald-50"
                      : feedbackValue === "down"
                      ? "text-slate-300 cursor-default"
                      : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                  }`}
                >
                  <ThumbsUp size={13} />
                </button>
              </Tooltip>
              <div className="relative">
                <Tooltip label={isEn ? "Needs improvement" : "نیاز به بهبود"} position="top">
                  <button
                    onClick={() => {
                      if (feedbackValue) return;
                      setShowActionsMenu(false);
                      setShowShareMenu(false);
                      setShowFeedbackMenu((v) => !v);
                    }}
                    disabled={!!feedbackValue}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition sm:h-8 sm:w-8 ${
                      feedbackValue === "down"
                        ? "text-red-500 bg-red-50"
                        : feedbackValue === "up"
                        ? "text-slate-300 cursor-default"
                        : "text-slate-400 hover:bg-red-50 hover:text-red-500"
                    }`}
                  >
                    <ThumbsDown size={13} />
                  </button>
                </Tooltip>
                {showFeedbackMenu && !feedbackValue && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-1.5 px-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {isEn ? "What was wrong?" : "چه مشکلی داشت؟"}
                    </p>
                    {FEEDBACK_REASONS[locale].map((reason) => (
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
                      {isEn ? "Cancel" : "انصراف"}
                    </button>
                  </div>
                )}
              </div>
              <Tooltip label={actionLabels.speak} position="top">
                <button
                  onClick={() => onSpeak(displayContent, index)}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition sm:h-8 sm:w-8 ${
                    isSpeaking
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`}
                  aria-label={actionLabels.speak}
                  title={actionLabels.speak}
                >
                  {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </Tooltip>
              <div className="relative">
                <Tooltip label={actionLabels.share} position="top">
                  <button
                    onClick={() => {
                      setShowActionsMenu(false);
                      setShowFeedbackMenu(false);
                      void handleShare();
                    }}
                    className={actionButtonClass}
                    aria-label={actionLabels.share}
                    aria-haspopup="menu"
                    aria-expanded={showShareMenu}
                    title={actionLabels.share}
                  >
                    <Share2 size={14} />
                  </button>
                </Tooltip>
                {showShareMenu && (
                  <div
                    className="absolute bottom-full left-0 z-50 mb-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                    role="menu"
                  >
                    <button
                      onClick={() => openShareTarget("whatsapp")}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.whatsapp}</span>
                      <MessageCircle size={15} />
                    </button>
                    <button
                      onClick={() => openShareTarget("telegram")}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.telegram}</span>
                      <Send size={15} />
                    </button>
                    <button
                      onClick={() => openShareTarget("email")}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.email}</span>
                      <Mail size={15} />
                    </button>
                    <button
                      onClick={() => openShareTarget("copy")}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.copyShare}</span>
                      <Copy size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <Tooltip label={actionLabels.more} position="top">
                  <button
                    onClick={() => {
                      setShowShareMenu(false);
                      setShowActionsMenu((v) => !v);
                    }}
                    className={actionButtonClass}
                    aria-label={actionLabels.more}
                    aria-haspopup="menu"
                    aria-expanded={showActionsMenu}
                    title={actionLabels.more}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </Tooltip>
                {showActionsMenu && (
                  <div
                    className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                    role="menu"
                  >
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onQuickAction("shorter", item.content);
                      }}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.shorter}</span>
                      <FileText size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onQuickAction("technical", item.content);
                      }}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.technical}</span>
                      <Wrench size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onQuickAction("table", item.content);
                      }}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.table}</span>
                      <Table2 size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onQuickAction("sources", item.content);
                      }}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.sources}</span>
                      <ListChecks size={15} />
                    </button>
                    {canRegenerate && onRegenerate && (
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          onRegenerate();
                        }}
                        className={menuActionClass}
                        role="menuitem"
                      >
                        <span>{actionLabels.regenerate}</span>
                        <RotateCcw size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        onRequest();
                      }}
                      className={menuActionClass}
                      role="menuitem"
                    >
                      <span>{actionLabels.request}</span>
                      <MessageSquarePlus size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
