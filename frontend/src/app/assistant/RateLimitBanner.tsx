/**
 * Rate-limit countdown banner shown on the assistant page while the user is
 * temporarily throttled. Pure presentational component — renders nothing when
 * there is no active countdown.
 */
type RateLimitBannerProps = {
  /** Seconds remaining until the user can send again. */
  countdown: number;
  /** Total countdown length, used for the progress bar width. */
  total: number;
  /** Whether the UI is in English (else Persian). */
  isEn: boolean;
};

export default function RateLimitBanner({ countdown, total, isEn }: RateLimitBannerProps) {
  if (countdown <= 0) return null;

  const widthPct = total > 0 ? (countdown / total) * 100 : 0;

  return (
    <div className="mb-3 w-full max-w-3xl overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      <div className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-amber-700">
        <span className="text-lg">⏳</span>
        <span className="flex-1">
          {isEn ? "Rate limit — please wait" : "محدودیت ارسال — لطفاً صبر کنید"}
        </span>
        <span className="rounded-xl bg-amber-100 px-3 py-1 text-base font-black tabular-nums">
          {countdown}s
        </span>
      </div>
      {/* Countdown progress bar */}
      <div className="h-1.5 bg-amber-100">
        <div
          className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}
