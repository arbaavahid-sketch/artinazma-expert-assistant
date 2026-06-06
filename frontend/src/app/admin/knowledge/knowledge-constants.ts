/**
 * ثابت‌ها و کمک‌توابع دسته‌بندی بانک دانش — استخراج‌شده از admin/knowledge/page.tsx.
 */

export const categoryOptions = [
  { value: "general", label: "عمومی" },
  { value: "ASTM Standards", label: "استانداردهای ASTM" },
  { value: "catalyst", label: "کاتالیست" },
  { value: "equipment", label: "تجهیزات" },
  { value: "chromatography", label: "کروماتوگرافی" },
  { value: "mercury-analysis", label: "آنالیز جیوه" },
  { value: "sulfur-analysis", label: "آنالیز سولفور" },
  { value: "troubleshooting", label: "عیب‌یابی" },
  { value: "application-note", label: "اپلیکیشن نوت" },
  { value: "expert-faq", label: "FAQ تاییدشده" },
];

export function getCategoryLabel(category: string) {
  return (
    categoryOptions.find((item) => item.value === category)?.label ||
    category ||
    "بدون دسته‌بندی"
  );
}
