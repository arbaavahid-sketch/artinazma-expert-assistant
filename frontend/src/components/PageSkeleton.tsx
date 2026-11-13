/**
 * اسکلت بارگذاری مشترک صفحه‌های داده‌محور (داشبوردها و فهرست‌ها).
 * در فایل‌های loading.tsx استفاده می‌شود و تا آمدن کد و دادهٔ صفحه،
 * به‌جای صفحهٔ خالی نمایش داده می‌شود. از .ui-skeleton در globals.css
 * استفاده می‌کند، پس در هر دو تم درست است.
 */
export default function PageSkeleton({ tiles = 4, rows = 6 }: { tiles?: number; rows?: number }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy="true">
      <div className="ui-skeleton mb-3 h-5 w-40" />
      <div className="ui-skeleton mb-8 h-9 w-72 max-w-full" />
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="ui-skeleton h-24" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="ui-skeleton h-14" />
        ))}
      </div>
    </div>
  );
}
