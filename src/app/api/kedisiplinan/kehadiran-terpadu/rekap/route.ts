import { verifyRole } from "@/lib/dal";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { susunKehadiranGuru } from "@/lib/kehadiran-guru";
import { jumlahRekap, rekapPerGuru } from "@/lib/kehadiran-guru-rekap";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Rekap kehadiran guru di kelas (.xlsx) untuk satu rentang tanggal — data & hitungan sama dengan tab "Rekap per Guru". */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  try { await assertKedisiplinan(session); } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Tidak punya akses" }, { status: 403 }); }
  const u = new URL(req.url), tgl = /^\d{4}-\d{2}-\d{2}$/;
  const dari = u.searchParams.get("dari") ?? "", sampai = u.searchParams.get("sampai") ?? "";
  if (!tgl.test(dari) || !tgl.test(sampai) || dari > sampai) return Response.json({ error: "Rentang tanggal tidak sah" }, { status: 400 });
  if ((new Date(sampai).getTime() - new Date(dari).getTime()) / 86400000 > 31) return Response.json({ error: "Rentang paling panjang 31 hari (satu bulan) — sama dengan batas layar Kehadiran Guru Terpadu." }, { status: 400 });
  const baris = await susunKehadiranGuru({ dari, sampai });
  const r = rekapPerGuru(baris), t = jumlahRekap(r);
  const pct = (v: number | null) => (v == null ? "" : v);
  return balasanExcelBanyakSheet(`rekap-kehadiran-guru-${dari}_${sampai}`, [
    {
      nama: "Rekap per Guru",
      headers: ["No", "Nama", "NIP", "Hari Mengajar", "Jam Terjadwal", "Jam Dicatat Piket", "Belum Dicatat", "Hadir", "Terlambat", "Izin", "Sakit", "Alpha", "Tidak Masuk tetapi Ada Tugas", "Masuk Kelas (%)", "Jurnal Diisi", "Hari Hadir di Sekolah (TU)"],
      rows: [...r.map((x, i) => [i + 1, x.nama, x.nip ?? "", x.hari, x.terjadwal, x.dicatat, x.belumDicatat, x.hadir, x.terlambat, x.izin, x.sakit, x.alpha, x.tugas, pct(x.persen), x.jurnal, x.hadirSekolah]),
        ["", "JUMLAH", "", "", t.terjadwal, t.dicatat, t.belumDicatat, t.hadir, t.terlambat, t.izin, t.sakit, t.alpha, t.tugas, pct(t.persen), t.jurnal, ""]],
    },
    {
      nama: "Rincian per Jam",
      headers: ["Tanggal", "Nama", "Kelas", "Mata Pelajaran", "Jam", "Status", "Ada Tugas", "Catatan Piket"],
      rows: baris.flatMap(b => b.blok.map(k => [b.tanggal, b.nama, k.kelas, k.mapel, k.jam, k.status, k.adaTugas == null ? "" : k.adaTugas ? "Ya" : "Tidak", k.catatan ?? ""])),
    },
  ]);
}
