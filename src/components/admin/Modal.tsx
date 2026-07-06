"use client";
import React from "react";
import { X } from "lucide-react";

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Aktifkan jika isi modal panjang & perlu scroll independen (form Buku Induk, dll). */
  scrollBody?: boolean;
}

/**
 * Kerangka modal seragam untuk seluruh panel admin — patokan tunggal untuk
 * ukuran, warna header, sudut rounded, dan perilaku tutup (klik backdrop/Escape).
 * Sengaja TIDAK memakai overflow-hidden di kartu luar (supaya dropdown Select
 * di dalam body tidak terpotong) — sudut rounded dijaga eksplisit di header/body.
 */
export default function Modal({
  open, onClose, title, description, size = "md", headerActions, footer, children, scrollBody = false,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZE_CLASS[size]} ${scrollBody ? "max-h-[90vh] flex flex-col" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl shrink-0"
          style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-white truncate">{title}</h2>
            {description && <p className="text-xs text-white/50 mt-0.5 truncate">{description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button type="button" onClick={onClose} className="p-2 text-white/60 hover:text-white rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {scrollBody ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">{children}</div>
        ) : (
          <div className="p-6 space-y-4">{children}</div>
        )}

        {footer && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
