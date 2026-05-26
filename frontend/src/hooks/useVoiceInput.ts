"use client";
/**
 * هوک ورودی صوتی — ضبط صدا با MediaRecorder و رونوشت با OpenAI Whisper.
 */

import { useState, useRef, useCallback } from "react";

type VoiceState = "idle" | "listening" | "processing" | "unsupported";

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isSupported =
    typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
    // transcription happens in onstop
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) { setVoiceState("unsupported"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceState("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const ext = mimeType.includes("ogg") ? "ogg" : "webm";
          const formData = new FormData();
          formData.append("file", blob, `recording.${ext}`);
          const res = await fetch(
            (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000") + "/transcribe",
            { method: "POST", body: formData }
          );
          if (res.ok) {
            const data = await res.json() as { transcript?: string };
            if (data.transcript?.trim()) onTranscript(data.transcript.trim());
          }
        } catch (err) {
          console.error("Whisper transcription failed:", err);
        } finally {
          setVoiceState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState("listening");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        alert("دسترسی به میکروفون رد شده. لطفاً از تنظیمات مرورگر مجوز میکروفون را فعال کنید.");
      }
      setVoiceState("idle");
    }
  }, [isSupported, onTranscript]);

  const toggleVoice = useCallback(() => {
    if (voiceState === "listening") stopAndTranscribe();
    else if (voiceState === "idle") startListening();
  }, [voiceState, startListening, stopAndTranscribe]);

  return { voiceState, toggleVoice, isSupported };
}

export type { VoiceState };
