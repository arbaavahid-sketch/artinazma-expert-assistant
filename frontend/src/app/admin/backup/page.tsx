"use client";

import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useConfirm } from "@/components/ConfirmDialog";
import { adminUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  Database,
  Download,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type BackupFile = {
  file_name: string;
  size_kb: number;
  created_at: string;
};

function formatDate(value: string, locale: "fa" | "en") {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(`${value}Z`));
  } catch {
    return value;
  }
}

function formatSize(sizeKb: number) {
  return sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toFixed(0)} KB`;
}

export default function BackupPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { confirm } = useConfirm();
  const [deletingFile, setDeletingFile] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function loadBackups() {
    setLoading(true);
    try {
      const res = await fetch(adminUrl("/admin/backup/list"), { cache: "no-store" });
      const data = await res.json();
      setBackups(data.backups || []);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }

  async function createBackup() {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch(adminUrl("/admin/backup/create"), { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({
          text: isEn
            ? `Backup created: ${data.file_name} (${data.size_kb} KB)`
            : `پشتیبان‌گیری انجام شد: ${data.file_name} (${data.size_kb} KB)`,
          ok: true,
        });
        await loadBackups();
      } else {
        setMessage({
          text: data.message || (isEn ? "Backup failed." : "خطا در پشتیبان‌گیری"),
          ok: false,
        });
      }
    } catch {
      setMessage({ text: isEn ? "Server connection error." : "خطا در اتصال به سرور", ok: false });
    } finally {
      setCreating(false);
    }
  }

  async function deleteBackup(fileName: string) {
    const approved = await confirm({
      message: isEn ? `Delete file "${fileName}"?` : `حذف فایل "${fileName}"؟`,
      variant: "danger",
      confirmLabel: isEn ? "Delete" : "حذف",
      title: isEn ? "Delete backup file" : "حذف فایل پشتیبان",
    });
    if (!approved) return;

    setDeletingFile(fileName);
    try {
      const res = await fetch(adminUrl(`/admin/backup/${encodeURIComponent(fileName)}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setBackups((prev) => prev.filter((b) => b.file_name !== fileName));
      }
    } finally {
      setDeletingFile("");
    }
  }

  function downloadBackup(fileName: string) {
    const a = document.createElement("a");
    a.href = adminUrl(`/admin/backup/download/${encodeURIComponent(fileName)}`);
    a.download = fileName;
    a.click();
  }

  useEffect(() => {
    loadBackups();
  }, []);

  const totalSizeKb = backups.reduce((sum, b) => sum + b.size_kb, 0);

  return (
    <section className="min-h-full bg-[var(--background)] px-6 py-8" dir={dir}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 overflow-hidden rounded-[36px] border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm">
          <div className="bg-gradient-to-l from-[var(--color-info-bg)] via-[var(--surface)] to-[var(--surface-soft)] p-8">
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher />
            </div>

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-info-bg)] px-4 py-2 text-sm font-bold text-[var(--color-info-text)]">
                  <ShieldCheck size={17} />
                  {isEn ? "Data Backups" : "پشتیبان‌گیری از داده‌ها"}
                </div>
                <h1 className="text-3xl font-black text-[var(--foreground)]">
                  {isEn ? "Backup Management" : "مدیریت نسخه‌های پشتیبان"}
                </h1>
                <p className="mt-4 max-w-2xl leading-8 text-[var(--text-muted)]">
                  {isEn
                    ? "Create a full SQLite database backup, then download or delete it when needed."
                    : "یک نسخه کامل از دیتابیس SQLite بگیرید و در صورت نیاز آن را دانلود یا حذف کنید."}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createBackup}
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-fill)] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-fill-hover)] disabled:opacity-50"
                >
                  <HardDrive size={18} className={creating ? "animate-pulse" : ""} />
                  {creating
                    ? isEn
                      ? "Creating backup..."
                      : "در حال پشتیبان‌گیری..."
                    : isEn
                      ? "New backup"
                      : "پشتیبان‌گیری جدید"}
                </button>

                <button
                  onClick={loadBackups}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  {isEn ? "Refresh" : "بروزرسانی"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-[28px] border p-5 text-sm font-bold leading-8 ${
              message.ok
                ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                : "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="text-sm font-bold text-[var(--text-subtle)]">
              {isEn ? "Backup count" : "تعداد نسخه‌های پشتیبان"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--foreground)]">{backups.length}</div>
          </div>
          <div className="rounded-[28px] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-5">
            <div className="text-sm font-bold text-[var(--color-info-text)]">
              {isEn ? "Total file size" : "حجم کل فایل‌ها"}
            </div>
            <div className="mt-2 text-3xl font-black text-[var(--color-info-text)]">
              {formatSize(totalSizeKb)}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Database size={20} className="text-[var(--color-info-text)]" />
            <h2 className="text-xl font-black text-[var(--foreground)]">
              {isEn ? "Backup Files" : "فایل‌های پشتیبان"}
            </h2>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-8 text-center text-[var(--text-subtle)]">
              {isEn ? "Loading..." : "در حال بارگذاری..."}
            </div>
          ) : backups.length === 0 ? (
            <div className="rounded-3xl bg-[var(--surface-soft)] p-10 text-center text-[var(--text-subtle)]">
              {isEn
                ? "No backup files yet. Create the first backup."
                : "هنوز هیچ نسخه پشتیبانی وجود ندارد. اولین پشتیبان را بگیرید."}
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.file_name}
                  className="flex flex-col gap-4 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-soft)] p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-black text-[var(--foreground)]">{backup.file_name}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-subtle)]">
                      <span>{formatDate(backup.created_at, locale)}</span>
                      <span className="font-bold text-[var(--text-muted)]">
                        {formatSize(backup.size_kb)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadBackup(backup.file_name)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-2 text-xs font-bold text-[var(--color-success-text)] transition hover:bg-[var(--color-success-bg)]"
                    >
                      <Download size={15} />
                      {isEn ? "Download" : "دانلود"}
                    </button>
                    <button
                      onClick={() => deleteBackup(backup.file_name)}
                      disabled={deletingFile === backup.file_name}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-2 text-xs font-bold text-[var(--color-danger-text)] transition hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      {deletingFile === backup.file_name
                        ? isEn
                          ? "Deleting..."
                          : "حذف..."
                        : isEn
                          ? "Delete"
                          : "حذف"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
