import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Portal khusus & mandiri untuk staf (Admin/TAS/Guru) mengelola Ujian Online (CBT) — dipisah dari
// /dashboard/admin & /dashboard/teacher supaya jadi "aplikasi sendiri" yang lengkap (Ringkasan, Daftar
// Ujian, Bank Soal, Hasil & Analitik), bukan sekadar 1 menu di antara puluhan menu dashboard lain.
export default async function PusatUjianLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const s = await getSettings(["logo.emblem"]);
  const backHref = session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <header className="relative overflow-hidden px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg print:hidden"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <div className="flex items-center gap-2.5 relative">
          <Image src={s["logo.emblem"]} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
          <div>
            <span className="font-heading font-bold text-white text-sm block leading-tight">Pusat Ujian Online</span>
            <span className="text-white/40 text-[10px] font-semibold tracking-widest uppercase">CBT — SMK Al Munawwir IIBS</span>
          </div>
        </div>
        <Link href={backHref} className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold transition-colors relative">
          <ArrowLeft size={14} /> Kembali ke Dashboard
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
