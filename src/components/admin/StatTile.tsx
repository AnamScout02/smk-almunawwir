import React from "react";

type StatColor = "primary" | "emerald" | "amber" | "blue" | "red" | "purple" | "gray";

const COLOR_STYLES: Record<StatColor, { border: string; text: string }> = {
  primary: { border: "border-primary-100", text: "text-primary-700" },
  emerald: { border: "border-emerald-100", text: "text-emerald-600" },
  amber:   { border: "border-amber-100",   text: "text-amber-600" },
  blue:    { border: "border-blue-100",    text: "text-blue-600" },
  red:     { border: "border-red-100",     text: "text-red-500" },
  purple:  { border: "border-purple-100",  text: "text-purple-600" },
  gray:    { border: "border-gray-100",    text: "text-gray-700" },
};

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  icon?: React.ElementType;
  color?: StatColor;
  size?: "md" | "lg";
  className?: string;
}

/** Kartu ringkasan angka seragam (mis. "Total Siswa", "Sudah Berkelas") — dipakai di seluruh panel admin. */
export default function StatTile({ value, label, sublabel, icon: Icon, color = "primary", size = "lg", className = "" }: StatTileProps) {
  const s = COLOR_STYLES[color];
  const valueClass = `${size === "lg" ? "text-3xl" : "text-2xl"} font-heading font-bold ${s.text}`;

  if (Icon) {
    return (
      <div className={`bg-white rounded-2xl border ${s.border} shadow-sm p-4 flex items-center gap-4 ${className}`}>
        <Icon size={36} className={s.text} />
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className={valueClass}>{value}</p>
          {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border ${s.border} shadow-sm p-4 text-center ${className}`}>
      <p className={valueClass}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
    </div>
  );
}
