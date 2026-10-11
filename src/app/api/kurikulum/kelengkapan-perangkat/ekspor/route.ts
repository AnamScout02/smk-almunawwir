import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { susunKelengkapan } from "@/lib/kelengkapan-perangkat";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Unduhan .xlsx rekap kelengkapan — khusus pengelola kurikulum (isinya data semua guru). */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  try { await assertKurikulum(session); } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Rekap semua guru khusus Administrator dan Wakil Kepala Kurikulum." }, { status: 403 });
  }
  const { semester, baris } = await susunKelengkapan();
  return balasanExcel({
    namaFile: `kelengkapan-perangkat-ajar-${semester.label.replace(/[ /]/g, "-")}`,
    namaSheet: "Kelengkapan Perangkat",
    headers: ["No", "Guru", "NIP", "Mata Pelajaran", "Tingkat", "Kelas", "Prota & Promes", "Jumlah RPP", "Jumlah Jurnal", "Pertemuan Terjadwal", "Form Nilai Terkirim", "Form Nilai Draf", "Ujian CBT", "Ujian Berkisi-kisi Lengkap", "Status"],
    rows: baris.map((b, i) => [
      i + 1, b.guru, b.nip ?? "", b.mapel, b.tingkat, b.kelas.join(", "),
      b.prota ? "Ada" : "Belum", b.rpp, b.jurnal, b.pertemuan ?? "", b.form.dikirim, b.form.draf, b.ujian.jumlah, b.ujian.kisiLengkap, b.lengkap ? "Lengkap" : "Belum lengkap",
    ]),
  });
}
