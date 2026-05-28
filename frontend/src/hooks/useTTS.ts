import { useState, useRef } from "react";

export function useTTS() {
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsNote, setTtsNote] = useState<string>("");
  const _ttsKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function _clearTtsKeepAlive() {
    if (_ttsKeepAliveRef.current) {
      clearInterval(_ttsKeepAliveRef.current);
      _ttsKeepAliveRef.current = null;
    }
  }

  function speakMessage(text: string, index: number) {
    if (!("speechSynthesis" in window)) {
      setTtsNote("مرورگر شما از قابلیت خواندن متن پشتیبانی نمی‌کند.");
      setTimeout(() => setTtsNote(""), 5000);
      return;
    }

    // Toggle off if already speaking this message
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      _clearTtsKeepAlive();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    _clearTtsKeepAlive();

    // Strip markdown for cleaner TTS
    const clean = text
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[-*_]{3,}/g, "")
      .replace(/\|/g, " ")
      .replace(/\n+/g, ". ")
      .trim()
      .slice(0, 4000);

    // Split text into Persian/Arabic vs Latin segments for bilingual TTS
    // Only switch voice for long English phrases (>15 chars with spaces).
    // Short terms like GC, XRF, HPLC stay in the Persian segment.
    const segments: { text: string; isLatin: boolean }[] = [];
    const segmentRegex = /([A-Za-z][A-Za-z0-9\s.,;:!?\'\"/()\-/%@#+*=<>{}\[\]~^&$_\\|]*)|([^A-Za-z]+)/g;
    let match: RegExpExecArray | null;
    while ((match = segmentRegex.exec(clean)) !== null) {
      const segText = match[0].trim();
      if (!segText) continue;
      const isLatin = Boolean(match[1]) && segText.length > 15 && segText.includes(" ");
      if (segments.length > 0 && segments[segments.length - 1].isLatin === isLatin) {
        segments[segments.length - 1].text += " " + segText;
      } else {
        segments.push({ text: segText, isLatin });
      }
    }
    if (segments.length === 0) {
      segments.push({ text: clean, isLatin: false });
    }

    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      const faVoice =
        voices.find((v) => v.lang.startsWith("fa")) ||
        voices.find((v) => v.lang.startsWith("ar")) ||
        null;
      const enVoice =
        voices.find((v) => v.lang.startsWith("en") && v.lang.includes("US")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        null;
      const fallbackVoice = voices.find((v) => v.default) || voices[0] || null;

      const utterances: SpeechSynthesisUtterance[] = segments.map((seg) => {
        const utter = new SpeechSynthesisUtterance(seg.text);
        if (seg.isLatin) {
          const voice = enVoice || fallbackVoice;
          if (voice) utter.voice = voice;
          utter.lang = voice?.lang ?? "en-US";
          utter.rate = 0.9;
        } else {
          const voice = faVoice || fallbackVoice;
          if (voice) utter.voice = voice;
          utter.lang = voice?.lang ?? "fa-IR";
          utter.rate = 0.85;
        }
        utter.pitch = 1;
        return utter;
      });

      if (utterances.length === 0) return;

      utterances[0].onstart = () => setTtsNote("");

      const lastUtter = utterances[utterances.length - 1];
      lastUtter.onend = () => {
        _clearTtsKeepAlive();
        setSpeakingIndex(null);
      };
      lastUtter.onerror = (e) => {
        _clearTtsKeepAlive();
        setSpeakingIndex(null);
        if (e.error !== "interrupted") {
          setTtsNote(
            "صدای فارسی روی سیستم شما نصب نیست. برای نصب: Settings → Time & Language → Speech → Add voices → Persian"
          );
          setTimeout(() => setTtsNote(""), 12000);
        }
      };

      setSpeakingIndex(index);
      for (const u of utterances) {
        window.speechSynthesis.speak(u);
      }

      _ttsKeepAliveRef.current = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          _clearTtsKeepAlive();
          setSpeakingIndex(null);
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 10000);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak(window.speechSynthesis.getVoices());
      };
      setTimeout(() => {
        const v = window.speechSynthesis.getVoices();
        if (v.length > 0) doSpeak(v);
      }, 600);
    }
  }

  return { speakingIndex, ttsNote, speakMessage };
}
