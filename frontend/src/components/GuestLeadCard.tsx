"use client";

import { useState } from "react";

import { apiUrl } from "@/lib/api";
import { getOrCreateUserId } from "@/lib/user";

/**
 * Shown inline in the chat when a guest asks something commercial — a price, a
 * datasheet, availability. Artin already declines to quote numbers and points
 * at the sales team; this turns that dead end into a lead by asking for a name
 * and a phone number, and nothing else.
 *
 * It posts to the same /customer-requests endpoint the full request form uses,
 * so these land in the existing admin panel and trigger the usual Telegram
 * notification. Deliberately not a sign-up: no password, no email verification.
 */

interface Props {
  /** The question that triggered the gate, recorded so sales has context. */
  question: string;
  isEn?: boolean;
  /**
   * "commercial" — they asked for a price or a datasheet; the chat carries on
   * either way. "quota" — the free questions are spent and the composer is
   * blocked until this is filled in.
   */
  reason?: "commercial" | "quota";
  freeQuestions?: number;
  onDone?: (fullName: string, phone: string) => void;
}

export default function GuestLeadCard({
  question,
  isEn = false,
  reason = "commercial",
  freeQuestions = 5,
  onDone,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const canSend = fullName.trim().length >= 2 && phone.trim().length >= 7 && !sending;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError("");

    try {
      const res = await fetch(apiUrl("/customer-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          company: company.trim(),
          request_type: "price-inquiry",
          subject: isEn ? "Inquiry from Artin chat" : "استعلام از گفت‌وگو با آرتین",
          // The question gives sales the context. It can be empty when the
          // card is shown on an empty conversation (a returning guest whose
          // allowance ran out), and the endpoint requires a message.
          message:
            question.trim().slice(0, 1500) ||
            (isEn
              ? "Contact requested from the Artin assistant."
              : "درخواست تماس از طریق دستیار آرتین."),
        }),
      });

      if (!res.ok) throw new Error(String(res.status));

      // Name the questions this visitor already asked. Until now they sat in
      // the admin panel under an opaque id like "user_muu40lv", which told
      // whoever followed the lead up nothing. Best-effort: the lead itself is
      // already saved, so a failure here must not look like a failed submit.
      try {
        await fetch(apiUrl("/questions/attach-identity"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: getOrCreateUserId(),
            full_name: fullName.trim(),
            phone: phone.trim(),
          }),
        });
      } catch {
        // Nothing to show the visitor — their details are stored either way.
      }

      setSent(true);
      onDone?.(fullName.trim(), phone.trim());
    } catch {
      setError(
        isEn
          ? "Could not send. Please try again."
          : "ارسال نشد. لطفاً دوباره تلاش کنید.",
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="ui-card mt-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-sm font-bold text-emerald-800">
          {isEn ? "Thank you — we have your details." : "ممنون — اطلاعات شما ثبت شد."}
        </div>
        <div className="mt-2 text-sm leading-7 text-emerald-700">
          {reason === "quota"
            ? isEn
              ? "You can carry on asking. A specialist will also get in touch."
              : "می‌توانید به پرسیدن ادامه بدهید. کارشناس ما هم با شما تماس می‌گیرد."
            : isEn
              ? "One of our specialists will contact you shortly. You can keep asking technical questions here in the meantime."
              : "کارشناسان ما به‌زودی با شما تماس می‌گیرند. تا آن موقع می‌توانید همین‌جا سؤال‌های فنی‌تان را بپرسید."}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card mt-3 rounded-[20px] border border-sky-200 bg-sky-50 p-5">
      <div className="text-sm font-bold text-slate-900">
        {reason === "quota"
          ? isEn
            ? "Let's keep going"
            : "برای ادامه گفت‌وگو"
          : isEn
            ? "For price, availability or a datasheet"
            : "برای قیمت، موجودی یا دریافت دیتاشیت"}
      </div>
      <div className="mt-2 text-sm leading-7 text-slate-600">
        {reason === "quota"
          ? isEn
            ? `You have used your ${freeQuestions} free questions. Leave your name and phone number to carry on — no account or password needed.`
            : `${freeQuestions} سؤال رایگان شما تمام شد. برای ادامه، نام و شماره تماس خود را بگذارید — نیازی به ساخت حساب و رمز عبور نیست.`
          : isEn
            ? "Leave your name and phone number and a specialist will get back to you. No account needed."
            : "نام و شماره تماس خود را بگذارید تا کارشناس ما با شما تماس بگیرد. نیازی به ساخت حساب کاربری نیست."}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          className="ui-input w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          placeholder={isEn ? "Full name" : "نام و نام خانوادگی"}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />
        <input
          className="ui-input w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          placeholder={isEn ? "Mobile number" : "شماره موبایل"}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
        />
        <input
          className="ui-input w-full rounded-xl border border-slate-200 px-4 py-3 text-sm sm:col-span-2"
          placeholder={isEn ? "Company (optional)" : "نام شرکت (اختیاری)"}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoComplete="organization"
        />
      </div>

      {error ? <div className="mt-3 text-sm text-rose-600">{error}</div> : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className="mt-4 w-full rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:opacity-40 sm:w-auto"
      >
        {sending
          ? isEn
            ? "Sending..."
            : "در حال ارسال..."
          : isEn
            ? "Request a call"
            : "درخواست تماس کارشناس"}
      </button>
    </div>
  );
}
