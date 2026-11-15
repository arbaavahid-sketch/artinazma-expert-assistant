"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { apiUrl, customerFetch } from "@/lib/api";
import { usePDFExport } from "./workspace/use-pdf-export";

export type QuickReportPayload = {
  locale: "fa" | "en";
  tool: string;
  title: string;
  category: string;
  formula: string;
  inputs: { label: string; value: string }[];
  results: string[];
  note: string;
};

/** Saves the calculation currently on screen as a one-page record sheet. */
export default function QuickPDFButton({ payload, en }: { payload: QuickReportPayload; en: boolean }) {
  const { savePDF, notice, clearNotice } = usePDFExport(en);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function download() {
    const abort = new AbortController();
    abortRef.current?.abort();
    abortRef.current = abort;
    const timer = setTimeout(() => abort.abort(), 20000);
    setBusy(true);
    setFailed(false);
    clearNotice();
    try {
      const response = await customerFetch(apiUrl("/uncertainty/quick-report.pdf"), {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal, body: JSON.stringify(payload),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw Error();
      const blob = await response.blob();
      if (abort.signal.aborted) return;
      await savePDF(blob, `artin-quick-${payload.tool}-${payload.locale}.pdf`);
    } catch {
      if (abortRef.current === abort) setFailed(true);
    } finally {
      clearTimeout(timer);
      if (abortRef.current === abort) setBusy(false);
    }
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void download()}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 text-sm font-medium disabled:cursor-wait disabled:opacity-60">
        <FileDown size={15} aria-hidden="true" />
        {busy ? (en ? "Preparing PDF…" : "در حال ساخت PDF…") : (en ? "Save as PDF" : "ذخیرهٔ PDF")}
      </button>
      {notice}
      {failed && <p role="alert" className="text-sm">{en ? "The PDF could not be generated. Check the connection and try again." : "PDF ساخته نشد؛ اتصال را بررسی و دوباره تلاش کنید."}</p>}
    </>
  );
}
