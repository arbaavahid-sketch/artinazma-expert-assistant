"use client";
/**
 * صفحه‌ی حریم خصوصی. متن نمونه و عمومی است و باید پیش از انتشار رسمی توسط
 * مشاور حقوقی بازبینی شود.
 */

import { useI18n } from "@/lib/i18n";

type Section = { title: string; body: string };

const SECTIONS_FA: Section[] = [
  {
    title: "۱. مقدمه",
    body: "این سیاست توضیح می‌دهد که «آرتین آزما مهر» چه اطلاعاتی را از طریق این سامانه جمع‌آوری و چگونه از آن استفاده می‌کند. با استفاده از این سرویس، با مفاد زیر موافقت می‌کنید.",
  },
  {
    title: "۲. چه اطلاعاتی جمع‌آوری می‌شود",
    body: "اطلاعاتی که خودتان در فرم درخواست/استعلام وارد می‌کنید (نام، نام شرکت، شماره تماس، ایمیل و شرح نیاز)؛ متن سوالات و گفتگوهای شما با دستیار؛ فایل‌ها یا تصاویری که برای تحلیل آپلود می‌کنید؛ و داده‌های فنی لازم برای عملکرد سامانه (کوکی‌های احراز هویت و امنیتی و یک شناسه‌ی کاربری).",
  },
  {
    title: "۳. نحوه‌ی استفاده",
    body: "اطلاعات برای پاسخ‌گویی فنی، پیگیری درخواست‌ها و استعلام‌ها توسط کارشناسان، بهبود کیفیت خدمات و ارتباط با شما استفاده می‌شود. اطلاعات شما فروخته نمی‌شود.",
  },
  {
    title: "۴. پردازش توسط سرویس‌های شخص ثالث",
    body: "برای تولید پاسخ‌های هوشمند، متن سوالات شما به سرویس مدل زبانی (OpenAI) ارسال می‌شود. لطفاً از وارد کردن اطلاعات محرمانه یا حساس در گفتگو خودداری کنید.",
  },
  {
    title: "۵. نگهداری و امنیت",
    body: "داده‌ها در سرورهای امن نگهداری می‌شوند و دسترسی به آن‌ها محدود است. از اقدامات امنیتی متعارف (رمزنگاری ارتباط، احراز هویت و محافظت در برابر سوءاستفاده) استفاده می‌شود؛ با این حال هیچ سامانه‌ای ۱۰۰٪ مصون نیست.",
  },
  {
    title: "۶. کوکی‌ها",
    body: "از کوکی‌های فنی برای احراز هویت، امنیت (CSRF) و حفظ نشست استفاده می‌شود. این کوکی‌ها برای عملکرد سامانه ضروری‌اند.",
  },
  {
    title: "۷. حقوق شما",
    body: "می‌توانید برای دسترسی، اصلاح یا حذف اطلاعات خود با ما تماس بگیرید و درخواست خود را پیگیری کنید.",
  },
  {
    title: "۸. تماس",
    body: "برای هر پرسش درباره‌ی حریم خصوصی، از طریق ایمیل info@artinazma.net یا فرم درخواست با ما در ارتباط باشید.",
  },
];

const SECTIONS_EN: Section[] = [
  { title: "1. Introduction", body: "This policy explains what information ArtinAzma Mehr collects through this platform and how it is used. By using this service you agree to the terms below." },
  { title: "2. Information We Collect", body: "Information you submit in the request/quote form (name, company, phone, email, and your requirements); your questions and conversations with the assistant; files or images you upload for analysis; and technical data required for operation (authentication/security cookies and a user identifier)." },
  { title: "3. How We Use It", body: "To provide technical answers, follow up on requests and quotes, improve service quality, and contact you. Your data is not sold." },
  { title: "4. Third-Party Processing", body: "To generate AI answers, your question text is sent to a language-model provider (OpenAI). Please avoid entering confidential or sensitive information in the chat." },
  { title: "5. Storage & Security", body: "Data is stored on secure servers with restricted access, using reasonable security measures (encrypted transport, authentication, abuse protection). However, no system is 100% immune." },
  { title: "6. Cookies", body: "Technical cookies are used for authentication, security (CSRF) and session management. They are essential for the platform to function." },
  { title: "7. Your Rights", body: "You may contact us to access, correct, or delete your information and to follow up on your request." },
  { title: "8. Contact", body: "For any privacy question, contact us at info@artinazma.net or via the request form." },
];

export default function PrivacyPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const sections = isEn ? SECTIONS_EN : SECTIONS_FA;

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-10" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <div className="ui-card rounded-[28px] p-6 md:p-9">
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl dark:text-slate-100">
            {isEn ? "Privacy Policy" : "سیاست حریم خصوصی"}
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

          <p className="mt-8 rounded-2xl bg-amber-50 p-4 text-xs leading-7 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {isEn
              ? "Note: This is a general template and should be reviewed by a legal advisor before official publication."
              : "توجه: این متن نمونه و عمومی است و پیش از انتشار رسمی باید توسط مشاور حقوقی بازبینی شود."}
          </p>
        </div>
      </div>
    </section>
  );
}
