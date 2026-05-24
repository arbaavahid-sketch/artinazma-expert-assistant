from pathlib import Path

ROOT = Path(__file__).resolve().parent

artin_shell = r'''"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navItems = [
  { href: "/", label: "خانه" },
  { href: "/assistant", label: "آرتین" },
  { href: "/analyze", label: "تحلیل تست" },
  { href: "/knowledge", label: "بانک دانش" },
  { href: "/questions", label: "سوالات" },
  { href: "/dashboard", label: "داشبورد" },
];

type ArtinShellProps = {
  children: ReactNode;
};

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <main className="h-screen overflow-hidden bg-[#f7f7f8] text-slate-900">
      <div className="flex h-full overflow-hidden">
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/20 md:hidden"
            aria-label="بستن منو"
          />
        )}

        <aside
          className={`fixed inset-y-0 right-0 z-40 flex w-[280px] flex-col border-l border-slate-200 bg-[#f3f4f6] transition-transform md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
          }`}
        >
          <div className="px-5 py-5">
            <Link href="/" className="block">
              <div className="text-xl font-bold">آرتین آزما</div>
              <div className="mt-1 text-sm text-slate-500">
                ArtinAzma Expert Assistant
              </div>
            </Link>
          </div>

          <div className="px-3">
            <Link
              href="/assistant"
              onClick={() => setSidebarOpen(false)}
              className="mb-4 block rounded-2xl bg-white px-4 py-4 text-center text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              گفتگوی جدید با آرتین
            </Link>

            <div className="mb-2 px-3 text-xs font-bold text-slate-500">
              بخش‌ها
            </div>

            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`mb-2 block rounded-xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-white font-semibold text-slate-900 shadow-sm"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6 px-5">
            <div className="mb-2 text-xs font-bold text-slate-500">
              دسترسی سریع
            </div>

            <div className="space-y-2">
              <Link
                href="/assistant"
                className="block rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 hover:bg-slate-50"
              >
                پرسش تخصصی از آرتین
              </Link>

              <Link
                href="/analyze"
                className="block rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 hover:bg-slate-50"
              >
                آپلود و تحلیل فایل تست
              </Link>

              <Link
                href="/knowledge"
                className="block rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 hover:bg-slate-50"
              >
                افزودن فایل به بانک دانش
              </Link>
            </div>
          </div>

          <div className="mt-auto border-t border-slate-200 px-5 py-5">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm font-bold">هوش مصنوعی فعال</div>
              <div className="mt-1 text-xs text-slate-500">
                آرتین، دستیار تخصصی آرتین آزما
              </div>
            </div>
          </div>
        </aside>

        <section className="relative h-full min-w-0 flex-1 overflow-hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed right-4 top-4 z-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm md:hidden"
          >
            منو
          </button>

          {children}
        </section>
      </div>
    </main>
  );
}
'''

assistant_page = r'''"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const tools = [
  "افزودن فایل",
  "تحلیل تست",
  "جست‌وجوی دانش",
  "عیب‌یابی تجهیزات",
  "پیشنهاد دستگاه",
  "پیشنهاد کاتالیست",
];

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [domain, setDomain] = useState("auto");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden bg-[#f7f7f8]">
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
                      key={tool}
                      onClick={() => setShowTools(false)}
                      className="block w-full rounded-2xl px-4 py-3 text-right text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {tool}
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
'''

files = {
    ROOT / "frontend" / "src" / "components" / "ArtinShell.tsx": artin_shell,
    ROOT / "frontend" / "src" / "app" / "assistant" / "page.tsx": assistant_page,
}

for path, content in files.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"Updated: {path}")

print("Done. Restart frontend now.")