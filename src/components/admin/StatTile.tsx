import React from "react";

type StatColor = "primary" | "emerald" | "amber" | "blue" | "red" | "purple" | "gray";

const COLOR_STYLES: Record<StatColor, { grad: string; ring: string }> = {
  primary: { grad: "from-primary-500 to-primary-700", ring: "ring-primary-100" },
  emerald: { grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-100" },
  amber:   { grad: "from-amber-500 to-amber-600",     ring: "ring-amber-100" },
  blue:    { grad: "from-blue-500 to-blue-600",       ring: "ring-blue-100" },
  red:     { grad: "from-red-500 to-red-600",         ring: "ring-red-100" },
  purple:  { grad: "from-purple-500 to-purple-600",   ring: "ring-purple-100" },
  gray:    { grad: "from-gray-500 to-gray-600",       ring: "ring-gray-100" },
};

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  icon?: React.ElementType;
  color?: StatColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Kartu ringkasan angka seragam gradasi warna (mis. "Total Siswa", "Sudah Berkelas") — dipakai di seluruh panel admin.
 * `size="sm"` dipakai kalau `value` bisa berupa teks panjang (mis. nama identitas router) — biar tidak
 * bikin kartu itu lebih tinggi dari kartu angka di sebelahnya dalam satu baris grid. `truncate` juga
 * dipasang selalu sebagai jaring pengaman di layar sempit. */
export default function StatTile({ value, label, sublabel, icon: Icon, color = "primary", size = "lg", className = "" }: StatTileProps) {
  const s = COLOR_STYLES[color];
  // size="sm" dibiarkan bisa turun ke 2 baris (line-clamp, bukan truncate 1 baris) supaya teks
  // panjang seperti nama identitas router tidak terpotong jadi "...IIBS" -> "II..." yang aneh dibaca.
  const sizeClass = size === "lg" ? "text-3xl truncate" : size === "sm" ? "text-sm leading-snug line-clamp-2" : "text-2xl truncate";
  const valueClass = `${sizeClass} font-heading font-bold text-white`;

  return (
    <div className={`group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br ${s.grad} ring-1 ${s.ring} ${className}`}>
      {Icon && (
        <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          <Icon size={56} className="text-white" />
        </div>
      )}
      <div className="relative">
        <p className={valueClass}>{value}</p>
        <p className="text-white/75 text-xs mt-0.5">{label}</p>
        {sublabel && <p className="text-white/60 text-xs">{sublabel}</p>}
      </div>
    </div>
  );
}
