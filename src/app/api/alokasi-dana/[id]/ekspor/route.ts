import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasanExcelBanyakSheet, type SelBaris } from "@/lib/ekspor-excel";
import { hitungRencana, hitungRealisasi } from "@/lib/alokasi-dana";
import { sesiAlokasi, muatRencana } from "@/lib/alokasi-dana-server";

export const dynamic = "force-dynamic";

/** Unduhan Excel rencana + realisasi — angka dari `hitungRencana`/`hitungRealisasi`, SAMA dengan layar & cetak. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await sesiAlokasi();
    const r = await muatRencana((await params).id);
    if (!r) return Response.json({ error: "Rencana tidak ditemukan." }, { status: 404 });
    const h = hitungRencana(r.angkatan, { bulan: r.bulan, posPenampung: r.posPenampung });
    const re = hitungRealisasi(h, r.transaksi);
    const namaAngkatan = new Map(h.angkatan.map(a => [a.id ?? "", a.nama]));

    const ringkasan: SelBaris[] = h.rekap.map(p => [p.nama, ...h.angkatan.map((a, i) => p.perAngkatan[a.id ?? `#${i}`] ?? 0), p.perBulan, p.perSemester, p.perTahun, Math.round(p.porsi * 100) / 100]);
    ringkasan.push(["TOTAL", ...h.angkatan.map(a => a.pemasukanBulan), h.pemasukanBulan, h.pemasukanSemester, h.pemasukanTahun, 100]);
    if (h.belumDialokasikanBulan) ringkasan.push(["(Belum dialokasikan)", ...h.angkatan.map(a => a.belumDialokasikan), h.belumDialokasikanBulan, Math.round(h.belumDialokasikanBulan * h.bulan / 2), h.belumDialokasikanBulan * h.bulan, null]);

    const rincian: SelBaris[] = [];
    for (const a of h.angkatan) {
      for (const p of a.pos) rincian.push([a.nama, a.jumlahSiswa, a.iuran, p.nama, p.jenis === "PERSEN" ? `${p.nilai}%` : `Rp${p.nilai.toLocaleString("id-ID")}/siswa`,
        Math.round(p.perSiswa), p.perBulan, p.perSemester, p.perTahun]);
      if (a.belumDialokasikan) rincian.push([a.nama, a.jumlahSiswa, a.iuran, "(Belum dialokasikan)", "", null, a.belumDialokasikan, Math.round(a.belumDialokasikan * h.bulan / 2), a.belumDialokasikan * h.bulan]);
      rincian.push([`${a.nama} — total`, a.jumlahSiswa, a.iuran, "", "", null, a.pemasukanBulan, a.pemasukanSemester, a.pemasukanTahun]);
    }

    return balasanExcelBanyakSheet(`alokasi-dana-${r.nama.replace(/[^\w-]+/g, "-").toLowerCase()}`, [
      { nama: "Ringkasan per Pos", headers: ["Pos", ...h.angkatan.map(a => `${a.nama} / bulan`), "Total / bulan", "Total / semester", `Total / tahun (${h.bulan} bln)`, "Porsi (%)"], rows: ringkasan },
      { nama: "Rincian per Angkatan", headers: ["Angkatan", "Jumlah Siswa", "Iuran / siswa / bulan", "Pos", "Alokasi", "Per siswa / bulan", "Per bulan", "Per semester", "Per tahun"], rows: rincian },
      { nama: "Saldo per Pos", headers: ["Pos", "Anggaran / tahun", "Uang masuk", "Pengeluaran", "Saldo", "Terpakai (%)"],
        rows: [...re.pos.map(p => [p.nama, p.anggaranTahun, p.masuk, p.keluar, p.saldo, Math.round(p.terpakai * 10) / 10] as SelBaris), ["TOTAL", h.pemasukanTahun, re.totalMasuk, re.totalKeluar, re.saldo, null]] },
      { nama: "Catatan Transaksi", headers: ["Tanggal", "Jenis", "Angkatan", "Pos", "Jumlah", "Keterangan", "Dicatat oleh"],
        rows: r.transaksi.map(t => [t.tanggal, t.jenis === "MASUK" ? "Uang masuk" : "Pengeluaran", t.angkatanId ? namaAngkatan.get(t.angkatanId) ?? "" : "", t.pos ?? "", t.jumlah, t.keterangan ?? "", t.dicatatOleh]) },
    ]);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Admin & Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal membuat berkas." }, { status: 500 });
  }
}
