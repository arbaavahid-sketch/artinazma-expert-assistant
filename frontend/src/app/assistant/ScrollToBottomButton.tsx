/**
 * Floating "jump to latest" button shown when the user has scrolled up in a
 * conversation. Presentational — renders nothing unless `show`.
 */
type ScrollToBottomButtonProps = {
  show: boolean;
  onClick: () => void;
  isEn: boolean;
};

export default function ScrollToBottomButton({ show, onClick, isEn }: ScrollToBottomButtonProps) {
  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center">
      <button
        onClick={onClick}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-lg transition hover:bg-slate-50 hover:shadow-xl"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        {isEn ? "Jump to latest" : "رفتن به آخر"}
      </button>
    </div>
  );
}
