"use client";

import { useEffect, useState } from "react";
import { Clock, Cloud, Play } from "lucide-react";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { GDriveSchedule } from "./settings-types";

/** Automatic Google Drive sync: interval, run-now and live sync status. */
export default function GoogleDriveScheduleCard() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [gdriveSchedule, setGdriveSchedule] = useState<GDriveSchedule | null>(null);
  const [gdriveIntervalInput, setGdriveIntervalInput] = useState("24");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [gdriveMessage, setGdriveMessage] = useState("");

  async function loadGdriveSchedule() {
    try {
      const res = await fetch(adminUrl("/admin/gdrive-schedule"), { cache: "no-store" });
      if (res.ok) {
        const data: GDriveSchedule = await res.json();
        setGdriveSchedule(data);
        if (data.interval_hours > 0) {
          setGdriveIntervalInput(String(data.interval_hours));
        }
      }
    } catch { /* ignore */ }
  }

  async function saveGdriveSchedule(enabled: boolean) {
    setSavingSchedule(true);
    setGdriveMessage("");
    try {
      const interval = enabled ? parseFloat(gdriveIntervalInput) || 24 : 0;
      const res = await fetch(adminUrl("/admin/gdrive-schedule"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_hours: interval }),
      });
      const data = await res.json();
      setGdriveMessage(data.message || (isEn ? "Saved." : "ذخیره شد."));
      await loadGdriveSchedule();
    } catch {
      setGdriveMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSavingSchedule(false);
    }
  }

  async function runGdriveSyncNow() {
    setSyncingNow(true);
    setGdriveMessage("");

    try {
      const res = await fetch(
        adminUrl("/admin/gdrive-sync-now"),
        { method: "POST" },
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setGdriveMessage(
          data.message || (isEn ? "Background sync started." : "همگام‌سازی در پس‌زمینه آغاز شد."),
        );
      } else {
        setGdriveMessage(
          data.message || data.detail || (isEn ? "Sync failed." : "خطا در همگام‌سازی."),
        );
      }

      await loadGdriveSchedule();
    } catch {
      setGdriveMessage(isEn ? "Failed to connect to the server." : "خطا در اتصال به سرور.");
    } finally {
      setSyncingNow(false);
    }
  }

  useEffect(() => {
    void loadGdriveSchedule();
  }, []);

  useEffect(() => {
    if (gdriveSchedule?.sync_status !== "running") return;

    const timer = window.setInterval(() => {
      void loadGdriveSchedule();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [gdriveSchedule?.sync_status]);

  return (
        <div className="mt-6 rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
              <Cloud size={25} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                {isEn ? "Automatic Google Drive Sync" : "همزمان‌سازی خودکار Google Drive"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-subtle)]">
                {isEn ? "Sync the knowledge base with Google Drive on a schedule." : "بانک دانش را به صورت زمان‌بندی‌شده با Google Drive همزمان کنید."}
              </p>
            </div>
          </div>

          {!gdriveSchedule?.folder_id_configured && (
            <div className="mb-5 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-sm font-bold text-[var(--color-warning-text)]">
              {isEn
                ? "GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured. Set it in the .env file to enable this feature."
                : "متغیر محیطی GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است. برای فعال‌کردن این قابلیت، آن را در فایل .env تنظیم کنید."}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--text-muted)]">
                  {isEn ? "Interval (hours)" : "فاصله زمانی (ساعت)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={gdriveIntervalInput}
                  onChange={(e) => setGdriveIntervalInput(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--brand-accent)] focus:outline-none"
                  placeholder={isEn ? "24" : "۲۴"}
                />
                <p className="mt-1 text-xs text-[var(--text-subtle)]">
                  {isEn ? "For example: 24 = once per day" : "مثلاً ۲۴ = هر روز یک‌بار"}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => saveGdriveSchedule(true)}
                  disabled={savingSchedule || !gdriveSchedule?.folder_id_configured}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
                >
                  <Clock size={16} />
                  {savingSchedule ? (isEn ? "Saving..." : "ذخیره...") : (isEn ? "Enable schedule" : "فعال‌کردن زمان‌بندی")}
                </button>

                <button
                  onClick={() => saveGdriveSchedule(false)}
                  disabled={savingSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--text-muted)] transition hover:bg-[var(--surface)] disabled:opacity-50"
                >
                  {isEn ? "Disable" : "غیرفعال"}
                </button>
              </div>

              <button
                onClick={runGdriveSyncNow}
                disabled={syncingNow || gdriveSchedule?.sync_status === "running" || !gdriveSchedule?.folder_id_configured}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm font-bold text-[var(--color-success-text)] transition hover:bg-[var(--color-success-bg)] disabled:opacity-50"
              >
                <Play size={16} />
                {syncingNow || gdriveSchedule?.sync_status === "running"
                  ? (isEn ? "Syncing..." : "در حال همزمان‌سازی...")
                  : (isEn ? "Sync now" : "همزمان‌سازی فوری")}
              </button>

              {gdriveMessage && (
                <div className="rounded-2xl bg-[var(--surface-soft)] p-4 text-sm font-bold text-[var(--text-muted)]">
                  {gdriveMessage}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <div className="text-xs font-bold text-[var(--text-subtle)] mb-1">{isEn ? "Schedule status" : "وضعیت زمان‌بندی"}</div>
                <div className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${gdriveSchedule?.enabled ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--border-soft)] text-[var(--text-muted)]"}`}>
                  {gdriveSchedule?.enabled
                    ? isEn
                      ? `Every ${gdriveSchedule.interval_hours} hours`
                      : `هر ${gdriveSchedule.interval_hours} ساعت یک‌بار`
                    : isEn ? "Inactive" : "غیرفعال"}
                </div>
              </div>

              {gdriveSchedule?.last_sync && (
                <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                  <div className="text-xs font-bold text-[var(--text-subtle)] mb-1">{isEn ? "Last sync" : "آخرین همزمان‌سازی"}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {new Intl.DateTimeFormat(isEn ? "en-US" : "fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(gdriveSchedule.last_sync))}
                  </div>
                  {gdriveSchedule.last_sync_result && (
                    <div className="mt-1 text-xs text-[var(--text-subtle)]">{gdriveSchedule.last_sync_result}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
