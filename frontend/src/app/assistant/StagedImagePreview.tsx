import { X as XIcon } from "lucide-react";

/**
 * Preview strip for an image the user has staged (pasted/selected) but not yet
 * sent. Presentational — renders nothing unless an image is staged.
 */
type StagedImagePreviewProps = {
  image: File | null;
  imageUrl: string;
  onClear: () => void;
  isEn: boolean;
};

export default function StagedImagePreview({ image, imageUrl, onClear, isEn }: StagedImagePreviewProps) {
  if (!image) return null;

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2">
      <img
        src={imageUrl}
        alt={isEn ? "Image preview" : "پیش‌نمایش عکس"}
        className="h-12 w-12 rounded-xl border border-slate-200 object-cover shadow-sm"
      />
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-bold text-slate-700">{image.name}</div>
        <div className="text-[11px] text-slate-400">
          {isEn
            ? "Image ready to send — write a message or send directly"
            : "عکس آماده ارسال — پیام خود را بنویسید یا مستقیم ارسال کنید"}
        </div>
      </div>
      <button
        onClick={onClear}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
