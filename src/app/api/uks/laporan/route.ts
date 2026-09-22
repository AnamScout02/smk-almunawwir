import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertUks } from "@/lib/uks-guard";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** LAPORAN BULANAN UKS (.xlsx) — ?bulan=YYYY-MM: kunjungan, keluhan terbanyak, obat terpakai, rujukan, status gizi. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  try { await assertUks(session); } catch { return Response.json({ error: "Khusus Kepala UKS." }, { status: 403 }); }
  const bulan = new URL(req.url).searchParams.get("bulan") ?? "";
  if (!/^\d{4}-\d{2}$/.test(bulan)) return Response.json({ error: "Format bulan YYYY-MM." }, { status: 400 });
  const awal = new Date(`${bulan}-01T00:00:00+07:00`);
  const akhir = new Date(awal); akhir.setUTCMonth(akhir.getUTCMonth() + 1);
  const [kunjungan, periksa] = await Promise.all([
    prisma.uksVisit.findMany({
      where: { visitDate: { gte: awal, lt: akhir } }, orderBy: { visitDate: "asc" },
      select: { visitDate: true, complaint: true, treatment: true, rujukan: true, student: { select: { nis: true, gender: true, user: { select: { name: true } }, class: { select: { name: true } } } }, usages: { select: { quantity: true, medicine: { select: { name: true, unit: true } } } } },
    }),
    prisma.pemeriksaanKesehatan.findMany({ where: { tanggal: { gte: awal, lt: akhir } }, select: { statusGizi: true } }),
  ]);
  const keluhan = new Map<string, number>();
  const obat = new Map<string, { jumlah: number; satuan: string }>();
  for (const k of kunjungan) {
    const kunci = k.complaint.trim().toLowerCase();
    keluhan.set(kunci, (keluhan.get(kunci) ?? 0) + 1);
    for (const u of k.usages) { const o = obat.get(u.medicine.name) ?? { jumlah: 0, satuan: u.medicine.unit }; o.jumlah += u.quantity; obat.set(u.medicine.name, o); }
  }
  const gizi = new Map<string, number>();
  for (const p of periksa) gizi.set(p.statusGizi ?? "Tidak lengkap", (gizi.get(p.statusGizi ?? "Tidak lengkap") ?? 0) + 1);
  const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" });
  return balasanExcelBanyakSheet(`laporan-uks-${bulan}`, [
    { nama: "Ringkasan", headers: ["Uraian", "Jumlah"], rows: [
      ["Kunjungan", kunjungan.length], ["Laki-laki", kunjungan.filter(k => k.student.gender === "L").length], ["Perempuan", kunjungan.filter(k => k.student.gender === "P").length],
      ["Dirujuk", kunjungan.filter(k => k.rujukan).length], ["Pemeriksaan TB/BB", periksa.length],
      ...[...gizi].map(([s, n]) => [`Status gizi: ${s}`, n] as [string, number]),
    ] },
    { nama: "Keluhan", headers: ["Keluhan", "Jumlah"], rows: [...keluhan].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, n]) },
    { nama: "Obat Terpakai", headers: ["Obat", "Jumlah", "Satuan"], rows: [...obat].map(([n, o]) => [n, o.jumlah, o.satuan]) },
    { nama: "Kunjungan", headers: ["Tanggal", "Nama", "NIS", "Kelas", "L/P", "Keluhan", "Tindakan", "Rujukan"], rows: kunjungan.map(k => [tgl(k.visitDate), k.student.user.name, k.student.nis, k.student.class?.name ?? "", k.student.gender ?? "", k.complaint, k.treatment ?? "", k.rujukan ?? ""]) },
  ]);
}
