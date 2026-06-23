import { useState, useRef, useEffect } from "react";
import { apiUrl, backendFetch } from "@/lib/api";

/**
 * TTS via the backend `/tts` endpoint (OpenAI gpt-4o-mini-tts).
 *
 * A single voice reads Persian + English mixed text naturally, which fixes
 * the old bug where the browser's speechSynthesis grouped utterances by
 * voice and read all English first, then all Persian.
 *
 * Long messages are split into ~600-char chunks at sentence boundaries.
 * Chunks are requested in parallel but played strictly in order, so the
 * first chunk starts playing as soon as it arrives (instead of waiting
 * 60+ seconds for the whole message to be synthesized).
 */
const CHUNK_TARGET = 600;
const CHUNK_MAX = 900;

function splitIntoChunks(text: string): string[] {
  const clean = text.trim();
  if (clean.length <= CHUNK_TARGET) return [clean];

  // Split on sentence-ending punctuation (Persian + Latin), keeping the delimiter.
  const sentences = clean
    .split(/(?<=[.!?؟。…\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (!current) {
      current = s;
    } else if ((current + " " + s).length <= CHUNK_TARGET) {
      current += " " + s;
    } else {
      chunks.push(current);
      current = s;
    }
    // Hard cap: very long single "sentence" — break by length
    while (current.length > CHUNK_MAX) {
      chunks.push(current.slice(0, CHUNK_MAX));
      current = current.slice(CHUNK_MAX);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function useTTS() {
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsNote, setTtsNote] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef<boolean>(false);

  function _cleanup(abort: boolean = true) {
    cancelledRef.current = true;
    if (audioRef.current) {
      // Detach handlers BEFORE clearing src — otherwise setting src=""
      // triggers onerror and surfaces a fake "playback failed" message.
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
    if (abortRef.current) {
      // Only abort if requested — and always pass a reason so Next.js 16's
      // dev overlay doesn't surface "signal is aborted without reason".
      if (abort && !abortRef.current.signal.aborted) {
        abortRef.current.abort(new DOMException("TTS cancelled", "AbortError"));
      }
      abortRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      _cleanup();
    };
  }, []);

  async function _fetchChunk(
    text: string,
    signal: AbortSignal,
  ): Promise<string> {
    const res = await backendFetch(apiUrl("/tts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.detail ?? "";
      } catch {
        // ignore
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  }

  function _playUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (cancelledRef.current) {
        reject(new DOMException("cancelled", "AbortError"));
        return;
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () =>
        reject(new Error("پخش صدا با خطا مواجه شد."));
      audio.play().catch(reject);
    });
  }

  async function speakMessage(text: string, index: number) {
    // Toggle off if the same message is already playing
    if (speakingIndex === index) {
      _cleanup();
      setSpeakingIndex(null);
      return;
    }

    _cleanup();
    cancelledRef.current = false;
    setSpeakingIndex(index);
    setTtsNote("");

    const controller = new AbortController();
    abortRef.current = controller;

    const chunks = splitIntoChunks(text);

    // Kick off all chunk fetches in parallel — they'll generate concurrently
    // on OpenAI's side, but we await them strictly in order for playback.
    // Wrap each result in a Settled-style object so that an abort on one
    // chunk never produces an unhandled rejection on the others (which
    // Next.js dev overlay surfaces as a runtime error).
    type Settled = { ok: true; url: string } | { ok: false; err: unknown };
    const pending: Promise<Settled>[] = chunks.map((c) =>
      _fetchChunk(c, controller.signal).then(
        (url) => ({ ok: true as const, url }),
        (err) => ({ ok: false as const, err }),
      ),
    );

    const _isAbort = (e: unknown): boolean =>
      (e instanceof DOMException &&
        (e.name === "AbortError" || e.message === "cancelled")) ||
      (e instanceof Error && e.name === "AbortError");

    try {
      for (let i = 0; i < pending.length; i++) {
        if (cancelledRef.current) return;
        const result = await pending[i];
        if (cancelledRef.current) return;
        if (!result.ok) {
          if (_isAbort(result.err)) return; // silently — user toggled off
          throw result.err;
        }
        await _playUrl(result.url);
      }
      // Normal end — no abort needed, all fetches already completed.
      _cleanup(false);
      setSpeakingIndex(null);
    } catch (err: unknown) {
      if (_isAbort(err)) return;
      _cleanup();
      setSpeakingIndex(null);
      const msg = err instanceof Error ? err.message : "خطا در تولید صدا.";
      setTtsNote(`خطا در سرویس صدا: ${msg}`);
      setTimeout(() => setTtsNote(""), 8000);
    }
  }

  return { speakingIndex, ttsNote, setTtsNote, speakMessage };
}
