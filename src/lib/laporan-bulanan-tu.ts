import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveExitDate } from "@/lib/student-exit";

/** LAPORAN BULANAN TATA USAHA (9 Okt 2026) — satu bulan kalender (WIB) dari tabel yang sudah ada; tidak ada isian baru.
 *  Aturan mutasi SAMA dengan Buku Mutasi (/api/admin/buku-mutasi): masuk = siswa ber-`pindahanDari`, keluar = status
 *  PINDAH/KELUAR menurut `resolveExitDate`; kelulusan bukan mutasi. Kalau aturan di sana diubah, ubah di sini juga.
 *  "Keadaan siswa" adalah keadaan SAAT LAPORAN DIBUAT (situs tidak menyimpan potret akhir bulan) — laporannya menyebut begitu. */
const WIB = 7 * 3600_000;
const aman = <T,>(p: Promise<T>, cadangan: T) => p.catch(() => cadangan);
const kelompok = <T,>(a: T[], kunci: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of a) { const k = kunci(x) || "Lainnya"; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
};

export function bulanSah(v: string | undefined): string {
  if (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return v;
  const k = new Date(Date.now() + WIB);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function susunLaporanBulanan(bulan: string) {
  const [th, bl] = bulan.split("-").map(Number);
  const dari = new Date(Date.UTC(th, bl - 1, 1) - WIB), sampai = new Date(Date.UTC(th, bl, 1) - WIB);
  const rentang = { gte: dari, lt: sampai };
  const diBulan = (d: Date | null | undefined) => !!d && d >= dari && d < sampai;

  const [suratMasuk, suratKeluar, disposisi, disposisiSelesai, ekspedisi, suratKet, legalisir, legalisirDiambil, tamu, siswa,
    presensi, cuti, bantuan, ijazah, rapor, arsip, spmb, biodataSiswa, biodataPegawai] = await Promise.all([
    aman(prisma.surat.findMany({ where: { tipe: "MASUK", tanggal: rentang }, select: { fileUrl: true, _count: { select: { disposisi: true } } } }), []),
    aman(prisma.surat.findMany({ where: { tipe: "KELUAR", tanggal: rentang }, select: { klasifikasi: true, content: true, docxUrl: true } }), []),
    aman(prisma.disposisi.count({ where: { tanggal: rentang } }), 0),
    aman(prisma.disposisi.count({ where: { selesaiAt: rentang } }), 0),
    aman(prisma.ekspedisi.findMany({ where: { tanggal: rentang }, select: { status: true } }), []),
    aman(prisma.suratKeterangan.findMany({ where: { tanggal: rentang }, select: { jenis: true } }), []),
    aman(prisma.legalisirRequest.findMany({ where: { requestDate: rentang }, select: { documentType: true, copies: true, status: true } }), []),
    aman(prisma.legalisirRequest.count({ where: { pickupDate: rentang } }), 0),
    aman(prisma.guestBookEntry.findMany({ where: { visitDate: rentang }, select: { category: true } }), []),
    aman(prisma.student.findMany({ select: { id: true, nis: true, gender: true, studentStatus: true, exitDate: true, bukuIndukData: true, user: { select: { name: true, createdAt: true } }, class: { select: { name: true, grade: true } } } }), []),
    aman(prisma.staffAttendance.findMany({ where: { tanggal: rentang }, select: { status: true } }), []),
    aman(prisma.staffLeave.findMany({ where: { startDate: rentang }, select: { jenis: true, days: true, status: true } }), []),
    aman(prisma.bantuanSiswa.findMany({ where: { tanggalCair: rentang }, select: { jenis: true, nominal: true, statusAmbil: true } }), []),
    aman(prisma.ijazahHandover.count({ where: { tanggalSerah: rentang } }), 0),
    aman(prisma.raporHandover.count({ where: { tanggalAmbil: rentang } }), 0),
    aman(prisma.arsip.count({ where: { tanggal: rentang } }), 0),
    aman(prisma.admission.count({ where: { createdAt: rentang } }), 0),
    aman(prisma.profileEditRequest.count({ where: { reviewedAt: rentang } }), 0),
    aman(prisma.pegawaiEditRequest.count({ where: { reviewedAt: rentang } }), 0),
  ]);

  const bi = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, string>;
  const baris = (s: (typeof siswa)[number], tanggal: Date | null, lain: string) => ({ id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "—", tanggal, lain });
  const masuk = siswa.filter(s => { const b = bi(s.bukuIndukData); return !!b.pindahanDari && diBulan(new Date(b.diterimaDate || s.user.createdAt)); })
    .map(s => { const b = bi(s.bukuIndukData); return baris(s, new Date(b.diterimaDate || s.user.createdAt), b.pindahanDari); });
  const keluar = siswa.filter(s => ["PINDAH", "KELUAR"].includes(s.studentStatus ?? "") && diBulan(resolveExitDate(s)))
    .map(s => { const b = bi(s.bukuIndukData); return baris(s, resolveExitDate(s), s.studentStatus === "PINDAH" ? `pindah ke ${b.transferTo || "—"}` : `keluar${b.alasanPindah ? ` — ${b.alasanPindah}` : ""}`); });
  const lulus = siswa.filter(s => s.studentStatus === "LULUS" && diBulan(resolveExitDate(s))).length;

  const aktif = siswa.filter(s => (s.studentStatus ?? "AKTIF") === "AKTIF");
  const keadaan = [10, 11, 12, 0].map(g => {
    const a = aktif.filter(s => (g ? s.class?.grade === g : ![10, 11, 12].includes(s.class?.grade ?? 0)));
    return { label: g === 10 ? "X" : g === 11 ? "XI" : g === 12 ? "XII" : "Belum ada kelas", L: a.filter(s => s.gender === "L").length, P: a.filter(s => s.gender === "P").length, jumlah: a.length };
  }).filter(k => k.label !== "Belum ada kelas" || k.jumlah > 0);

  return {
    bulan, dari, sampai,
    surat: {
      masuk: suratMasuk.length, masukDipindai: suratMasuk.filter(s => s.fileUrl).length, masukDidisposisi: suratMasuk.filter(s => s._count.disposisi > 0).length,
      keluar: suratKeluar.length, keluarBerisi: suratKeluar.filter(s => (s.content && s.content.trim()) || s.docxUrl).length,
      perKlasifikasi: kelompok(suratKeluar, s => s.klasifikasi ?? "Tanpa klasifikasi"),
      disposisi, disposisiSelesai,
      ekspedisi: ekspedisi.length, ekspedisiDiterima: ekspedisi.filter(e => e.status !== "DIKIRIM").length,
    },
    layanan: {
      suratKet: suratKet.length, suratKetPerJenis: kelompok(suratKet, s => s.jenis),
      legalisir: legalisir.length, legalisirLembar: legalisir.reduce((a, l) => a + l.copies, 0), legalisirDiambil,
      legalisirPerDokumen: kelompok(legalisir, l => l.documentType),
      tamu: tamu.length, tamuPerKategori: kelompok(tamu, t => t.category),
      ijazah, rapor, arsip,
      bantuan: bantuan.length, bantuanNominal: bantuan.reduce((a, b) => a + b.nominal, 0), bantuanDiambil: bantuan.filter(b => b.statusAmbil !== "BELUM").length,
    },
    siswa: { masuk, keluar, lulus, keadaan, totalAktif: aktif.length, spmb, biodata: biodataSiswa },
    pegawai: {
      presensi: kelompok(presensi, p => p.status), presensiTotal: presensi.length,
      cuti: cuti.length, cutiHari: cuti.filter(c => c.status !== "DITOLAK").reduce((a, c) => a + c.days, 0), cutiPerJenis: kelompok(cuti, c => c.jenis.replace(/_/g, " ")),
      biodata: biodataPegawai,
    },
  };
}
export type LaporanBulanan = Awaited<ReturnType<typeof susunLaporanBulanan>>;
