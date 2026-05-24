"use client";

import { useEffect, useState } from "react";
import { adminUrl } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  ShieldCheck,
} from "lucide-react";

type BackupFile = {
  file_name: string;
  size_kb: number;
  created_at: string;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value + "Z"));
  } catch {
    return value;
  }
}

export default function BackupPage() {
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
        setMessage({ text: `پشتیبان‌گیری انجام شد: ${data.file_name} (${data.size_kb} KB)`, ok: true });
        await loadBackups();
      } else {
        setMessage({ text: data.message || "خطا در پشتیبان‌گیری", ok: false });
      }
    } catch {
      setMessage({ text: "خطا در اتصال به سرور", ok: false });
    } finally {
      setCreating(false);
    }
  }

  async function deleteBackup(fileName: string) {
    if (!await confirm({ message: `حذف فایل "${fileName}"؟`, variant: "danger", confirmLabel: "حذف", title: "حذف فایل پشتیبان" })) return;
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
    <section className="min-h-full bg-[#f7f7f8] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-blue-50 via-white to-slate-50 p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                  <ShieldCheck size={17} />
                  پشتیبان‌گیری از داده‌ها
                </div>
                <h1 className="text-3xl font-black text-slate-900">
                  مدیریت نسخه‌های پشتیبان
                </h1>
                <p className="mt-4 max-w-2xl leading-8 text-slate-600">
                  یک نسخه کامل از دیتابیس SQLite بگیرید و در صورت نیاز آن را
                  دانلود یا حذف کنید.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createBackup}
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                >
                  <HardDrive size={18} className={creating ? "animate-pulse" : ""} />
                  {creating ? "در حال پشتیبان‌گیری..." : "پشتیبان‌گیری جدید"}
                </button>

                <button
                  onClick={loadBackups}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  بروزرسانی
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 rounded-[28px] border p-5 text-sm font-bold leading-8 ${
              message.ok
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold text-slate-500">تعداد نسخه‌های پشتیبان</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{backups.length}</div>
          </div>
          <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
            <div className="text-sm font-bold text-blue-700">حجم کل فایل‌ها</div>
            <div className="mt-2 text-3xl font-black text-blue-700">
              {totalSizeKb > 1024
                ? `${(totalSizeKb / 1024).toFixed(1)} MB`
                : `${totalSizeKb.toFixed(0)} KB`}
            </div>
          </div>
        </div>

        {/* Backup list */}
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Database size={20} className="text-blue-600" />
            <h2 className="text-xl font-black text-slate-900">فایل‌های پشتیبان</h2>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-500">
              در حال بارگذاری...
            </div>
          ) : backups.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
              هنوز هیچ نسخه پشتیبانی وجود ندارد. اولین پشتیبان را بگیرید.
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.file_name}
                  className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-black text-slate-900">{backup.file_name}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{formatDate(backup.created_at)}</span>
                      <span className="font-bold text-slate-600">
                        {backup.size_kb > 1024
                          ? `${(backup.size_kb / 1024).toFixed(1)} MB`
                          : `${backup.size_kb} KB`}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadBackup(backup.file_name)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Download size={15} />
                      دانلود
                    </button>
                    <button
                      onClick={() => deleteBackup(backup.file_name)}
                      disabled={deletingFile === backup.file_name}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      {deletingFile === backup.file_name ? "حذف..." : "حذف"}
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
