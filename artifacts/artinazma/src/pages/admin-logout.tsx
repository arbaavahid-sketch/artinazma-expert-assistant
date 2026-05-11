import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";

export default function AdminLogoutPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    async function logout() {
      await fetch("/api/admin-logout", { method: "POST" });
      navigate("/admin-login");
    }
    logout();
  }, [navigate]);

  return (
    <section className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl items-center justify-center">
        <div className="w-full max-w-xl rounded-[40px] border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[30px] bg-red-50 text-red-700">
            <LogOut size={36} strokeWidth={1.7} />
          </div>

          <h1 className="text-3xl font-black text-slate-900">
            خروج از پنل ادمین
          </h1>

          <p className="mt-4 leading-8 text-slate-600">
            در حال خروج از پنل داخلی آرتین آزما هستید. پس از خروج، برای ورود
            دوباره باید رمز ادمین را وارد کنید.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">
            <Loader2 size={18} className="animate-spin" />
            در حال خروج...
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <ShieldCheck size={17} />
            نشست ادمین در حال پاک شدن است.
          </div>
        </div>
      </div>
    </section>
  );
}
