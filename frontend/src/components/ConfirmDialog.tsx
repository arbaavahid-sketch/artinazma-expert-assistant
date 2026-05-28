"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: async () => false,
});

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    setOpen(false);
    resolveRef.current(true);
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current(false);
  }

  const iconColor =
    options.variant === "danger"
      ? "text-red-500"
      : options.variant === "warning"
      ? "text-amber-500"
      : "text-blue-500";

  const iconBg =
    options.variant === "danger"
      ? "bg-red-50"
      : options.variant === "warning"
      ? "bg-amber-50"
      : "bg-blue-50";

  const confirmBtnClass =
    options.variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : options.variant === "warning"
      ? "bg-amber-500 hover:bg-amber-600 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {open && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900">
            <div className="p-6">
              {/* Icon */}
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}
              >
                {options.variant === "danger" ? (
                  <Trash2 size={22} className={iconColor} />
                ) : (
                  <AlertTriangle size={22} className={iconColor} />
                )}
              </div>

              {/* Title */}
              {options.title && (
                <h3 className="mb-2 text-lg font-black text-slate-900 dark:text-white">
                  {options.title}
                </h3>
              )}

              {/* Message */}
              <p className="leading-7 text-slate-600 dark:text-slate-300">
                {options.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                onClick={handleCancel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X size={15} />
                {options.cancelLabel || (isEn ? "Cancel" : "انصراف")}
              </button>
              <button
                onClick={handleConfirm}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-bold shadow-sm transition ${confirmBtnClass}`}
              >
                                {options.confirmLabel || (isEn ? "Confirm" : "تایید")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
