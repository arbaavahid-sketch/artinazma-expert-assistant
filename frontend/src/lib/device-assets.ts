export type DeviceAsset = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  keywords: string[];
  /**
   * آدرس واقعی صفحه‌ی محصول روی artinazma.net. اگر تنظیم شود، دکمه‌ی
   * «مشاهده محصول» روی کارت نمایش داده می‌شود. این مقادیر از ایندکس سایت
   * (backend/artinazma_site_index.json) استخراج شده‌اند.
   */
  productUrl?: string;
  /**
   * slug محصول روی سایت برای واکشی عکس از نقشه‌ی product-images.json.
   * اگر عکس موجود باشد جایگزین فیلد image (که فایل محلی است) می‌شود.
   */
  imageSlug?: string;
};

export const deviceAssets: DeviceAsset[] = [
  {
    id: "ra-915m",
    title: "RA-915M Mercury Analyzer",
    subtitle: "آنالایزر جیوه مناسب آب، خاک، گاز و نمونه‌های صنعتی",
    image: "/images/devices/ra-915m.jpg",
    productUrl: "https://artinazma.net/product/ra-915m-mercury-measuring-device/",
    imageSlug: "ra-915m-mercury-measuring-device",
    keywords: [
      "جیوه",
      "mercury",
      "ra-915",
      "ra915",
      "آنالیز جیوه",
    ],
  },
  {
    id: "mga-1000",
    title: "MGA-1000 Atomic Absorption Spectrometer",
    subtitle: "دستگاه جذب اتمی برای آنالیز فلزات و عناصر",
    image: "/images/devices/mga-1000.jpg",
    productUrl: "https://artinazma.net/product/mga-1000-atomic-absorption-spectrometer/",
    imageSlug: "mga-1000-atomic-absorption-spectrometer",
    keywords: [
      "mga",
      "mga-1000",
      "aas",
      "atomic absorption",
      "جذب اتمی",
      "فلزات",
      "عنصری",
      "طلا",
      "نقره",
      "مس",
      "سرب",
    ],
  },
  {
    id: "gc-analyzer",
    title: "GC / Chromatography Analyzer",
    subtitle: "سیستم کروماتوگرافی برای GC، FID، TCD و آنالیز ترکیبات",
    image: "/images/devices/gc-analyzer.jpg",
    productUrl: "https://artinazma.net/product/gas-chromatograph/",
    imageSlug: "gas-chromatograph",
    keywords: [
      "gc",
      "hplc",
      "کروماتوگرافی",
      "chromatography",
      "fid",
      "tcd",
      "baseline",
      "پیک",
      "ستون",
      "گاز کروماتوگراف",
    ],
  },
  {
    id: "sulfur-analyzer",
    title: "Sulfur Analyzer",
    subtitle: "آنالایزر سولفور، گوگرد، H2S و مرکاپتان در سوخت و گاز",
    image: "/images/devices/sulfur-analyzer.jpg",
    productUrl: "https://artinazma.net/product/sulfur-and-nitrogen-measuring-device-model-meta/",
    imageSlug: "sulfur-and-nitrogen-measuring-device-model-meta",
    keywords: [
      "سولفور",
      "گوگرد",
      "sulfur",
      "sulphur",
      "h2s",
      "mercaptan",
      "مرکاپتان",
      "lpg",
      "گاز طبیعی",
    ],
  },
  {
    id: "catalyst-reactor",
    title: "Catalyst Test Reactor",
    subtitle: "سیستم تست کاتالیست، راکتور آزمایشگاهی و ارزیابی عملکرد",
    image: "/images/devices/catalyst-reactor.jpg",
    productUrl: "https://artinazma.net/process-catalysts/",
    imageSlug: "cr-35-reforming-catalyst",
    keywords: [
      "کاتالیست",
      "catalyst",
      "reactor",
      "راکتور",
      "conversion",
      "selectivity",
      "yield",
      "deactivation",
      "افت فعالیت",
    ],
  },
];

// کلیدواژه به‌صورت «کلمه‌ی کامل» تطبیق داده می‌شود، نه زیررشته — وگرنه کلمات کوتاه
// (مثل «آب» داخل «حساب» یا «hg» داخل واژه‌ها) باعث تطبیق‌های نادرست می‌شوند.
const _kwRegexCache = new Map<string, RegExp>();
function _matchesWholeWord(text: string, keyword: string): boolean {
  let re = _kwRegexCache.get(keyword);
  if (!re) {
    const esc = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // مرز = ابتدا/انتهای رشته یا هر چیزی جز حرف/رقم (پوشش یونیکد برای فارسی).
    re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "u");
    _kwRegexCache.set(keyword, re);
  }
  return re.test(text);
}

export function findRelatedDevices(message: string, answer = "", maxResults = 2) {
  const msgNorm = (message || "").toLowerCase();
  const ansNorm = (answer || "").toLowerCase();

  return deviceAssets
    .map((device) => {
      const msgScore = device.keywords.reduce(
        (total, keyword) => (_matchesWholeWord(msgNorm, keyword) ? total + 1 : total),
        0,
      );
      const ansScore = device.keywords.reduce(
        (total, keyword) => (_matchesWholeWord(ansNorm, keyword) ? total + 1 : total),
        0,
      );

      // یک دستگاه فقط وقتی «مرتبط» است که خودِ سؤالِ کاربر به آن اشاره کند
      // (msgScore ≥ ۱)، یا جوابْ آشکارا حولِ آن باشد (ansScore ≥ ۲). یک کلیدواژهٔ
      // اتفاقیِ تکی در جوابِ طولانی کافی نیست — همین باعثِ کارت‌های نامرتبط می‌شد
      // (مثلاً پیشنهادِ آنالایزر گوگرد زیرِ سؤالِ دانسیته‌متر).
      const relevant = msgScore >= 1 || ansScore >= 2;

      return {
        ...device,
        // امتیازِ پیام ۱۰ برابرِ جواب وزن می‌گیرد تا دستگاهِ موردِ اشارهٔ کاربر اول بیاید.
        score: relevant ? msgScore * 10 + ansScore : 0,
      };
    })
    .filter((device) => device.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
