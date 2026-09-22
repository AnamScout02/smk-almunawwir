export const dynamic = "force-dynamic";

import { BarChart3, Library, Tags, TrendingUp, Trophy, LineChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import StatTile from "@/components/admin/StatTile";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { aturanPerpustakaan, hitungDenda } from "@/lib/perpustakaan-server";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const kunciBulan = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

/** LAPORAN PERPUSTAKAAN — 12 bulan terakhir: tren peminjaman & kunjungan, buku terpopuler, kategori, anggota
 * teraktif, dan ketepatan pengembalian. Grafik batang CSS sederhana (tanpa pustaka grafik). */
export default async function LaporanPerpustakaanPage() {
  const kini = new Date();
  const wib = new Date(kini.getTime() + 7 * 3600_000);
  const bulan = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() - 11 + i, 1));
    return { kunci: d.toISOString().slice(0, 7), label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }) };
  });
  const sejak = new Date(`${bulan[0].kunci}-01T00:00:00+07:00`);

  const [aturan, pinjaman, kunjungan] = await Promise.all([
    aturanPerpustakaan(),
    prisma.bookLoan.findMany({
      where: { borrowDate: { gte: sejak } },
      select: {
        borrowDate: true, dueDate: true, returnDate: true, status: true, finePaid: true, borrowerId: true,
        book: { select: { id: true, title: true, author: true, category: true } },
        borrower: { select: { name: true, role: true, student: { select: { class: { select: { name: true } } } } } },
      },
    }),
    prisma.libraryVisit.findMany({ where: { visitedAt: { gte: sejak } }, select: { visitedAt: true } }),
  ]);

  const perBulan = new Map(bulan.map(b => [b.kunci, { pinjam: 0, kunjung: 0 }]));
  for (const p of pinjaman) { const b = perBulan.get(kunciBulan(p.borrowDate)); if (b) b.pinjam++; }
  for (const v of kunjungan) { const b = perBulan.get(kunciBulan(v.visitedAt)); if (b) b.kunjung++; }
  const maksBulan = Math.max(1, ...[...perBulan.values()].flatMap(b => [b.pinjam, b.kunjung]));

  const hitung = <K,>(xs: typeof pinjaman, f: (p: (typeof pinjaman)[number]) => K) => {
    const m = new Map<K, number>();
    for (const p of xs) m.set(f(p), (m.get(f(p)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const populer = hitung(pinjaman, p => p.book.id).slice(0, 10).map(([id, n]) => ({ buku: pinjaman.find(p => p.book.id === id)!.book, n }));
  const kategori = hitung(pinjaman, p => p.book.category);
  const teraktif = hitung(pinjaman, p => p.borrowerId).slice(0, 10).map(([id, n]) => ({ orang: pinjaman.find(p => p.borrowerId === id)!.borrower, n }));

  const kembali = pinjaman.filter(p => p.returnDate);
  const tepat = kembali.filter(p => p.returnDate! <= p.dueDate).length;
  const dendaTerkumpul = kembali.filter(p => p.finePaid).reduce((a, p) => a + hitungDenda(p.dueDate, p.returnDate!, aturan.dendaPerHari).denda, 0);
  const terlambatSekarang = pinjaman.filter(p => p.status === "DIPINJAM" && p.dueDate < kini).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <PageHeader icon={<LineChart size={22} />} title="Laporan Perpustakaan"
        description={<>{bulan[0].label} – {bulan[11].label} · data peminjaman &amp; kunjungan 12 bulan terakhir</>} />

      <div className="kisi-kartu kisi-kartu-4">
        {/* StatTile = client component: dari server component ikon WAJIB dikirim sebagai elemen, bukan komponen mentah */}
        <StatTile value={pinjaman.length} label="Peminjaman 12 Bulan" ikon="dipinjam" color="primary" size="md" />
        <StatTile value={kunjungan.length} label="Kunjungan 12 Bulan" ikon="pintu" color="emerald" size="md" />
        <StatTile value={kembali.length ? `${Math.round((tepat / kembali.length) * 100)}%` : "–"} label="Dikembalikan Tepat Waktu" ikon="menunggu" color="blue" size="md" />
        <StatTile value={rupiah(dendaTerkumpul)} label={`Denda Terkumpul · ${terlambatSekarang} terlambat kini`} ikon="dompet" color="amber" size="sm" />
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <div className="flex items-center gap-2"><BarChart3 size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Tren Bulanan</h3></div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary-700" /> Peminjaman</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gold" /> Kunjungan</span>
          </div>
        </div>
        {pinjaman.length + kunjungan.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Belum ada data 12 bulan terakhir" description="Grafik terisi otomatis begitu peminjaman & kunjungan dicatat lewat Meja Sirkulasi dan Kiosk Kunjungan." />
        ) : (
          <div className="p-5 overflow-x-auto scrollbar-visible">
            <div className="flex items-end gap-3 h-56 min-w-[640px]">
              {bulan.map(b => {
                const d = perBulan.get(b.kunci)!;
                return (
                  <div key={b.kunci} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-1 h-44 w-full justify-center">
                      <div className="w-1/3 rounded-t bg-primary-700" style={{ height: `${(d.pinjam / maksBulan) * 100}%` }} title={`${d.pinjam} peminjaman`} />
                      <div className="w-1/3 rounded-t bg-gold" style={{ height: `${(d.kunjung / maksBulan) * 100}%` }} title={`${d.kunjung} kunjungan`} />
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums">{d.pinjam}/{d.kunjung}</span>
                    <span className="text-xs text-gray-400">{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Daftar judul="Buku Terpopuler" ikon={Library} kosong="Belum ada buku yang dipinjam."
          baris={populer.map(p => ({ utama: p.buku.title, kedua: p.buku.author ?? p.buku.category, n: p.n }))} />
        <Daftar judul="Kategori Paling Dipinjam" ikon={Tags} kosong="Belum ada peminjaman."
          baris={kategori.map(([k, n]) => ({ utama: k, kedua: `${Math.round((n / Math.max(1, pinjaman.length)) * 100)}% peminjaman`, n }))} />
        <Daftar judul="Anggota Teraktif" ikon={Trophy} kosong="Belum ada peminjam."
          baris={teraktif.map(t => ({ utama: t.orang.name, kedua: t.orang.student?.class?.name ?? (t.orang.role === "TEACHER" ? "Guru" : "Pegawai"), n: t.n }))} />
      </div>
    </div>
  );
}

function Daftar({ judul, ikon: Ikon, baris, kosong }: { judul: string; ikon: typeof Library; baris: { utama: string; kedua: string; n: number }[]; kosong: string }) {
  const maks = Math.max(1, ...baris.map(b => b.n));
  return (
    <div className="page-card">
      <div className="page-card-header"><div className="flex items-center gap-2"><Ikon size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">{judul}</h3></div></div>
      {baris.length === 0 ? <p className="p-5 text-sm text-gray-400">{kosong}</p> : (
        <ul className="p-5 space-y-3">
          {baris.map((b, i) => (
            <li key={`${b.utama}-${i}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800 truncate">{i + 1}. {b.utama}</span>
                <span className="font-heading font-bold text-primary-900 tabular-nums">{b.n}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-700 rounded-full" style={{ width: `${(b.n / maks) * 100}%` }} /></div>
                <span className="text-xs text-gray-400 truncate max-w-[45%]">{b.kedua}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
