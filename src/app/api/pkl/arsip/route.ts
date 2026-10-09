import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { labelTa, muatArsipPkl, ringkasAngkatan } from "@/lib/pkl-arsip";
import { STATUS_PKL } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

const tgl = (d: Date) => d.toISOString().slice(0, 10);

/** Unduh arsip PKL satu angkatan (.xlsx): Ringkasan · Per DUDI · Daftar Siswa. */
export async function GET(req: NextRequest) {
  try {
    await sesiPkl();
    const ta = Number(req.nextUrl.searchParams.get("ta"));
    if (!Number.isInteger(ta) || ta < 2000 || ta > 2100) return Response.json({ error: "Tahun ajaran tidak dikenali." }, { status: 400 });
    const b = (await muatArsipPkl()).filter(x => x.ta === ta);
    const r = ringkasAngkatan(b);
    const label = (s: string) => (STATUS_PKL as Record<string, { label: string }>)[s]?.label ?? s;
    return balasanExcelBanyakSheet(`arsip-pkl-${ta}-${ta + 1}`, [
      { nama: "Ringkasan", headers: ["Keterangan", "Jumlah"], rows: [
        ["Tahun ajaran", labelTa(ta)], ["Peserta PKL", r.peserta], ["Mendapat tempat PKL", r.ditempatkan], ["Selesai PKL", r.selesai],
        ["Dibatalkan", r.batal], ["DUDI yang ditempati", r.dudi], ["Mutasi tempat", r.mutasi], ["Sertifikat terbit", r.sertifikat],
        ["Rata-rata nilai industri", r.rataIndustri ?? ""],
      ] },
      { nama: "Per DUDI", headers: ["No", "DUDI", "Siswa", "Selesai", "Rata-rata nilai industri"], rows: r.perDudi.map((d, i) => [i + 1, d.nama, d.siswa, d.selesai, d.rata ?? ""]) },
      { nama: "Daftar Siswa", headers: ["No", "NIS", "Nama", "Kelas sekarang", "Jurusan", "Status siswa", "Tempat PKL", "Posisi", "Mulai", "Selesai", "Lama (bulan)", "Status PKL", "Guru pembimbing", "Nilai industri", "Nilai akhir", "Jurnal", "Monitoring", "Mutasi", "No. sertifikat"],
        rows: b.map((x, i) => [i + 1, x.nis, x.nama, x.kelas ?? "", x.jurusan, x.statusSiswa, x.tempat ?? "Belum dapat DUDI", x.posisi, tgl(x.mulai), tgl(x.selesai), x.lamaBulan ?? "", label(x.status), x.guru ?? "", x.nilaiIndustri ?? "", x.nilaiAkhir ?? "", x.jurnal, x.monitoring, x.mutasi, x.sertifikat ?? ""]) },
    ]);
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
