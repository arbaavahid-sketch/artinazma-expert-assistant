/**
 * توابع کمکی مشترک چت — استخراج‌شده از assistant/page.tsx
 * برای کاهش حجم صفحه اصلی و قابلیت استفاده مجدد.
 */

/** Escape special regex characters */
export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** آیا متن شامل کاراکترهای فارسی است؟ */
export function hasPersianText(text: string) {
  return /[؀-ۿ]/.test(text);
}

/** جهت متن بر اساس زبان */
export function getTextDirection(text: string) {
  return hasPersianText(text) ? "rtl" : "ltr";
}

/** فونت متن بر اساس زبان */
export function getTextFont(text: string) {
  return hasPersianText(text) ? "var(--font-persian)" : "var(--font-english)";
}

/** عناوین بخش‌های فارسی که باید به Markdown heading تبدیل شوند */
const SECTION_TITLES = [
  "جمع‌بندی کاربردی", "جمع بندی کاربردی", "جمع‌بندی", "جمع بندی",
  "تفاوت بنیادی", "مقایسه فنی و عملیاتی", "مقایسه فنی",
  "روش‌ها یا دستگاه‌های مناسب", "روش ها یا دستگاه های مناسب",
  "معیار انتخاب", "نکات نمونه‌برداری", "نکات نمونه برداری",
  "آماده‌سازی نمونه", "آماده سازی نمونه", "کنترل کیفیت", "QC",
  "محدودیت‌ها و خطاهای رایج", "محدودیت‌ها", "محدودیت ها", "خطاهای رایج",
  "سناریوی انتخاب", "پیشنهاد عملی", "اقدام بعدی",
  "اطلاعات لازم برای تصمیم قطعی", "اطلاعات تکمیلی موردنیاز",
  "اطلاعات تکمیلی مورد نیاز",
];

/**
 * پاکسازی و بهبود متن Markdown دریافتی از AI:
 * - تبدیل عناوین بخش‌ها به heading
 * - اصلاح جدول‌ها
 * - بهبود لیست‌ها
 * - جهت‌دهی صحیح توکن‌های لاتین در متن فارسی
 */
export function cleanMarkdownText(text: string) {
  if (!text) return "";

  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s*---+\s*$/gm, "")
    .trim();

  // استخراج جدول از code block
  cleaned = cleaned
    .replace(/```(?:markdown|md)?\s*\n([\s\S]*?\|[\s\S]*?)\n```/gi, "$1")
    .replace(/```\s*\n([\s\S]*?\|[\s\S]*?)\n```/g, "$1");

  // حذف فاصله ابتدای خطوط جدول
  cleaned = cleaned
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const looksLikeTableLine =
        trimmed.includes("|") &&
        (trimmed.startsWith("|") ||
          trimmed.endsWith("|") ||
          /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed));
      return looksLikeTableLine ? trimmed : line;
    })
    .join("\n");

  // تبدیل عناوین بخش‌ها
  for (const title of SECTION_TITLES) {
    const pattern = new RegExp(
      `^\\s*(?:[-*]\\s*)?(?:\\*\\*\\s*)?${escapeRegExp(title)}(?:\\s*\\*\\*)?(?:\\s*:)?\\s*$`,
      "gmi",
    );
    cleaned = cleaned.replace(pattern, `## ${title}`);
  }

  // بولت فارسی به markdown
  cleaned = cleaned.replace(/\s*[•●▪]\s*/g, "\n- ");
  cleaned = cleaned.replace(/([^\n])\s+-\s+/g, "$1\n- ");

  // فاصله‌های اضافه
  cleaned = cleaned
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  // جهت‌دهی توکن‌های لاتین
  if (hasPersianText(cleaned)) {
    cleaned = cleaned
      .replace(/\(([A-Za-z][A-Za-z0-9.+/\-\s]{1,})\)/g, "(⁦$1⁩)")
      .replace(/\b([A-Z]{2,}(?:-[A-Z0-9]+)?)\b/g, "⁦$1⁩");
  }

  return cleaned;
}

/** آیا باید کارت‌های تجهیزات مرتبط نمایش داده شوند؟ */
export function shouldShowRelatedDeviceCards(userText: string, selectedDomain: string) {
  const text = userText.toLowerCase();

  if (selectedDomain === "equipment") return true;

  const intentKeywords = [
    "دستگاه", "تجهیز", "تجهیزات", "آنالایزر", "مدل", "برند",
    "عکس", "تصویر", "کاتالوگ", "پیشنهاد دستگاه", "چه دستگاهی",
    "چه تجهیزی", "دستگاه مناسب", "تجهیز مناسب", "خرید", "استعلام",
    "قیمت", "موجودی", "device", "equipment", "instrument", "analyzer",
    "model", "brand", "image", "photo", "picture", "catalog", "price",
    "quotation", "availability",
  ];

  return intentKeywords.some((keyword) => text.includes(keyword));
}

/** لیست انواع تست */
export const testTypes = [
  { label: "گزارش عمومی آزمایشگاهی", value: "general" },
  { label: "تست کاتالیست", value: "catalyst" },
  { label: "کروماتوگرافی GC/HPLC", value: "chromatography" },
  { label: "آنالیز جیوه", value: "mercury" },
  { label: "آنالیز سولفور", value: "sulfur" },
  { label: "آنالیز عنصری / فلزات", value: "metals" },
];

/** لیست انواع تصویر */
export const imageTypes = [
  { label: "تصویر عمومی", value: "general" },
  { label: "خطای دستگاه", value: "device-error" },
  { label: "کروماتوگرام", value: "chromatogram" },
  { label: "نمودار تست", value: "chart" },
  { label: "صفحه نرم‌افزار دستگاه", value: "software-screen" },
  { label: "گزارش تصویری آزمایشگاهی", value: "lab-report" },
];

export function getTestTypeLabel(value: string) {
  return testTypes.find((t) => t.value === value)?.label || "گزارش عمومی آزمایشگاهی";
}

export function getImageTypeLabel(value: string) {
  return imageTypes.find((t) => t.value === value)?.label || "تصویر عمومی";
}
