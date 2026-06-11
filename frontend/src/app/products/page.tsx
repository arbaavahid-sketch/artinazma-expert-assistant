"use client";
/**
 * صفحه‌ی کاتالوگ محصولات — فهرست کامل محصولات ArtinAzma با جستجو.
 * هر کارت به صفحه‌ی واقعی محصول لینک می‌دهد و دکمه‌ی «استعلام قیمت» دارد
 * که فرم درخواست را با همان محصول از پیش پر می‌کند.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Package, Search, Send } from "lucide-react";
import { products, PRODUCT_CATEGORIES, categorizeProduct } from "@/lib/products-catalog";
import productImages from "@/lib/product-images.json";
import { useI18n } from "@/lib/i18n";

const imageMap = productImages as Record<string, string>;

export default function ProductsPage() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery = !q || p.title.toLowerCase().includes(q) || p.slug.includes(q);
      const matchesCategory = category === "all" || categorizeProduct(p.title) === category;
      return matchesQuery && matchesCategory;
    });
  }, [query, category]);

  return (
    <section className="brand-shell-bg min-h-full px-5 py-6 md:px-8 md:py-8" dir={dir}>
      <div className="mx-auto max-w-7xl">
        <div className="brand-panel hero-grid-bg mb-6 overflow-hidden rounded-[34px]">
          <div className="bg-gradient-to-l from-blue-50/85 via-white/80 to-slate-50/70 p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
            <h1 className="text-2xl font-black text-slate-900 md:text-3xl dark:text-slate-100">
              {isEn ? "Product catalog" : "کاتالوگ محصولات"}
            </h1>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
              {isEn
                ? `Browse all ${products.length} ArtinAzma products and request a quote for any item.`
                : `مرور همه‌ی ${products.length} محصول آرتین آزما و استعلام قیمت هر مورد.`}
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEn ? "Search products..." : "جستجوی محصول..."}
                aria-label={isEn ? "Search products" : "جستجوی محصول"}
                className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[{ key: "all", fa: "همه", en: "All" }, ...PRODUCT_CATEGORIES].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    category === cat.key
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {isEn ? cat.en : cat.fa}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {isEn ? "No products matched your search." : "محصولی با جستجوی شما پیدا نشد."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const quoteHref = `/customer-request?type=price-inquiry&item=${encodeURIComponent(product.title)}`;
              const image = imageMap[product.slug];
              return (
                <div
                  key={product.slug}
                  className="flex flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.title}
                        loading="lazy"
                        className="h-full w-full object-contain p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Package size={30} strokeWidth={1.5} className="text-slate-300" aria-hidden="true" />
                    )}
                  </div>

                  <div className="mb-3 text-sm font-black leading-6 text-slate-900 dark:text-slate-100">
                    {product.title}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={quoteHref}
                      className="ui-btn ui-btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-black"
                    >
                      <Send size={13} aria-hidden="true" />
                      {isEn ? "Request a quote" : "استعلام قیمت"}
                    </Link>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-btn ui-btn-ghost flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold"
                    >
                      {isEn ? "View" : "مشاهده"}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
