"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navItems = [
  { href: "/", label: "خانه" },
  { href: "/assistant", label: "آرتین" },
  { href: "/analyze", label: "تحلیل تست" },
  { href: "/memory", label: "حافظه من" },
  { href: "/customer-request", label: "درخواست مشاوره" },
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
    <div className="rounded-3xl bg-white p-4 shadow-sm">
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

            
            </div>
          </div>

          <div className="mt-auto border-t border-slate-200 px-5 py-5">
            <div className="rounded-2xl bg-white p-4">
  <div className="flex items-center gap-3">
    <img
      src="/images/artin-avatar.png"
      alt="آرتین"
      className="h-12 w-12 rounded-2xl object-contain"
    />

    <div>
      <div className="text-sm font-bold">هوش مصنوعی فعال</div>
      <div className="mt-1 text-xs text-slate-500">
        آرتین، دستیار تخصصی آرتین آزما
      </div>
    </div>
  </div>
</div>
          </div>
        </aside>

        <section className="relative h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
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
