"use client";
import { useState } from "react";
import { LogOut, UserCog, Loader2 } from "lucide-react";

/** Pita peringatan persisten selama ADMIN sedang "Masuk Sebagai" akun lain — supaya tidak lupa
 * lagi berada di akun siapa, dan selalu ada jalan cepat kembali tanpa perlu logout manual. Dipasang
 * di ketiga layout dashboard (admin/teacher/student), muncul kalau cookie `impersonator` valid
 * (dicek server-side, lihat getImpersonatorSession di session.ts). */
export default function ImpersonationBanner({ adminName }: { adminName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleStop() {
    setLoading(true);
    const res = await fetch("/api/admin/impersonate/stop", { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      window.location.href = d.redirectTo || "/dashboard/admin/users";
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-md sm:text-sm">
      <span className="flex items-center gap-1.5">
        <UserCog size={15} className="shrink-0" />
        Anda sedang <strong>Masuk Sebagai</strong> akun ini (login asli: {adminName})
      </span>
      <button
        onClick={handleStop}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-1 text-amber-50 transition-colors hover:bg-amber-900 disabled:opacity-60"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        Kembali ke Akun Admin
      </button>
    </div>
  );
}
