import React from "react";

interface GroupedSectionProps {
  title: string;
  subtitle?: string;
  count: number;
  icon: React.ElementType;
  /** default = bar navy gradient (grup normal), warning = bar oranye solid (mis. "Belum Ada Kelas") */
  variant?: "default" | "warning";
  /** Aksi tambahan di sisi kanan header, sebelum badge jumlah (mis. tombol Cetak Kelas) */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

/** Kartu grup tabel seragam (bar header + badge jumlah + isi tabel) — dipakai di seluruh tabel admin yang dikelompokkan. */
export default function GroupedSection({ title, subtitle, count, icon: Icon, variant = "default", headerActions, children }: GroupedSectionProps) {
  const warning = variant === "warning";
  return (
    <div className={`bg-white rounded-2xl border ${warning ? "border-amber-100" : "border-gray-100"} shadow-sm overflow-hidden`}>
      <div
        className={`px-5 py-3.5 flex items-center justify-between gap-3 ${warning ? "bg-amber-500" : ""}`}
        style={!warning ? { background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" } : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={15} className={warning ? "text-white" : "text-gold"} />
          <span className="font-heading font-bold text-white text-sm truncate">{title}</span>
          {subtitle && <span className="text-white/40 text-xs">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerActions}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${warning ? "text-white bg-white/20" : "text-gold bg-white/10 border border-white/20"}`}>
            {!warning && <Icon size={10} />}
            {count}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
