"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { ToastProvider } from "@/components/Toast";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import AdminGlobalSearch from "@/components/AdminGlobalSearch";
import ServerStatus from "@/components/ServerStatus";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  ChartBar,
  CircleUserRound,
  Database,
  FlaskConical,
  HardDrive,
  Home,
  Inbox,
  ListX,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  Settings,
  Sparkles,
  Sun,
  Pencil,
  Trash2,
  Users,
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

const navItemDefs: { href: string; labelKey: string; fallback: string; Icon: LucideIcon }[] = [
  { href: "/assistant", labelKey: "nav.assistant", fallback: "دستیار هوشمند", Icon: Home },
  { href: "/", labelKey: "nav.home", fallback: "آرتین", Icon: Sparkles },
  { href: "/analyze", labelKey: "nav.analyze", fallback: "تحلیل تست", Icon: FlaskConical },
  { href: "/customer-request", labelKey: "nav.customerRequest", fallback: "درخواست مشاوره", Icon: PhoneCall },
  { href: "/customer-dashboard", labelKey: "nav.dashboard", fallback: "حساب من", Icon: CircleUserRound },
];

const adminItems: SidebarItem[] = [
  { href: "/admin", label: "پنل ادمین", Icon: LayoutDashboard },
  { href: "/admin/knowledge", label: "بانک دانش", Icon: Database },
  { href: "/admin/questions", label: "سوالات کاربران", Icon: MessagesSquare },
  { href: "/admin/requests", label: "درخواست‌ها", Icon: Inbox },
  { href: "/admin/customers", label: "مشتریان", Icon: Users },
  { href: "/admin/dashboard", label: "داشبورد", Icon: ChartBar },
  { href: "/admin/error-log", label: "Error Log", Icon: ListX },
  { href: "/admin/backup", label: "پشتیبان‌گیری", Icon: HardDrive },
  { href: "/admin/settings", label: "تنظیمات سیستم", Icon: Settings },
];

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return <Icon size={21} strokeWidth={1.8} className="text-slate-700 dark:text-slate-300" />;
}

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const isRtl = locale === "fa";

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  const navItems: SidebarItem[] = navItemDefs.map(d => ({ href: d.href, label: t(d.labelKey) || d.fallback, Icon: d.Icon }));

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { confirm } = useConfirm();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSessions, setCustomerSessions] = useState<ChatSession[]>([]);
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  // Theme is owned by ThemeProvider (single source of truth, key: artin_theme).
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === "dark";

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

    const confirmed = await confirm({ message: "این گفتگو حذف شود؟", variant: "danger", confirmLabel: "حذف", title: "حذف گفتگو" });

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

  async function logoutCustomer() {
    localStorage.removeItem("artin_customer");

    // Clear httpOnly session cookies via server-side API route
    await fetch("/api/customer-session", { method: "DELETE" }).catch(() => {});

    setCustomer(null);
    setCustomerSessions([]);
    setMobileSidebarOpen(false);

    window.location.href = "/customer-login";
  }

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const res = await fetch("/api/admin-status", { cache: "no-store" });
        const data = await res.json();
        setIsAdmin(Boolean(data.is_admin));
      } catch {
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, [pathname]);

  useEffect(() => {
    async function fetchPendingRequests() {
      try {
        const res = await fetch(apiUrl("/customers/stats"), { cache: "no-store" });
        const data = await res.json();
        setPendingRequestsCount(data.new_requests ?? 0);
      } catch {
        setPendingRequestsCount(0);
      }
    }

    if (isAdminArea) {
      fetchPendingRequests();
      const interval = setInterval(fetchPendingRequests, 60_000);
      return () => clearInterval(interval);
    }
  }, [isAdminArea, pathname]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveSessionId(params.get("session_id"));
  }, [pathname]);

  useEffect(() => {
    refreshCustomerSessions();
  }, [pathname, activeSessionId]);

  // (Theme init/toggle now lives in ThemeProvider — see useTheme above.)

  // Online/offline detection
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <ToastProvider>
    <div className="relative h-screen overflow-hidden bg-[--background] text-[--foreground]" dir={isRtl ? "rtl" : "ltr"}>
      {/* Skip to main content — visible only on keyboard focus */}
      <a href="#main-content" className="skip-link">
        {isRtl ? "پرش به محتوای اصلی" : "Skip to main content"}
      </a>
      {/* Offline banner */}
      {!isOnline && (
        <div className="absolute inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          <span>📡</span>
          <span>{locale === "fa" ? "اتصال اینترنت قطع شده است — پیام‌های جدید ارسال نمی‌شوند." : "Internet connection lost — new messages won't be sent."}</span>
        </div>
      )}
      {/* Reconnected flash */}
      {showReconnected && (
        <div className="absolute inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          <span>✅</span>
          <span>{locale === "fa" ? "اتصال برقرار شد." : "Connection restored."}</span>
        </div>
      )}

      {/* Mobile backdrop — absolute within main (avoids fixed-in-overflow-hidden bug on iOS) */}
      {mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="absolute inset-0 z-30 bg-black/25 backdrop-blur-sm md:hidden"
          aria-label="بستن منو"
        />
      )}

      {/* Sidebar — absolute positioning, visibility controlled by display (translate unreliable in RTL) */}
      <aside
        className={`absolute inset-y-0 z-40 flex-col border-[--border-soft] bg-[--sidebar-bg] transition-all duration-300 ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        } ${
          sidebarCollapsed ? "w-[88px]" : "w-[300px]"
        } ${mobileSidebarOpen ? "flex" : "hidden md:flex"}`}
      >
          <div className="relative shrink-0 px-4 pb-7 pt-14">
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className={`absolute top-4 hidden h-9 w-9 items-center justify-center rounded-xl border border-[--border-soft] bg-[--surface] shadow-sm transition hover:bg-blue-50 dark:hover:bg-slate-800 md:flex ${
                isRtl ? "left-4" : "right-4"
              }`}
              title={sidebarCollapsed ? (isRtl ? "باز کردن منو" : "Open menu") : (isRtl ? "جمع کردن منو" : "Collapse menu")}
              aria-label={sidebarCollapsed ? (isRtl ? "باز کردن منو" : "Open menu") : (isRtl ? "جمع کردن منو" : "Collapse menu")}
            >
              <SidebarToggleIcon collapsed={sidebarCollapsed} />
            </button>

            {!sidebarCollapsed ? (
              <Link href="/" className="block">
                <div className="mx-auto w-[78%]">
                  <img
                    src="/images/artinazma-logo.png"
                    alt={isRtl ? "آرتین آزما" : "ArtinAzma"}
                    className="mx-auto h-auto max-h-14 w-full object-contain"
                  />
                </div>

                <div className="mt-3 text-center">
                  <div className="text-sm font-bold text-slate-900">
                    {isRtl ? "دستیار هوشمند آرتین آزما" : "ArtinAzma Intelligent Assistant"}
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
                title={isRtl ? "آرتین آزما" : "ArtinAzma"}
              >
                <img
                  src="/images/artinazma-logo.png"
                  alt={isRtl ? "آرتین آزما" : "ArtinAzma"}
                  className="h-10 w-10 object-contain"
                />
              </Link>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
            {!sidebarCollapsed && (
              <div className="mb-2 px-3 text-xs font-bold text-slate-500 dark:text-slate-400">
{t("nav.home") ? (locale === "fa" ? "بخش‌ها" : "Sections") : "بخش‌ها"}
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
                      ? "bg-[--surface] font-bold text-blue-700 shadow-sm shadow-slate-200/20"
                      : "text-slate-700 dark:text-slate-300 hover:bg-[--surface]"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-700"
                        : "bg-[--surface] text-slate-500 dark:text-slate-400 group-hover:text-blue-700"
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
                <div className="mb-2 px-3 text-xs font-bold text-slate-500 dark:text-slate-400">
{locale === "fa" ? "گفتگوهای من" : "My Conversations"}
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
                                {isRtl ? "ذخیره" : "Save"}
                              </button>

                              <button
                                onClick={() => {
                                  setRenamingSessionId(null);
                                  setRenameTitle("");
                                }}
                                className="ui-btn ui-btn-ghost flex-1 text-xs"
                              >
                                {isRtl ? "انصراف" : "Cancel"}
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
                              {session.title || (isRtl ? "گفتگوی جدید" : "New conversation")}
                            </Link>

                            <div className="hidden shrink-0 items-center gap-1 pl-2 group-hover:flex">
                              <button
                                onClick={() => {
                                  setRenamingSessionId(session.id);
                                  setRenameTitle(
                                    session.title || (isRtl ? "گفتگوی جدید" : "New conversation"),
                                  );
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                                aria-label={isRtl ? "تغییر نام گفتگو" : "Rename conversation"}
                              >
                                <Pencil size={14} strokeWidth={2} />
                              </button>

                              <button
                                onClick={() =>
                                  deleteCustomerChatSession(session.id)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={isRtl ? "حذف گفتگو" : "Delete conversation"}
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
{locale === "fa" ? "حساب مشتری" : "Customer Account"}
                  </div>
                )}

                <button
                  onClick={logoutCustomer}
                  title={isRtl ? "خروج از حساب مشتری" : "Logout"}
                  className={`ui-btn ui-btn-danger group mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
                    sidebarCollapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                    <LogOut size={19} strokeWidth={1.9} />
                  </span>

                  {!sidebarCollapsed && <span>{locale === "fa" ? "خروج از حساب مشتری" : "Logout"}</span>}
                </button>
              </div>
            )}

            {isAdminArea && (
              <div className="mt-6">
                {!sidebarCollapsed && isAdmin && (
                  <div className="mb-3 px-1">
                    <AdminGlobalSearch />
                  </div>
                )}
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3 text-xs font-bold text-slate-500 dark:text-slate-400">
{locale === "fa" ? "مدیریت" : "Administration"}
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

                      const isRequestsItem = item.href === "/admin/requests";
                      const showBadge = isRequestsItem && pendingRequestsCount > 0;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          title={item.label}
                          className={`group relative mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                            sidebarCollapsed ? "justify-center px-2" : ""
                          } ${
                            isActive
                              ? "bg-[--surface] font-bold text-purple-700 shadow-sm shadow-slate-200/20"
                              : "text-slate-700 dark:text-slate-300 hover:bg-[--surface]"
                          }`}
                        >
                          <span
                            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                              isActive
                                ? "bg-purple-50 dark:bg-purple-950 text-purple-700"
                                : "bg-[--surface] text-slate-500 dark:text-slate-400 group-hover:text-purple-700"
                            }`}
                          >
                            <item.Icon size={19} strokeWidth={1.9} />
                            {showBadge && sidebarCollapsed && (
                              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                                {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
                              </span>
                            )}
                          </span>

                          {!sidebarCollapsed && <span className="flex-1 text-current">{item.label}</span>}

                          {!sidebarCollapsed && showBadge && (
                            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
                              {pendingRequestsCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}

                    <Link
                      href="/admin-logout"
                      onClick={() => setMobileSidebarOpen(false)}
                      title={isRtl ? "خروج از ادمین" : "Logout from admin"}
                      className={`group mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                        sidebarCollapsed ? "justify-center px-2" : ""
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                        <LogOut size={19} strokeWidth={1.9} />
                      </span>

                      {!sidebarCollapsed && <span>{isRtl ? "خروج از ادمین" : "Logout from admin"}</span>}
                    </Link>
                  </>
                )}
              </div>
            )}
            {/* Server status indicator */}
            {!sidebarCollapsed && (
              <div className="mt-3 px-3">
                <ServerStatus />
              </div>
            )}
            {/* Dark mode toggle */}
            <div className={`mt-4 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
              <button
                onClick={toggleTheme}
                aria-label={darkMode ? (isRtl ? "حالت روشن" : "Light Mode") : (isRtl ? "حالت تاریک" : "Dark Mode")}
                title={darkMode ? (isRtl ? "حالت روشن" : "Light Mode") : (isRtl ? "حالت تاریک" : "Dark Mode")}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition hover:bg-white dark:hover:bg-slate-800 ${
                  sidebarCollapsed ? "justify-center px-2" : "w-full"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm">
                  {darkMode ? <Sun size={19} strokeWidth={1.9} /> : <Moon size={19} strokeWidth={1.9} />}
                </span>
                {!sidebarCollapsed && (
                  <span className="text-slate-700 dark:text-slate-300">
                    {darkMode ? (locale === "fa" ? "حالت روشن" : "Light Mode") : (locale === "fa" ? "حالت تاریک" : "Dark Mode")}
                  </span>
                )}
              </button>
            </div>
          </div>
        </aside>

      {/* Main content wrapper — column on mobile (topbar + content), row on desktop (spacer + content) */}
      <div className="flex h-full flex-col md:flex-row">

        {/* Mobile topbar — part of layout flow, never overlaps page content */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-2 md:hidden dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{isRtl ? "آرتین آزما" : "ArtinAzma"}</span>
            <ServerStatus />
          </div>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            aria-label={isRtl ? "باز کردن منو" : "Open menu"}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="5" width="14" height="1.8" rx="0.9" fill="currentColor" className="text-slate-600"/>
              <rect x="3" y="9.1" width="10" height="1.8" rx="0.9" fill="currentColor" className="text-slate-600"/>
              <rect x="3" y="13.2" width="12" height="1.8" rx="0.9" fill="currentColor" className="text-slate-600"/>
            </svg>
          </button>
        </div>

        {/* Horizontal layout for desktop: spacer + content */}
        <div className="flex min-h-0 flex-1">
          {/* Desktop spacer — mirrors sidebar width */}
          <div
            className={`hidden md:block shrink-0 transition-all duration-300 ${
              sidebarCollapsed ? "w-[88px]" : "w-[300px]"
            }`}
          />
          <main
            id="main-content"
            tabIndex={-1}
            data-app-path={pathname}
            className="relative h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden focus:outline-none"
          >
            <SectionErrorBoundary>
              {children}
            </SectionErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  </ToastProvider>
  );
}
