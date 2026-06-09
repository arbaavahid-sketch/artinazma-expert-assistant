/**
 * Welcome heading + subtitle shown at the top of the assistant page when there
 * are no messages yet. Pure presentational — only depends on the locale.
 */
type AssistantWelcomeProps = {
  /** Whether the UI is in English (else Persian). */
  isEn: boolean;
};

export default function AssistantWelcome({ isEn }: AssistantWelcomeProps) {
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {isEn ? "How can Artin help you today?" : "امروز چه کمکی از آرتین می‌خواهید؟"}
      </h2>

      <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
        {isEn
          ? "Ask a technical question, upload a test file or error photo, or submit a consultation request."
          : "سوال تخصصی بپرسید، فایل تست یا عکس خطا ارسال کنید، یا درخواست مشاوره ثبت کنید."}
      </p>
    </>
  );
}
