export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

function sortByNip<T extends { nip: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const na = parseInt((a.nip ?? "").replace(/\D/g, ""), 10);
    const nb = parseInt((b.nip ?? "").replace(/\D/g, ""), 10);
    if (isNaN(na) || isNaN(nb)) return (a.nip ?? "").localeCompare(b.nip ?? "");
    return na - nb;
  });
}

export default async function CetakAkunLoginPage() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["TEACHER", "TAS"] } },
    select: { id: true, name: true, email: true, role: true, teacher: { select: { nip: true } } },
  }).catch(() => []);

  const rows = sortByNip(users.map(u => ({ ...u, nip: u.teacher?.nip ?? null })));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6 max-w-4xl mx-auto">
        <Link href="/dashboard/admin/users" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="max-w-4xl mx-auto bg-white print:shadow-none shadow-lg rounded-2xl print:rounded-none p-8 print:p-0">
        <div className="text-center mb-6">
          <h1 className="font-heading text-xl font-bold text-navy">Daftar Akun Login Guru &amp; Pegawai</h1>
          <p className="text-sm text-gray-500">SMK Al Munawwir IIBS — Dicetak {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3 mb-5 print:border-black print:bg-white">
          <b>Catatan:</b> Semua akun guru &amp; TAS/staf sudah di-set ulang ke password default yang sama: <b>Almunawwir1</b>. Sampaikan ke setiap pemilik akun untuk segera mengganti password ini setelah login pertama kali (menu Profil Saya). Kalau ada yang sudah pernah mengganti sendiri SETELAH tanggal cetak ini, password di lembar ini otomatis tidak berlaku lagi untuk akun tsb.
        </div>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-navy">
              <th className="text-left py-2 pr-2 w-8">No</th>
              <th className="text-left py-2 pr-2">Nama</th>
              <th className="text-left py-2 pr-2">Jabatan</th>
              <th className="text-left py-2 pr-2">Email (Username)</th>
              <th className="text-left py-2">Password Default</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id} className="border-b border-gray-200">
                <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                <td className="py-2 pr-2 font-semibold text-navy">{u.name}</td>
                <td className="py-2 pr-2 text-gray-500">{u.role === "TEACHER" ? "Guru" : "TAS/Staf"}</td>
                <td className="py-2 pr-2 font-mono text-xs">{u.email}</td>
                <td className="py-2 font-mono text-xs">{u.nip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="text-center text-gray-400 py-10 text-sm">Belum ada akun guru/pegawai.</p>
        )}
      </div>
    </div>
  );
}
