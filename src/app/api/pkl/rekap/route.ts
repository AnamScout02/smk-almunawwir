import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { balasTolak, muatPeserta, sesiPkl, terisiPerDudi } from "@/lib/pkl-server";
import { STATUS_PKL, keadaanMou, tglPkl } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** Rekap PKL (.xlsx): ringkasan per DUDI, siswa per DUDI, siswa belum dapat DUDI, dan riwayat mutasi. */
export async function GET() {
  try {
    await sesiPkl();
    const [peserta, dudi, terisi, mutasi] = await Promise.all([
      muatPeserta(),
      prisma.industryPartner.findMany({ orderBy: { name: "asc" } }),
      terisiPerDudi(),
      prisma.mutasiPkl.findMany({ orderBy: { tanggal: "desc" }, include: { internship: { select: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } } } } }),
    ]);
    const ditempatkan = peserta.filter(p => p.tempat).sort((a, b) => (a.tempat ?? "").localeCompare(b.tempat ?? "") || (a.kelas ?? "").localeCompare(b.kelas ?? "") || a.nama.localeCompare(b.nama));
    const belum = peserta.filter(p => !p.tempat && p.status !== "CANCELLED");
    const wib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return balasanExcelBanyakSheet(`rekap-pkl-${wib}`, [
      {
        nama: "Per DUDI",
        headers: ["No", "DUDI", "Bidang", "Kecamatan", "Kabupaten", "Alamat", "Pimpinan", "Narahubung", "Telepon", "Kuota", "Sedang PKL", "Sisa Kuota", "MoU Berakhir", "Keadaan MoU", "Aktif"],
        rows: dudi.map((d, i) => {
          const n = terisi.get(d.id) ?? 0;
          return [i + 1, d.name, d.industryField ?? "", d.kecamatan ?? "", d.kabupaten ?? "", d.address ?? "", d.pimpinan ?? "", d.contactPerson ?? "", d.contactPhone ?? "",
            d.quota ?? "", n, d.quota != null ? d.quota - n : "", d.mouEndDate ? tglPkl(d.mouEndDate) : "", keadaanMou(d.mouEndDate).label, d.aktif ? "Ya" : "Tidak"];
        }),
      },
      {
        nama: "Siswa per DUDI",
        headers: ["No", "DUDI", "Nama Siswa", "NIS", "L/P", "Kelas", "Jurusan", "Posisi", "Pembimbing Industri", "Guru Pembimbing", "Mulai", "Selesai", "Lama (bulan)", "Status", "Diantar", "Dijemput", "Nilai Industri"],
        rows: ditempatkan.map((p, i) => [i + 1, p.tempat ?? "", p.nama, p.nis, p.jk === "Perempuan" || p.jk === "P" ? "P" : p.jk ? "L" : "", p.kelas ?? "", p.jurusan, p.posisi, p.pembimbingIndustri, p.guru ?? "",
          tglPkl(p.mulai), tglPkl(p.selesai), p.lamaBulan ?? "", STATUS_PKL[p.status]?.label ?? p.status, p.diantarPada ? tglPkl(p.diantarPada) : "", p.dijemputPada ? tglPkl(p.dijemputPada) : "", p.nilaiIndustri ?? ""]),
      },
      {
        nama: "Belum Dapat DUDI",
        headers: ["No", "Nama Siswa", "NIS", "L/P", "Kelas", "Jurusan", "Guru Pembimbing", "Rencana Mulai", "Rencana Selesai"],
        rows: belum.map((p, i) => [i + 1, p.nama, p.nis, p.jk === "Perempuan" || p.jk === "P" ? "P" : p.jk ? "L" : "", p.kelas ?? "", p.jurusan, p.guru ?? "", tglPkl(p.mulai), tglPkl(p.selesai)]),
      },
      {
        nama: "Mutasi",
        headers: ["No", "Tanggal", "Nama Siswa", "NIS", "Kelas", "Dari", "Ke", "Alasan", "Dicatat Oleh"],
        rows: mutasi.map((m, i) => [i + 1, tglPkl(m.tanggal), m.internship.student.user.name, m.internship.student.nis, m.internship.student.class?.name ?? "", m.dariNama, m.keNama, m.alasan, m.olehNama]),
      },
    ]);
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
