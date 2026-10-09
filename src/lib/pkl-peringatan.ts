import "server-only";
import { prisma } from "@/lib/prisma";
import { hariPkl } from "@/lib/pkl-harian";
import { rapikanNomorWa } from "@/lib/spmb-form";

export type PeringatanPkl = {
  id: string; studentId: string; nama: string; kelas: string | null; tempat: string; guru: string | null; skor: number; alasan: string[];
  nomorOrtu: string | null;
};

/** PERINGATAN DINI PKL (9 Okt 2026) — SATU sumber. Siswa yang SEDANG PKL dan menunjukkan tanda perlu didatangi:
 *  lama tidak menulis jurnal, alpha, tidak presensi, laporan masalah terbuka, lama tidak dimonitor, tanpa guru pembimbing.
 *  Hasilnya DAFTAR UNTUK DITINDAKLANJUTI, bukan penilaian; ambang & bobot hanya diubah di sini.
 *  Tanda "tidak presensi" baru dihitung bila siswa itu PERNAH presensi — sebelum presensi dipakai, semua siswa akan
 *  tertandai dan daftarnya tidak berarti. */
export async function hitungPeringatanPkl(): Promise<PeringatanPkl[]> {
  const hari = hariPkl(), H = 86_400_000;
  const empatBelas = new Date(hari.getTime() - 13 * H), tigaPuluh = new Date(hari.getTime() - 30 * H);
  const pkl = await prisma.internship.findMany({
    where: { status: "ONGOING", mitraId: { not: null }, startDate: { lte: hari }, endDate: { gte: hari }, student: { studentStatus: "AKTIF" } },
    select: {
      id: true, studentId: true, company: true, startDate: true, teacherId: true, mitraId: true,
      teacher: { select: { user: { select: { name: true } } } },
      student: { select: { parentPhone: true, user: { select: { name: true } }, class: { select: { name: true } } } },
      // 12 jurnal terakhir: yang pertama untuk "lama tidak menulis", semuanya untuk mengenali jurnal salin-tempel.
      journal: { orderBy: { date: "desc" }, take: 12, select: { date: true, activity: true } },
      presensi: { where: { tanggal: { gte: empatBelas } }, select: { tanggal: true, status: true } },
      monitoring: { orderBy: { tanggal: "desc" }, take: 1, select: { tanggal: true } },
      laporanMasalah: { where: { status: { in: ["BARU", "DITANGANI"] } }, select: { id: true } },
      _count: { select: { presensi: true } },
    },
  });
  // JURNAL SALIN-TEMPEL: teks dirapikan (huruf kecil, tanpa tanda baca) lalu dibandingkan. Dua tanda: (a) siswa menulis
  // teks yang SAMA PERSIS berulang, (b) teksnya sama persis dengan teman di DUDI & tanggal yang sama. Jurnal sangat
  // pendek tidak dinilai ("membantu pelanggan" wajar berulang). Ini tanda untuk DILIHAT guru, bukan bukti kecurangan —
  // pekerjaan PKL memang sering berulang.
  const rapi = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const bersama = new Map<string, number>();
  for (const p of pkl) for (const j of p.journal) { const r = rapi(j.activity); if (r.length >= 40) { const k = `${p.mitraId}|${j.date.toISOString().slice(0, 10)}|${r}`; bersama.set(k, (bersama.get(k) ?? 0) + 1); } }
  const hasil: PeringatanPkl[] = [];
  for (const p of pkl) {
    const alasan: string[] = []; let skor = 0;
    const sejak = (d: Date) => Math.floor((hari.getTime() - d.getTime()) / H);
    const berjalan = sejak(p.startDate);
    const tanpaJurnal = sejak(p.journal[0]?.date ?? p.startDate);
    if (tanpaJurnal >= 5) { alasan.push(p.journal[0] ? `tidak menulis jurnal ${tanpaJurnal} hari` : `belum pernah menulis jurnal (${berjalan} hari PKL)`); skor += tanpaJurnal >= 10 ? 3 : 2; }
    const alpha = p.presensi.filter(x => x.status === "ALPHA").length;
    if (alpha >= 2) { alasan.push(`alpha ${alpha} kali dalam 14 hari`); skor += alpha >= 4 ? 4 : 3; }
    if (p._count.presensi > 0) {
      const terakhir = p.presensi.reduce<Date | null>((a, x) => (!a || x.tanggal > a ? x.tanggal : a), null);
      const kosong = terakhir ? sejak(terakhir) : 14;
      if (kosong >= 4) { alasan.push(`tidak presensi ${kosong >= 14 ? "14 hari lebih" : `${kosong} hari`}`); skor += 2; }
    }
    const teks = p.journal.map(j => rapi(j.activity)).filter(r => r.length >= 40);
    const ulang = Math.max(0, ...[...teks.reduce((m, r) => m.set(r, (m.get(r) ?? 0) + 1), new Map<string, number>()).values()]);
    if (ulang >= 4) { alasan.push(`jurnal sama persis ${ulang} kali`); skor += 1; }
    const kembar = p.journal.filter(j => { const r = rapi(j.activity); return r.length >= 40 && (bersama.get(`${p.mitraId}|${j.date.toISOString().slice(0, 10)}|${r}`) ?? 0) >= 2; }).length;
    if (kembar >= 3) { alasan.push(`jurnal sama dengan teman se-DUDI pada ${kembar} hari`); skor += 1; }
    if (p.laporanMasalah.length) { alasan.push(`${p.laporanMasalah.length} laporan masalah belum selesai`); skor += 3; }
    const monitor = p.monitoring[0]?.tanggal;
    if (berjalan >= 30 && (!monitor || monitor < tigaPuluh)) { alasan.push(monitor ? `belum dimonitor ${sejak(monitor)} hari` : "belum pernah dimonitor"); skor += 1; }
    if (!p.teacherId) { alasan.push("belum punya guru pembimbing"); skor += 1; }
    if (!alasan.length) continue;
    const wa = rapikanNomorWa(p.student.parentPhone ?? "");
    const nomor = /^62\d{8,13}$/.test(wa) ? wa : null;
    hasil.push({ id: p.id, studentId: p.studentId, nama: p.student.user.name, kelas: p.student.class?.name ?? null, tempat: p.company, guru: p.teacher?.user.name ?? null, skor, alasan, nomorOrtu: nomor });
  }
  return hasil.sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama, "id"));
}
