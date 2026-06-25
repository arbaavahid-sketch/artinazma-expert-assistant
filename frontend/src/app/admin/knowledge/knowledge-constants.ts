export const categoryOptions = [
  { value: "general", label: "عمومی", labelEn: "General" },
  { value: "ASTM Standards", label: "استانداردهای ASTM", labelEn: "ASTM Standards" },
  { value: "catalyst", label: "کاتالیست", labelEn: "Catalyst" },
  { value: "equipment", label: "تجهیزات", labelEn: "Equipment" },
  { value: "chromatography", label: "کروماتوگرافی", labelEn: "Chromatography" },
  { value: "mercury-analysis", label: "آنالیز جیوه", labelEn: "Mercury analysis" },
  { value: "sulfur-analysis", label: "آنالیز سولفور", labelEn: "Sulfur analysis" },
  { value: "troubleshooting", label: "عیب‌یابی", labelEn: "Troubleshooting" },
  { value: "application-note", label: "اپلیکیشن نوت", labelEn: "Application note" },
  { value: "expert-faq", label: "FAQ تاییدشده", labelEn: "Approved FAQ" },
];

export function getCategoryLabel(category: string, locale = "fa") {
  const option = categoryOptions.find((item) => item.value === category);
  if (option) return locale === "en" ? option.labelEn : option.label;
  return category || (locale === "en" ? "Uncategorized" : "بدون دسته‌بندی");
}
