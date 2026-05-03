"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navItems = [
  { href: "/", label: "خانه", icon: "⌂" },
  { href: "/assistant", label: "آرتین", icon: "✦" },
  { href: "/analyze", label: "تحلیل تست", icon: "▣" },
  { href: "/customer-request", label: "درخواست مشاوره", icon: "☎" },
];

type ArtinShellProps = {
  children: ReactNode;
};

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="text-slate-700"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d={collapsed ? "M9 8V16" : "M15 8V16"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d={collapsed ? "M13 10L16 12L13 14" : "M11 10L8 12L11 14"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ArtinShell({ children }: ArtinShellProps) {
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          className={`fixed inset-y-0 right-0 z-40 flex w-[300px] flex-col border-l border-slate-200 bg-[#f3f4f6] transition-all duration-300 md:static md:translate-x-0 ${
            mobileSidebarOpen
              ? "translate-x-0"
              : "translate-x-full md:translate-x-0"
          } ${sidebarCollapsed ? "md:w-[88px]" : "md:w-[300px]"}`}
        >
          <div className="shrink-0 px-4 py-4">
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
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className={`mb-4 hidden w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-200/70 transition hover:bg-blue-50 hover:text-blue-700 md:flex ${
                sidebarCollapsed ? "px-2" : ""
              }`}
              title={sidebarCollapsed ? "باز کردن منو" : "جمع کردن منو"}
            >
              <SidebarToggleIcon collapsed={sidebarCollapsed} />
              {!sidebarCollapsed && <span>جمع کردن منو</span>}
            </button>

            <Link
              href="/assistant"
              onClick={() => setMobileSidebarOpen(false)}
              className={`mb-4 block rounded-2xl bg-white px-4 py-4 text-center text-sm font-bold text-slate-900 shadow-sm shadow-slate-200/70 transition hover:bg-slate-50 ${
                sidebarCollapsed ? "px-2 text-lg" : ""
              }`}
              title="گفتگوی جدید با آرتین"
            >
              {sidebarCollapsed ? "✦" : "گفتگوی جدید با آرتین"}
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
                  : pathname.startsWith(item.href);

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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base">
                    {item.icon}
                  </span>

                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            {!sidebarCollapsed && (
              <div className="mt-6">
                <div className="mb-2 px-3 text-xs font-bold text-slate-500">
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
                    href="/customer-request"
                    className="block rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 hover:bg-slate-50"
                  >
                    ثبت درخواست مشاوره
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 px-4 py-4">
            <div className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-200/70">
              <div
                className={`flex items-center ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                }`}
              >
                <img
                  src="/images/artin-avatar.png"
                  alt="آرتین"
                  className="h-12 w-12 rounded-full border border-slate-200 bg-white object-cover shadow-sm"
                />

                {!sidebarCollapsed && (
                  <div>
                    <div className="text-sm font-bold">هوش مصنوعی فعال</div>
                    <div className="mt-1 text-xs text-slate-500">
                      آرتین، دستیار تخصصی آرتین آزما
                    </div>
                  </div>
                )}
              </div>
            </div>
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