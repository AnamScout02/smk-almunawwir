export const dynamic = "force-dynamic";

import Link from "next/link";
import { CalendarCheck, CalendarClock, History, LibraryBig } from "lucide-react";
import { prisma } from "@/lib/prisma";
import StatTile from "@/components/admin/StatTile";
import PageHeader from "@/components/admin/PageHeader";
import { KisiMenuPortal } from "@/components/shared/NavPortal";
import { MENU_PUSAT_PERPUSTAKAAN } from "@/lib/menu-portal";
import { TautanIkon } from "@/components/shared/IkonNama";
import EmptyState from "@/components/admin/EmptyState";
import { aturanPerpustakaan, hitungDenda } from "@/lib/perpustakaan-server";

const HARI_MS = 86400_000;
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** BERANDA PUSAT PERPUSTAKAAN — kondisi layanan hari ini dalam satu layar. */
export default async function BerandaPusatPerpustakaan() {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const awalHari = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
  const kini = new Date();

  const [aturan, stok, dipinjam, terlambat, dikembalikanBelumLunas, kunjunganHariIni, reservasi, jatuhTempoHariIni, aktivitas] = await Promise.all([
    aturanPerpustakaan(),
    prisma.book.aggregate({ _count: { id: true }, _sum: { stock: true } }),
    prisma.bookLoan.count({ where: { status: "DIPINJAM" } }),
    prisma.bookLoan.findMany({ where: { status: "DIPINJAM", dueDate: { lt: kini } }, select: { dueDate: true } }),
    prisma.bookLoan.findMany({ where: { status: "DIKEMBALIKAN", finePaid: false, returnDate: { not: null } }, select: { dueDate: true, returnDate: true } }),
    prisma.libraryVisit.count({ where: { visitedAt: { gte: awalHari } } }),
    prisma.bookReservation.groupBy({ by: ["status"], where: { status: { in: ["MENUNGGU", "TERSEDIA"] } }, _count: { id: true } }),
    prisma.bookLoan.findMany({
      where: { status: "DIPINJAM", dueDate: { gte: awalHari, lt: new Date(awalHari.getTime() + HARI_MS) } },
      select: { id: true, dueDate: true, book: { select: { title: true } }, borrower: { select: { name: true, student: { select: { class: { select: { name: true } } } } } } },
      orderBy: { dueDate: "asc" }, take: 8,
    }),
    prisma.bookLoan.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, status: true, borrowDate: true, returnDate: true, book: { select: { title: true } }, borrower: { select: { name: true } } },
    }),
  ]);

  const dendaBerjalan = terlambat.reduce((a, l) => a + hitungDenda(l.dueDate, kini, aturan.dendaPerHari).denda, 0);
  const dendaTertunggak = dikembalikanBelumLunas.reduce((a, l) => a + hitungDenda(l.dueDate, l.returnDate!, aturan.dendaPerHari).denda, 0);
  const jumlahReservasi = (s: string) => reservasi.find(r => r.status === s)?._count.id ?? 0;
  const fmt = (d: Date) => d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <PageHeader icon={<LibraryBig size={22} />} title="Layanan Hari Ini" description={<>{wib.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} · masa pinjam {aturan.masaHari} hari · maks {aturan.maksPinjam} buku · denda {rupiah(aturan.dendaPerHari)}/hari</>} />
      <KisiMenuPortal items={MENU_PUSAT_PERPUSTAKAAN} judul="Menu Pusat Perpustakaan" />
      <div className="alat-aksi justify-end">
        <TautanIkon href="/pusat-perpustakaan/sirkulasi" ikon="pindai" ukuran={16} className="btn-modal-save">Buka Meja Sirkulasi</TautanIkon>
        <TautanIkon href="/pusat-perpustakaan/kunjungan" ikon="pintu" ukuran={16} className="btn-modal-cancel">Kiosk Kunjungan</TautanIkon>
      </div>

      <div className="kisi-kartu kisi-kartu-4">
        {/* StatTile = client component: dari server component ikon WAJIB dikirim sebagai elemen, bukan komponen mentah.
            Setiap ikon di halaman ini SENGAJA dipakai sekali saja — ikon kembar bikin SSR produksi 500 (gotcha #35). */}
        <StatTile value={stok._count.id} label={`Judul · ${stok._sum.stock ?? 0} eksemplar`} ikon="perpustakaan" color="primary" size="md" />
        <StatTile value={dipinjam} label="Sedang Dipinjam" ikon="dipinjam" color="blue" size="md" />
        <StatTile value={terlambat.length} label="Terlambat Dikembalikan" ikon="peringatan" color="red" size="md" />
        <StatTile value={kunjunganHariIni} label="Kunjungan Hari Ini" ikon="kunjungan" color="emerald" size="md" />
        <StatTile value={jumlahReservasi("MENUNGGU")} label="Pesanan Menunggu" ikon="pesanan" color="amber" size="md" />
        <StatTile value={jumlahReservasi("TERSEDIA")} label="Pesanan Siap Diambil" ikon="buku" color="purple" size="md" />
        <StatTile value={rupiah(dendaBerjalan)} label="Denda Berjalan (belum kembali)" ikon="dompet" color="gray" size="sm" />
        <StatTile value={rupiah(dendaTertunggak)} label="Denda Belum Dibayar" ikon="denda" color="gray" size="sm" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="page-card overflow-hidden">
          <div className="page-card-header">
            <div className="flex items-center gap-2"><CalendarClock size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Jatuh Tempo Hari Ini</h3></div>
            <span className="text-xs text-gray-400">{jatuhTempoHariIni.length} buku</span>
          </div>
          {jatuhTempoHariIni.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="Tidak ada yang jatuh tempo hari ini" description="Pinjaman yang harus kembali hari ini akan muncul di sini." />
          ) : (
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Buku</th><th>Peminjam</th><th>Batas</th></tr></thead>
              <tbody>
                {jatuhTempoHariIni.map(l => (
                  <tr key={l.id}><td className="font-medium">{l.book.title}</td><td>{l.borrower.name}<span className="block text-xs text-gray-400">{l.borrower.student?.class?.name ?? ""}</span></td><td className="text-xs whitespace-nowrap">{fmt(l.dueDate)}</td></tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="page-card overflow-hidden">
          <div className="page-card-header"><h3 className="font-heading font-semibold text-primary-900">Transaksi Terbaru</h3></div>
          {aktivitas.length === 0 ? (
            <EmptyState icon={History} title="Belum ada transaksi" description="Peminjaman pertama akan tercatat dari Meja Sirkulasi." />
          ) : (
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Buku</th><th>Anggota</th><th>Status</th></tr></thead>
              <tbody>
                {aktivitas.map(l => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.book.title}</td>
                    <td>{l.borrower.name}</td>
                    <td className="whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${l.status === "DIPINJAM" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {l.status === "DIPINJAM" ? "Dipinjam" : "Kembali"}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">{fmt(l.returnDate ?? l.borrowDate)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
