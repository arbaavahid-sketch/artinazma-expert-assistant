import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f8] px-6">
      <div className="text-center">
        <div className="text-6xl font-black text-slate-200 mb-4">۴۰۴</div>
        <h1 className="text-2xl font-black text-slate-900 mb-3">صفحه پیدا نشد</h1>
        <p className="text-slate-500 mb-6">صفحه‌ای که دنبال آن بودید وجود ندارد.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-6 py-3 font-bold text-white hover:bg-purple-800 transition"
        >
          بازگشت به صفحه اصلی
        </Link>
      </div>
    </div>
  );
}
