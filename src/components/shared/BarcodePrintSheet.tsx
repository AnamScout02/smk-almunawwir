"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

interface Book { id: string; title: string; barcode: string | null; barcodeQr: string | null; stock: number }
interface BarcodeCell { key: string; title: string; barcode: string; qr: string }

/** Cetak barcode (QR + logo di tengah) SEMUA buku sekaligus, sejumlah stok masing-masing —
 * dipakai admin/petugas perpustakaan utk tempel label fisik di tiap eksemplar buku. Reuse endpoint
 * `/api/perpustakaan/books` yang sudah ada (sudah menghasilkan `barcodeQr` dgn logo tertanam),
 * bukan bikin endpoint baru — data & auth-nya sama persis dgn katalog. */
export default function BarcodePrintSheet({ backHref }: { backHref: string }) {
  const [cells, setCells] = useState<BarcodeCell[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/perpustakaan/books").then(r => r.json()).then((books: Book[]) => {
      const flat: BarcodeCell[] = [];
      for (const b of books) {
        if (!b.barcode || !b.barcodeQr) continue;
        for (let i = 0; i < Math.max(1, b.stock); i++) {
          flat.push({ key: `${b.id}-${i}`, title: b.title, barcode: b.barcode, qr: b.barcodeQr });
        }
      }
      setCells(flat);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <style>{"@page { size: A4; margin: 1cm; }"}</style>

      <div className="flex items-center justify-between mb-5 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="font-heading text-lg font-bold text-primary-900">Cetak Barcode Semua Buku</h1>
            <p className="text-sm text-gray-400">{cells.length} label barcode ({new Set(cells.map(c => c.barcode)).size} judul) — sesuai jumlah stok</p>
          </div>
        </div>
        <PrintButton />
      </div>

      {cells.length === 0 ? (
        <p className="text-center py-16 text-gray-400 text-sm">Belum ada buku dengan barcode di katalog.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 print:grid-cols-5 gap-4 print:gap-3">
          {cells.map(c => (
            <div key={c.key} className="border border-gray-200 rounded-xl p-3 flex flex-col items-center text-center break-inside-avoid">
              <img src={c.qr} alt={c.barcode} className="w-24 h-24" />
              <p className="text-[11px] font-semibold text-primary-900 mt-1.5 line-clamp-2 leading-tight">{c.title}</p>
              <p className="font-mono text-[10px] text-gray-500 mt-0.5">{c.barcode}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
