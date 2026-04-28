import Link from "next/link";

const navItems = [
  { href: "/", label: "خانه" },
  { href: "/assistant", label: "دستیار فنی" },
  { href: "/analyze", label: "تحلیل تست" },
  { href: "/knowledge", label: "بانک دانش" },
  { href: "/questions", label: "سوالات" },
  { href: "/dashboard", label: "داشبورد" },
];

export default function AppNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-bold text-slate-900">
            ArtinAzma Expert Assistant
          </div>
          <div className="text-sm text-slate-500">
            دستیار تخصصی آرتین آزما
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-700 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}