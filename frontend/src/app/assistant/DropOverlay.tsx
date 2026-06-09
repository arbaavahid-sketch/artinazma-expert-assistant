import { ImagePlus } from "lucide-react";

/**
 * Full-area overlay shown while a file is being dragged over the chat, prompting
 * the user to drop an image. Presentational — renders nothing unless `show`.
 */
type DropOverlayProps = {
  show: boolean;
  isEn: boolean;
};

export default function DropOverlay({ show, isEn }: DropOverlayProps) {
  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-[32px] border-2 border-dashed border-blue-400 bg-white/90 px-10 py-8 shadow-xl">
        <ImagePlus size={40} className="text-blue-500" />
        <span className="text-lg font-black text-blue-600">
          {isEn ? "Drop the image here" : "عکس را اینجا رها کنید"}
        </span>
      </div>
    </div>
  );
}
