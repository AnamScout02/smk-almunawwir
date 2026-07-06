import React from "react";

interface EmptyStateProps {
  icon: React.ElementType;
  title?: string;
  description?: string;
  className?: string;
}

/** Kondisi "belum ada data" seragam (kartu putih + ikon + teks tengah) — dipakai di seluruh panel admin. */
export default function EmptyState({ icon: Icon, title, description, className = "" }: EmptyStateProps) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400 ${className}`}>
      <Icon size={40} className="mx-auto mb-3 text-gray-200" />
      {title && <p className="font-medium text-gray-500">{title}</p>}
      {description && <p className={title ? "text-sm mt-1" : ""}>{description}</p>}
    </div>
  );
}
