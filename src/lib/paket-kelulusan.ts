import "server-only";
import { prisma } from "@/lib/prisma";

/** PAKET KELULUSAN (9 Okt 2026) — satu daftar per kelas XII / per tahun lulus: Surat Keterangan Lulus (SKL) tiap siswa dan
 *  status serah terima ijazahnya. SKL = surat keluar biasa dari templat KET_LULUS (nomor agenda TU, ber-QR saat dicetak);
 *  tautannya disimpan di `bukuIndukData.sklSuratId/sklNomor`. Serah terima ijazah tetap di tabelnya sendiri
 *  (`IjazahHandover`) — di sini hanya DIBACA supaya tidak ada dua tempat mencatat penyerahan. */
export type SaringKelulusan = { kelas?: string; lulus?: string };

export async function muatPaketKelulusan(f: SaringKelulusan) {
  const tahun = /^\d{4}$/.test(f.lulus ?? "") ? (f.lulus as string) : "";
  const siswa = await prisma.student.findMany({
    where: f.kelas ? { classId: f.kelas, class: { grade: 12 }, studentStatus: { in: ["AKTIF", "LULUS"] } } : tahun ? { studentStatus: "LULUS" } : { id: "tidak-ada" },
    select: { id: true, nis: true, nisn: true, studentStatus: true, bukuIndukData: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { code: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const kena = tahun ? siswa.filter(s => String(((s.bukuIndukData ?? {}) as Record<string, unknown>).graduationDate ?? "").startsWith(tahun)) : siswa;
  const sklIds = kena.map(s => ((s.bukuIndukData ?? {}) as Record<string, unknown>).sklSuratId).filter((x): x is string => typeof x === "string" && !!x);
  const [surat, serah] = await Promise.all([
    sklIds.length ? prisma.surat.findMany({ where: { id: { in: sklIds } }, select: { id: true, nomor: true, tanggal: true } }) : [],
    prisma.ijazahHandover.findMany({ where: { studentId: { in: kena.map(s => s.id) } }, orderBy: { tanggalSerah: "desc" }, select: { studentId: true, tanggalSerah: true, dokumen: true, pengambilNama: true } }),
  ]);
  const petaSurat = new Map(surat.map(x => [x.id, x]));
  return kena.map(s => {
    const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
    const skl = typeof d.sklSuratId === "string" ? petaSurat.get(d.sklSuratId) ?? null : null; // surat yang sudah dihapus TU = dianggap belum ada
    const h = serah.filter(x => x.studentId === s.id);
    const ijazah = h.find(x => x.dokumen.includes("IJAZAH")) ?? null;
    return { id: s.id, nama: s.user.name, nis: s.nis, nisn: s.nisn, kelas: s.class?.name ?? s.major?.code ?? null, status: s.studentStatus ?? "AKTIF",
      skl: skl ? { id: skl.id, nomor: skl.nomor } : null, ijazah: ijazah ? { tanggal: ijazah.tanggalSerah, oleh: ijazah.pengambilNama } : null, dokumenLain: h.filter(x => x !== ijazah).length };
  });
}
