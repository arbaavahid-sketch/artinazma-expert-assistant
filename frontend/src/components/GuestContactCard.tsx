"use client";
import { useState } from "react";
import { apiUrl, backendFetch } from "@/lib/api";
export default function GuestContactCard({isEn, onDone}: {isEn: boolean; onDone: () => void}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      const res = await backendFetch(apiUrl("/questions/attach-identity"), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({user_id: "", full_name: name, phone})});
      if (!res.ok) throw new Error();
      localStorage.setItem("artin_guest_name", name);
      localStorage.setItem("artin_guest_phone", phone);
      onDone();
    } catch { setError(isEn ? "Enter a valid name and Iranian mobile number, then retry." : "نام و شماره موبایل معتبر وارد کنید و دوباره تلاش کنید."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={e => {e.preventDefault(); void submit();}} className="mx-auto mt-4 max-w-xl rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
    <p>{isEn ? "Enter your name and mobile to ask two more questions. Then complete registration for admin approval." : "برای دو سؤال دیگر، نام و موبایل را وارد کنید. پس از آن، تکمیل ثبت‌نام و تأیید مدیر لازم است."}</p>
    <input required minLength={2} maxLength={120} className="ui-input w-full" autoComplete="name" placeholder={isEn ? "Full name" : "نام و نام خانوادگی"} value={name} onChange={e => setName(e.target.value)} />
    <input required className="ui-input w-full" autoComplete="tel" inputMode="tel" placeholder={isEn ? "Mobile number" : "شماره موبایل"} value={phone} onChange={e => setPhone(e.target.value)} />
    {error && <p role="alert">{error}</p>}
    <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-white">{isEn ? "Save and continue" : "ثبت و ادامه گفتگو"}</button>
  </form>;
}
