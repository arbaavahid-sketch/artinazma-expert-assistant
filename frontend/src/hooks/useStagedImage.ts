"use client";
/**
 * هوک تصویر staged و drag & drop — مدیریت عکس آماده‌ی ارسال،
 * پیش‌نمایش با object URL، paste و کشیدن‌ورها کردن فایل تصویر.
 *
 * استخراج‌شده از assistant/page.tsx برای کاهش حجم آن فایل و قابل‌تست‌تر شدن
 * منطق پیوست تصویر. رفتار دقیقاً مطابق نسخه‌ی قبلی است.
 */

import { useState } from "react";

export function useStagedImage() {
  const [stagedImage, setStagedImage] = useState<File | null>(null);
  const [stagedImageUrl, setStagedImageUrl] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  function stageImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setStagedImage(file);
    const url = URL.createObjectURL(file);
    setStagedImageUrl(url);
  }

  function clearStagedImage() {
    setStagedImage(null);
    if (stagedImageUrl) URL.revokeObjectURL(stagedImageUrl);
    setStagedImageUrl("");
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        stageImageFile(file);
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    const hasImage = Array.from(e.dataTransfer.types).includes("Files");
    if (hasImage) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    setIsDragOver(false);
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      stageImageFile(file);
    }
  }

  return {
    stagedImage,
    stagedImageUrl,
    isDragOver,
    stageImageFile,
    clearStagedImage,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
