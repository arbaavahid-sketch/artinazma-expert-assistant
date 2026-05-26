"use client";
/**
 * مودال آپلود فایل/تصویر — استخراج‌شده از assistant/page.tsx
 */

interface UploadModalProps {
  title: string;
  fileName: string;
  label: string;
  selectValue: string;
  onSelectChange: (value: string) => void;
  options: { value: string; label: string }[];
  noteValue: string;
  onNoteChange: (value: string) => void;
  noteLabel: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  footer?: string;
}

export default function UploadModal({
  title,
  fileName,
  label,
  selectValue,
  onSelectChange,
  options,
  noteValue,
  onNoteChange,
  noteLabel,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
  footer,
}: UploadModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="ui-card w-full max-w-xl rounded-[36px] p-6 shadow-2xl">
        <div className="mb-5">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            فایل انتخاب‌شده: <span className="font-bold">{fileName}</span>
          </p>
        </div>

        <label className="mb-2 block text-sm font-bold">{label}</label>

        <select
          value={selectValue}
          onChange={(e) => onSelectChange(e.target.value)}
          className="ui-select rounded-2xl p-4 text-sm"
        >
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <label className="mb-2 mt-5 block text-sm font-bold">{noteLabel}</label>

        <textarea
          value={noteValue}
          onChange={(e) => onNoteChange(e.target.value)}
          className="ui-textarea h-28 w-full rounded-2xl p-4 leading-8"
          placeholder={placeholder}
        />

        {footer && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            {footer}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="ui-btn ui-btn-primary flex-1 rounded-2xl px-5 py-4"
          >
            {confirmLabel}
          </button>

          <button
            onClick={onCancel}
            className="ui-btn ui-btn-ghost rounded-2xl border-slate-300 px-5 py-4"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
