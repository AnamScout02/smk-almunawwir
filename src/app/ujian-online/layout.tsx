import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

// Layout khusus & minimal (tanpa sidebar/menu navigasi) untuk portal ujian online — sengaja dibuat
// terpisah dari /dashboard/student agar siswa tidak terdistraksi menu lain saat mengerjakan ujian.
export default async function UjianOnlineLayout({ children }: { children: React.ReactNode }) {
  await verifyRole(["STUDENT"]);
  const s = await getSettings(["logo.emblem"]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <header className="bg-primary-900 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg print:hidden">
        <div className="flex items-center gap-2.5">
          <Image src={s["logo.emblem"]} alt="Logo" width={30} height={30} className="rounded-full object-contain" unoptimized />
          <span className="font-heading font-bold text-white text-sm">Portal Ujian Online</span>
        </div>
        <form action={logout}>
          <button type="submit" title="Keluar" className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold transition-colors">
            <LogOut size={14} /> Keluar
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
