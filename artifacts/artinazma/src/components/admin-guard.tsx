import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const res = await fetch("/api/admin-status", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { logged_in: boolean };
          if (data.logged_in) {
            setAuthorized(true);
            setChecking(false);
            return;
          }
        }
      } catch {}
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/admin-login?next=${next}`);
    }
    checkAdminAuth();
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-bold text-slate-700">در حال بررسی دسترسی...</div>
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
