"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { WSStatus } from "@/lib/useWebSocketChat";

interface Props {
  status: WSStatus;
  onReconnect?: () => void;
}

function getStatusMap(isEn: boolean): Record<WSStatus, { label: string; color: string; icon: React.ReactNode }> {
  return {
    connected: {
      label: isEn ? "Connected" : "متصل",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <Wifi className="w-3.5 h-3.5" />,
    },
    connecting: {
      label: isEn ? "Connecting..." : "در حال اتصال...",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    },
    disconnected: {
      label: isEn ? "Disconnected" : "قطع شده",
      color: "bg-gray-50 text-gray-500 border-gray-200",
      icon: <WifiOff className="w-3.5 h-3.5" />,
    },
    error: {
      label: isEn ? "Connection Error" : "خطا در اتصال",
      color: "bg-red-50 text-red-600 border-red-200",
      icon: <WifiOff className="w-3.5 h-3.5" />,
    },
  };
}

export default function WSConnectionBadge({ status, onReconnect }: Props) {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const info = getStatusMap(isEn)[status];
  const clickable = status !== "connected" && status !== "connecting";

  return (
    <button
      onClick={clickable ? onReconnect : undefined}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${info.color} ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
      title={status !== "connected" ? (isEn ? "Click to reconnect" : "کلیک برای اتصال مجدد") : (isEn ? "WebSocket connected" : "اتصال WebSocket برقرار است")}
    >
      {info.icon}
      {info.label}
    </button>
  );
}
