import Link from "next/link";

export default function GuestRegistrationCard({ isEn = false }: { isEn?: boolean }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-xl rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
      <p className="font-semibold text-slate-900">
        {isEn ? "Your 4 free questions have been used." : "۴ سؤال رایگان شما استفاده شده است."}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {isEn ? "Register and sign in to continue chatting and use file and image analysis."
          : "برای ادامه گفتگو و استفاده از تحلیل فایل و عکس، ثبت‌نام کنید و وارد حساب شوید."}
      </p>
      <div className="mt-4 flex justify-center gap-4">
        <Link href="/customer-register" className="rounded-xl bg-blue-600 px-4 py-2 text-white">
          {isEn ? "Register" : "ثبت‌نام"}
        </Link>
        <Link href="/customer-login?next=/assistant" className="px-4 py-2 text-blue-700">
          {isEn ? "Sign in" : "ورود به حساب"}
        </Link>
      </div>
    </div>
  );
}
