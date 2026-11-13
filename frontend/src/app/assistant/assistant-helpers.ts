// Runtime adapters and analysis-response helpers for the assistant chat page.
import { generateId } from "@assistant-ui/react";
import type { AttachmentAdapter, ThreadMessageLike } from "@assistant-ui/react";
import { cleanMarkdownText } from "@/lib/chat-helpers";
import type { ChatMessage } from "@/lib/chat-types";

export const imageAttachmentAdapter: AttachmentAdapter = {
  accept: "image/*",
  async add({ file }) {
    return {
      id: generateId(),
      type: "image",
      name: file.name,
      contentType: file.type,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  },
  async send(attachment) {
    // The existing analysis endpoint accepts the original File in FormData.
    return { ...attachment, status: { type: "complete" }, content: [] };
  },
  async remove() {},
};

export function convertChatMessage(item: ChatMessage): ThreadMessageLike {
  return {
    role: item.role,
    content: [{ type: "text", text: item.role === "assistant" ? cleanMarkdownText(item.content) : item.content }],
  };
}

export type AnalysisResponse = Record<string, unknown> & {
  ai_analysis?: string;
  error?: string;
  detail?: string;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  test_type?: string;
  test_type_label?: string;
  image_type?: string;
  image_type_label?: string;
};

export async function readAnalysisResponse(res: Response): Promise<AnalysisResponse> {
  let data: AnalysisResponse = {};

  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const detail =
      data.detail ||
      data.error ||
      (res.status >= 500
        ? "Backend connection failed. Make sure the FastAPI server is running on port 8000."
        : `HTTP ${res.status}`);
    throw new Error(detail);
  }

  return data;
}

export function formatAnalysisUploadError(error: unknown, kind: "file" | "image", isEn: boolean) {
  const message = error instanceof Error ? error.message : "";
  const looksLikeBackendDown =
    !message ||
    /failed to fetch|network error|econnrefused|econnreset|socket hang up|fetch failed|connection/i.test(message);

  if (looksLikeBackendDown) {
    return isEn
      ? "Could not connect to the analysis server. Please make sure the backend is running on port 8000, then try again."
      : "اتصال به سرور تحلیل برقرار نشد. لطفا مطمئن شوید بک‌اند روی پورت 8000 اجراست و دوباره امتحان کنید.";
  }

  const label = kind === "image"
    ? isEn ? "image" : "عکس"
    : isEn ? "file" : "فایل";

  return isEn
    ? `Upload or analysis failed for this ${label}: ${message}`
    : `خطا در آپلود یا تحلیل ${label}: ${message}`;
}
