"use client";
import { conversationLabels, useConversationLabels } from "./ConversationLabels";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  clearSavedCustomer,
  CUSTOMER_AUTH_CHANGED_EVENT,
  getSavedCustomer,
} from "@/lib/customer";
import { ToastProvider } from "@/components/Toast";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { useI18n } from "@/lib/i18n";
import BazaarUpdateNotice from "@/components/BazaarUpdateNotice";
import { useTheme } from "@/components/ThemeProvider";
import AdminGlobalSearch from "@/components/AdminGlobalSearch";
import NativeDocumentRecovery from "@/components/NativeDocumentRecovery";
import ServerStatus from "@/components/ServerStatus";
import { useConfirm } from "@/components/ConfirmDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Calculator,
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
  Monitor,
  Moon,
  Package,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  Power,
  SearchX,
  Settings,
  Sparkles,
  Sun,
  Pencil,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

type SidebarItemDef = {
  href: string;
  label: { fa: string; en: string };
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
  { href: "/calculators", labelKey: "nav.calculators", fallback: "محاسبات آزمایشگاهی", Icon: Calculator },
  { href: "/products", labelKey: "nav.products", fallback: "محصولات", Icon: Package },
  { href: "/customer-request", labelKey: "nav.customerRequest", fallback: "درخواست مشاوره", Icon: PhoneCall },
  { href: "/customer-dashboard", labelKey: "nav.dashboard", fallback: "حساب من", Icon: CircleUserRound },
  { href: "/install", labelKey: "nav.install", fallback: "افزودن به صفحهٔ اصلی", Icon: Home },
];

const adminItemDefs: SidebarItemDef[] = [
  { href: "/admin", label: { fa: "پنل ادمین", en: "Admin Panel" }, Icon: LayoutDashboard },
  { href: "/admin/knowledge", label: { fa: "بانک دانش", en: "Knowledge Base" }, Icon: Database },
  { href: "/admin/questions", label: { fa: "سوالات کاربران", en: "User Questions" }, Icon: MessagesSquare },
  { href: "/admin/calculations", label: { fa: "استفاده از محاسبات", en: "Calculation Usage" }, Icon: Calculator },
  { href: "/admin/requests", label: { fa: "درخواست‌ها", en: "Requests" }, Icon: Inbox },
  { href: "/admin/customers", label: { fa: "مشتریان", en: "Customers" }, Icon: Users },
  { href: "/admin/dashboard", label: { fa: "داشبورد", en: "Dashboard" }, Icon: ChartBar },
  { href: "/admin/knowledge-gaps", label: { fa: "شکاف دانش", en: "Knowledge Gaps" }, Icon: SearchX },
  { href: "/admin/error-log", label: { fa: "لاگ خطاها", en: "Error Log" }, Icon: ListX },
  { href: "/admin/backup", label: { fa: "پشتیبان‌گیری", en: "Backups" }, Icon: HardDrive },
  { href: "/admin/settings", label: { fa: "تنظیمات سیستم", en: "System Settings" }, Icon: Settings },
];

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;

  return <Icon size={21} strokeWidth={1.8} className="text-slate-700 dark:text-slate-300" />;
}

function normalizeConversationSearch(value: string) {
  return value.normalize("NFKC").toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s\u200c\u200d]/g, "");
}

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const isRtl = locale === "fa";

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  const navItems: SidebarItem[] = navItemDefs.map(d => ({ href: d.href, label: t(d.labelKey) || d.fallback, Icon: d.Icon }));
  const adminItems: SidebarItem[] = adminItemDefs.map((item) => ({
    href: item.href,
    label: isRtl ? item.label.fa : item.label.en,
    Icon: item.Icon,
  }));

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { confirm } = useConfirm();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [horizontalAdminNav, setHorizontalAdminNav] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [conversationFilter, setConversationFilter] = useState("");
  const [openLabelsSessionId, setOpenLabelsSessionId] = useState<number | null>(null);
  const [customerSessions, setCustomerSessions] = useState<ChatSession[]>([]);
  const { assignments, toggle: toggleConversationLabel } = useConversationLabels(customer?.id);
  const conversationQuery = normalizeConversationSearch(conversationSearch);
  const visibleConversations = customerSessions.filter((session) => {
    const title = session.title || (isRtl ? "گفتگوی جدید" : "New conversation");
    return normalizeConversationSearch(title).includes(conversationQuery)
      && (!conversationFilter || assignments[session.id]?.includes(conversationFilter));
  });
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  // Theme is owned by ThemeProvider (single source of truth, key: artin_theme).
  // The sidebar control cycles light → dark → system.
  const { pref, cycleTheme } = useTheme();
  const themeName =
    pref === "light"
      ? (isRtl ? "حالت روشن" : "Light")
      : pref === "dark"
      ? (isRtl ? "حالت تاریک" : "Dark")
      : (isRtl ? "تم سیستم" : "System");
  const ThemeIcon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;

  async function refreshCustomerSessions() {
    try {
      const savedCustomer = getSavedCustomer();

      if (!savedCustomer) {
        setCustomer(null);
        setCustomerSessions([]);
        return;
      }

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
    clearSavedCustomer();
    setCustomer(null);
    setCustomerSessions([]);
    setMobileSidebarOpen(false);

    // Clear httpOnly session cookies via server-side API route
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    await fetch("/api/customer-session", {
      method: "DELETE",
      signal: controller.signal,
    }).catch(() => {}).finally(() => window.clearTimeout(timeout));

    window.location.assign("/customer-login");
  }

  async function exitNativeApp() {
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
    } catch {
      setMobileSidebarOpen(false);
    }
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

  useEffect(() => {
    function handleCustomerAuthChanged() {
      refreshCustomerSessions();
    }

    window.addEventListener(CUSTOMER_AUTH_CHANGED_EVENT, handleCustomerAuthChanged);
    window.addEventListener("storage", handleCustomerAuthChanged);
    return () => {
      window.removeEventListener(CUSTOMER_AUTH_CHANGED_EVENT, handleCustomerAuthChanged);
      window.removeEventListener("storage", handleCustomerAuthChanged);
    };
  }, []);

  useEffect(() => {
    void import("@capacitor/core")
      .then(({ Capacitor }) => setIsNativeApp(Capacitor.isNativePlatform()))
      .catch(() => setIsNativeApp(false));
  }, []);

  useEffect(() => {
    function closeMobileSidebar() {
      setMobileSidebarOpen(false);
    }

    window.addEventListener("artin:close-mobile-sidebar", closeMobileSidebar);
    return () => {
      window.removeEventListener("artin:close-mobile-sidebar", closeMobileSidebar);
    };
  }, []);
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
    <div
      className="relative h-dvh overflow-hidden bg-[--background] text-[--foreground]"
      data-admin-horizontal={isAdmin && isAdminArea && horizontalAdminNav ? "true" : undefined}
      data-mobile-sidebar-open={mobileSidebarOpen ? "true" : "false"}
      dir={isRtl ? "rtl" : "ltr"}
    >
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
          className="artin-sidebar-backdrop absolute inset-0 z-30 bg-slate-950/35 md:hidden"
          aria-label={isRtl ? "بستن منو" : "Close menu"}
        />
      )}

      {/* Sidebar — absolute positioning, visibility controlled by display (translate unreliable in RTL) */}
      <aside
        data-app-sidebar
        data-assistant-sidebar={pathname === "/assistant" ? "true" : undefined}
        className={`absolute inset-y-0 z-40 flex-col border-[var(--border-soft)] bg-[var(--surface)] shadow-xl shadow-slate-950/10 transition-all duration-300 md:shadow-none ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        } ${
          sidebarCollapsed ? "w-[88px]" : "w-[260px]"
        } ${mobileSidebarOpen ? "flex" : "hidden md:flex"}`}
      >
          <div className="relative shrink-0 px-4 pb-4 pt-14">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className={`absolute top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[--border-soft] bg-white text-xl text-slate-700 dark:bg-slate-900 dark:text-slate-100 md:hidden ${isRtl ? "left-4" : "right-4"}`}
              aria-label={isRtl ? "بستن نوار کناری" : "Close sidebar"}
            ><span aria-hidden="true">×</span></button>

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
              <>
                <Link href="/" className="block">
                  <div className="mx-auto w-28">
                    <img
                      src="/images/artinazma-logo.png"
                      alt={isRtl ? "آرتین آزما" : "ArtinAzma"}
                      className="mx-auto h-auto max-h-14 w-full object-contain"
                    />
                  </div>

                  <div className="mt-2 text-center">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {isRtl ? "دستیار هوشمند آرتین آزما" : "ArtinAzma Intelligent Assistant"}
                    </div>
                  </div>
                </Link>
                <div className="mt-3 flex justify-center">
                  <LanguageSwitcher size="compact" />
                </div>
              </>
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

            {navItems.filter((item) => customer || isAdmin || item.href === "/assistant" || item.href === "/install").map((item) => {
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
                  aria-current={isActive ? "page" : undefined}
                  className={`artin-nav-item group mb-1 flex min-h-10 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                    sidebarCollapsed ? "justify-center px-2" : ""
                  } ${
                    isActive
                      ? "font-bold"
                      : ""
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center"
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
                  {locale === "fa" ? "تاریخچهٔ گفتگوها" : "Conversation history"}
                </div>

                <input
                  type="search"
                  aria-label={isRtl ? "جست‌وجوی گفتگوها" : "Search conversations"}
                  placeholder={isRtl ? "جست‌وجوی گفتگوها" : "Search conversations"}
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  className="mb-2 w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm"
                />
                <select
                  aria-label={isRtl ? "دستهٔ گفتگو" : "Conversation category"}
                  value={conversationFilter}
                  onChange={(event) => setConversationFilter(event.target.value)}
                  className="mb-2 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-2 text-sm"
                >
                  <option value="">{isRtl ? "همهٔ گفتگوها" : "All conversations"}</option>
                  {conversationLabels.map(({ id, fa, en }) => <option key={id} value={id}>{isRtl ? fa : en}</option>)}
                </select>
                {visibleConversations.length === 0 && (
                  <div className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-xs">
                    <p role="status">{isRtl ? "گفتگویی با این جست‌وجو یا فیلتر پیدا نشد." : "No conversations match your search or filter."}</p>
                    <button type="button" className="mt-2 font-semibold underline underline-offset-2"
                      onClick={() => { setConversationSearch(""); setConversationFilter(""); }}>
                      {isRtl ? "پاک‌کردن جست‌وجو و فیلتر" : "Clear search and filter"}
                    </button>
                  </div>
                )}
                <div className="space-y-1">
                  {visibleConversations.map((session) => {
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
                              className={`min-w-0 flex-1 truncate py-2.5 ps-3 text-sm ${
                                isActiveSession ? "font-bold" : ""
                              }`}
                            >
                              {session.title || (isRtl ? "گفتگوی جدید" : "New conversation")}
                            </Link>

                            <div className="flex shrink-0 items-center gap-1 pe-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                              <button
                                type="button"
                                aria-label={isRtl ? "برچسب‌های گفتگو" : "Conversation labels"}
                                title={isRtl ? "برچسب‌های گفتگو" : "Conversation labels"}
                                aria-expanded={openLabelsSessionId === session.id}
                                aria-controls={openLabelsSessionId === session.id ? `conversation-labels-${session.id}` : undefined}
                                onClick={() => setOpenLabelsSessionId((id) => id === session.id ? null : session.id)}
                                className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-[var(--surface-soft)]"
                              >
                                <Tag size={14} aria-hidden="true" />
                              </button>
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
                        {renamingSessionId !== session.id && openLabelsSessionId === session.id && (
                            <div id={`conversation-labels-${session.id}`} className="mb-2 flex flex-wrap gap-1 px-3 text-xs">
                              {conversationLabels.map(({ id, fa, en }) => (
                                <button key={id} type="button" aria-pressed={assignments[session.id]?.includes(id) ?? false}
                                  onClick={() => toggleConversationLabel(session.id, id)}
                                  className="rounded-md border border-[var(--border-soft)] px-2 py-1 aria-pressed:bg-teal-700 aria-pressed:text-white">
                                  {isRtl ? fa : en}
                                </button>
                              ))}
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
                  aria-label={isRtl ? "خروج از حساب مشتری" : "Logout"}
                  className={`ui-btn ui-btn-danger group mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
                    sidebarCollapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                    <LogOut size={19} strokeWidth={1.9} aria-hidden="true" />
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
            {/* Theme cycle: light → dark → system */}
            <div className={`mt-4 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
              <button
                onClick={cycleTheme}
                aria-label={`${isRtl ? "تم" : "Theme"}: ${themeName}`}
                title={`${isRtl ? "تم" : "Theme"}: ${themeName}`}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition hover:bg-white dark:hover:bg-slate-800 ${
                  sidebarCollapsed ? "justify-center px-2" : "w-full"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm">
                  <ThemeIcon size={19} strokeWidth={1.9} />
                </span>
                {!sidebarCollapsed && (
                  <span className="text-slate-700 dark:text-slate-300">{themeName}</span>
                )}
              </button>
            </div>

            {isNativeApp && (
              <div className={`mt-3 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
                <button
                  onClick={exitNativeApp}
                  aria-label={isRtl ? "خروج از برنامه" : "Exit app"}
                  title={isRtl ? "خروج از برنامه" : "Exit app"}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
                    sidebarCollapsed ? "justify-center px-2" : "w-full"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                    <Power size={19} strokeWidth={1.9} />
                  </span>
                  {!sidebarCollapsed && (
                    <span>{isRtl ? "خروج از برنامه" : "Exit app"}</span>
                  )}
                </button>
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-4 text-[11px] text-slate-400">
                <Link href="/privacy" className="transition hover:text-slate-600 dark:hover:text-slate-300">
                  {isRtl ? "حریم خصوصی" : "Privacy"}
                </Link>
                <Link href="/terms" className="transition hover:text-slate-600 dark:hover:text-slate-300">
                  {isRtl ? "شرایط استفاده" : "Terms"}
                </Link>
              </div>
            )}
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
            className="artin-motion-action flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
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
            data-app-sidebar-spacer
            className={`hidden md:block shrink-0 transition-all duration-300 ${
              sidebarCollapsed ? "w-[88px]" : "w-[260px]"
            }`}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!isAdminArea && <BazaarUpdateNotice en={locale === "en"} />}
            <main
              id="main-content"
              tabIndex={-1}
              data-app-path={pathname}
              className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden focus:outline-none"
            >
              <SectionErrorBoundary>
                {isAdminArea && isAdmin && (
                  <div className="sticky top-0 z-20 hidden border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 md:block">
                    <button type="button" aria-pressed={horizontalAdminNav} className="ui-btn ui-btn-ghost"
                      onClick={() => setHorizontalAdminNav((current) => !current)}>
                      {horizontalAdminNav ? (isRtl ? "منوی کناری" : "Sidebar navigation") : (isRtl ? "منوی افقی" : "Top navigation")}
                    </button>
                    {horizontalAdminNav && (
                      <nav aria-label={isRtl ? "بخش‌های مدیریت" : "Administration"} className="flex gap-1 overflow-x-auto py-1">
                        {adminItems.map(({ href, label, Icon }) => (
                          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
                            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[var(--surface-soft)] aria-[current=page]:bg-[var(--surface-soft)]">
                            <Icon size={16} aria-hidden="true" />{label}
                          </Link>
                        ))}
                      </nav>
                    )}
                  </div>
                )}
                <NativeDocumentRecovery en={locale === "en"}/>
                {children}
              </SectionErrorBoundary>
            </main>
          </div>
        </div>
      </div>
    </div>
  </ToastProvider>
  );
}
