export type DeviceAsset = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  keywords: string[];
};

export const deviceAssets: DeviceAsset[] = [
  {
    id: "ra-915m",
    title: "RA-915M Mercury Analyzer",
    subtitle: "آنالایزر جیوه مناسب آب، خاک، گاز و نمونه‌های صنعتی",
    image: "/images/devices/ra-915m.jpg",
    keywords: [
      "جیوه",
      "mercury",
      "hg",
      "ra-915",
      "ra915",
      "آب",
      "خاک",
      "آنالیز جیوه",
    ],
  },
  {
    id: "mga-1000",
    title: "MGA-1000 Atomic Absorption Spectrometer",
    subtitle: "دستگاه جذب اتمی برای آنالیز فلزات و عناصر",
    image: "/images/devices/mga-1000.jpg",
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

export function findRelatedDevices(text: string, maxResults = 2) {
  const normalizedText = text.toLowerCase();

  return deviceAssets
    .map((device) => {
      const score = device.keywords.reduce((total, keyword) => {
        return normalizedText.includes(keyword.toLowerCase())
          ? total + 1
          : total;
      }, 0);

      return {
        ...device,
        score,
      };
    })
    .filter((device) => device.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}
