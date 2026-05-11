"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  ChartBar,
  CircleUserRound,
  Database,
  FlaskConical,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  Settings,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

type Customer = {
  id: number;
  full_name: string;
  email: string;
};

type ChatSession = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

type ArtinShellProps = {
  children: ReactNode;
};

const navItems: SidebarItem[] = [
  { href: "/assistant", label: "خانه", Icon: Home },
  { href: "/", label: "آرتین", Icon: Sparkles },
  { href: "/analyze", label: "تحلیل تست", Icon: FlaskConical },
  { href: "/customer-request", label: "درخواست مشاوره", Icon: PhoneCall },
  { href: "/customer-dashboard", label: "حساب من", Icon: CircleUserRound },
];

const adminItems: SidebarItem[] = [
  { href: "/admin", label: "پنل ادمین", Icon: LayoutDashboard },
  { href: "/admin/knowledge", label: "بانک دانش", Icon: Database },
  { href: "/admin/questions", label: "سوالات کاربران", Icon: MessagesSquare },
  { href: "/admin/requests", label: "درخواست‌ها", Icon: Inbox },
  { href: "/admin/dashboard", label: "داشبورد", Icon: ChartBar },
  { href: "/admin/settings", label: "تنظیمات سیستم", Icon: Settings },
];

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return <Icon size={21} strokeWidth={1.8} className="text-slate-700" />;
}

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSessions, setCustomerSessions] = useState<ChatSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(
    null,
  );
  const [renameTitle, setRenameTitle] = useState("");

  async function refreshCustomerSessions() {
    try {
      const raw = localStorage.getItem("artin_customer");

      if (!raw) {
        setCustomer(null);
        setCustomerSessions([]);
        return;
      }

      const savedCustomer = JSON.parse(raw) as Customer;

      setCustomer(savedCustomer);

      const res = await fetch(
        apiUrl(`/customers/${savedCustomer.id}/chat-sessions`),
        {
          cache: "no-store",
        },
      );

      const data = await res.json();

      setCustomerSessions(data.sessions || []);
    } catch {
      setCustomer(null);
      setCustomerSessions([]);
    }
  }

  async function renameChatSession(sessionId: number) {
    if (!customer || !renameTitle.trim()) return;

    try {
      const res = await fetch(apiUrl(`/customers/chat-sessions/${sessionId}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          title: renameTitle,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setRenamingSessionId(null);
        setRenameTitle("");
        await refreshCustomerSessions();
      }
    } catch {}
  }

  async function deleteCustomerChatSession(sessionId: number) {
    if (!customer) return;

    const confirmed = window.confirm("این گفتگو حذف شود؟");

    if (!confirmed) return;

    try {
      const res = await fetch(
        apiUrl(`/customers/${customer.id}/chat-sessions/${sessionId}`),
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (data.success) {
        await refreshCustomerSessions();

        if (activeSessionId === String(sessionId)) {
          window.location.href = "/assistant";
        }
      }
    } catch {}
  }

  function logoutCustomer() {
    localStorage.removeItem("artin_customer");
    document.cookie = "artin_customer_auth=; path=/; max-age=0";

    setCustomer(null);
    setCustomerSessions([]);
    setMobileSidebarOpen(false);

    window.location.href = "/customer-login";
  }

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const res = await fetch("/api/admin-status", {
          cache: "no-store",
        });

        const data = await res.json();
        setIsAdmin(Boolean(data.is_admin));
      } catch {
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [pathname]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveSessionId(params.get("session_id"));
  }, [pathname]);

  useEffect(() => {
    refreshCustomerSessions();
  }, [pathname, activeSessionId]);

  return (
    <main className="h-screen overflow-hidden bg-[#f7f7f8] text-slate-900">
      <div className="flex h-full overflow-hidden">
        {mobileSidebarOpen && (
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm md:hidden"
            aria-label="بستن منو"
          />
        )}

        <aside
          className={`fixed inset-y-0 right-0 z-40 flex flex-col border-l border-slate-200 bg-[#f3f4f6] transition-all duration-300 md:static md:translate-x-0 ${
            mobileSidebarOpen
              ? "translate-x-0"
              : "translate-x-full md:translate-x-0"
          } ${
            sidebarCollapsed ? "w-[88px] md:w-[88px]" : "w-[300px] md:w-[300px]"
          }`}
        >
          <div className="relative shrink-0 px-4 pb-7 pt-14">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="absolute left-4 top-4 hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-blue-50 md:flex"
              title={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
              aria-label={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
            >
              <SidebarToggleIcon collapsed={sidebarCollapsed} />
            </button>

            {!sidebarCollapsed ? (
              <Link href="/" className="block">
                <div className="mx-auto w-[78%]">
                  <img
                    src="/images/artinazma-logo.png"
                    alt="آرتین آزما"
                    className="mx-auto h-auto max-h-14 w-full object-contain"
                  />
                </div>

                <div className="mt-3 text-center">
                  <div className="text-sm font-bold text-slate-900">
                    دستیار هوشمند آرتین آزما
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ArtinAzma Expert Assistant
                  </div>
                </div>
              </Link>
            ) : (
              <Link
                href="/"
                className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden"
                title="آرتین آزما"
              >
                <img
                  src="/images/artinazma-logo.png"
                  alt="آرتین آزما"
                  className="h-10 w-10 object-contain"
                />
              </Link>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
            {!sidebarCollapsed && (
              <div className="mb-2 px-3 text-xs font-bold text-slate-500">
                بخش‌ها
              </div>
            )}

            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  title={item.label}
                  className={`group mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    sidebarCollapsed ? "justify-center px-2" : ""
                  } ${
                    isActive
                      ? "bg-white font-bold text-blue-700 shadow-sm shadow-slate-200/70"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "bg-white text-slate-500 group-hover:text-blue-700"
                    }`}
                  >
                    <item.Icon size={19} strokeWidth={1.9} />
                  </span>

                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            {!sidebarCollapsed && customer && customerSessions.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 px-3 text-xs font-bold text-slate-500">
                  گفتگوهای من
                </div>

                <div className="space-y-1">
                  {customerSessions.slice(0, 12).map((session) => {
                    const isActiveSession =
                      String(session.id) === activeSessionId;

                    return (
                      <div key={session.id}>
                        {renamingSessionId === session.id ? (
                          <div className="ui-card rounded-2xl p-2 shadow-sm shadow-slate-200/70">
                            <input
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  renameChatSession(session.id);
                                }

                                if (e.key === "Escape") {
                                  setRenamingSessionId(null);
                                  setRenameTitle("");
                                }
                              }}
                              autoFocus
                              className="ui-input bg-slate-50"
                            />

                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => renameChatSession(session.id)}
                                className="ui-btn ui-btn-primary flex-1 text-xs"
                              >
                                ذخیره
                              </button>

                              <button
                                onClick={() => {
                                  setRenamingSessionId(null);
                                  setRenameTitle("");
                                }}
                                className="ui-btn ui-btn-ghost flex-1 text-xs"
                              >
                                انصراف
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`group flex items-center rounded-2xl transition ${
                              isActiveSession
                                ? "bg-white text-blue-700 shadow-sm shadow-slate-200/70"
                                : "text-slate-600 hover:bg-white hover:text-slate-900"
                            }`}
                          >
                            <Link
                              href={`/assistant?session_id=${session.id}`}
                              onClick={() => setMobileSidebarOpen(false)}
                              title={session.title}
                              className={`min-w-0 flex-1 truncate py-3 pr-4 text-sm ${
                                isActiveSession ? "font-bold" : ""
                              }`}
                            >
                              {session.title || "گفتگوی جدید"}
                            </Link>

                            <div className="hidden shrink-0 items-center gap-1 pl-2 group-hover:flex">
                              <button
                                onClick={() => {
                                  setRenamingSessionId(session.id);
                                  setRenameTitle(
                                    session.title || "گفتگوی جدید",
                                  );
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                                aria-label="تغییر نام گفتگو"
                              >
                                <Pencil size={14} strokeWidth={2} />
                              </button>

                              <button
                                onClick={() =>
                                  deleteCustomerChatSession(session.id)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label="حذف گفتگو"
                              >
                                <Trash2 size={14} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {customer && (
              <div className="mt-6">
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3 text-xs font-bold text-slate-500">
                    حساب مشتری
                  </div>
                )}

                <button
                  onClick={logoutCustomer}
                  title="خروج از حساب مشتری"
                  className={`ui-btn ui-btn-danger group mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
                    sidebarCollapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                    <LogOut size={19} strokeWidth={1.9} />
                  </span>

                  {!sidebarCollapsed && <span>خروج از حساب مشتری</span>}
                </button>
              </div>
            )}

            {isAdminArea && (
              <div className="mt-6">
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3 text-xs font-bold text-slate-500">
                    مدیریت
                  </div>
                )}

                {isAdmin && (
                  <>
                    {adminItems.map((item) => {
                      const isActive =
                        item.href === "/admin"
                          ? pathname === "/admin"
                          : pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          title={item.label}
                          className={`group mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                            sidebarCollapsed ? "justify-center px-2" : ""
                          } ${
                            isActive
                              ? "bg-white font-bold text-purple-700 shadow-sm shadow-slate-200/70"
                              : "text-slate-700 hover:bg-white"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                              isActive
                                ? "bg-purple-50 text-purple-700"
                                : "bg-white text-slate-500 group-hover:text-purple-700"
                            }`}
                          >
                            <item.Icon size={19} strokeWidth={1.9} />
                          </span>

                          {!sidebarCollapsed && <span>{item.label}</span>}
                        </Link>
                      );
                    })}

                    <Link
                      href="/admin-logout"
                      onClick={() => setMobileSidebarOpen(false)}
                      title="خروج از ادمین"
                      className={`group mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                        sidebarCollapsed ? "justify-center px-2" : ""
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                        <LogOut size={19} strokeWidth={1.9} />
                      </span>

                      {!sidebarCollapsed && <span>خروج از ادمین</span>}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="relative h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="ui-btn ui-btn-ghost fixed right-4 top-4 z-20 border-slate-300 shadow-sm md:hidden"
          >
            منو
          </button>

          {children}
        </section>
      </div>
    </main>
  );
}
