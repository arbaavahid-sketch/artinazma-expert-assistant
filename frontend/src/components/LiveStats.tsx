"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

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

function StatCard({ stat, delay }: { stat: Stat; delay: number }) {
  const [visible, setVisible] = useState(false);
  const count = useCountUp(visible ? (stat.value ?? 0) : null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white/95 px-3 py-3 shadow-sm transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className={`text-xl font-black ${stat.color}`}>
        {stat.value === null
          ? "—"
          : `${stat.prefix}${count.toLocaleString("fa-IR")}${stat.suffix}`
        }
      </div>
      <div className="mt-0.5 text-[11px] font-bold text-slate-500">{stat.label}</div>
    </div>
  );
}

export default function LiveStats() {
  const [stats, setStats] = useState<Stat[]>([
    { value: null, prefix: "", suffix: "", label: "پاسخ‌گویی آنلاین", color: "text-blue-700" },
    { value: null, prefix: "", suffix: "٪", label: "رضایت کاربران", color: "text-emerald-700" },
    { value: null, prefix: "", suffix: "", label: "بخش دانش تخصصی", color: "text-purple-700" },
    { value: null, prefix: "", suffix: "", label: "سوالات پاسخ‌داده‌شده", color: "text-amber-700" },
  ]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [knowledgeRes, feedbackRes, questionsRes] = await Promise.allSettled([
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
            suffix: "/۷",
            label: "پاسخ‌گویی آنلاین",
            color: "text-blue-700",
          },
          {
            value: questions?.satisfaction_pct ?? 95,
            prefix: "",
            suffix: "٪",
            label: "رضایت کاربران",
            color: "text-emerald-700",
          },
          {
            value: knowledge?.total_chunks ?? 200,
            prefix: "+",
            suffix: "",
            label: "بخش دانش تخصصی",
            color: "text-purple-700",
          },
          {
            value: questions?.total_questions ?? 0,
            prefix: "",
            suffix: "",
            label: "سوالات پاسخ‌داده‌شده",
            color: "text-amber-700",
          },
        ]);
      } catch {
        // fallback to static values
        setStats([
          { value: 24,  prefix: "", suffix: "/۷", label: "پاسخ‌گویی آنلاین",       color: "text-blue-700"    },
          { value: 95,  prefix: "", suffix: "٪",  label: "رضایت کاربران",           color: "text-emerald-700" },
          { value: 200, prefix: "+",suffix: "",   label: "بخش دانش تخصصی",          color: "text-purple-700"  },
          { value: 0,   prefix: "", suffix: "",   label: "سوالات پاسخ‌داده‌شده",    color: "text-amber-700"   },
        ]);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {stats.map((s, i) => (
        <StatCard key={s.label} stat={s} delay={i * 150} />
      ))}
    </div>
  );
}
