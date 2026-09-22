import React from "react";

interface EmptyStateProps {
  icon: React.ElementType;
  title?: string;
  description?: string;
  className?: string;
}

/** Kondisi "belum ada data" seragam — Pola tampilan v2 (DESIGN_SYSTEM.md §17): kartu panel + chip ikon lembut + teks tengah.
 * Di dalam panel yang sudah punya kepala, pakai `PanelKosong` (lebih ringkas). */
export default function EmptyState({ icon: Icon, title, description, className = "" }: EmptyStateProps) {
  return (
    <div className={`panel masuk-halus flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className}`}>
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-300" aria-hidden="true">
        <Icon size={26} />
      </span>
      {title && <p className="font-heading font-semibold text-primary-900">{title}</p>}
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
    </div>
  );
}
