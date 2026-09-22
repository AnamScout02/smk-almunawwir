import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { aksesRaporKelas } from "@/lib/rapor-form-server";
import { susunRaporKelas } from "@/lib/rapor-cetak";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { petaSingkatanMapel } from "@/lib/singkatan-mapel-server";
import { keteranganSingkatan } from "@/lib/singkatan-mapel";
import { legerRapor } from "@/lib/leger-rapor";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** Unduh Leger Nilai Rapor satu kelas (.xlsx) — isi sama dengan halaman leger (src/lib/leger-rapor.ts). */
export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId") ?? "", semester = sp.get("semester") ?? "";
  if (!semesterRapor().includes(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  if (!(await aksesRaporKelas(session, classId))) return Response.json({ error: "Anda tidak berhak." }, { status: 403 });
  const d = await susunRaporKelas(classId, semester);
  if (!d) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  const semuaMapel = [...new Set(d.siswa.flatMap(s => [...s.umum, ...s.kejuruan, ...s.diniyah].map(b => b.mapel)))];
  const singkatan = await petaSingkatanMapel(semuaMapel);
  const L = legerRapor(d, singkatan);
  const headers = [
    "No", "NIS", "Nama Siswa", ...L.kolom.map(k => k.label), "Jumlah", "Rata-rata", "Peringkat",
    ...L.kolomDiniyah.flatMap(k => [`${k.label} (P)`, `${k.label} (T)`]), ...(L.kolomDiniyah.length ? ["Jumlah Diniyah", "Peringkat Diniyah"] : []),
  ];
  const rows: (string | number | null)[][] = L.baris.map((b, i) => [
    i + 1, b.nis, b.nama, ...b.nilai, b.jumlah, b.rata, b.peringkat,
    ...b.diniyah.flatMap(x => [x.p, x.t]), ...(L.kolomDiniyah.length ? [b.jumlahDiniyah, b.peringkatDiniyah] : []),
  ]);
  const kaki = (label: string, ambil: (j: number) => number | null) => ["", "", label, ...L.kolom.map((_, j) => ambil(j))];
  rows.push([], kaki("KKM", j => L.kolom[j].kkm), kaki("Rata-rata", j => L.statMapel[j].rata), kaki("Tertinggi", j => L.statMapel[j].maks),
    kaki("Terendah", j => L.statMapel[j].min), kaki("Di bawah KKM", j => L.statMapel[j].belumTuntas));
  const ket = keteranganSingkatan(semuaMapel, singkatan);
  if (ket) rows.push([], [`Singkatan: ${ket}`]);
  if (d.mapelTanpaForm.length) rows.push([`Belum dikirim guru mapel (kolom kosong): ${d.mapelTanpaForm.map(m => m.nama).join(", ")}`]);
  const aman = d.kelas.nama.replace(/[^\w-]+/g, "-");
  return balasanExcel({ namaFile: `leger-rapor-${aman}-${semester.replace(/[^\w]+/g, "-")}`, namaSheet: `Leger ${d.kelas.nama}`, headers, rows });
}
