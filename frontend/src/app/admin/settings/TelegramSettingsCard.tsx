"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, MessageCircle, Save, Send } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Telegram bot token, chat id and a test-message action. */
export default function TelegramSettingsCard() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  // Telegram settings state
  const [tgSettings, setTgSettings] = useState({ bot_token: "", chat_id: "", enabled: false });
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [tgMessage, setTgMessage] = useState("");
  const [tgMessageType, setTgMessageType] = useState<"success" | "error">("success");

  async function loadTgSettings() {
    try {
      const res = await fetch(adminUrl("/admin/telegram-settings"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTgSettings(data);
      }
    } catch { /* ignore */ }
  }

  async function saveTgSettings() {
    setSavingTg(true);
    setTgMessage("");
    try {
      const res = await fetch(adminUrl("/admin/telegram-settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgSettings),
      });
      const data = await res.json();
      setTgMessageType(data.success ? "success" : "error");
      setTgMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
      await loadTgSettings();
    } catch {
      setTgMessageType("error");
      setTgMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingTg(false);
    }
  }

  async function testTg() {
    setTestingTg(true);
    setTgMessage("");
    try {
      const res = await fetch(adminUrl("/admin/telegram-test"), { method: "POST" });
      const data = await res.json();
      setTgMessageType(data.success ? "success" : "error");
      setTgMessage(data.message || (isEn ? "Message sent." : "پیام ارسال شد."));
    } catch {
      setTgMessageType("error");
      setTgMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setTestingTg(false);
    }
  }

  useEffect(() => {
    void loadTgSettings();
  }, []);

  return (
        <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
              <MessageCircle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                {isEn ? "Telegram Notifications" : "اعلان‌های تلگرام"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-subtle)]">
                {isEn
                  ? "Receive new customer registrations and contact requests on Telegram."
                  : "ثبت‌نام مشتری جدید و درخواست‌های تماس را روی تلگرام دریافت کن"}
              </p>
            </div>
          </div>

          {tgMessage && (
            <div className={`mb-5 flex items-center gap-2 rounded-2xl p-4 text-sm font-bold ${
              tgMessageType === "success" ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
            }`}>
              {tgMessageType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {tgMessage}
            </div>
          )}

          {tgSettings.enabled && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-success-bg)] px-4 py-2 text-sm font-bold text-[var(--color-success-text)]">
              <CheckCircle2 size={15} />
              {isEn ? "Telegram is active" : "تلگرام فعال است"}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                Bot Token
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="mr-2 font-normal text-[var(--color-info-text)] hover:underline"
                >
                  {isEn ? "(get it from @BotFather)" : "(از @BotFather بگیر)"}
                </a>
              </label>
              <input
                value={tgSettings.bot_token}
                onChange={(e) => setTgSettings((s) => ({ ...s, bot_token: e.target.value }))}
                placeholder="123456789:AABBcc..."
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-muted)]">
                Chat ID
                <span className="mr-2 font-normal text-[var(--text-subtle)]">
                  {isEn ? "(group or channel ID)" : "(شناسه گروه یا کانال)"}
                </span>
              </label>
              <input
                value={tgSettings.chat_id}
                onChange={(e) => setTgSettings((s) => ({ ...s, chat_id: e.target.value }))}
                placeholder="-100123456789"
                dir="ltr"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--brand-accent)]"
              />
            </div>
          </div>

          <p className="mt-3 rounded-2xl bg-[var(--surface-soft)] p-4 text-xs leading-7 text-[var(--text-subtle)]">
            {isEn ? "To find the Chat ID, add the bot to the group, then use " : "برای پیداکردن Chat ID: ربات را به گروه اضافه کن، سپس از"}{" "}
            <span dir="ltr" className="font-mono text-[var(--text-muted)]">
              https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </span>{" "}
            {isEn ? "and copy the " : "استفاده کن و عدد "}
            <span className="font-bold">chat.id</span>
            {isEn ? " value." : " را کپی کن."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={saveTgSettings}
              disabled={savingTg}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
            >
              <Save size={16} />
              {savingTg ? (isEn ? "Saving..." : "در حال ذخیره...") : (isEn ? "Save settings" : "ذخیره تنظیمات")}
            </button>
            <button
              onClick={testTg}
              disabled={testingTg}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-5 py-3 text-sm font-bold text-[var(--color-info-text)] transition hover:bg-[var(--color-info-bg)] disabled:opacity-50"
            >
              <Send size={16} />
              {testingTg ? (isEn ? "Sending..." : "در حال ارسال...") : (isEn ? "Send test message" : "ارسال پیام آزمایشی")}
            </button>
          </div>
        </div>
  );
}
