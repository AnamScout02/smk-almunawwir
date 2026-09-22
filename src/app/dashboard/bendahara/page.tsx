export const dynamic = "force-dynamic";

import { verifyBendaharaLayoutAccess } from "@/lib/bendahara-guard";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import { KartuTautan } from "@/components/shared/IkonNama";
import { MenuBendahara } from "@/components/shared/MenuPortal";
import StatTile from "@/components/admin/StatTile";
import PenagihanTrendChart from "@/components/bendahara/PenagihanTrendChart";
import { Wallet } from "lucide-react";
import { formatRupiah } from "@/lib/currency";

export const metadata = { title: "Dashboard — Portal Bendahara" };

const BULAN_LABEL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BendaharaDashboardPage() {
  const session = await verifyBendaharaLayoutAccess();
  const period = currentMonth();
  const year = new Date().getFullYear();

  const invoices = await prisma.invoice.findMany({
    where: { period },
    select: { amount: true, paidAmount: true },
  }).catch(() => []);

  const totalTagihan = invoices.reduce((a, inv) => a + inv.amount, 0);
  const totalTerbayar = invoices.reduce((a, inv) => a + inv.paidAmount, 0);
  const belumLunasCount = invoices.filter(inv => inv.paidAmount < inv.amount).length;

  // Piutang — total belum lunas SEPANJANG MASA (bukan cuma bulan ini), beda dari 3 StatTile di
  // atas yang di-scope `period` bulan berjalan. Prisma tidak bisa bandingkan 2 kolom langsung
  // di `where` — load semua lalu hitung di JS (pola sama §5.6, dataset per sekolah kecil).
  const allInvoices = await prisma.invoice.findMany({ select: { amount: true, paidAmount: true } }).catch(() => []);
  const piutang = allInvoices.reduce((a, inv) => a + Math.max(0, inv.amount - inv.paidAmount), 0);

  // Tren bulanan tahun berjalan (Terbayar vs Belum Dibayar) — dikelompokkan dari `period`
  // ("YYYY-MM", format standar tagihan bulanan spt SPP). Tagihan berlabel bebas non-bulanan
  // (mis. "2026/2027" utk Uang Gedung) otomatis tidak match regex, sengaja dilewati di chart ini.
  const yearInvoices = await prisma.invoice.groupBy({
    by: ["period"],
    where: { period: { startsWith: String(year) } },
    _sum: { amount: true, paidAmount: true },
  }).catch(() => []);
  const monthlyMap = new Map(yearInvoices.filter(r => /^\d{4}-\d{2}$/.test(r.period)).map(r => [r.period, r]));
  const trendData = BULAN_LABEL.map((label, idx) => {
    const key = `${year}-${String(idx + 1).padStart(2, "0")}`;
    const row = monthlyMap.get(key);
    const amount = row?._sum.amount ?? 0;
    const paid = row?._sum.paidAmount ?? 0;
    return { month: key, label, terbayar: paid, belumDibayar: Math.max(0, amount - paid) };
  });

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wallet size={22} />} title="Dashboard Bendahara"
        description={<>Selamat datang, <span className="font-medium">{session.name}</span> — {today}</>} />

      <MenuBendahara ringkas={7} hrefSemua="/dashboard/bendahara/menu" judul="Menu Cepat" />

      <div className="kisi-kartu kisi-kartu-4 min-[420px]:grid-cols-2 mb-6">
        <StatTile tampilan="lembut" color="blue" ikon="tagihan" value={formatRupiah(totalTagihan)} size="md" label="Total Tagihan Bulan Ini" />
        <StatTile tampilan="lembut" color="emerald" ikon="lunas" value={formatRupiah(totalTerbayar)} size="md" label="Total Terbayar Bulan Ini" />
        <StatTile tampilan="lembut" color="amber" ikon="menunggu" value={belumLunasCount} size="md" label="Belum Lunas Bulan Ini" sorot={belumLunasCount > 0} />
        <StatTile tampilan="lembut" color="red" ikon="piutang" value={formatRupiah(piutang)} size="md" label="Piutang (Sepanjang Masa)" />
      </div>

      <div className="mb-6">
        <PenagihanTrendChart data={trendData} year={year} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KartuTautan href="/dashboard/bendahara/tagihan" ikon="daftar-tugas" judul="Kelola Tagihan" keterangan="Catat, tandai lunas, buat massal" />

        <KartuTautan href="/dashboard/bendahara/jenis-biaya" ikon="daftar-centang" judul="Kelola Jenis Biaya" keterangan="SPP, Uang Gedung, dan lainnya" />
      </div>
    </div>
  );
}
