export const dynamic = "force-dynamic";
import { Bug } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import TombolHapusGalat from "@/components/admin/TombolHapusGalat";

export const metadata = { title: "Galat Server" };
const waktu = (d: Date) => d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** GALAT SERVER — galat yang tidak tertangkap saat halaman dirender / route dijalankan (src/lib/galat-server.ts), satu baris
 *  per jenis galat. Khusus Superadmin. Catatan dihapus setelah penyebabnya dibereskan; kalau terjadi lagi ia muncul lagi. */
export default async function Page() {
  await verifyRole(["ADMIN"]);
  const kemarin = new Date(Date.now() - 86400_000);
  const [daftar, baru, tertaut] = await Promise.all([
    prisma.galatServer.findMany({ orderBy: { terakhir: "desc" }, take: 200 }).catch(() => []),
    prisma.galatServer.count({ where: { terakhir: { gte: kemarin } } }).catch(() => 0),
    prisma.tautanTelegram.count({ where: { aktif: true, user: { role: "ADMIN" } } }).catch(() => 0),
  ]);
  const kejadian = daftar.reduce((a, g) => a + g.jumlah, 0);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Bug size={22} />} title="Galat Server" description="Galat yang terjadi di server saat halaman dibuka atau data disimpan — untuk diperbaiki sebelum pengguna melapor" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={daftar.length} label="Jenis galat tercatat" ikon="peringatan" color={daftar.length ? "amber" : "emerald"} />
          <StatTile value={baru} label="Terjadi dalam 24 jam terakhir" ikon="daftar-tugas" color={baru ? "red" : "primary"} sorot={baru > 0} />
          <StatTile value={kejadian} label="Jumlah kejadian" ikon="hadir" color="blue" />
        </div>
        {tertaut === 0 && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Belum ada Superadmin yang menautkan Telegram, jadi galat baru hanya tercatat di sini. Tautkan lewat menu Profil supaya dikabari saat itu juga.</p>}
        {daftar.length > 0 && <div className="alat-aksi justify-end"><TombolHapusGalat /></div>}
        {daftar.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada galat tercatat.</p> : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Galat</th><th>Jalur</th><th className="text-right">Kali</th><th>Terakhir</th><th>Pertama</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {daftar.map(g => (
                    <tr key={g.id}>
                      <td className="min-w-[16rem] max-w-[28rem]">
                        <details>
                          <summary className="cursor-pointer font-medium text-primary-900">{g.pesan.slice(0, 160)}</summary>
                          {g.tumpukan && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600">{g.tumpukan}</pre>}
                        </details>
                      </td>
                      <td className="font-mono text-xs text-gray-600">{g.metode} {g.jalur}</td>
                      <td className="angka text-right font-semibold">{g.jumlah}</td>
                      <td className="angka whitespace-nowrap text-xs">{waktu(g.terakhir)}</td>
                      <td className="angka whitespace-nowrap text-xs text-gray-500">{waktu(g.pertama)}</td>
                      <td className="text-right"><TombolHapusGalat id={g.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500">Yang tercatat: galat yang membuat halaman gagal tampil atau permintaan berakhir dengan kesalahan server. Isi permintaan tidak disimpan — hanya jalur, pesan, dan jejak kodenya. Penolakan akses, halaman tidak ditemukan, dan galat yang sudah ditangani halamannya sendiri tidak masuk di sini.</p>
      </div>
    </div>
  );
}
