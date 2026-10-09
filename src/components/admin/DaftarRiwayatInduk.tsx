import { History, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/admin/EmptyState";
import type { Perubahan } from "@/lib/buku-induk-diff";
import type { Mentah } from "@/lib/riwayat-induk";
import TombolKembalikanRiwayat from "@/components/admin/TombolKembalikanRiwayat";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator", TAS: "Tata Usaha", TEACHER: "Guru", STUDENT: "Siswa", PARENT: "Orang Tua", SYSTEM: "Sistem",
};

/** Daftar riwayat perubahan Buku Induk satu siswa / satu guru (ActivityLog), dipakai kedua halaman riwayat.
 *  `bolehKembalikan` = pemegang akses Buku Induk penuh; wali kelas hanya membaca. Tombol hanya muncul pada catatan
 *  yang menyimpan nilai aslinya (`mentah`, sejak 9 Okt 2026). */
export default async function DaftarRiwayatInduk({ entitas, id, bolehKembalikan }: { entitas: "Student" | "Teacher"; id: string; bolehKembalikan: boolean }) {
  const logs = await prisma.activityLog.findMany({ where: { entity: entitas, entityId: id }, orderBy: { createdAt: "desc" }, take: 200 });
  if (logs.length === 0) return (
    <EmptyState icon={History} title="Belum Ada Riwayat"
      description="Belum ada perubahan data yang tercatat. Riwayat mulai terkumpul setiap kali data Buku Induk-nya disimpan." />
  );
  return (
    <>
      <div className="space-y-3">
        {logs.map(log => {
          const meta = log.metadata as { perubahan?: Perubahan[]; mentah?: Mentah[] } | null;
          const perubahan = Array.isArray(meta?.perubahan) ? meta!.perubahan! : [];
          const mentah = Array.isArray(meta?.mentah) ? meta!.mentah! : [];
          const bisa = bolehKembalikan && log.action === "UPDATE_BUKU_INDUK" && mentah.length > 0;
          const jalurDari = (kunci: string) => mentah.find(m => m.jalur === `kolom:${kunci}` || m.jalur === `induk:${kunci}` || (kunci === "nama" && m.jalur === "akun:name"))?.jalur;
          return (
            <div key={log.id} className="page-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
                <span className="w-8 h-8 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><User size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-700">{log.description}</span>
                  <span className="block text-xs text-gray-400">
                    {log.userName} · {ROLE_LABEL[log.userRole] ?? log.userRole}{log.impersonatorName ? ` (oleh ${log.impersonatorName})` : ""} ·{" "}
                    {new Date(log.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" })}
                  </span>
                </span>
                {bisa && <TombolKembalikanRiwayat logId={log.id} apa="seluruh perubahan pada catatan ini" />}
              </div>
              {perubahan.length > 0 && (
                <div className="overflow-x-auto scrollbar-visible">
                  <table className="data-table">
                    <thead><tr><th>Kolom</th><th>Sebelum</th><th>Sesudah</th>{bisa && <th className="w-10" />}</tr></thead>
                    <tbody>
                      {perubahan.map((p, i) => {
                        const jalur = bisa ? jalurDari(p.key) : undefined;
                        return (
                          <tr key={`${log.id}-${p.key}-${i}`}>
                            <td className="font-medium whitespace-nowrap">{p.label}<span className="block text-xs font-normal text-gray-400">{p.group}</span></td>
                            <td className="text-red-600 line-through decoration-red-300">{p.sebelum || <span className="text-gray-300 no-underline">(kosong)</span>}</td>
                            <td className="text-emerald-700 font-medium">{p.sesudah || <span className="text-gray-300 font-normal">(kosong)</span>}</td>
                            {bisa && <td>{jalur && <TombolKembalikanRiwayat logId={log.id} jalur={[jalur]} apa={`isian "${p.label}"`} kecil />}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-4">
        Menampilkan {logs.length} catatan terakhir. Tombol Kembalikan tersedia untuk perubahan sejak 9 Oktober 2026 (nilai aslinya ikut disimpan);
        isian yang sudah diubah lagi sesudahnya tidak ditimpa. Catatan sebelum 12 September 2026 hanya berisi keterangan singkat.
      </p>
    </>
  );
}
