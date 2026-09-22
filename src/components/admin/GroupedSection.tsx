import React from "react";
import { ChevronDown } from "lucide-react";

interface GroupedSectionProps {
  title: string;
  subtitle?: string;
  count: number;
  icon: React.ElementType;
  /** default = kepala putih (grup normal), warning = kepala amber lembut (grup yang perlu perhatian, mis. "Belum Ada Kelas") */
  variant?: "default" | "warning";
  /** Aksi tambahan di sisi kanan kepala, sebelum chip jumlah (mis. tombol Cetak Kelas) */
  headerActions?: React.ReactNode;
  /** Buka-tutup (akordeon): isi hanya dirender bila `terbuka`; judul menjadi tombol yang memanggil `onBukaTutup`.
   * Tanpa `onBukaTutup` grup selalu terbuka seperti biasa. */
  terbuka?: boolean;
  onBukaTutup?: () => void;
  children: React.ReactNode;
}

/** Kartu grup tabel seragam — dipakai di seluruh tabel admin yang dikelompokkan.
 * Pola tampilan v2 (keputusan user 15 Sep 2026: kepala tabel & grup "terang seperti panel dashboard"): kepala putih,
 * chip ikon, judul navy, chip jumlah. Sebelumnya bar navy bergradien. */
export default function GroupedSection({ title, subtitle, count, icon: Icon, variant = "default", headerActions, terbuka = true, onBukaTutup, children }: GroupedSectionProps) {
  const warning = variant === "warning";
  const lipat = !!onBukaTutup;
  const tampil = !lipat || terbuka;
  const judul = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${warning ? "bg-amber-500 text-white" : "bg-primary-50 text-primary-700"}`}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 block">
        <span className="block truncate font-heading text-sm font-semibold text-primary-900">{title}</span>
        {subtitle && <span className="block truncate text-xs text-gray-500">{subtitle}</span>}
      </span>
    </>
  );
  return (
    <section className={`panel overflow-hidden ${warning ? "border-amber-200" : ""}`}>
      <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5 ${tampil ? "border-b" : ""} ${warning ? "border-amber-100 bg-amber-50/70" : "border-primary-100/60 bg-gradient-to-r from-primary-50 to-white"}`}>
        {lipat ? (
          <button type="button" onClick={onBukaTutup} aria-expanded={terbuka} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            {judul}
          </button>
        ) : (
          <h3 className="flex min-w-0 items-center gap-2.5">{judul}</h3>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <span className={`angka rounded-full border px-2.5 py-0.5 text-xs font-semibold ${warning ? "border-amber-200 bg-white text-amber-700" : "border-primary-100 bg-primary-50 text-primary-700"}`}>
            {count}
          </span>
          {lipat && (
            <button type="button" onClick={onBukaTutup} aria-label={terbuka ? `Tutup ${title}` : `Buka ${title}`} className="rounded-lg p-1 text-gray-400 hover:bg-white hover:text-primary-900">
              <ChevronDown size={18} className={`transition-transform ${terbuka ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      {tampil && children}
    </section>
  );
}
