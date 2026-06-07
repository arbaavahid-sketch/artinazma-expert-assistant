"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const STARTER_QUESTIONS_FA: { category: string; icon: string; questions: string[] }[] = [
  {
    category: "کروماتوگرافی",
    icon: "📊",
    questions: [
      "تفاوت GC-FID و GC-TCD در آنالیز گاز طبیعی چیست؟",
      "علت نوسان baseline در کروماتوگراف چیست و چطور رفع می‌شود؟",
    ],
  },
  {
    category: "کاتالیست",
    icon: "⚗️",
    questions: [
      "کاتالیست مناسب فرایند ریفرمینگ نفتا چه ویژگی‌هایی دارد؟",
      "روش ارزیابی فعالیت کاتالیست هیدروکراکینگ چیست؟",
    ],
  },
  {
    category: "استانداردها",
    icon: "📋",
    questions: [
      "استاندارد ASTM D5453 برای اندازه‌گیری سولفور را توضیح دهید",
      "برای تعیین آروماتیک‌ها در بنزین کدام استاندارد ASTM مناسب است؟",
    ],
  },
  {
    category: "تجهیزات",
    icon: "🔬",
    questions: [
      "برای اندازه‌گیری جیوه در نفت خام چه دستگاهی پیشنهاد می‌کنید؟",
      "تفاوت XRF و ICP-OES در آنالیز عنصری چیست؟",
    ],
  },
];

const STARTER_QUESTIONS_EN: { category: string; icon: string; questions: string[] }[] = [
  {
    category: "Chromatography",
    icon: "📊",
    questions: [
      "What is the difference between GC-FID and GC-TCD in natural gas analysis?",
      "What causes baseline fluctuation in chromatography, and how can it be fixed?",
    ],
  },
  {
    category: "Catalyst",
    icon: "⚗️",
    questions: [
      "What properties should a suitable naphtha reforming catalyst have?",
      "How is hydrocracking catalyst activity evaluated?",
    ],
  },
  {
    category: "Standards",
    icon: "📋",
    questions: [
      "Explain ASTM D5453 for sulfur measurement.",
      "Which ASTM standard is suitable for determining aromatics in gasoline?",
    ],
  },
  {
    category: "Equipment",
    icon: "🔬",
    questions: [
      "Which device do you recommend for measuring mercury in crude oil?",
      "What is the difference between XRF and ICP-OES in elemental analysis?",
    ],
  },
];

export default function StarterQuestions({ onSelect }: { onSelect: (q: string) => void }) {
  const { locale, dir } = useI18n();
  const isEn = locale === "en";
  const starterQuestions = locale === "en" ? STARTER_QUESTIONS_EN : STARTER_QUESTIONS_FA;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allQuestions = starterQuestions.flatMap((c) => c.questions);
  const displayQuestions =
    activeCategory
      ? (starterQuestions.find((c) => c.category === activeCategory)?.questions ?? [])
      : allQuestions.slice(0, 4);

  return (
    <div className="mt-8 w-full max-w-3xl px-1 md:px-0" dir={dir}>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold text-slate-400 ml-1">{isEn ? "Topic:" : "موضوع:"}</span>
        {starterQuestions.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(activeCategory === cat.category ? null : cat.category)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              activeCategory === cat.category
                ? "bg-violet-100 text-violet-700"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            }`}
          >
            {cat.icon} {cat.category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {displayQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className={`group flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 ${
              isEn ? "text-left" : "text-right"
            }`}
          >
            <svg
              className={`mt-0.5 shrink-0 text-slate-300 transition group-hover:text-violet-400 ${isEn ? "" : "rotate-180"}`}
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className={`min-w-0 flex-1 leading-6 ${isEn ? "text-left" : "text-right"}`}>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
