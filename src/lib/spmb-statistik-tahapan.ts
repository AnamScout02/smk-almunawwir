import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { aturanTahapan, denganBayar, PILIH_TAHAPAN, ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { bacaIsiTahap, bacaSetelanSeragam, hitungImt, susunTahapan, tahapBerlaku, tahapSelesai, type IsiSeragam, type KodeTahap } from "@/lib/spmb-tahapan";

/** Statistik TAHAPAN calon untuk halaman Statistik & Sebaran (6 Oktober 2026) — angka GABUNGAN saja, tanpa nama
 *  (data kesehatan sensitif). Hitungan centang & bayar memakai fungsi yang SAMA dengan halaman Tahapan Calon. */
export async function statistikTahapan() {
  const [baris, gelombang, aturan, setBayar, peta, s] = await Promise.all([
    prisma.admission.findMany({
      select: { ...PILIH_TAHAPAN, id: true, sesiId: true, seragam: true, pemeriksaan: true },
    }),
    prisma.gelombangSpmb.findMany({
      orderBy: { urutan: "asc" },
      select: { id: true, nama: true, sesi: { orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }], select: { id: true, tanggal: true, jamMulai: true, jamSelesai: true, tempat: true, kuota: true, _count: { select: { pendaftar: true } } } } },
    }),
    aturanTahapan(), setelanBayar(), ringkasBayar(), getSettings(["spmb.seragam"]),
  ]);
  const kode = tahapBerlaku(aturan);

  type Rekap = { nama: string; total: number; tahap: Record<string, number>; tuntas: number; bayar: { terkumpul: number; lunas: number; mencicil: number; belum: number; menunggu: number } };
  const kosong = (nama: string): Rekap => ({ nama, total: 0, tahap: Object.fromEntries(kode.map(k => [k, 0])), tuntas: 0, bayar: { terkumpul: 0, lunas: 0, mencicil: 0, belum: 0, menunggu: 0 } });
  const per = new Map<string, Rekap>(gelombang.map(g => [g.id, kosong(g.nama)]));
  const semua = kosong("Semua gelombang");

  const setelanSeragam = bacaSetelanSeragam(s["spmb.seragam"]);
  const seragam: Record<string, Record<string, number>> = Object.fromEntries(setelanSeragam.item.map(i => [i.nama, Object.fromEntries(i.ukuran.map(u => [u.label, 0]))]));
  const imt: Record<string, number> = {};
  let butaWarna = 0, diperiksa = 0;

  for (const mentah of baris) {
    const a = denganBayar(mentah, setBayar, peta);
    const ditolak = ["DITOLAK", "REJECTED"].includes(a.status);
    const { tuntas } = susunTahapan(a, aturan);
    const target = [semua, ...(a.gelombangId && per.has(a.gelombangId) ? [per.get(a.gelombangId)!] : [])];
    for (const r of target) {
      r.total++;
      for (const k of kode) if (tahapSelesai(k as KodeTahap, a, aturan) !== false) r.tahap[k]++;
      if (tuntas) r.tuntas++;
      if (!ditolak) {
        r.bayar.terkumpul += a.bayar.sah;
        if (a.bayar.menunggu > 0) r.bayar.menunggu++;
        if (a.bayar.lunas) r.bayar.lunas++; else if (a.bayar.sah > 0) r.bayar.mencicil++; else r.bayar.belum++;
      }
    }
    if (!ditolak && a.seragamAt) {
      for (const p of ((a.seragam ?? { pilihan: [] }) as IsiSeragam).pilihan ?? []) {
        seragam[p.item] ??= {};
        seragam[p.item][p.ukuran] = (seragam[p.item][p.ukuran] ?? 0) + 1;
      }
    }
    if (a.pemeriksaanAt) {
      diperiksa++;
      const j = bacaIsiTahap(mentah.pemeriksaan).jawaban;
      const n = (k: string) => Number(j.find(x => x.bukuInduk === k)?.nilai);
      const h = hitungImt(n("height"), n("weight"));
      if (h) imt[h.kategori] = (imt[h.kategori] ?? 0) + 1;
      const bw = j.find(x => /buta warna|ishihara/i.test(x.label))?.nilai ?? "";
      if (bw && !/^normal/i.test(bw)) butaWarna++;
    }
  }

  return {
    kode,
    semua,
    perGelombang: gelombang.map(g => per.get(g.id)!).filter(r => r.total > 0),
    sesi: gelombang.flatMap(g => g.sesi.map(x => ({
      gelombang: g.nama, label: `${x.tanggal} · ${x.jamMulai}–${x.jamSelesai}`, tempat: x.tempat, kuota: x.kuota, terisi: x._count.pendaftar,
    }))),
    seragam,
    kesehatan: { diperiksa, imt, butaWarna },
  };
}
