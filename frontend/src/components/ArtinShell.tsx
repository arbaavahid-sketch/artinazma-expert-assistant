"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  Bot,
  ChartBar,
  CircleUserRound,
  Database,
  FlaskConical,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircleQuestion,
  MessagesSquare,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  Settings,
  Sparkles,
  SquarePen,
  Ellipsis,
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
import { apiUrl } from "@/lib/api";
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
type ArtinShellProps = {
  children: ReactNode;
};

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return <Icon size={21} strokeWidth={1.8} className="text-slate-700" />;
}

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("session_id");
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSessions, setCustomerSessions] = useState<ChatSession[]>([]);
  
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
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
      }
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
      }
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
          } ${sidebarCollapsed ? "w-[88px] md:w-[88px]" : "w-[300px] md:w-[300px]"}`}
        >
          <div className="relative shrink-0 px-4 pb-4 pt-14">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="absolute left-4 top-4 hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-blue-50 md:flex"
              title={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
              aria-label={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
            >
              <SidebarToggleIcon collapsed={sidebarCollapsed} />
            </button>

            {!sidebarCollapsed ? (
              <Link href="/" className="block">
                <div className="rounded-[30px] bg-white p-4 shadow-sm shadow-slate-200/70">
                  <img
                    src="/images/artinazma-logo.png"
                    alt="آرتین آزما"
                    className="mx-auto h-auto max-h-20 w-full object-contain"
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
                className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm"
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

          <div className="shrink-0 px-3">
            <Link
              href="/assistant"
              onClick={() => setMobileSidebarOpen(false)}
              className={`mb-4 block rounded-2xl bg-white px-4 py-4 text-center text-sm font-bold text-slate-900 shadow-sm shadow-slate-200/70 transition hover:bg-slate-50 ${
                sidebarCollapsed ? "px-2 text-lg" : ""
              }`}
              title="گفتگوی جدید با آرتین"
            >
              {sidebarCollapsed ? (
  <SquarePen size={22} strokeWidth={1.9} />
) : (
  <span className="flex items-center justify-center gap-2">
    <SquarePen size={18} strokeWidth={1.9} />
    گفتگوی جدید با آرتین
  </span>
)}
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {!sidebarCollapsed && (
              <div className="mb-2 px-3 text-xs font-bold text-slate-500">
                بخش‌ها
              </div>
            )}

            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  title={item.label}
                  className={`mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
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
        const isActiveSession = String(session.id) === activeSessionId;

        return (
          <div key={session.id}>
            {renamingSessionId === session.id ? (
              <div className="rounded-2xl bg-white p-2 shadow-sm shadow-slate-200/70">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => renameChatSession(session.id)}
                    className="flex-1 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    ذخیره
                  </button>

                  <button
                    onClick={() => {
                      setRenamingSessionId(null);
                      setRenameTitle("");
                    }}
                    className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
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

                <div className="flex shrink-0 items-center gap-1 pl-2 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setRenamingSessionId(session.id);
                      setRenameTitle(session.title || "گفتگوی جدید");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                    title="تغییر نام"
                  >
                    <Pencil size={15} strokeWidth={2} />
                  </button>

                  <button
                    onClick={() => deleteCustomerChatSession(session.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                    title="حذف گفتگو"
                  >
                    <Trash2 size={15} strokeWidth={2} />
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