"use client";

import { useI18n } from "@/lib/i18n";

type Section = { title: string; body: string };

const SECTIONS_FA: Section[] = [
  {
    title: "۱. پذیرش شرایط",
    body: "با استفاده از این سامانه، شرایط زیر را می‌پذیرید. اگر با این شرایط موافق نیستید، لطفاً از سرویس استفاده نکنید.",
  },
  {
    title: "۲. ماهیت سرویس",
    body: "این سامانه یک دستیار هوشمند برای ارائه‌ی اطلاعات فنی و راهنمایی در حوزه‌ی تجهیزات آزمایشگاهی، مواد شیمیایی و کاتالیست‌هاست. هدف آن کمک به انتخاب و پشتیبانی فنی است.",
  },
  {
    title: "۳. صحت و کامل بودن پاسخ‌ها",
    body: "پاسخ‌های هوش مصنوعی ممکن است ناقص یا نادرست باشند و جایگزین مشاوره‌ی تخصصی نیستند. برای تصمیم‌های مهم فنی، خرید یا ایمنی، حتماً با کارشناسان ما یا منابع رسمی استانداردها تأیید بگیرید.",
  },
  {
    title: "۴. استفاده‌ی مجاز",
    body: "استفاده از سامانه باید قانونی و متعارف باشد. تلاش برای نفوذ، اخلال، استخراج انبوه داده یا سوءاستفاده از سرویس مجاز نیست.",
  },
  {
    title: "۵. مالکیت معنوی",
    body: "محتوا، نام تجاری و مواد این سامانه متعلق به آرتین آزما مهر است و استفاده‌ی تجاری بدون اجازه مجاز نیست.",
  },
  {
    title: "۶. محدودیت مسئولیت",
    body: "آرتین آزما مهر در قبال خسارات ناشی از اتکا به پاسخ‌های خودکار یا قطعی‌نبودن اطلاعات، در حدود قانون مسئولیتی نمی‌پذیرد.",
  },
  {
    title: "۷. تغییرات",
    body: "ممکن است این شرایط و امکانات سرویس در طول زمان به‌روزرسانی شوند. نسخه‌ی جاری در همین صفحه در دسترس است.",
  },
  {
    title: "۸. تماس",
    body: "برای هر پرسش درباره‌ی شرایط استفاده، از طریق ایمیل info@artinazma.net یا فرم درخواست با ما در ارتباط باشید.",
  },
];

const SECTIONS_EN: Section[] = [
  { title: "1. Acceptance of Terms", body: "By using this platform you accept the terms below. If you do not agree, please do not use the service." },
  { title: "2. Nature of the Service", body: "This platform is an AI assistant providing technical information and guidance on laboratory equipment, chemicals, and catalysts. Its purpose is to support selection and technical assistance." },
  { title: "3. Accuracy & Completeness", body: "AI answers may be incomplete or incorrect and are not a substitute for professional advice. For important technical, purchasing, or safety decisions, always confirm with our experts or official standards." },
  { title: "4. Acceptable Use", body: "Use must be lawful and reasonable. Attempting to breach, disrupt, mass-scrape, or abuse the service is not permitted." },
  { title: "5. Intellectual Property", body: "Content, brand, and materials of this platform belong to ArtinAzma Mehr; commercial use without permission is not allowed." },
  { title: "6. Limitation of Liability", body: "To the extent permitted by law, ArtinAzma Mehr is not liable for damages arising from reliance on automated answers or non-definitive information." },
  { title: "7. Changes", body: "These terms and service features may be updated over time. The current version is available on this page." },
  { title: "8. Contact", body: "For any question about these terms, contact us at info@artinazma.net or via the request form." },
];

export default function TermsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const sections = isEn ? SECTIONS_EN : SECTIONS_FA;

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-10" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <div className="ui-card rounded-[28px] p-6 md:p-9">
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl dark:text-slate-100">
            {isEn ? "Terms of Use" : "شرایط استفاده"}
          </h1>
          <p className="mt-2 text-xs text-slate-400">
            {isEn ? "Last updated: June 2026" : "آخرین به‌روزرسانی: خرداد ۱۴۰۵"}
          </p>

          <div className="mt-6 space-y-6">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-200">{s.title}</h2>
                <p className="mt-2 text-sm leading-8 text-slate-600 dark:text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
