export const dynamic = "force-dynamic";

import Link from "next/link";
import { IdCard } from "lucide-react";
import { verifySession } from "@/lib/dal";
import KartuAnggotaDigital from "@/components/perpustakaan/KartuAnggotaDigital";

export const metadata = { title: "Kartu Identitas Digital" };

const BERANDA: Record<string, string> = {
  ADMIN: "/dashboard/admin", TAS: "/dashboard/admin", TEACHER: "/dashboard/teacher", STUDENT: "/dashboard/student", PARENT: "/dashboard/parent",
};

/** KARTU IDENTITAS DIGITAL (18 Sep 2026) — semua akun (siswa, guru, pegawai) bisa membuka kartunya sendiri.
 * QR-nya sama persis dengan kartu tanda cetak, jadi bisa dipindai untuk presensi gerbang, perpustakaan,
 * dan layanan sekolah lain tanpa harus membawa kartu fisik. */
export default async function Page() {
  const session = await verifySession();
  return (
    <div className="min-h-dvh bg-[#f0f2f7] py-6">
      <div className="max-w-md mx-auto px-4 pb-2 flex items-center justify-between gap-3">
        <p className="font-heading font-bold text-primary-900 flex items-center gap-2"><IdCard size={18} className="text-gold-dark" /> Kartu Identitas</p>
        <Link href={BERANDA[session.role] ?? "/login"} className="btn-modal-cancel">Kembali</Link>
      </div>
      <KartuAnggotaDigital mode="identitas" />
    </div>
  );
}
