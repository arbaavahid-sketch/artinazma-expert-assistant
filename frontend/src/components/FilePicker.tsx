"use client";

import { useId, useState, type ChangeEvent } from "react";
import { Paperclip } from "lucide-react";

/**
 * File input with a localized button instead of the browser's own
 * "Choose File" control. The native input stays in the page (visually hidden)
 * so keyboard, screen readers and tests keep working; `label` is its
 * accessible name.
 */
export default function FilePicker({ label, en, accept, disabled, multiple, className = "", showName = true, onChange }: {
  label: string;
  en: boolean;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  /** Off where the page already shows the attached file, so a removed file is not still named here. */
  showName?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  const [chosen, setChosen] = useState("");
  return (
    <div className={`space-y-2 ${className}`}>
      <span className="block">{label}</span>
      <label htmlFor={id} className={`flex flex-wrap items-center gap-3 rounded-xl has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--color-info-text)] ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
        <input id={id} type="file" className="sr-only" aria-label={label} accept={accept} disabled={disabled} multiple={multiple}
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            setChosen(files.map(file => file.name).join("، "));
            onChange(event);
          }} />
        <span aria-hidden="true" className="ui-btn ui-btn-ghost inline-flex items-center gap-2">
          <Paperclip size={16} />{en ? "Choose file" : "انتخاب فایل"}
        </span>
        {showName && <span aria-live="polite" className="min-w-0 truncate text-sm opacity-75">
          {chosen || (en ? "No file selected" : "فایلی انتخاب نشده")}
        </span>}
      </label>
    </div>
  );
}
