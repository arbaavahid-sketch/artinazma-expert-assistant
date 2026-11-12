"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Stat = {
  value: number | null;
  suffix: string;
  prefix: string;
  label: string;
  color: string;
};

function useCountUp(target: number | null, duration = 1200) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * (target as number)));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return display;
}

function StatCard({ stat, delay, numberLocale }: { stat: Stat; delay: number; numberLocale: string }) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(visible ? (stat.value ?? 0) : null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className={`text-xl font-black tabular-nums ${stat.color}`}>
        {stat.value === null
          ? "—"
          : `${stat.prefix}${count.toLocaleString(numberLocale)}${stat.suffix}`
        }
      </div>
      <div className="mt-0.5 text-[11px] font-bold text-[var(--text-subtle)]">{stat.label}</div>
    </div>
  );
}

export default function LiveStats() {
  const { locale } = useI18n();
  const isEn = locale === "en";
  const numberLocale = isEn ? "en-US" : "fa-IR";
  const labels = useMemo(() => ({
    online: isEn ? "Online support" : "پاسخ‌گویی آنلاین",
    satisfaction: isEn ? "User satisfaction" : "رضایت کاربران",
    knowledge: isEn ? "Knowledge sections" : "بخش دانش تخصصی",
    answered: isEn ? "Answered questions" : "سوالات پاسخ‌داده‌شده",
  }), [isEn]);
  const [stats, setStats] = useState<Stat[]>([
    { value: null, prefix: "", suffix: "", label: labels.online, color: "text-[var(--brand-accent)]" },
    { value: null, prefix: "", suffix: "%", label: labels.satisfaction, color: "text-[var(--brand-accent)]" },
    { value: null, prefix: "", suffix: "", label: labels.knowledge, color: "text-[var(--brand-accent)]" },
    { value: null, prefix: "", suffix: "", label: labels.answered, color: "text-[var(--brand-accent)]" },
  ]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [knowledgeRes, , questionsRes] = await Promise.allSettled([
          fetch(apiUrl("/knowledge/stats"), { cache: "no-store" }).then(r => r.json()),
          fetch(apiUrl("/questions/analytics?days=3650"), { cache: "no-store" }).then(r => r.json()),
          fetch(apiUrl("/questions/stats-public"), { cache: "no-store" }).then(r => r.json()),
        ]);

        const knowledge = knowledgeRes.status === "fulfilled" ? knowledgeRes.value : null;
        const questions = questionsRes.status === "fulfilled" ? questionsRes.value : null;

        setStats([
          {
            value: 24,
            prefix: "",
            suffix: "/7",
            label: labels.online,
            color: "text-[var(--brand-accent)]",
          },
          {
            value: questions?.satisfaction_pct ?? 95,
            prefix: "",
            suffix: "%",
            label: labels.satisfaction,
            color: "text-[var(--brand-accent)]",
          },
          {
            value: knowledge?.total_chunks ?? 200,
            prefix: "+",
            suffix: "",
            label: labels.knowledge,
            color: "text-[var(--brand-accent)]",
          },
          {
            value: questions?.total_questions ?? 0,
            prefix: "",
            suffix: "",
            label: labels.answered,
            color: "text-[var(--brand-accent)]",
          },
        ]);
      } catch {
        // fallback to static values
        setStats([
          { value: 24,  prefix: "", suffix: "/7", label: labels.online,       color: "text-[var(--brand-accent)]"    },
          { value: 95,  prefix: "", suffix: "%",  label: labels.satisfaction, color: "text-[var(--brand-accent)]" },
          { value: 200, prefix: "+",suffix: "",   label: labels.knowledge,    color: "text-[var(--brand-accent)]"  },
          { value: 0,   prefix: "", suffix: "",   label: labels.answered,     color: "text-[var(--brand-accent)]"   },
        ]);
      }
    }
    fetchStats();
  }, [labels.answered, labels.knowledge, labels.online, labels.satisfaction]);

  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {stats.map((s, i) => (
        <StatCard key={s.label} stat={s} delay={i * 150} numberLocale={numberLocale} />
      ))}
    </div>
  );
}
