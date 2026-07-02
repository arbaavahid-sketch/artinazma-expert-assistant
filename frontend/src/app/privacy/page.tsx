"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

type Section = { title: string; body: string };

const SECTIONS_FA: Section[] = [
  {
    title: "۱. مقدمه",
    body: "این سیاست حفظ حریم خصوصی توضیح می‌دهد که «آرتین آزما مهر» برای ارائه‌ی دستیار هوشمند آرتین، ثبت‌نام مشتریان، پاسخ‌گویی فنی، تحلیل فایل و پیگیری درخواست‌ها چه اطلاعاتی را دریافت می‌کند، چرا آن‌ها را لازم دارد، چگونه از آن‌ها نگهداری می‌کند و حقوق شما چیست. مطالعه و پذیرش این سیاست پیش از ثبت‌نام یا ارسال درخواست الزامی است.",
  },
  {
    title: "۲. چه اطلاعاتی جمع‌آوری می‌شود",
    body: "اطلاعاتی که خودتان وارد می‌کنید شامل نام و نام خانوادگی، نام شرکت یا سازمان، شماره تماس یا موبایل، ایمیل، رمز عبور حساب، نوع درخواست، موضوع و شرح نیاز، پیام‌ها و گفتگوهای شما با دستیار، سوابق درخواست‌ها و وضعیت پیگیری است. رمز عبور به‌صورت هش‌شده نگهداری می‌شود و متن اصلی رمز عبور ذخیره نمی‌شود. اگر از بخش تحلیل استفاده کنید، فایل‌ها، تصاویر، PDF، Excel یا CSV آپلودشده نیز برای همان تحلیل دریافت می‌شود. اگر از ورودی صوتی استفاده کنید، صدای ضبط‌شده برای تبدیل به متن پردازش می‌شود. برای عملکرد فنی سامانه، شناسه کاربری، کوکی‌های نشست و امنیتی، توکن‌های CSRF، شناسه اشتراک اعلان و داده‌های فنی مانند زمان درخواست، خطاهای سامانه، مرورگر/دستگاه و نشانی IP نیز ممکن است ثبت شود.",
  },
  {
    title: "۳. نحوه‌ی استفاده",
    body: "اطلاعات فقط برای ایجاد و مدیریت حساب مشتری، پاسخ‌گویی هوشمند و کارشناسی، ذخیره و نمایش گفتگوهای قبلی، تحلیل فایل‌ها و تصاویر ارسالی، پیگیری درخواست‌های مشاوره، خرید، استعلام قیمت یا پشتیبانی، ارسال پاسخ یا اعلان مرتبط با درخواست شما، افزایش امنیت، جلوگیری از سوءاستفاده، رفع خطا و بهبود کیفیت خدمات استفاده می‌شود.",
  },
  {
    title: "۴. مجوزها و امکانات دستگاه",
    body: "نسخه موبایل برنامه برای اتصال به سرور از اینترنت استفاده می‌کند. دسترسی میکروفون فقط زمانی استفاده می‌شود که خودتان دکمه ورودی صوتی را فعال کنید و برای تبدیل گفتار به متن به کار می‌رود. دسترسی اعلان فقط پس از اجازه شما فعال می‌شود و برای اطلاع‌رسانی درباره حساب، درخواست‌ها یا پیام‌های مرتبط استفاده می‌شود. برنامه بدون اقدام مستقیم شما به مخاطبین، موقعیت مکانی، پیامک، تماس‌ها، دوربین یا فایل‌های شخصی دستگاه دسترسی ندارد.",
  },
  {
    title: "۵. پردازش توسط سرویس‌های شخص ثالث",
    body: "برای تولید پاسخ‌های هوشمند و تبدیل صدا به متن، محتوای لازم مانند متن سؤال، متن گفتگو، فایل یا صدای ارسالی ممکن است به سرویس‌های پردازش هوش مصنوعی مانند OpenAI ارسال شود. برای ارسال ایمیل، اعلان یا پیام مدیریتی نیز ممکن است از سرویس‌های ایمیل، Web Push یا پیام‌رسان تنظیم‌شده توسط آرتین آزما استفاده شود. فقط اطلاعات لازم برای انجام همان خدمت منتقل می‌شود.",
  },
  {
    title: "۶. اشتراک‌گذاری و محرمانگی",
    body: "اطلاعات شما فروخته، اجاره داده یا برای تبلیغات در اختیار دیگران قرار داده نمی‌شود. دسترسی داخلی به اطلاعات فقط برای مدیران و کارشناسان مجاز آرتین آزما و فقط به اندازه نیاز کاری انجام می‌شود. اطلاعات در اختیار اشخاص یا سازمان‌های ثالث قرار نمی‌گیرد، مگر برای ارائه سرویس‌های فنی توضیح‌داده‌شده در این سیاست، انجام الزامات قانونی معتبر، حفظ امنیت کاربران یا رسیدگی به سوءاستفاده.",
  },
  {
    title: "۷. نگهداری و امنیت",
    body: "داده‌ها در سرورهای کنترل‌شده نگهداری می‌شوند و دسترسی به آن‌ها محدود است. از اقدامات امنیتی متعارف مانند رمزنگاری ارتباط، کوکی‌های امن، احراز هویت، کنترل دسترسی، محافظت در برابر سوءاستفاده و ثبت رویدادهای امنیتی استفاده می‌شود؛ با این حال هیچ سامانه‌ای ۱۰۰٪ مصون نیست. اطلاعات تا زمانی نگهداری می‌شود که برای ارائه خدمات، پیگیری درخواست، نگهداری سوابق کاری، امنیت سامانه یا الزامات قانونی لازم باشد.",
  },
  {
    title: "۸. کوکی‌ها و نشست کاربری",
    body: "از کوکی‌های فنی برای ورود مشتری، حفظ نشست، امنیت CSRF، تشخیص وضعیت ورود و عملکرد درست سامانه استفاده می‌شود. این کوکی‌ها برای اجرای برنامه ضروری‌اند و برای ردیابی تبلیغاتی استفاده نمی‌شوند.",
  },
  {
    title: "۹. حقوق شما",
    body: "می‌توانید برای دسترسی به اطلاعات حساب و درخواست‌های خود، اصلاح اطلاعات نادرست، حذف یا غیرفعال‌سازی حساب، لغو اعلان‌ها، یا درخواست حذف فایل‌ها و داده‌های ارسالی با ما تماس بگیرید. در مواردی که نگهداری بخشی از اطلاعات به دلیل تعهدات قانونی، امنیتی یا سوابق پیگیری لازم باشد، درخواست شما طبق محدودیت‌های قانونی و عملی بررسی می‌شود.",
  },
  {
    title: "۱۰. تغییرات سیاست",
    body: "ممکن است این سیاست با تغییر امکانات برنامه یا الزامات قانونی به‌روزرسانی شود. نسخه جاری همیشه در همین صفحه در دسترس است و تاریخ آخرین به‌روزرسانی در بالای صفحه نمایش داده می‌شود.",
  },
  {
    title: "۱۱. تماس",
    body: "برای هر پرسش درباره‌ی حریم خصوصی، دسترسی، اصلاح یا حذف اطلاعات، از طریق ایمیل info@artinazma.net یا فرم درخواست با ما در ارتباط باشید.",
  },
];

const SECTIONS_EN: Section[] = [
  { title: "1. Introduction", body: "This Privacy Policy explains what information ArtinAzma Mehr receives to provide the Artin AI assistant, customer registration, technical support, file analysis, and request follow-up; why it is needed; how it is protected; and what rights you have. Reading and accepting this policy is required before registration or request submission." },
  { title: "2. Information We Collect", body: "Information you enter may include full name, company or organization, phone or mobile number, email, account password, request type, request subject and details, messages and conversations with the assistant, request history, and follow-up status. Passwords are stored as hashes and the original password text is not stored. If you use analysis features, uploaded files, images, PDFs, Excel, or CSV files are received for that analysis. If you use voice input, recorded audio is processed for transcription. For technical operation, we may also process user identifiers, session and security cookies, CSRF tokens, notification subscription identifiers, request timestamps, system errors, browser/device data, and IP address." },
  { title: "3. How We Use It", body: "Information is used only to create and manage customer accounts, provide AI and expert answers, store and display previous conversations, analyze submitted files and images, follow up consultation, purchase, price inquiry, or support requests, send relevant replies or notifications, improve security, prevent abuse, resolve errors, and improve service quality." },
  { title: "4. Device Permissions", body: "The mobile app uses Internet access to connect to the service. Microphone access is used only when you activate voice input and is used for speech-to-text. Notification access is enabled only after your permission and is used for account, request, or related message notifications. The app does not access contacts, location, SMS, calls, camera, or personal device files without your direct action." },
  { title: "5. Third-Party Processing", body: "To generate AI answers and transcribe voice, necessary content such as your question text, conversation text, submitted files, or audio may be sent to AI processing services such as OpenAI. Email, Web Push, or configured messaging services may be used for notifications or administrative messages. Only the information required for the relevant service is transferred." },
  { title: "6. Sharing & Confidentiality", body: "Your information is not sold, rented, or shared for advertising. Internal access is limited to authorized ArtinAzma managers and experts and only as needed for work. Information is not provided to third parties except for the technical service providers described in this policy, valid legal requirements, user safety, or abuse handling." },
  { title: "7. Storage & Security", body: "Data is stored on controlled servers with restricted access. We use reasonable security measures such as encrypted transport, secure cookies, authentication, access control, abuse protection, and security logs; however, no system is 100% immune. Information is retained while needed for service delivery, request follow-up, business records, security, or legal requirements." },
  { title: "8. Cookies & Sessions", body: "Technical cookies are used for customer login, session management, CSRF security, login status, and correct platform operation. These cookies are necessary for the app and are not used for advertising tracking." },
  { title: "9. Your Rights", body: "You may contact us to access your account and request data, correct inaccurate information, delete or deactivate your account, disable notifications, or request deletion of submitted files and data. Where some information must be retained for legal, security, or follow-up records, your request will be reviewed within those practical and legal limits." },
  { title: "10. Changes", body: "This policy may be updated as app features or legal requirements change. The current version is always available on this page, with the last update date shown above." },
  { title: "11. Contact", body: "For privacy questions or requests to access, correct, or delete information, contact us at info@artinazma.net or through the request form." },
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
            {isEn ? "Last updated: July 2026" : "آخرین به‌روزرسانی: تیر ۱۴۰۵"}
          </p>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-8 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
            {isEn
              ? "Before you register, submit a request, enter a phone number, upload a file, use voice input, or enable notifications, please read this policy carefully."
              : "پیش از ثبت‌نام، ارسال درخواست، وارد کردن شماره تماس، آپلود فایل، استفاده از ورودی صوتی یا فعال‌سازی اعلان‌ها، لطفاً این سیاست را با دقت مطالعه کنید."}
          </div>

          <div className="mt-6 space-y-6">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-200">{s.title}</h2>
                <p className="mt-2 text-sm leading-8 text-slate-600 dark:text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/customer-register" className="text-blue-700 transition hover:text-blue-900 dark:text-blue-300">
              {isEn ? "Customer registration" : "ثبت‌نام مشتری"}
            </Link>
            <Link href="/customer-request" className="text-blue-700 transition hover:text-blue-900 dark:text-blue-300">
              {isEn ? "Submit request" : "ثبت درخواست"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
