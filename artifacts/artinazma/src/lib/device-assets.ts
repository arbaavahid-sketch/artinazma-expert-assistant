export type DeviceAsset = {
  id: string;
  name: string;
  category: string;
  description: string;
  specs?: string[];
  imageUrl?: string;
};

export const deviceCategories = [
  { id: "chromatography", label: "کروماتوگرافی" },
  { id: "mercury-analysis", label: "آنالیز جیوه" },
  { id: "sulfur-analysis", label: "آنالیز سولفور" },
  { id: "catalyst", label: "کاتالیست" },
  { id: "equipment", label: "تجهیزات عمومی" },
];

export const deviceAssets: DeviceAsset[] = [
  {
    id: "gc-fid",
    name: "کروماتوگراف گازی با آشکارساز یونش شعله‌ای",
    category: "chromatography",
    description: "دستگاه GC-FID برای آنالیز ترکیبات هیدروکربنی و آلی",
    specs: ["حساسیت بالا", "دامنه دینامیکی وسیع", "مناسب برای ترکیبات آلی"],
  },
  {
    id: "gc-tcd",
    name: "کروماتوگراف گازی با آشکارساز هدایت حرارتی",
    category: "chromatography",
    description: "دستگاه GC-TCD برای آنالیز گازهای دائمی و ترکیبات معدنی",
    specs: ["آشکارساز جهانی", "غیرمخرب", "مناسب برای گازها"],
  },
  {
    id: "hg-analyzer",
    name: "آنالیزور جیوه",
    category: "mercury-analysis",
    description: "دستگاه آنالیز جیوه بر اساس روش CV-AAS یا روش‌های اسپکتروسکوپی",
    specs: ["آنالیز ppb", "نمونه‌های مایع و جامد", "استاندارد ASTM"],
  },
  {
    id: "sulfur-analyzer",
    name: "آنالیزور سولفور",
    category: "sulfur-analysis",
    description: "دستگاه آنالیز سولفور برای نفت و فرآورده‌های نفتی",
    specs: ["روش احتراق", "دامنه ppm تا درصد", "استاندارد ASTM D4294"],
  },
];

const DEVICE_KEYWORDS: Record<string, string[]> = {
  "gc-fid": ["gc", "fid", "کروماتوگراف", "کروماتوگرافی", "هیدروکربن", "lpg", "lng", "گاز طبیعی", "fid", "شعله"],
  "gc-tcd": ["tcd", "گاز دائمی", "معدنی", "هیدروژن", "نیتروژن", "اکسیژن", "co2", "گاز"],
  "hg-analyzer": ["جیوه", "mercury", "cv-aas", "hg", "آنالیز جیوه"],
  "sulfur-analyzer": ["سولفور", "گوگرد", "sulfur", "d4294", "فرآورده نفتی", "نفت"],
};

export function findRelatedDevices(text: string, limit = 2): DeviceAsset[] {
  const lower = text.toLowerCase();
  const scored = deviceAssets.map((device) => {
    const keywords = DEVICE_KEYWORDS[device.id] || [];
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    return { device, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.device);
}
