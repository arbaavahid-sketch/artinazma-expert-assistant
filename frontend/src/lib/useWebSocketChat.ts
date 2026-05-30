"use client";

import { useCallback, useEffect, useRef, useState } from "react";
/** Read the CSRF cookie set by the backend. */
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)artin_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Fetch a one-time WebSocket ticket from the backend (JWT stays out of URL/logs). */
async function fetchWsTicket(): Promise<string | null> {
  try {
    const csrf = getCsrfToken();
    const res = await fetch("/api/backend/customers/ws-ticket", {
      method: "POST",
      credentials: "include",
      headers: csrf ? { "X-CSRF-Token": csrf } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ticket ?? null;
  } catch {
    return null;
  }
}

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://127.0.0.1:8000";

export type WSStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WSChatMeta {
  detected_domain?: string;
  sources?: string[];
  resource_links?: Array<{ title: string; url: string }>;
  resource_images?: Array<{ url: string; alt?: string }>;
  search_mode?: string;
  web_search_used?: boolean;
  question_intent?: string;
  question_intent_label?: string;
}

interface UseWebSocketChatOptions {
  /** Automatically connect on mount */
  autoConnect?: boolean;
  /** Max reconnect attempts */
  maxRetries?: number;
  /** Reconnect interval in ms */
  retryInterval?: number;
  /** Called when meta arrives */
  onMeta?: (meta: WSChatMeta) => void;
  /** Called for each text chunk */
  onChunk?: (text: string, requestId: string) => void;
  /** Called when response is complete */
  onDone?: (data: { question_id?: number; memory_id?: number; request_id: string }) => void;
  /** Called on errors */
  onError?: (message: string) => void;
  /** Called when typing starts */
  onTypingStart?: () => void;
  /** Called when typing stops */
  onTypingStop?: () => void;
}

export function useWebSocketChat(options: UseWebSocketChatOptions = {}) {
  const {
    autoConnect = false,
    maxRetries = 5,
    retryInterval = 3000,
    onMeta,
    onChunk,
    onDone,
    onError,
    onTypingStart,
    onTypingStop,
  } = options;

  const [status, setStatus] = useState<WSStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdCounterRef = useRef(0);

  // Store latest callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({ onMeta, onChunk, onDone, onError, onTypingStart, onTypingStop });
  callbacksRef.current = { onMeta, onChunk, onDone, onError, onTypingStart, onTypingStop };

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setStatus("connecting");

    // Fetch a one-time ticket so the JWT never appears in the WebSocket URL / server logs.
    fetchWsTicket().then((ticket) => {
    const url = ticket
      ? `${WS_BASE}/ws/chat?ticket=${encodeURIComponent(ticket)}`
      : `${WS_BASE}/ws/chat`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const cb = callbacksRef.current;

        switch (data.type) {
          case "connected":
            break;
          case "ping":
            // Respond with pong
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "pong" }));
            }
            break;
          case "meta":
            cb.onMeta?.(data);
            break;
          case "chunk":
            cb.onChunk?.(data.text, data.request_id || "");
            break;
          case "done":
            cb.onDone?.({
              question_id: data.question_id,
              memory_id: data.memory_id,
              request_id: data.request_id || "",
            });
            break;
          case "typing_start":
            cb.onTypingStart?.();
            break;
          case "typing_stop":
            cb.onTypingStop?.();
            break;
          case "error":
            cb.onError?.(data.message || "Unknown error");
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;

      // Auto-reconnect
      if (retriesRef.current < maxRetries) {
        retriesRef.current++;
        const delay = retryInterval * Math.min(retriesRef.current, 5);
        reconnectTimerRef.current = setTimeout(() => connect(), delay);
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };
    }); // end fetchWsToken().then
  }, [cleanup, maxRetries, retryInterval]);

  const disconnect = useCallback(() => {
    retriesRef.current = maxRetries; // prevent auto-reconnect
    cleanup();
    setStatus("disconnected");
  }, [cleanup, maxRetries]);

  const sendMessage = useCallback(
    (message: string, opts?: { session_id?: string; history?: Array<{ role: string; content: string }> }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        callbacksRef.current.onError?.("WebSocket is not connected");
        return "";
      }

      const requestId = `req_${++requestIdCounterRef.current}_${Date.now()}`;

      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          message,
          request_id: requestId,
          session_id: opts?.session_id,
          history: opts?.history,
        })
      );

      return requestId;
    },
    []
  );

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) connect();
    return () => cleanup();
  }, [autoConnect, connect, cleanup]);

  return {
    status,
    connect,
    disconnect,
    sendMessage,
    isConnected: status === "connected",
  };
}
