"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Customer } from "./customers-types";

/** Drafts an email to the customer and opens it in the admin's mail app. Mount it fresh for each open. */
export default function CustomerEmailModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [subject, setSubject] = useState(
    isEn ? `Message from ArtinAzma to ${customer.full_name}` : `پیام از آرتین آزما به ${customer.full_name}`,
  );
  const [body, setBody] = useState("");

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Send Email" : "ارسال ایمیل"}</h2>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">
                  {isEn ? "To" : "به"}: {customer.full_name} — {customer.email}
                </p>
              </div>
              <button
                onClick={() => onClose()}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-subtle)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Subject" : "موضوع"}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="ui-input"
                  placeholder={isEn ? "Email subject..." : "موضوع ایمیل..."}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Email body" : "متن ایمیل"}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="ui-textarea w-full resize-none p-3"
                  placeholder={isEn ? "Write your message..." : "متن پیام خود را بنویسید..."}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <a
                  href={`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3 font-bold text-white transition hover:bg-[var(--brand-fill-hover)]"
                  onClick={() => onClose()}
                >
                  <Send size={16} />
                  {isEn ? "Open in email app" : "باز کردن در ایمیل"}
                </a>
                <button
                  onClick={() => onClose()}
                  className="ui-btn ui-btn-ghost px-5 py-3"
                >
                  {isEn ? "Cancel" : "انصراف"}
                </button>
              </div>
              <p className="text-xs text-[var(--text-subtle)] text-center">
                {isEn
                  ? "This button opens your email client with the filled information."
                  : "این دکمه کلاینت ایمیل شما را با اطلاعات پر‌شده باز می‌کند."}
              </p>
            </div>
          </div>
        </div>
  );
}
