"use client";

import { useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { imageTypes, testTypes } from "@/lib/chat-helpers";

const UploadModal = dynamic(() => import("@/components/UploadModal"), { ssr: false });

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/**
 * File picker flow for analysis: picking a file opens an options dialog (test or
 * image type and an optional note); confirming hands the file to onAppend.
 * Returns the input change handler and the dialogs to render.
 */
export function useAnalysisUpload({
  signedIn,
  loading,
  isEn,
  onRequireAccount,
  onAppend,
}: {
  signedIn: boolean;
  loading: boolean;
  isEn: boolean;
  onRequireAccount: () => void;
  onAppend: (file: File, type: "image" | "document", analysisType: string, note: string) => void;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [testType, setTestType] = useState("general");
  const [fileNote, setFileNote] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageType, setImageType] = useState("general");
  const [imageNote, setImageNote] = useState("");

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    if (!signedIn) { onRequireAccount(); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop() || "";
    if (IMAGE_EXTENSIONS.includes(ext)) {
      setPendingImage(file);
      setImageType("general");
      setImageNote("");
    } else {
      setPendingFile(file);
      setTestType("general");
      setFileNote("");
    }
    e.target.value = "";
  }

  function confirmFile() {
    if (!pendingFile || loading) return;
    onAppend(pendingFile, "document", testType, fileNote);
    setPendingFile(null);
  }

  function confirmImage() {
    if (!pendingImage || loading) return;
    onAppend(pendingImage, "image", imageType, imageNote);
    setPendingImage(null);
  }

  const dialogs = (
    <>
      {pendingFile && (
        <UploadModal
          title={isEn ? "File analysis settings" : "تنظیمات تحلیل فایل"}
          fileName={pendingFile.name}
          label={isEn ? "Test or report type" : "نوع تست یا گزارش"}
          selectValue={testType}
          onSelectChange={setTestType}
          options={testTypes}
          noteValue={fileNote}
          onNoteChange={setFileNote}
          noteLabel={isEn ? "Optional note about the sample or test conditions" : "توضیح اختیاری درباره نمونه یا شرایط تست"}
          placeholder={
            isEn
              ? "Example: The sample is LPG, the baseline fluctuates, the catalyst test was run at 350 C..."
              : "مثلاً: نمونه LPG است، baseline نوسان دارد، تست کاتالیست در دمای 350 درجه انجام شده..."
          }
          confirmLabel={isEn ? "Start file analysis" : "شروع تحلیل فایل"}
          onConfirm={confirmFile}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {pendingImage && (
        <UploadModal
          title={isEn ? "Image analysis settings" : "تنظیمات تحلیل عکس"}
          fileName={pendingImage.name}
          label={isEn ? "Image type" : "نوع تصویر"}
          selectValue={imageType}
          onSelectChange={setImageType}
          options={imageTypes}
          noteValue={imageNote}
          onNoteChange={setImageNote}
          noteLabel={isEn ? "Optional note about the image" : "توضیح اختیاری درباره تصویر"}
          placeholder={
            isEn
              ? "Example: This image shows a GC instrument error or an LPG sample chromatogram..."
              : "مثلاً: این عکس مربوط به ارور دستگاه GC است یا کروماتوگرام نمونه LPG است..."
          }
          confirmLabel={isEn ? "Start image analysis" : "شروع تحلیل عکس"}
          onConfirm={confirmImage}
          onCancel={() => setPendingImage(null)}
          footer={isEn ? "Allowed image formats: JPG, PNG, WEBP" : "فرمت‌های مجاز تصویر: JPG, PNG, WEBP"}
        />
      )}
    </>
  );

  return { handleUploadChange, dialogs };
}
