import type { Metadata } from "next";
import { products } from "@/lib/products-catalog";

/**
 * لایه‌ی سرور برای صفحه‌ی /products — چون خود صفحه client component است و
 * نمی‌تواند metadata صادر کند، عنوان/توضیحات SEO و structured data اینجا تعریف
 * می‌شوند. این به ایندکس بهتر کاتالوگ در گوگل کمک می‌کند.
 */

export const metadata: Metadata = {
  title: "کاتالوگ محصولات | آرتین آزما",
  description:
    "فهرست کامل تجهیزات آزمایشگاهی، آنالایزرها (گوگرد، جیوه، GC، XRF)، کاتالیست‌ها و مواد شیمیایی آرتین آزما — مرور محصولات و استعلام قیمت آنلاین.",
  keywords: [
    "کاتالوگ محصولات",
    "تجهیزات آزمایشگاهی",
    "آنالایزر گوگرد",
    "آنالایزر جیوه",
    "کروماتوگرافی",
    "کاتالیست",
    "آرتین آزما",
  ],
  alternates: { canonical: "https://artinazma.net/products" },
  openGraph: {
    title: "کاتالوگ محصولات آرتین آزما",
    description: "مرور همه‌ی تجهیزات، کاتالیست‌ها و مواد شیمیایی و استعلام قیمت.",
    url: "https://artinazma.net/products",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "کاتالوگ محصولات آرتین آزما",
  url: "https://artinazma.net/products",
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: product.url,
      name: product.title,
    })),
  },
};

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
