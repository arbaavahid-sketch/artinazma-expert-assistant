"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Calculator, FlaskConical, MessageSquareText, Package, PhoneCall, Sparkles } from "lucide-react";
import LiveStats from "@/components/LiveStats";
import WorkspaceSectionHeader from "@/components/WorkspaceSectionHeader";
import styles from "@/components/workspace-pages.module.css";
import { useI18n } from "@/lib/i18n";

const brands = [
  { name: "CHROMATEC", href: "https://artinazma.net/chromatec-agency-in-iran/" },
  { name: "SPECTRON", href: "https://artinazma.net/spectron-agency-in-iran/" },
  { name: "LUMEX", href: "https://artinazma.net/lumex-agency-in-iran/" },
  { name: "TERMEX", href: "https://artinazma.net/termex-agency-in-iran/" },
  { name: "NXA", href: "https://artinazma.net/nxa-agency-in-iran/" },
  { name: "HACH", href: "https://artinazma.net/hach-agency-in-iran/" },
  { name: "METTLER TOLEDO", href: "https://artinazma.net/mettler-toledo-agency-in-iran/" },
];

const entryPoints = [
  { href: "/assistant", Icon: MessageSquareText, fa: "گفتگو با آرتین", en: "Chat with Artin", detailFa: "دربارهٔ روش آزمون، تجهیزات یا عیب‌یابی دستگاه بپرسید.", detailEn: "Ask about test methods, equipment or troubleshooting." },
  { href: "/analyze", Icon: FlaskConical, fa: "تحلیل فایل تست", en: "Analyze a test file", detailFa: "گزارش، داده یا تصویر آزمایشگاهی را بررسی کنید.", detailEn: "Review a lab report, data file or image." },
  { href: "/calculators", Icon: Calculator, fa: "محاسبات آزمایشگاهی", en: "Laboratory calculators", detailFa: "روش را انتخاب کنید یا پروندهٔ آزمون را باز کنید.", detailEn: "Select a method or open an existing test project." },
  { href: "/products", Icon: Package, fa: "کاتالوگ محصولات", en: "Product catalog", detailFa: "تجهیز و مدل موردنظر را در کاتالوگ پیدا کنید.", detailEn: "Find equipment and models in the catalog." },
  { href: "/customer-request", Icon: PhoneCall, fa: "درخواست مشاوره", en: "Request consultation", detailFa: "مشاورهٔ فنی یا استعلام قیمت ثبت کنید.", detailEn: "Send a technical question or request a quote." },
];

export default function Home() {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const domains = isEn
    ? ["GC / GC-MS / HPLC", "Mercury and sulfur", "Catalysts and adsorbents", "ASTM test methods", "Fuel, LPG and natural gas"]
    : ["GC / GC-MS / HPLC", "جیوه و سولفور", "کاتالیست و جاذب‌ها", "روش‌های آزمون ASTM", "سوخت، LPG و گاز طبیعی"];

  return (
    <section className={styles.page} dir={dir}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,31%)]">
          <WorkspaceSectionHeader
            icon={Sparkles}
            label={isEn ? "ARTIN · LABORATORY WORKSPACE" : "آرتین · فضای کار آزمایشگاهی"}
            title={isEn ? "ArtinAzma Expert Assistant" : "دستیار تخصصی آرتین آزما"}
            description={isEn
              ? "Technical guidance for equipment, chemicals and test data in oil, gas and petrochemicals."
              : "راهنمای تجهیزات، مواد و داده‌های آزمون در صنایع نفت، گاز و پتروشیمی."}
          >
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/assistant" className="ui-btn ui-btn-primary min-h-11 gap-2 px-5">
                <MessageSquareText size={17} aria-hidden="true" />
                {isEn ? "Start chatting with Artin" : "شروع گفتگو با آرتین"}
              </Link>
              <Link href="/customer-register" className="ui-btn ui-btn-ghost min-h-11 px-4">
                {isEn ? "Register as customer" : "ثبت‌نام مشتری"}
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {domains.map(domain => <li className={styles.chip} key={domain}><bdi>{domain}</bdi></li>)}
            </ul>
          </WorkspaceSectionHeader>

          <aside className={`${styles.panel} p-4`} aria-label={isEn ? "Artin activity" : "فعالیت آرتین"}>
            <div className="mb-3 flex items-center gap-3">
              <Image src="/images/artin-avatar.webp" alt="" width={52} height={52} className="rounded-xl" />
              <strong>{isEn ? "Artin at a glance" : "آرتین در یک نگاه"}</strong>
            </div>
            <LiveStats />
          </aside>
        </div>

        <section aria-labelledby="home-entry-title">
          <h2 id="home-entry-title" className="mb-3 text-lg">{isEn ? "What would you like to do?" : "از کجا شروع کنیم؟"}</h2>
          <div className={styles.tileGrid}>
            {entryPoints.map(({ href, Icon, fa, en, detailFa, detailEn }) => (
              <Link key={href} href={href} className={`artin-motion-card ${styles.tile} ${href === "/assistant" ? styles.featureTile : ""}`}>
                <span className={styles.tileIcon}><Icon size={19} aria-hidden="true" /></span>
                <ArrowUpRight size={17} className={styles.tileArrow} aria-hidden="true" />
                <strong>{isEn ? en : fa}</strong>
                <p>{isEn ? detailEn : detailFa}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} p-4`} aria-labelledby="home-brands">
          <h2 id="home-brands" className="mb-3 text-lg">{isEn ? "ArtinAzma Mehr brands" : "برندهای آرتین آزما مهر"}</h2>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {brands.map(({ name, href }) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer" className={`${styles.brandLink} artin-motion-action`}>
                {name}
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
