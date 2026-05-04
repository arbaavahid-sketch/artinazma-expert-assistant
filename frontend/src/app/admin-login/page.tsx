"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("/admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/admin");
  }, []);

  async function login() {
    setError("");

    if (!password.trim()) {
      setError("لطفاً رمز ادمین را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "ورود ناموفق بود.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("خطا در اتصال به سیستم ورود ادمین.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      login();
    }
  }

  return (
    <section className="flex h-full items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 text-sm font-bold text-blue-700">
            پنل داخلی آرتین آزما
          </div>

          <h1 className="text-2xl font-bold text-slate-900">ورود ادمین</h1>

          <p className="mt-3 leading-7 text-slate-600">
            برای دسترسی به بانک دانش، سوالات کاربران و داشبورد، رمز ادمین را
            وارد کنید.
          </p>
        </div>

        <label className="mb-2 block text-sm font-bold">رمز ادمین</label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
          placeholder="رمز را وارد کنید"
        />

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={login}
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-4 font-medium text-white disabled:opacity-50"
        >
          {loading ? "در حال ورود..." : "ورود به پنل ادمین"}
        </button>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
          رمز ادمین از تنظیمات امن سرور خوانده می‌شود.
        </div>
      </div>
    </section>
  );
}