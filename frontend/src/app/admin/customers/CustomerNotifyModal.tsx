"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Customer } from "./customers-types";

/** Sends an in-app notification to the customer. Mount it fresh for each open. */
export default function CustomerNotifyModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [sendingNotify, setSendingNotify] = useState(false);

  async function sendNotification() {
    if (!customer || !notifyMessage.trim()) return;
    setSendingNotify(true);
    setNotifyStatus(null);
    try {
      const res = await fetch(adminUrl(`/admin/customers/${customer.id}/notify`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: notifyMessage.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifyStatus({ text: isEn ? "Notification sent successfully." : "اعلان با موفقیت ارسال شد.", ok: true });
        setNotifyMessage("");
        setTimeout(() => { onClose(); }, 1500);
      } else {
        setNotifyStatus({ text: data.message || (isEn ? "Send failed." : "خطا در ارسال."), ok: false });
      }
    } catch {
      setNotifyStatus({ text: isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.", ok: false });
    } finally {
      setSendingNotify(false);
    }
  }

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] p-6">
              <div>
                <h2 className="text-lg font-black text-[var(--foreground)]">{isEn ? "Send In-App Notification" : "ارسال اعلان داخل اپ"}</h2>
                <p className="mt-1 text-sm text-[var(--text-subtle)]">{isEn ? "For" : "برای"}: {customer.full_name}</p>
              </div>
              <button
                onClick={() => onClose()}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-subtle)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-muted)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {notifyStatus && (
                <div className={`rounded-2xl p-4 text-sm font-bold ${
                  notifyStatus.ok ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                }`}>
                  {notifyStatus.text}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">{isEn ? "Message text" : "متن پیام"}</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 outline-none transition focus:border-amber-500"
                  placeholder={isEn ? "Notification message for the customer..." : "پیام اعلان برای مشتری..."}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={sendNotification}
                  disabled={sendingNotify || !notifyMessage.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  <Bell size={16} />
                  {sendingNotify ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send notification" : "ارسال اعلان")}
                </button>
                <button
                  onClick={() => onClose()}
                  className="rounded-2xl border border-[var(--border-soft)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                >
                  {isEn ? "Cancel" : "انصراف"}
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
