import { useState } from "react";
import type { ChatMessage } from "@/lib/chat-types";

export function useExportChat(messages: ChatMessage[]) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  function _buildExportHtml(forWord: boolean): string {
    const now = new Date().toLocaleDateString("fa-IR", {
      year: "numeric", month: "long", day: "numeric",
    });
    const msgHtml = messages.map((msg) => {
      if (msg.role === "user") {
        const attachLine = msg.attachment
          ? `<div class="attachment">📎 پیوست: ${msg.attachment.name}</div>`
          : "";
        const body = msg.content
          ? `<p>${msg.content.replace(/\n/g, "<br/>")}</p>`
          : "";
        return `<div class="bubble user"><div class="label">کاربر</div>${attachLine}${body}</div>`;
      } else {
        const safe = msg.content
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/^#{1,3}\s+(.+)$/gm, "<b>$1</b><br/>")
          .replace(/\n/g, "<br/>");
        return `<div class="bubble artin"><div class="label">آرتین</div><p>${safe}</p></div>`;
      }
    }).join("");
    const font = "Tahoma, Arial, 'Segoe UI', sans-serif";
    const printScript = forWord ? "" : `<script>window.onload=function(){window.print();}<\/script>`;
    return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8"/>
<title>گفتگو با آرتین — آرتین آزما</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${font}; background: #fff; color: #1e293b; padding: 40px; font-size: 13px; direction: rtl; }
  .header { border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 28px; }
  .header h1 { font-size: 20px; font-weight: 900; color: #7c3aed; }
  .header .meta { font-size: 11px; color: #64748b; margin-top: 6px; }
  .bubble { margin-bottom: 20px; padding: 14px 16px; border-radius: 16px; page-break-inside: avoid; }
  .bubble.user { background: #ede9fe; border-right: 4px solid #7c3aed; }
  .bubble.artin { background: #f1f5f9; border-right: 4px solid #0ea5e9; }
  .label { font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; }
  .bubble.user .label { color: #7c3aed; }
  .bubble.artin .label { color: #0ea5e9; }
  p { line-height: 2; }
  .attachment { font-size: 11px; color: #64748b; margin-bottom: 6px; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>گفتگو با آرتین — دستیار هوشمند آرتین آزما</h1>
  <div class="meta">تاریخ: ${now} | تعداد پیام: ${messages.length}</div>
</div>
${msgHtml}
<div class="footer">آرتین آزما مهر — artinazma.net</div>
${printScript}
</body>
</html>`;
  }

  function exportChat() {
    if (messages.length === 0) return;
    const html = _buildExportHtml(false);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    setShowExportMenu(false);
  }

  function exportChatWord() {
    if (messages.length === 0) return;
    const html = _buildExportHtml(true);
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `گفتگو-آرتین-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }

  function exportChatText() {
    if (messages.length === 0) return;
    const now = new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
    const lines: string[] = [
      "گفتگو با آرتین — دستیار هوشمند آرتین آزما",
      `تاریخ: ${now}`,
      "═══════════════════════════════════════",
      "",
    ];
    messages.forEach((msg, i) => {
      if (msg.role === "user") {
        lines.push(`── کاربر [${i + 1}] ──`);
        if (msg.attachment) lines.push(`📎 پیوست: ${msg.attachment.name}`);
        lines.push(msg.content);
      } else {
        lines.push(`── آرتین [${i + 1}] ──`);
        lines.push(msg.content.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/#{1,6}\s/g, ""));
      }
      lines.push("");
    });
    lines.push("───────────────────────────────────────");
    lines.push("آرتین آزما مهر — artinazma.net");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `گفتگو-آرتین-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }

  return { showExportMenu, setShowExportMenu, exportChat, exportChatWord, exportChatText };
}
