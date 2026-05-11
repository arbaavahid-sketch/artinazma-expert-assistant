import { Link, useLocation } from "wouter";
import { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  ArrowLeft,
  Building2,
  LockKeyhole,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";

export default function CustomerRegisterPage() {
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function register() {
    setMessage("");
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setMessage("نام، ایمیل و رمز عبور الزامی است.");
      return;
    }
    if (password.length < 6) {
      setMessage("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/customers/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, company, phone, email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setMessage(data.message || "ثبت‌نام انجام نشد.");
        return;
      }
      localStorage.setItem("artin_customer", JSON.stringify(data.customer));
      document.cookie = "artin_customer_auth=logged_in; path=/; max-age=86400; samesite=lax";
      navigate("/assistant");
    } catch {
      setMessage("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl items-center justify-center">
        <div className="ui-card grid w-full overflow-hidden rounded-[40px] border-slate-200 shadow-sm lg:grid-cols-[1fr_430px]">
          <div className="p-8 lg:p-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              <UserPlus size={17} />
              ثبت‌نام مشتری
            </div>
            <h1 className="text-3xl font-black leading-[1.5] text-slate-900 md:text-4xl">
              ساخت حساب کاربری مشتری
            </h1>
            <p className="mt-4 max-w-2xl leading-8 text-slate-600">
              با ساخت حساب، گفتگوهای شما با آرتین ذخیره می‌شود و می‌توانید سوالات قبلی و درخواست‌ها را مشاهده کنید.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">نام و نام خانوادگی *</label>
                <div className="relative">
                  <UserRound size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام کامل" className="ui-input py-4 pl-4 pr-11" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">شرکت / سازمان</label>
                <div className="relative">
                  <Building2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="نام شرکت" className="ui-input py-4 pl-4 pr-11" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">شماره تماس</label>
                <div className="relative">
                  <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره موبایل یا تلفن" className="ui-input py-4 pl-4 pr-11" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">ایمیل *</label>
                <div className="relative">
                  <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="ui-input py-4 pl-4 pr-11" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-700">رمز عبور *</label>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="حداقل ۶ کاراکتر"
                    className="ui-input py-4 pl-4 pr-11"
                    onKeyDown={(e) => { if (e.key === "Enter") register(); }}
                  />
                </div>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-700">{message}</div>
            )}

            <button
              onClick={register}
              disabled={loading}
              className="ui-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-4 text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "در حال ثبت‌نام..." : "ثبت‌نام و ورود"}
              <ArrowLeft size={18} />
            </button>

            <div className="mt-6 text-center text-sm text-slate-600">
              قبلاً ثبت‌نام کرده‌اید؟{" "}
              <Link href="/customer-login" className="inline-flex items-center gap-1 font-bold text-blue-700">
                ورود مشتری <LogIn size={15} />
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-slate-50 p-8">
            <div className="ui-card w-full max-w-md rounded-[32px] p-6 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-[34px] bg-blue-50 text-blue-700">
                <UserPlus size={42} strokeWidth={1.7} />
              </div>
              <div className="text-xl font-black text-slate-900">آرتین، دستیار تخصصی شما</div>
              <p className="mt-3 leading-8 text-slate-600">
                حساب کاربری شما کمک می‌کند گفتگوها، تحلیل‌ها و درخواست‌های فنی مرتب و قابل پیگیری بمانند.
              </p>
              <div className="mt-5 grid gap-3 text-right text-sm">
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <ShieldCheck size={18} className="text-blue-700" />
                  دسترسی به گفتگوهای ذخیره‌شده
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 font-bold text-slate-700">
                  <Sparkles size={18} className="text-blue-700" />
                  پیگیری بهتر درخواست‌های فنی
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
