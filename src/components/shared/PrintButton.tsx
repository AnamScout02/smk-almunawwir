"use client";
import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-modal-cancel btn-ikon print:hidden">
      <Printer size={15} /> Cetak / Simpan PDF
    </button>
  );
}
