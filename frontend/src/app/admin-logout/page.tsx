"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function logout() {
      await fetch("/api/admin-logout", {
        method: "POST",
      });

      router.replace("/");
      router.refresh();
    }

    logout();
  }, [router]);

  return (
    <section className="flex h-full items-center justify-center px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          خروج از پنل ادمین
        </h1>

        <p className="mt-4 text-slate-600">
          در حال خروج از پنل داخلی آرتین آزما...
        </p>
      </div>
    </section>
  );
}