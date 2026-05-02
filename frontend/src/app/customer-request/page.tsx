"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";

const requestTypes = [
  { value: "consultation", label: "مشاوره فنی" },
  { value: "equipment", label: "انتخاب یا خرید تجهیزات" },
  { value: "catalyst", label: "کاتالیست" },
  { value: "test-analysis", label: "تحلیل تست یا گزارش" },
  { value: "troubleshooting", label: "عیب‌یابی دستگاه" },
  { value: "price-inquiry", label: "استعلام قیمت" },
];

export default function CustomerRequestPage() {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("consultation");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  async function submitRequest() {
    setResultMessage("");

    if (!fullName.trim() || !phone.trim() || !message.trim()) {
      setResultMessage("لطفاً نام، شماره تماس و متن درخواست را وارد کنید.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl("/customer-requests"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName,
          company,
          phone,
          email,
          request_type: requestType,
          subject,
          message,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResultMessage(data.message || "درخواست شما با موفقیت ثبت شد.");

        setFullName("");
        setCompany("");
        setPhone("");
        setEmail("");
        setRequestType("consultation");
        setSubject("");
        setMessage("");
      } else {
        setResultMessage(data.message || "خطا در ثبت درخواست.");
      }
    } catch {
      setResultMessage("خطا در اتصال به سرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[32px] bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="mb-3 text-sm font-bold text-blue-700">
            ارتباط با کارشناس آرتین آزما
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            ثبت درخواست مشاوره یا تماس
          </h1>

          <p className="mt-4 max-w-3xl leading-8 text-slate-600">
            اگر بعد از گفتگو با آرتین نیاز به بررسی تخصصی‌تر، استعلام قیمت،
            پیشنهاد دستگاه، بررسی کاتالیست یا تحلیل تست دارید، فرم زیر را تکمیل
            کنید تا کارشناسان آرتین آزما پیگیری کنند.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  نام و نام خانوادگی *
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
                  placeholder="مثلاً: وحید ..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  شرکت / سازمان
                </label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
                  placeholder="نام شرکت"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  شماره تماس *
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
                  placeholder="شماره موبایل یا تلفن"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold">
                  ایمیل
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <label className="mb-2 mt-5 block text-sm font-bold">
              نوع درخواست
            </label>

            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
            >
              {requestTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label className="mb-2 mt-5 block text-sm font-bold">
              موضوع درخواست
            </label>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-600"
              placeholder="مثلاً: انتخاب دستگاه برای آنالیز سولفور در LPG"
            />

            <label className="mb-2 mt-5 block text-sm font-bold">
              توضیحات درخواست *
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-44 w-full rounded-2xl border border-slate-300 bg-white p-4 leading-8 outline-none focus:border-blue-600"
              placeholder="نیاز، نوع نمونه، مشکل، فایل تست یا اطلاعات فنی را توضیح دهید..."
            />

            <button
              onClick={submitRequest}
              disabled={loading}
              className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-4 font-medium text-white disabled:opacity-50"
            >
              {loading ? "در حال ثبت..." : "ثبت درخواست"}
            </button>

            {resultMessage && (
              <div className="mt-5 rounded-2xl bg-white p-4 leading-8 text-slate-700">
                {resultMessage}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-blue-50 p-5 text-blue-950">
              <div className="mb-2 font-bold">چه زمانی درخواست ثبت کنم؟</div>
              <p className="text-sm leading-7">
                وقتی نیاز به پیشنهاد دقیق دستگاه، بررسی کاتالیست، تحلیل تست،
                استعلام قیمت یا عیب‌یابی تخصصی دارید.
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5 text-slate-700">
              <div className="mb-2 font-bold">اطلاعات مفید برای کارشناس</div>
              <ul className="list-inside list-disc space-y-2 text-sm leading-7">
                <li>نوع نمونه یا فرایند</li>
                <li>محدوده اندازه‌گیری</li>
                <li>مدل دستگاه یا تجهیز</li>
                <li>مشکل یا خطای مشاهده‌شده</li>
                <li>هدف از آنالیز یا تست</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}