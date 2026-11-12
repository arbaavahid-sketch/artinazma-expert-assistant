"use client";

import {reportFontCSS} from '@/lib/report-font';
import { useState } from "react";
import { apiUrl, backendRequestUrl, getCsrfToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import WorkspaceSectionHeader from "@/components/WorkspaceSectionHeader";
import styles from "@/components/workspace-pages.module.css";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  UploadCloud,
  FileDown,
} from "lucide-react";

const testTypes = [
  { value: "general", fa: "گزارش عمومی آزمایشگاهی", en: "General laboratory report" },
  { value: "catalyst", fa: "تست کاتالیست", en: "Catalyst test" },
  { value: "chromatography", fa: "کروماتوگرافی GC/HPLC", en: "GC/HPLC chromatography" },
  { value: "mercury", fa: "آنالیز جیوه", en: "Mercury analysis" },
  { value: "sulfur", fa: "آنالیز سولفور", en: "Sulfur analysis" },
  { value: "metals", fa: "آنالیز عنصری / فلزات", en: "Elemental / metals analysis" },
];

const imageTypes = [
  { value: "general", fa: "تصویر عمومی", en: "General image" },
  { value: "device-error", fa: "خطای دستگاه", en: "Device error" },
  { value: "chromatogram", fa: "کروماتوگرام", en: "Chromatogram" },
  { value: "chart", fa: "نمودار تست", en: "Test chart" },
  { value: "software-screen", fa: "صفحه نرم‌افزار دستگاه", en: "Instrument software screen" },
  { value: "lab-report", fa: "گزارش تصویری آزمایشگاهی", en: "Visual lab report" },
];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

function isImageFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.includes(ext);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const PROGRESS_STEPS_IMAGE = [
  "در حال آپلود تصویر…",
  "استخراج متن با OCR…",
  "ارسال به آرتین برای تحلیل…",
  "در حال تحلیل تخصصی…",
];
const PROGRESS_STEPS_FILE = [
  "در حال آپلود فایل…",
  "پردازش و خواندن داده‌ها…",
  "ارسال به آرتین برای تحلیل…",
  "در حال تحلیل تخصصی…",
];

function friendlyError(raw: string): string {
  if (!raw) return "خطای ناشناخته رخ داد.";
  if (raw.includes("Connection") || raw.includes("RemoteDisconnected"))
    return "اتصال به سرویس هوش مصنوعی برقرار نشد. لطفاً چند ثانیه صبر کنید و دوباره امتحان کنید.";
  if (raw.includes("timeout") || raw.includes("Timeout"))
    return "زمان پاسخ سرویس هوش مصنوعی به پایان رسید. لطفاً دوباره امتحان کنید.";
  if (raw.includes("فرمت") || raw.includes("پشتیبانی نمی‌شود"))
    return raw;
  if (raw.startsWith("خطا در تحلیل"))
    return raw.replace(/^خطا در تحلیل (تصویر|فایل): /, "مشکل در تحلیل: ");
  return raw;
}


// ─── Markdown → React renderer ────────────────────────────────────────────────
function AnalysisRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  function parseInline(raw: string): React.ReactNode {
    // Bold **text**
    const parts = raw.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, idx) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={idx} className="font-black text-[var(--foreground)]">{p.slice(2, -2)}</strong>
        : p
    );
  }

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Horizontal rule
    if (/^[-─═]{3,}$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-4 border-[var(--border-soft)]" />);
      i++; continue;
    }

    // Header ##
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const cls = level === 1
        ? "text-xl font-black text-[var(--foreground)] mt-5 mb-2 border-b border-[var(--border-soft)] pb-1"
        : level === 2
        ? "text-lg font-black text-[var(--foreground)] mt-4 mb-1"
        : "text-base font-black text-[var(--text-muted)] mt-3 mb-1";
      elements.push(<div key={i} className={cls}>{parseInline(hMatch[2])}</div>);
      i++; continue;
    }

    // Markdown table
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i+1].trim().startsWith("|---")) {
      const headers = line.split("|").filter(c => c.trim()).map(c => c.trim());
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].split("|").filter(c => c.trim()).map(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={`tbl-${i}`} className="my-4 overflow-x-auto rounded-2xl border border-[var(--border-soft)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-soft)]">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-4 py-2.5 text-right font-black text-[var(--text-muted)] border-b border-[var(--border-soft)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-[var(--surface)]" : "bg-[var(--surface-soft)]/70"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-right text-[var(--text-muted)] border-b border-[var(--border-soft)]">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[-•*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-•*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pr-4">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-[var(--text-muted)] leading-8">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 pr-4">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-[var(--text-muted)] leading-8">
              <span className="shrink-0 font-black text-[var(--color-success-text)]">{ii + 1}.</span>
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="leading-9 text-[var(--text-muted)]">{parseInline(line)}</p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

export default function AnalyzePage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const progressStepsImage = isEn
    ? ["Uploading image...", "Extracting text with OCR...", "Sending to Artin for analysis...", "Running specialized analysis..."]
    : PROGRESS_STEPS_IMAGE;
  const progressStepsFile = isEn
    ? ["Uploading file...", "Processing and reading data...", "Sending to Artin for analysis...", "Running specialized analysis..."]
    : PROGRESS_STEPS_FILE;
  const [analysisSources,setAnalysisSources]=useState<{id:number;name:string}[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [testType, setTestType] = useState("general");
  const [imageType, setImageType] = useState("general");
  const [userNote, setUserNote] = useState("");
  const [fileAnalysis, setFileAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [resultType, setResultType] = useState<"success" | "error" | "">("");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [followUpQ, setFollowUpQ] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpHistory, setFollowUpHistory] = useState<{q: string; a: string}[]>([]);

  const ALLOWED_EXTS = [...IMAGE_EXTS, "xlsx", "xls", "csv", "pdf"];
  const allImages = files.length > 0 && files.every(isImageFile);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid = arr.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ALLOWED_EXTS.includes(ext);
    });
    const invalid = arr.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return !ALLOWED_EXTS.includes(ext);
    });
    if (invalid.length) {
      setResultType("error");
      setFileAnalysis(isEn ? `Unsupported format: ${invalid.map((f) => f.name).join(", ")}` : `فرمت پشتیبانی نمی‌شود: ${invalid.map((f) => f.name).join(", ")}`);
    }
    const next = [...files, ...valid].slice(0, 5); // max 5 files
    setFiles(next);
    setFileAnalysis("");setAnalysisSources([]);
    setResultType("");
    setFollowUpHistory([]);

    // generate previews for images
    const previews: string[] = [];
    next.forEach((f, i) => {
      if (isImageFile(f)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previews[i] = e.target?.result as string;
          if (previews.filter(Boolean).length === next.filter(isImageFile).length) {
            setImagePreviews([...previews]);
          }
        };
        reader.readAsDataURL(f);
      }
    });
    if (!next.some(isImageFile)) setImagePreviews([]);
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  async function analyzeSingleFile(f: File, idx: number, total: number): Promise<string> {
    const img = isImageFile(f);
    const steps = img ? progressStepsImage : progressStepsFile;
    setProgressLabel(isEn ? `File ${idx + 1} of ${total}: ${f.name}` : `فایل ${idx + 1} از ${total}: ${f.name}`);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, img ? 4000 : 2500);

    const formData = new FormData();
    formData.append("file", f);
    formData.append("user_note", userNote);
    const endpoint = img ? "/analyze-image" : "/analyze-file";
    if (img) formData.append("image_type", imageType);
    else formData.append("test_type", testType);

    setUploadPercent(0);
    try {
      const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", backendRequestUrl(apiUrl(endpoint)));
        xhr.withCredentials = true;
        const csrfToken = getCsrfToken();
        if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadPercent(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          setUploadPercent(100);
          if (xhr.status === 401 || xhr.status === 403) {
            window.location.href = "/customer-login?next=/analyze";
            reject(new Error("Please sign in to analyze files."));
            return;
          }
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Invalid JSON")); }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(formData);
      });
      clearInterval(interval);
      if(typeof data.question_id==='number'&&data.ai_analysis)setAnalysisSources(prev=>[...prev,{id:data.question_id as number,name:f.name}]);
      if (data.ai_analysis) return data.ai_analysis as string;
      if (data.error) return isEn ? `⚠️ Error: ${data.error as string}` : `⚠️ خطا: ${friendlyError(data.error as string)}`;
      return JSON.stringify(data, null, 2);
    } catch {
      clearInterval(interval);
      return isEn
        ? "⚠️ Could not connect to the analysis server. Make sure the backend is running on port 8000 and try again."
        : "⚠️ اتصال به سرور تحلیل برقرار نشد. مطمئن شوید بک‌اند روی پورت 8000 اجراست و دوباره امتحان کنید.";
    }
  }

  async function uploadFile() {
    if (!files.length) return;
    setLoading(true);
    setFileAnalysis("");
    setResultType("");
    setFollowUpHistory([]);

    const results: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await analyzeSingleFile(files[i], i, files.length);
      results.push(
        files.length > 1
          ? `${isEn ? "File" : "فایل"} ${i + 1}: ${files[i].name}\n${result}`
          : result
      );
    }

    const combined = results.join("\n\n");
    const hasError = combined.includes("⚠️");
    setResultType(hasError && results.every((r) => r.includes("⚠️")) ? "error" : "success");
    setFileAnalysis(combined);
    setLoading(false);
    setProgressLabel("");
    setUploadPercent(0);
  }

  async function copyResult() {
    if (!fileAnalysis) return;
    await navigator.clipboard.writeText(fileAnalysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportPDF() {
    if (!fileAnalysis) return;
    const now = new Date().toLocaleString(isEn ? "en-US" : "fa-IR");
    const fileNames = files.map((f) => f.name).join(isEn ? ", " : "، ");
    const html = `<!DOCTYPE html>
<html dir="${isEn ? "ltr" : "rtl"}" lang="${isEn ? "en" : "fa"}">
<head>
<meta charset="utf-8"/>
<title>${isEn ? "Artin analysis report" : "گزارش تحلیل آرتین"}</title>
<style>${reportFontCSS}
  body { font-family:Vazir,Tahoma,Arial,sans-serif; padding: 40px; color: #1e293b; line-height: 2; direction: ${isEn ? "ltr" : "rtl"}; }
  h1 { font-size: 22px; font-weight: 900; color: #065f46; border-bottom: 2px solid #065f46; padding-bottom: 10px; }
  .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
  .content { white-space: pre-wrap; font-size: 14px; background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
  .followup { margin-top: 32px; }
  .followup h2 { font-size: 16px; font-weight: 900; color: #1e293b; }
  .q { background: #f1f5f9; border-radius: 10px; padding: 10px 14px; margin-top: 12px; font-weight: 700; font-size: 13px; }
  .a { background: #ecfdf5; border-radius: 10px; padding: 10px 14px; margin-top: 6px; font-size: 13px; white-space: pre-wrap; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>${isEn ? "Artin specialized analysis report" : "گزارش تحلیل تخصصی آرتین"}</h1>
<div class="meta">
  <div>${isEn ? "Date" : "تاریخ"}: ${now}</div>
  <div>${isEn ? "Files" : "فایل‌ها"}: ${fileNames}</div>
</div>
<div class="content">${fileAnalysis.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
${followUpHistory.length ? `
<div class="followup">
  <h2>${isEn ? "Follow-up questions" : "سوالات پیگیری"}</h2>
  ${followUpHistory.map((item) => `
    <div class="q">${isEn ? "Question" : "سوال"}: ${item.q.replace(/</g, "&lt;")}</div>
    <div class="a">${item.a.replace(/</g, "&lt;")}</div>
  `).join("")}
</div>` : ""}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  function exportWord() {
    if (!fileAnalysis) return;
    const now = new Date().toLocaleString(isEn ? "en-US" : "fa-IR");
    const fileNames = files.map((f) => f.name).join(isEn ? ", " : "، ");
    const htmlBody = fileAnalysis
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/^#{3}\s+(.+)/gm, "<h3>$1</h3>")
      .replace(/^#{2}\s+(.+)/gm, "<h2>$1</h2>")
      .replace(/^#{1}\s+(.+)/gm, "<h1>$1</h1>")
      .replace(/\n/g, "<br/>");
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset='utf-8'/><style>${reportFontCSS}
  body{font-family:Vazir,Tahoma,Arial,sans-serif;direction:${isEn ? "ltr" : "rtl"};padding:40px;font-size:13pt;}
  h1,h2,h3{color:#065f46;} table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #ccc;padding:6px 10px;}
</style></head>
<body>
<h1>${isEn ? "ArtinAzma analysis report" : "گزارش تحلیل آرتین آزما"}</h1>
<p><b>${isEn ? "Date" : "تاریخ"}:</b> ${now} &nbsp;&nbsp; <b>${isEn ? "Files" : "فایل‌ها"}:</b> ${fileNames}</p>
<hr/>
${htmlBody}
</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artin-analysis.doc";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendFollowUp() {
    if (!followUpQ.trim() || !fileAnalysis) return;
    const question = followUpQ.trim();
    setFollowUpLoading(true);
    setFollowUpQ("");

    const fileNames = files.map((f) => f.name).join(isEn ? ", " : "، ");
    // Build context: file analysis result as system context
    const context = isEn
      ? `Artin, the following file(s) were uploaded by the user and already analyzed:\nFile name(s): ${fileNames}\n\nAnalysis summary:\n${fileAnalysis.slice(0, 3000)}`
      : `آرتین، فایل(های) زیر توسط کاربر آپلود و قبلاً تحلیل شده‌اند:\nنام فایل: ${fileNames}\n\nخلاصه تحلیل:\n${fileAnalysis.slice(0, 3000)}`;

    // Build conversation history from previous follow-up exchanges
    const history = followUpHistory.flatMap((item) => [
      { role: "user", content: item.q },
      { role: "assistant", content: item.a },
    ]);

    try {
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, context, history }),
      });
      const data = await res.json();
      const answer = data.answer || data.response || (isEn ? "No answer received." : "پاسخی دریافت نشد.");
      setFollowUpHistory((prev) => [...prev, { q: question, a: answer }]);
    } catch {
      setFollowUpHistory((prev) => [...prev, { q: question, a: isEn ? "Error receiving the answer." : "خطا در دریافت پاسخ." }]);
    } finally {
      setFollowUpLoading(false);
    }
  }

  return (
    <section className={styles.page} dir={dir}>
      <div className="mx-auto max-w-7xl">
        <WorkspaceSectionHeader icon={FlaskConical}
          label={isEn ? "Laboratory data" : "داده‌های آزمایشگاهی"}
          title={isEn ? "Specialized test file analysis with Artin" : "تحلیل تخصصی فایل تست با آرتین"}
          description={isEn ? "Add your files, describe the sample and review the analysis in the same workspace." : "فایل‌ها را اضافه کنید، اطلاعات نمونه را بنویسید و نتیجه را در همین صفحه ببینید."}
        >
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={isEn ? "Supported formats" : "فرمت‌های قابل تحلیل"}>
            {["PDF", "Excel", "CSV", "JPG", "PNG"].map((format) => (
              <li key={format} className={styles.chip} dir="ltr">{format}</li>
            ))}
          </ul>
        </WorkspaceSectionHeader>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className={`${styles.panel} p-4 sm:p-5`}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                  <UploadCloud size={25} />
                </div>

                <div>
                  <h2 className="text-xl">
                    {isEn ? "Files and sample details" : "فایل‌ها و مشخصات نمونه"}
                  </h2>
                  <p className={`${styles.muted} mt-1 text-sm`}>
                    {isEn ? "Specify the test type and sample notes." : "نوع تست و توضیحات نمونه را مشخص کنید."}
                  </p>
                </div>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`${styles.dropZone} text-center`}
                data-dragging={isDragging}
              >
                <label className="group block cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                    className="sr-only"
                  />
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] text-[var(--color-success-text)] shadow-sm transition group-hover:scale-105">
                    <UploadCloud size={26} />
                  </div>
                  <div className="font-bold">
                    {isDragging ? (isEn ? "Drop files..." : "رها کنید…") : (isEn ? "Select files or drop them here" : "فایل‌ها را انتخاب یا اینجا رها کنید")}
                  </div>
                  <div className={`${styles.muted} mt-1 text-sm`}>
                    {isEn ? "PDF, Excel, CSV, or image — up to 5 files together" : "PDF، Excel، CSV یا تصویر — تا ۵ فایل با هم"}
                  </div>
                </label>
              </div>

              {/* image previews grid */}
              {imagePreviews.filter(Boolean).length > 0 && (
                <div className={`mt-3 grid gap-2 ${imagePreviews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {imagePreviews.map((src, i) => src && (
                    <div key={i} className="overflow-hidden rounded-[18px] border border-[var(--color-success-border)] bg-[var(--color-success-bg)]">
                      <img src={src} alt={`preview-${i}`} className="max-h-36 w-full object-contain" />
                    </div>
                  ))}
                </div>
              )}

              {/* file list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3">
                      {isImageFile(f)
                        ? <ImageIcon size={18} className="shrink-0 text-[var(--color-success-text)]" />
                        : <FileSpreadsheet size={18} className="shrink-0 text-[var(--color-success-text)]" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[var(--foreground)]">{f.name}</div>
                        <div className="text-xs text-[var(--text-subtle)]">{formatFileSize(f.size)}</div>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="shrink-0 rounded-xl p-1 text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label htmlFor="analysis-kind" className="mb-2 mt-4 block text-sm font-bold">
                {allImages ? (isEn ? "Image type" : "نوع تصویر") : (isEn ? "Test or report type" : "نوع تست یا گزارش")}
              </label>

              {allImages ? (
                <select id="analysis-kind" value={imageType} onChange={(e) => setImageType(e.target.value)}
                  className="ui-select rounded-2xl p-4 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]">
                  {imageTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item[locale]}</option>
                  ))}
                </select>
              ) : (
                <select id="analysis-kind" value={testType} onChange={(e) => setTestType(e.target.value)}
                  className="ui-select rounded-2xl p-4 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]">
                  {testTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item[locale]}</option>
                  ))}
                </select>
              )}

              <label htmlFor="analysis-note" className="mb-2 mt-5 block text-sm font-bold">
                {isEn ? "Optional note about the sample or test conditions" : "توضیح اختیاری درباره نمونه یا شرایط تست"}
              </label>
              <textarea
                id="analysis-note"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                className="ui-textarea h-28 resize-none rounded-2xl p-4 leading-8 focus:border-emerald-600 focus:shadow-[0_0_0_4px_rgba(5,150,105,0.12)]"
                placeholder={isEn ? "Example: The sample is LPG and the goal is checking sulfur compounds..." : "مثلاً: نمونه LPG است، هدف بررسی ترکیبات گوگردی است..."}
              />

              <button
                onClick={uploadFile}
                disabled={loading || !files.length}
                className="ui-btn mt-5 w-full gap-2 rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-700 px-5 py-4 text-white shadow-lg shadow-emerald-700/15 transition hover:from-emerald-800 hover:to-teal-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Beaker size={18} />}
                {loading
                  ? (isEn ? `Analyzing ${files.length > 1 ? `(${files.length} files)` : ""}...` : `در حال تحلیل ${files.length > 1 ? `(${files.length} فایل)` : ""}…`)
                  : (isEn ? `Start analysis${files.length > 1 ? ` (${files.length} files)` : ""}` : `شروع تحلیل${files.length > 1 ? ` (${files.length} فایل)` : " تخصصی"}`)
                }
              </button>
            </div>

            <details className={`${styles.panel} p-4 sm:p-5`}>
              <summary className="cursor-pointer text-sm font-bold">
                {isEn ? "Tips for more accurate analysis" : "نکات تحلیل دقیق‌تر"}
              </summary>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                  <ShieldCheck size={21} />
                </div>
                <h3 className="text-lg">
                  {isEn ? "Tips for more accurate analysis" : "نکات بهتر برای تحلیل دقیق‌تر"}
                </h3>
              </div>

              <div className="space-y-3 text-sm leading-7 text-[var(--text-muted)]">
                <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
                  {isEn ? "Write the sample type, matrix, and test goal in the notes." : "نوع نمونه، ماتریس و هدف آزمون را در توضیحات بنویسید."}
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
                  {isEn ? "For instrument photos, choose the proper image type from the menu above." : "برای عکس دستگاه، نوع تصویر مناسب را از منوی بالا انتخاب کنید."}
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
                  {isEn ? "If the file is a chromatogram or QC file, add the instrument type and test method." : "اگر فایل کروماتوگرام یا QC است، نوع دستگاه و روش آزمون را اضافه کنید."}
                </div>
                <div className="rounded-2xl bg-[var(--surface-soft)] p-3">
                  {isEn ? "For final decisions, review the result against real laboratory conditions." : "برای تصمیم نهایی، نتیجه باید با شرایط واقعی آزمایشگاه بررسی شود."}
                </div>
              </div>
            </details>
          </aside>

          <div className={`${styles.panel} min-w-0 self-start p-4 sm:p-5`}>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--text-muted)]">
                  <FileText size={25} />
                </div>

                <div>
                  <h2 className="text-xl">
                    {isEn ? "Analysis result" : "نتیجه تحلیل"}
                  </h2>
                  <p className={`${styles.muted} mt-1 text-sm`}>
                    {isEn ? "Artin's specialized output will appear here after file analysis." : "خروجی تخصصی آرتین بعد از تحلیل فایل اینجا نمایش داده می‌شود."}
                  </p>
                </div>
              </div>

              {fileAnalysis && resultType === "success" && (
                <div className="flex gap-2">
                  <button
                    onClick={copyResult}
                    className={`ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm transition-all ${copied ? "text-[var(--color-success-text)]" : ""}`}
                  >
                    {copied ? <CheckCircle2 size={16} /> : <ClipboardCopy size={16} />}
                    {copied ? (isEn ? "Copied!" : "کپی شد!") : (isEn ? "Copy" : "کپی")}
                  </button>
                  <button
                    onClick={exportPDF}
                    className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm"
                  >
                    <Download size={16} />
                    PDF
                  </button>
                  <button
                    onClick={exportWord}
                    className="ui-btn ui-btn-ghost gap-2 rounded-2xl px-4 py-2 text-sm"
                  >
                    <FileDown size={16} />
                    Word
                  </button>
                </div>
              )}
            </div>

            {!fileAnalysis && !loading && (
              <div className={styles.empty}>
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface)] text-[var(--color-success-text)] shadow-sm">
                    <FileText size={30} aria-hidden="true" />
                  </div>

                  <h3 className="text-lg">
                    {isEn ? "No analysis has been run yet" : "هنوز تحلیلی انجام نشده است"}
                  </h3>

                  <p className="mt-3 max-w-md leading-8 text-[var(--text-subtle)]">
                    {isEn
                      ? "Add your files and start the analysis. The report and export controls will appear here."
                      : "فایل‌ها را اضافه کنید و تحلیل را شروع کنید. گزارش و گزینه‌های دریافت آن اینجا نمایش داده می‌شوند."}
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[520px] items-center justify-center rounded-[28px] bg-[var(--surface-soft)] p-8 text-center">
                <div className="w-full max-w-sm">
                  <Loader2 size={34} className="mx-auto mb-5 animate-spin text-[var(--color-success-text)]" />
                  <h3 className="text-lg font-black text-[var(--foreground)]">
                    {isEn ? "Artin is analyzing..." : "آرتین در حال تحلیل است…"}
                  </h3>
                  {progressLabel && (
                    <p className="mt-1 text-sm text-[var(--text-subtle)]">{progressLabel}</p>
                  )}
                  {uploadPercent > 0 && uploadPercent < 100 && (
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs font-bold text-[var(--text-subtle)]">
                        <span>{isEn ? "File upload" : "آپلود فایل"}</span>
                        <span>{uploadPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                          style={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-6 space-y-2">
                    {(allImages ? progressStepsImage : progressStepsFile).map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                          i < progressStep
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                            : i === progressStep
                            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                            : "text-[var(--text-subtle)]"
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                          i < progressStep
                            ? "bg-emerald-600 text-white"
                            : i === progressStep
                            ? "bg-[var(--foreground)] text-[var(--background)]"
                            : "bg-[var(--border-soft)] text-[var(--text-subtle)]"
                        }`}>
                          {i < progressStep ? "✓" : i + 1}
                        </span>
                        {step}
                        {i === progressStep && (
                          <Loader2 size={14} className="mr-auto animate-spin text-[var(--color-success-text)]" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {fileAnalysis && (
              <>
                {analysisSources.map(source=><a className="my-3 block rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-4 font-bold text-[var(--color-info-text)]" key={source.id} href={`/laboratory-imports?analysis=${source.id}`}>{isEn?'Review data and calculate':'بررسی داده‌ها و اجرای محاسبه'} · {source.name}</a>)}
                <div
                  className={`rounded-[28px] border p-6 leading-9 shadow-inner ${
                    resultType === "error"
                      ? "border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                      : "border-[var(--border-soft)] bg-[var(--surface-soft)]/90 text-[var(--foreground)]"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-2 text-sm font-black">
                    {resultType === "error" ? (
                      <>
                        <AlertCircle size={18} />
                        {isEn ? "Analysis error" : "خطا در تحلیل"}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="text-[var(--color-success-text)]" />
                        {isEn ? "Analysis is ready" : "تحلیل آماده شد"}
                      </>
                    )}
                  </div>
                  {resultType === "error"
                    ? <p className="leading-9 text-[var(--color-danger-text)]">{fileAnalysis}</p>
                    : <AnalysisRenderer text={fileAnalysis} />
                  }
                </div>

                {resultType === "success" && (
                  <div className="mt-6 rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div className="font-black text-[var(--foreground)]">{isEn ? "Follow-up question" : "سوال پیگیری"}</div>
                        <div className="text-sm text-[var(--text-subtle)]">{isEn ? "Ask Artin about this result" : "درباره این نتیجه از آرتین بپرسید"}</div>
                      </div>
                    </div>

                    {followUpHistory.map((item, i) => (
                      <div key={i} className="mb-4 space-y-2">
                        <div className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--text-muted)]">
                          {item.q}
                        </div>
                        <div className="whitespace-pre-wrap rounded-2xl bg-[var(--color-success-bg)] px-4 py-3 text-sm leading-8 text-[var(--foreground)]">
                          {item.a}
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <textarea
                        value={followUpQ}
                        onChange={(e) => setFollowUpQ(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendFollowUp();
                          }
                        }}
                        placeholder={isEn ? "Example: Is this result acceptable for the ASTM standard?" : "مثلاً: این نتیجه برای استاندارد ASTM قابل قبوله؟"}
                        className="ui-textarea h-14 flex-1 resize-none rounded-2xl p-3 text-sm leading-7 focus:border-emerald-600"
                        disabled={followUpLoading}
                      />
                      <button
                        onClick={sendFollowUp}
                        disabled={followUpLoading || !followUpQ.trim()}
                        className="ui-btn flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow disabled:opacity-40"
                      >
                        {followUpLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[26px] border border-[var(--color-info-border)] bg-[var(--color-info-bg)]/90 p-5 text-sm leading-8 text-[var(--color-info-text)] shadow-sm">
          {isEn
            ? "This file is used only for temporary analysis and is not added to ArtinAzma's internal knowledge base unless an expert later approves and registers it."
            : "این فایل فقط برای تحلیل موقت استفاده می‌شود و به بانک دانش داخلی آرتین آزما اضافه نمی‌شود، مگر اینکه کارشناس بعداً آن را تایید و ثبت کند."}
        </div>
      </div>
    </section>
  );
}
