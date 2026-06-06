"use client";
/**
 * کامپوننت حباب پیام — استخراج‌شده از assistant/page.tsx
 */

import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Copy,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import Tooltip from "@/components/Tooltip";
import {
  cleanMarkdownText,
  getTextDirection,
  getTextFont,
} from "@/lib/chat-helpers";
import type { ChatMessage, ResourceLink, ResourceImage, Source } from "@/lib/chat-types";

function formatSourceScore(score?: number) {
  const value = Number(score || 0);
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(1)}٪`;
}

function InternalSourceCitations({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700">
        <BookOpen size={14} />
        منابع داخلی استفاده‌شده
      </div>
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={`${source.file_name}-${source.chunk_index ?? index}`}
            className="rounded-2xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-blue-700">
                [{source.citation_id || `S${index + 1}`}]
              </span>
              <span className="font-black text-slate-800">
                {source.title || source.file_name || "منبع داخلی"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-500">
                {formatSourceScore(source.score)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-slate-500">
              <FileText size={12} />
              <span className="break-all">{source.file_name || "-"}</span>
              {source.chunk_index !== undefined && (
                <span>chunk {source.chunk_index}</span>
              )}
              {source.category && <span>{source.category}</span>}
            </div>
            {source.score_reason && (
              <div className="mt-1 font-bold text-slate-500">{source.score_reason}</div>
            )}
            {source.excerpt && (
              <div className="mt-2 max-h-12 overflow-hidden text-slate-500">{source.excerpt}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ArtinazmaResourceCards (فقط اینجا استفاده می‌شود) ── */
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

/* ── MessageBubble ── */
const FEEDBACK_REASONS = [
  "پاسخ ناقص بود",
  "اطلاعات اشتباه داشت",
  "ربطی به سوالم نداشت",
  "خیلی طولانی بود",
  "خیلی کوتاه بود",
  "دیگر",
];

interface MessageBubbleProps {
  item: ChatMessage;
  index: number;
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
  onEdit: (index: number, newText: string) => void;
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
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.content);
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);
  const isUser = item.role === "user";

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
            <InternalSourceCitations sources={item.sources} />
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
              <Tooltip label="مفید بود" position="top">
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
                >
                  <ThumbsUp size={13} />
                </button>
              </Tooltip>
              <div className="relative">
                <Tooltip label="نیاز به بهبود" position="top">
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
                  >
                    <ThumbsDown size={13} />
                  </button>
                </Tooltip>
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

export default memo(MessageBubble);
