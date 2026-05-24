"use client";
/**
 * سیستم Toast notification سراسری
 *
 * استفاده:
 *   import { useToast } from "@/components/Toast";
 *   const { toast } = useToast();
 *   toast("عملیات با موفقیت انجام شد", "success");
 *   toast("خطا در اتصال به سرور", "error");
 *
 * ToastContainer باید یک‌بار در layout یا ArtinShell قرار بگیرد.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let _counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++_counter;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), 3800);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Container */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2"
        dir="rtl"
      >
        {toasts.map((item) => (
          <ToastBubble key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const config: Record<
    ToastType,
    { icon: React.ReactNode; bg: string; text: string; border: string }
  > = {
    success: {
      icon: <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />,
      bg: "bg-white",
      text: "text-slate-800",
      border: "border-emerald-200",
    },
    error: {
      icon: <XCircle size={16} className="shrink-0 text-red-500" />,
      bg: "bg-white",
      text: "text-slate-800",
      border: "border-red-200",
    },
    warning: {
      icon: <AlertCircle size={16} className="shrink-0 text-amber-500" />,
      bg: "bg-white",
      text: "text-slate-800",
      border: "border-amber-200",
    },
    info: {
      icon: <Info size={16} className="shrink-0 text-blue-500" />,
      bg: "bg-white",
      text: "text-slate-800",
      border: "border-blue-200",
    },
  };

  const { icon, bg, text, border } = config[item.type];

  return (
    <div
      className={`pointer-events-auto flex animate-[slideUp_0.25s_ease-out] items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg ${bg} ${border} max-w-sm`}
    >
      {icon}
      <span className={`flex-1 text-sm font-bold leading-6 ${text}`}>
        {item.message}
      </span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-slate-300 hover:text-slate-500"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
