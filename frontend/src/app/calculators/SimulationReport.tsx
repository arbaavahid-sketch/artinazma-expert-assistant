export type SimulationResult = {
  engine: string; engine_version: string; samples: number; seed: number; probability: number;
  mean: number; standard_uncertainty: number; lower: number; upper: number;
  histogram: { offset: number; count: number }[];
  model?: string;
  applicability_exceedances?:number;
  applicability_exceedance_fraction?:number;
};

export default function SimulationReport({ value, en, unit }: { value: SimulationResult; en: boolean; unit: string }) {
  const format = (x: number) => new Intl.NumberFormat(en ? "en" : "fa", { maximumSignificantDigits: 7 }).format(x);
  const max = Math.max(...value.histogram.map(bin => bin.count), 1);
  return <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
    <h4 className="font-bold">{value.engine === "numpy-model-mc"
      ? (en ? "Monte Carlo · full measurement model" : "مونت‌کارلو · معادلهٔ کامل اندازه‌گیری")
      : (en ? "Monte Carlo · linearized budget" : "مونت‌کارلو · بودجهٔ خطی‌شده")}</h4>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt>{en ? "Simulated mean" : "میانگین شبیه‌سازی"}</dt><dd><bdi>{format(value.mean)} {unit}</bdi></dd></div>
      <div><dt>{en ? "Simulated standard uncertainty" : "عدم‌قطعیت استاندارد شبیه‌سازی"}</dt><dd><bdi>{format(value.standard_uncertainty)} {unit}</bdi></dd></div>
      <div className="sm:col-span-2"><dt>{en ? "Equal-tail coverage interval" : "بازهٔ پوشش با دُم‌های برابر"} · {format(value.probability * 100)}%</dt>
        <dd><bdi dir="ltr">[{format(value.lower)}, {format(value.upper)}] {unit}</bdi></dd></div>
    </dl>
    {Boolean(value.applicability_exceedances)&&<p role="alert" className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 text-xs leading-6 text-[var(--color-warning-text)]">{en
      ? `${value.applicability_exceedances} draws (${format(100*(value.applicability_exceedance_fraction??0))}%) were outside the model's nominal applicability bounds. They were evaluated without clipping or discarding. Review distributions and method applicability before using this interval.`
      : `${format(value.applicability_exceedances!)} نمونه (${format(100*(value.applicability_exceedance_fraction??0))}٪) بیرون از حدود کاربرد اسمی مدل بودند. این نمونه‌ها بدون برش یا حذف محاسبه شدند. قبل از استفاده از بازه، توزیع‌ها و دامنهٔ کاربرد روش را بررسی کنید.`}</p>}
    <figure>
      <svg viewBox="0 0 360 140" role="img" aria-label={en ? "Simulated output histogram" : "هیستوگرام خروجی شبیه‌سازی"}>
        {value.histogram.map((bin, index) => <rect key={index} x={10 + index * 340 / value.histogram.length}
          width={Math.max(1, 340 / value.histogram.length - 1)} y={115 - 100 * bin.count / max} height={100 * bin.count / max}
          fill="var(--color-info-text)"><title>{format(bin.offset)} · {bin.count}</title></rect>)}
        <path d="M10 115H350" stroke="currentColor" />
        <text x="10" y="132" fill="currentColor" fontSize="9">{format(value.histogram[0]?.offset ?? 0)}</text>
        <text x="350" y="132" fill="currentColor" textAnchor="end" fontSize="9">{format(value.histogram.at(-1)?.offset ?? 0)}</text>
      </svg>
      <figcaption className="text-xs opacity-75">{en ? "Horizontal axis: deviation from nominal result. Vertical axis: sample count."
        : "محور افقی اختلاف با نتیجهٔ اسمی و محور عمودی تعداد نمونه‌هاست."}</figcaption>
    </figure>
    <p className="text-xs leading-6">{value.engine === "numpy-model-mc"
      ? (en ? "Each sample is evaluated using the registered measurement equation. GUM uses its local first-order sensitivities."
        : "هر نمونه با معادلهٔ ثبت‌شدهٔ اندازه‌گیری محاسبه می‌شود. GUM از ضرایب حساسیت مرتبهٔ اول همان معادله استفاده می‌کند.")
      : (en ? "The simulation propagates the linearized budget using the supplied sensitivities."
        : "شبیه‌سازی با ضرایب حساسیت، بودجهٔ خطی‌شده را منتشر می‌کند.")}</p>
    <p className="text-xs"><bdi>{value.engine} {value.engine_version} · n={value.samples} · seed={value.seed}</bdi></p>
  </section>;
}
