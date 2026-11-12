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
import WorkspaceSectionHeader from "@/components/WorkspaceSectionHeader";
import styles from "@/components/workspace-pages.module.css";

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
    <section className={styles.page} dir={dir}>
      <div className="mx-auto max-w-7xl space-y-5">
        <WorkspaceSectionHeader icon={Package}
          label={isEn ? "ArtinAzma equipment" : "تجهیزات آرتین آزما"}
          title={isEn ? "Product catalog" : "کاتالوگ محصولات"}
          description={isEn ? "Search by instrument or model, then open its specifications or request a quote." : "نام تجهیز یا مدل را جست‌وجو کنید، مشخصاتش را ببینید یا استعلام قیمت بگیرید."}
        />
        <div className="grid min-w-0 gap-4 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start">
          <aside className={`${styles.panel} p-4`} aria-label={isEn ? "Product filters" : "فیلتر محصولات"}>
            <h2 className="mb-2 text-sm">{isEn ? "Filter catalog" : "فیلتر کاتالوگ"}</h2>
            <div className="relative flex items-center">
              <Search size={16} className={`${styles.muted} pointer-events-none absolute start-3`} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEn ? "Search products..." : "جستجوی محصول..."}
                aria-label={isEn ? "Search products" : "جستجوی محصول"}
                className="ui-input min-h-11 min-w-0 !ps-9"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 lg:grid">
              {[{ key: "all", fa: "همه", en: "All" }, ...PRODUCT_CATEGORIES].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  aria-pressed={category === cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`min-h-10 rounded-lg px-3 py-2 text-start text-xs font-bold transition ${
                    category === cat.key
                      ? "bg-[var(--brand-fill)] text-white"
                      : `${styles.muted} hover:bg-[var(--work-tint)]`
                  }`}
                >
                  {isEn ? cat.en : cat.fa}
                </button>
              ))}
            </div>
          </aside>
          <section className="min-w-0" aria-label={isEn ? "Product results" : "نتایج محصولات"}>
            <p role="status" className={`${styles.muted} mb-3 text-sm`}>
              {new Intl.NumberFormat(locale).format(filtered.length)} {isEn ? "products" : "محصول"}
            </p>
            {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Package size={28} className={styles.accent} aria-hidden="true" />
            <h2 className="text-base">{isEn ? "No products matched your search." : "محصولی با جستجوی شما پیدا نشد."}</h2>
            <button type="button" className="ui-btn ui-btn-ghost min-h-11 px-4" onClick={() => { setQuery(""); setCategory("all"); }}>
              {isEn ? "Clear filters" : "پاک کردن فیلترها"}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const quoteHref = `/customer-request?type=price-inquiry&item=${encodeURIComponent(product.title)}`;
              const image = imageMap[product.slug];
              return (
                <div
                  key={product.slug}
                  className={`${styles.tile} !flex flex-col`}
                >
                  <div className="mb-2 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-200">
                    {image ? (
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
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Package size={30} strokeWidth={1.5} aria-hidden="true" />
                        <span className="text-[11px] font-bold">
                          {isEn ? "Image pending" : "تصویر در حال تکمیل"}
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="mb-3 flex-1 text-sm font-bold leading-6" dir="auto">
                    {product.title}
                  </h3>

                  <div className="flex items-center gap-2">
                    <Link
                      href={quoteHref}
                      className="ui-btn ui-btn-primary flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-2.5 py-2.5 text-xs font-black"
                    >
                      <Send size={13} aria-hidden="true" />
                      {isEn ? "Request a quote" : "استعلام قیمت"}
                    </Link>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-btn ui-btn-ghost flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-2.5 py-2.5 text-xs font-bold"
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
          </section>
        </div>
      </div>
    </section>
  );
}
