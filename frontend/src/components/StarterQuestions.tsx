"use client";

import { ChartNoAxesCombined, CornerDownLeft, FlaskConical, GitCompare, Microscope, Factory } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThreadPrimitive } from "@assistant-ui/react";
import styles from "@/app/assistant/assistant-start.module.css";
import type { PointerEvent } from "react";

const starters = [
  {
    tone: "equipment",
    Icon: Microscope,
    fa: "انتخاب تجهیزات آزمایشگاهی",
    en: "Choose laboratory equipment",
    detailFa: "از نیاز آزمون تا انتخاب روش و دستگاه مناسب",
    detailEn: "Match your test requirements to a method and instrument",
    questionFa: "برای اندازه‌گیری جیوه در نفت خام، چه روش و تجهیزی مناسب است؟",
    questionEn: "Which method and instrument are suitable for measuring mercury in crude oil?",
  },
  {
    tone: "results",
    Icon: ChartNoAxesCombined,
    fa: "تحلیل نتایج آزمایشگاهی",
    en: "Analyze laboratory results",
    detailFa: "داده‌های لازم برای بررسی تکرارپذیری",
    detailEn: "Identify what you need to assess repeatability",
    questionFa: "برای بررسی تکرارپذیری نتایج یک آزمون آزمایشگاهی چه داده‌هایی لازم است؟",
    questionEn: "What data do I need to assess the repeatability of a laboratory test?",
  },
  {
    tone: "chemistry",
    Icon: FlaskConical,
    fa: "مواد شیمیایی و کاتالیست‌ها",
    en: "Explore chemicals and catalysts",
    detailFa: "معیارهای مقایسهٔ کاتالیست‌های ریفرمینگ",
    detailEn: "Compare naphtha reforming catalysts",
    questionFa: "برای مقایسهٔ کاتالیست‌های ریفرمینگ نفتا چه مشخصاتی را بررسی کنم؟",
    questionEn: "What specifications should I check when comparing naphtha reforming catalysts?",
  },
  {
    tone: "comparison",
    Icon: GitCompare,
    fa: "مقایسهٔ مشخصات فنی تجهیزات",
    en: "Compare instrument specifications",
    detailFa: "آماده‌سازی نمونه و کاربرد XRF و ICP-OES",
    detailEn: "Compare sample prep for XRF and ICP-OES",
    questionFa: "XRF و ICP-OES را از نظر آماده‌سازی نمونه و کاربرد در آنالیز عنصری مقایسه کنید.",
    questionEn: "Compare XRF and ICP-OES in terms of sample preparation and elemental analysis applications.",
  },
  {
    tone: "industry",
    Icon: Factory,
    fa: "کاربرد صنعتی در نفت و پتروشیمی",
    en: "Explore oil and petrochemical applications",
    detailFa: "آزمون‌های کنترل کیفیت سوخت در پالایشگاه",
    detailEn: "Explore refinery fuel quality tests",
    questionFa: "برای پایش کیفیت سوخت در پالایشگاه چه آزمون‌هایی رایج‌اند و هرکدام چه کاربردی دارند؟",
    questionEn: "Which tests are commonly used to monitor fuel quality in a refinery, and what does each test measure?",
  },
];

function moveSpotlight(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === "touch") return;
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
}

function SpectrumIllustration() {
  return (
    <svg viewBox="0 0 288 130" className={styles.spectrum} aria-hidden="true" focusable="false">
      <path d="M0 25h288M0 50h288M0 75h288M0 100h288M25 0v130M70 0v130M115 0v130M160 0v130M205 0v130M250 0v130" fill="none" stroke="currentColor" opacity=".17" />
      <path d="M0 104h33c10 0 16-3 23-13l10-16c4-7 9-7 13 0l9 17c3 6 8 5 11-2l14-31c4-8 7-8 10 0l10 23c4 10 12 10 17 0l21-52c4-10 9-10 13 0l18 52c4 10 12 12 18 2l9-14c5-7 10-7 14 0l12 21c5 8 12 13 26 13h7" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="178" cy="23" r="4" fill="currentColor" />
      <path d="M178 32v76" stroke="currentColor" strokeDasharray="3 5" opacity=".55" />
    </svg>
  );
}

export default function StarterQuestions({ onSelect }: { onSelect: () => void }) {
  const { locale } = useI18n();
  const isEn = locale === "en";

  return (
    <section className={styles.topics} aria-label={isEn ? "Suggested questions" : "پرسش‌های پیشنهادی"}>
      <h3 className="artin-workspace-label mb-3">{isEn ? "Start with a topic" : "از یک موضوع شروع کنید"}</h3>
      <p className="-mt-1 mb-3 text-xs leading-6">
        {isEn ? "Choose a topic to insert an editable draft." : "یک موضوع انتخاب کنید تا متن پیشنهادی در کادر پیام قرار بگیرد."}
      </p>
      <div className={styles.topicGrid}>
        {starters.map(({ tone, Icon, fa, en, detailFa, detailEn, questionFa, questionEn }) => (
          <ThreadPrimitive.Suggestion
            key={en}
            type="button"
            prompt={isEn ? questionEn : questionFa}
            onClick={onSelect}
            data-tone={tone}
            onPointerMove={moveSpotlight}
            aria-label={isEn ? en : fa}
            className={`artin-motion-card ${styles.topic}`}
          >
            {tone === "equipment" ? <SpectrumIllustration /> : (
              <Icon size={88} className={styles.topicArt} strokeWidth={1} aria-hidden="true" />
            )}
            <span className={styles.topicBadge}><Icon size={17} aria-hidden="true" /></span>
            <span className={styles.topicCopy}>
              <strong>{isEn ? en : fa}</strong>
              <small>{isEn ? detailEn : detailFa}</small>
            </span>
            <span className={styles.topicAction}><CornerDownLeft size={15} aria-hidden="true" /></span>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </section>
  );
}
