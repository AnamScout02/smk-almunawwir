import { BookUser } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { kelasBukuWali, susunBukuWali } from "@/lib/buku-wali";
import BukuWaliKelas from "@/components/wali/BukuWaliKelas";

/** Isi halaman Buku Wali Kelas untuk kedua portal (guru: kelas walinya; Admin: semua kelas). */
export default async function HalamanBukuWali({ session, kelas, basePath }: { session: { role: string; email: string }; kelas?: string; basePath: string }) {
  const daftar = await kelasBukuWali(session);
  const judul = <PageHeader icon={<BookUser size={22} />} title="Buku Wali Kelas" description="Kehadiran, poin, nilai, izin, ekstrakurikuler, dan kunjungan rumah tiap siswa dalam satu halaman" printHidden />;
  if (!daftar.length) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<p className="py-10 text-center text-sm text-gray-400">Halaman ini untuk wali kelas. Anda belum menjadi wali kelas mana pun.</p></div>;
  const dipilih = daftar.find(k => k.id === kelas) ?? daftar[0];
  const d = await susunBukuWali(dipilih.id);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      {d ? <BukuWaliKelas data={d} daftarKelas={daftar} basePath={basePath} portal={session.role === "ADMIN" ? "admin" : "guru"} /> : <p className="py-10 text-center text-sm text-gray-400">Kelas tidak ditemukan.</p>}
    </div>
  );
}
