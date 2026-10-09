import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveExitDate } from "@/lib/student-exit";

export type ButirPeriksa = { kunci: string; label: string; beres: boolean; ket?: string; href?: string; manual?: boolean };

/** Langkah yang hanya bisa dikerjakan MANUSIA di luar situs — dicentang petugas, disimpan di `bukuIndukData.mutasiCentang`
 *  (teks dipisah koma, supaya `bukuIndukData` tetap berisi teks seperti isian Buku Induk lainnya). */
export const MANUAL_KELUAR = [
  { kunci: "dapodik", label: "Dikeluarkan / dimutasi di Dapodik" },
  { kunci: "berkas", label: "Rapor & berkas asli diserahkan ke orang tua" },
  { kunci: "surat", label: "Surat pindah ditandatangani, distempel, dan diserahkan" },
] as const;
export const MANUAL_MASUK = [
  { kunci: "dapodik", label: "Ditarik di Dapodik (dari sekolah asal)" },
  { kunci: "berkas", label: "Rapor & surat pindah ASLI dari sekolah asal diterima" },
  { kunci: "wali", label: "Wali kelas dikabari & siswa masuk grup kelas" },
] as const;

/** DAFTAR PERIKSA MUTASI SATU SISWA (9 Okt 2026) — satu sumber untuk layar. Butir otomatis dibaca dari DATA (bukan dari
 *  ingatan bahwa tombolnya pernah ditekan), jadi daftar ini juga benar untuk mutasi yang dicatat lewat Buku Induk. */
export async function periksaMutasi(studentId: string): Promise<{ arah: "KELUAR" | "MASUK" | null; butir: ButirPeriksa[]; nama: string; kelas: string | null; status: string } | null> {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, nis: true, nisn: true, studentStatus: true, exitDate: true, bukuIndukData: true, birthDate: true, address: true, classId: true, userId: true,
      user: { select: { name: true } }, class: { select: { name: true } },
      internship: { select: { status: true, company: true, mitraId: true, endDate: true } },
    },
  });
  if (!s) return null;
  const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");
  const centang = new Set(str("mutasiCentang").split(",").filter(Boolean));
  const status = s.studentStatus ?? "AKTIF";
  const keluar = status === "PINDAH" || status === "KELUAR";
  const masuk = !keluar && !!str("pindahanDari");
  if (!keluar && !masuk) return { arah: null, butir: [], nama: s.user.name, kelas: s.class?.name ?? null, status };
  const [pinjam, sesi] = await Promise.all([
    prisma.bookLoan.count({ where: { borrowerId: s.userId, status: "DIPINJAM" } }).catch(() => 0),
    prisma.userSession.count({ where: { userId: s.userId, revokedAt: null, expiresAt: { gt: new Date() } } }).catch(() => 0),
  ]);
  const butir: ButirPeriksa[] = [];
  if (keluar) {
    const tgl = resolveExitDate(s);
    butir.push({ kunci: "status", label: `Status siswa: ${status === "PINDAH" ? "Pindah" : "Keluar"}`, beres: true });
    butir.push({ kunci: "tanggal", label: "Tanggal keluar tercatat (masuk Buku Mutasi)", beres: !!tgl, ket: tgl ? tgl.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "isi di Buku Induk → Pindah/Keluar", href: "/dashboard/admin/buku-mutasi" });
    butir.push({ kunci: "tujuan", label: status === "PINDAH" ? "Sekolah tujuan & alasan tercatat" : "Alasan keluar tercatat", beres: status === "PINDAH" ? !!str("transferTo") && !!str("alasanPindah") : !!str("alasanPindah"), ket: str("transferTo") || undefined });
    if (status === "PINDAH") butir.push({ kunci: "suratpindah", label: "Surat Keterangan Pindah dibuat", beres: !!str("suratNo"), ket: str("suratNo") || "belum ada nomor surat", href: str("mutasiSuratId") ? `/dashboard/admin/persuratan/${str("mutasiSuratId")}/cetak` : "/dashboard/admin/persuratan" });
    butir.push({ kunci: "perpus", label: "Buku perpustakaan sudah kembali", beres: pinjam === 0, ket: pinjam ? `${pinjam} buku masih dipinjam` : undefined, href: "/pusat-perpustakaan/sirkulasi" });
    const pklJalan = s.internship?.status === "ONGOING" && !!s.internship.mitraId;
    butir.push({ kunci: "pkl", label: "Tidak ada PKL yang masih berjalan", beres: !pklJalan, ket: pklJalan ? `masih tercatat PKL di ${s.internship?.company} — kabari Humas` : undefined, href: "/pusat-pkl/penempatan" });
    butir.push({ kunci: "akun", label: "Akun siswa sudah dikeluarkan dari semua perangkat", beres: sesi === 0, ket: sesi ? `${sesi} sesi masih aktif` : undefined });
    for (const m of MANUAL_KELUAR) if (m.kunci !== "surat" || status === "PINDAH") butir.push({ kunci: m.kunci, label: m.label, beres: centang.has(m.kunci), manual: true });
  } else {
    butir.push({ kunci: "akun", label: "Akun & NIS diterbitkan", beres: !!s.nis, ket: s.nis });
    butir.push({ kunci: "kelas", label: "Kelas ditetapkan", beres: !!s.classId, ket: s.class?.name ?? "belum ada kelas", href: "/dashboard/admin/students" });
    butir.push({ kunci: "asal", label: "Sekolah asal & tanggal diterima tercatat (masuk Buku Mutasi)", beres: !!str("pindahanDari") && !!str("diterimaDate"), ket: str("pindahanDari"), href: "/dashboard/admin/buku-mutasi" });
    butir.push({ kunci: "nisn", label: "NISN terisi", beres: !!s.nisn, ket: s.nisn ?? "wajib untuk Dapodik" });
    butir.push({ kunci: "biodata", label: "Tanggal lahir & alamat terisi", beres: !!s.birthDate && !!s.address, href: "/dashboard/admin/buku-induk/siswa" });
    butir.push({ kunci: "suratterima", label: "Surat kesediaan menerima dibuat", beres: !!str("mutasiSuratId"), ket: str("mutasiSuratNomor") || "opsional — diminta sebagian sekolah asal", href: str("mutasiSuratId") ? `/dashboard/admin/persuratan/${str("mutasiSuratId")}/cetak` : undefined });
    for (const m of MANUAL_MASUK) butir.push({ kunci: m.kunci, label: m.label, beres: centang.has(m.kunci), manual: true });
  }
  return { arah: keluar ? "KELUAR" : "MASUK", butir, nama: s.user.name, kelas: s.class?.name ?? null, status };
}

/** MUTASI SETAHUN TERAKHIR + sisa langkah manualnya — satu sumber untuk tab "Daftar & periksa" dan Meja Kerja TU.
 *  Buku Induk menyimpan tanda mutasi di JSON, jadi kandidat diambil longgar lalu disaring di sini (pola Buku Mutasi). */
export async function mutasiTerbaru() {
  const setahun = new Date(Date.now() - 400 * 86_400_000);
  const calon = await prisma.student.findMany({
    where: { OR: [{ studentStatus: { in: ["PINDAH", "KELUAR"] } }, { studentStatus: "AKTIF", user: { createdAt: { gte: setahun } } }] },
    select: { id: true, studentStatus: true, exitDate: true, bukuIndukData: true, user: { select: { name: true, createdAt: true } }, class: { select: { name: true } } },
  });
  return calon.flatMap(s => {
    const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
    const keluar = s.studentStatus !== "AKTIF";
    if (!keluar && !(typeof d.pindahanDari === "string" && d.pindahanDari.trim())) return [];
    const t = keluar ? resolveExitDate(s) : new Date(typeof d.diterimaDate === "string" && d.diterimaDate ? d.diterimaDate : s.user.createdAt);
    if (!t || Number.isNaN(+t) || t < setahun) return [];
    const manual = keluar ? MANUAL_KELUAR.filter(x => x.kunci !== "surat" || s.studentStatus === "PINDAH") : MANUAL_MASUK;
    const centang = new Set(String(d.mutasiCentang ?? "").split(",").filter(Boolean));
    return [{ id: s.id, nama: s.user.name, kelas: s.class?.name ?? null, arah: keluar ? "KELUAR" as const : "MASUK" as const, status: s.studentStatus ?? "AKTIF", tanggal: t,
      lain: String(keluar ? d.transferTo ?? "" : d.pindahanDari ?? ""), sisaManual: manual.filter(x => !centang.has(x.kunci)).length }];
  }).sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());
}
