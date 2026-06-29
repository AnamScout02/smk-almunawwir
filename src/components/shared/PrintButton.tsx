"use client";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-gold text-primary-900 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gold/90 transition">
      <Printer size={15} /> Cetak / Simpan PDF
    </button>
  );
}
