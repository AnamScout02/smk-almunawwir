import "server-only";
import { prisma } from "@/lib/prisma";
import { levelPoin, semesterBerjalan, userKesiswaanBk } from "@/lib/peringatan-dini";
import { kirimNotifikasi } from "@/lib/push-server";
import { templateSurat } from "@/lib/template-surat";

/** PANGGILAN ORANG TUA OTOMATIS DARI POIN (17 Sep 2026). Tingkat mengikuti `levelPoin` (Aman < 25 · SP 1 · SP 2 · SP 3 ·
 * Dikembalikan ke Orang Tua ≥ 100) atas poin bersih SEMESTER BERJALAN. Satu draf per tingkat per semester; tingkat yang sama
 * atau lebih rendah tidak dibuat ulang. */
export const URUTAN_TINGKAT = ["Aman", "SP 1", "SP 2", "SP 3", "Dikembalikan ke Orang Tua"];

export async function poinBersih(studentId: string, semester = semesterBerjalan()) {
  const catatan = await prisma.studentPointRecord.findMany({ where: { studentId, semester }, select: { kind: true, points: true } });
  const total = (k: string) => catatan.filter(c => c.kind === k).reduce((a, c) => a + c.points, 0);
  return Math.max(0, total("PELANGGARAN") - total("PRESTASI") - total("REMISI"));
}

export async function periksaPanggilanOtomatis(studentId: string) {
  const semester = semesterBerjalan();
  const poin = await poinBersih(studentId, semester);
  const tingkat = levelPoin(poin);
  const urutan = URUTAN_TINGKAT.indexOf(tingkat);
  if (urutan <= 0) return null;
  const ada = await prisma.panggilanOrangTua.findMany({ where: { studentId, semester, status: { not: "BATAL" } }, select: { tingkat: true } });
  if (ada.some(x => URUTAN_TINGKAT.indexOf(x.tingkat) >= urutan)) return null;
  const siswa = await prisma.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { name: true } }, class: { select: { name: true, homeroom: { select: { userId: true } } } } },
  });
  if (!siswa) return null;
  const draf = await prisma.panggilanOrangTua.create({
    data: {
      studentId, semester, tingkat, poin, otomatis: true,
      alasan: `Akumulasi poin pelanggaran ${poin} pada semester ${semester} (${tingkat}).`,
      keperluan: `Pembinaan kedisiplinan — ${tingkat}`,
    },
  });
  const penerima = [...(await userKesiswaanBk()), siswa.class?.homeroom?.userId].filter((x): x is string => !!x);
  await kirimNotifikasi({
    userIds: penerima, jenis: "PERINGATAN_DINI", kunci: `panggilan-ortu:${draf.id}`,
    judul: `${tingkat}: ${siswa.user.name} perlu pemanggilan orang tua`,
    isi: `${siswa.class?.name ?? "-"} · poin bersih ${poin}. Draf surat panggilan sudah dibuat — tentukan jadwal lalu terbitkan.`,
    url: "/dashboard/teacher/kesiswaan/panggilan", tag: `panggilan-${studentId}`,
  });
  return draf;
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Isi surat dari templat PGL_PELANGGARAN dengan data panggilan. */
export function isiSuratPanggilan(o: { nama: string; kelas: string; uraian: string; periode: string; jadwal: Date; tempat: string; keperluan: string }) {
  const t = templateSurat("PGL_PELANGGARAN");
  if (!t) throw new Error("Templat PGL_PELANGGARAN tidak ditemukan");
  const wib = new Date(o.jadwal.getTime() + 7 * 3600_000);
  const esc = (x: string) => x.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  const ganti: Record<string, string> = {
    "[NAMA SISWA]": esc(o.nama), "[KELAS]": esc(o.kelas), "[URAIAN PELANGGARAN / JUMLAH KETIDAKHADIRAN]": esc(o.uraian),
    "[PERIODE]": esc(o.periode), "[HARI]": HARI[wib.getUTCDay()],
    "[TANGGAL]": wib.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    "[JAM]": `${String(wib.getUTCHours()).padStart(2, "0")}.${String(wib.getUTCMinutes()).padStart(2, "0")}`,
    "[KEPERLUAN]": esc(o.keperluan), "[TEMPAT]": esc(o.tempat),
  };
  let html = t.html;
  for (const [k, v] of Object.entries(ganti)) html = html.split(k).join(v);
  const pihak = t.pihak ? Object.entries(ganti).reduce((a, [k, v]) => a.split(k).join(v), t.pihak) : "";
  return { html, pihak, perihal: t.perihal, klasifikasi: t.klasifikasi };
}
