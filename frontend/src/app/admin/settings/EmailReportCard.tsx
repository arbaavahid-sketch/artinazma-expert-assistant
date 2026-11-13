"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Mail, Save, Send } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** SMTP settings for the weekly report and request alerts. */
export default function EmailReportCard() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  // Email settings state
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: "",
    from_addr: "", to_addr: "", weekly_enabled: false, request_alerts_enabled: true,
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMessageType, setEmailMessageType] = useState<"success" | "error">("success");

  async function loadEmailSettings() {
    try {
      const res = await fetch(adminUrl("/admin/email-settings"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings((prev) => ({ ...prev, ...data }));
      }
    } catch { /* ignore */ }
  }

  async function saveEmailSettings() {
    setSavingEmail(true);
    setEmailMessage("");
    try {
      const res = await fetch(adminUrl("/admin/email-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailSettings),
      });
      const data = await res.json();
      setEmailMessageType(data.success ? "success" : "error");
      setEmailMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
    } catch {
      setEmailMessageType("error");
      setEmailMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function sendWeeklyReport() {
    setSendingReport(true);
    setEmailMessage("");
    try {
      const res = await fetch(adminUrl("/admin/send-weekly-report"), { method: "POST" });
      const data = await res.json();
      setEmailMessageType(data.success ? "success" : "error");
      setEmailMessage(data.message || (data.success ? (isEn ? "Sent." : "ارسال شد.") : (isEn ? "Send failed." : "خطا در ارسال.")));
    } catch {
      setEmailMessageType("error");
      setEmailMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSendingReport(false);
    }
  }

  useEffect(() => {
    void loadEmailSettings();
  }, []);

  return (
        <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                {isEn ? "Weekly Email Report" : "گزارش هفتگی ایمیل"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-subtle)]">
                {isEn ? "SMTP settings for automatic admin reports" : "تنظیمات SMTP برای ارسال خودکار گزارش به ادمین"}
              </p>
            </div>
          </div>

          {emailMessage && (
            <div className={`mb-5 flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${
              emailMessageType === "success" ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
            }`}>
              {emailMessageType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {emailMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">SMTP Host</label>
              <input
                value={emailSettings.smtp_host}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">Port</label>
              <select
                value={emailSettings.smtp_port}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_port: Number(e.target.value) }))}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              >
                <option value={587}>587 (STARTTLS)</option>
                <option value={465}>465 (SSL)</option>
                <option value={25}>25</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                {isEn ? "SMTP username" : "نام کاربری SMTP"}
              </label>
              <input
                value={emailSettings.smtp_user}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                placeholder="your@email.com"
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                {isEn ? "SMTP password" : "رمز عبور SMTP"}
              </label>
              <input
                type="password"
                value={emailSettings.smtp_pass}
                onChange={(e) => setEmailSettings((s) => ({ ...s, smtp_pass: e.target.value }))}
                placeholder={isEn ? "App password or password" : "App password یا رمز عبور"}
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                {isEn ? "Sender address" : "آدرس فرستنده"}
              </label>
              <input
                value={emailSettings.from_addr}
                onChange={(e) => setEmailSettings((s) => ({ ...s, from_addr: e.target.value }))}
                placeholder="artin@artinazma.ir"
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                {isEn ? "Recipient email (admin)" : "ایمیل گیرنده (ادمین)"}
              </label>
              <input
                value={emailSettings.to_addr}
                onChange={(e) => setEmailSettings((s) => ({ ...s, to_addr: e.target.value }))}
                placeholder="admin@artinazma.ir"
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={emailSettings.weekly_enabled}
              onChange={(e) => setEmailSettings((s) => ({ ...s, weekly_enabled: e.target.checked }))}
            />
            <span className="font-bold">
              {isEn ? "Send the report automatically once a week" : "ارسال خودکار گزارش هر هفته یک‌بار"}
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--color-info-bg)] px-4 py-3 text-sm text-[var(--color-info-text)]">
            <input
              type="checkbox"
              checked={emailSettings.request_alerts_enabled}
              onChange={(e) => setEmailSettings((s) => ({ ...s, request_alerts_enabled: e.target.checked }))}
            />
            <span className="font-bold">
              {isEn ? "Send instant admin email for new customer requests" : "ارسال ایمیل فوری به ادمین برای درخواست جدید مشتری"}
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={saveEmailSettings}
              disabled={savingEmail}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
            >
              <Save size={16} />
              {savingEmail ? (isEn ? "Saving..." : "در حال ذخیره...") : (isEn ? "Save settings" : "ذخیره تنظیمات")}
            </button>

            <button
              onClick={sendWeeklyReport}
              disabled={sendingReport || !emailSettings.to_addr}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-5 py-3 text-sm font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)] disabled:opacity-50"
            >
              <Send size={16} />
              {sendingReport ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send report now" : "ارسال گزارش الان")}
            </button>
          </div>
        </div>
  );
}
