import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { bacaSetelanSeragam, jkDari, type IsiSeragam, type UntukSeragam } from "@/lib/spmb-tahapan";

/** REKAP PESANAN SERAGAM (6–7 Okt 2026) — satu sumber untuk layar, Excel, dan surat pesanan ke penjahit.
 *  Jumlah per item × ukuran DIPISAH per jenis kelamin (potongan putra & putri berbeda). Calon yang ditolak
 *  tidak ikut. Jenis kelamin dari formulir ("Laki-laki"/"Perempuan"; data lama "L"/"P"). */
export type JK = "L" | "P" | "?";
export { jkDari };

export async function rekapSeragam(gelombangId?: string) {
  const [baris, s, gel] = await Promise.all([
    prisma.admission.findMany({
      where: { seragamAt: { not: null }, status: { notIn: ["DITOLAK", "REJECTED"] }, ...(gelombangId ? { gelombangId } : {}) },
      orderBy: [{ gelombang: { urutan: "asc" } }, { fullName: "asc" }],
      select: { nomor: true, fullName: true, gender: true, chosenMajor: true, status: true, seragam: true, gelombang: { select: { nama: true } } },
    }),
    getSettings(["spmb.seragam"]),
    gelombangId ? prisma.gelombangSpmb.findUnique({ where: { id: gelombangId }, select: { nama: true } }) : null,
  ]);
  const setelan = bacaSetelanSeragam(s["spmb.seragam"]);
  const item = setelan.item.map(i => i.nama);
  // Untuk siapa tiap item (Celana khusus putra, Rok khusus putri) — surat pesanan hanya menampilkan kolom yang relevan.
  const untuk: Record<string, UntukSeragam> = Object.fromEntries(setelan.item.map(i => [i.nama, i.untuk ?? "SEMUA"]));
  // hitung[item][ukuran] = { L, P, "?" } — urutan ukuran mengikuti pengaturan, ukuran lama yang sudah dihapus ditambahkan di akhir.
  const hitung: Record<string, Record<string, Record<JK, number>>> = {};
  for (const i of setelan.item) hitung[i.nama] = Object.fromEntries(i.ukuran.map(u => [u.label, { L: 0, P: 0, "?": 0 }]));
  const rincian = baris.map(b => {
    const isi = (b.seragam ?? { pilihan: [] }) as IsiSeragam;
    const jk = jkDari(b.gender);
    const ukuran = item.map(n => isi.pilihan?.find(p => p.item === n)?.ukuran ?? "");
    ukuran.forEach((u, k) => {
      if (!u) return;
      const h = (hitung[item[k]] ??= {});
      (h[u] ??= { L: 0, P: 0, "?": 0 })[jk]++;
    });
    return {
      nomor: b.nomor ?? "", nama: b.fullName, jk, jurusan: b.chosenMajor, gelombang: b.gelombang?.nama ?? "",
      status: LABEL_STATUS[b.status] ?? b.status, ukuran, catatan: isi.catatan ?? "",
    };
  });
  const adaTanpaJk = rincian.some(r => r.jk === "?");
  return { item, untuk, hitung, rincian, jumlah: rincian.length, adaTanpaJk, gelombang: gel?.nama ?? null };
}
export type RekapSeragam = Awaited<ReturnType<typeof rekapSeragam>>;
