import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export default function CustomerGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("artin_customer");
      if (raw) {
        const customer = JSON.parse(raw) as { id?: number };
        if (customer?.id) {
          setAuthorized(true);
          setChecking(false);
          return;
        }
      }
    } catch {}
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    navigate(`/customer-login?next=${next}`);
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-bold text-slate-700">در حال بررسی ورود...</div>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
