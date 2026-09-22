"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckSquare, Square, Printer, QrCode } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";
import PageHeader from "@/components/admin/PageHeader";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";

interface Book { id: string; title: string; barcode: string | null; barcodeQr: string | null; stock: number }
interface BarcodeCell { key: string; title: string; barcode: string; qr: string }

/** Cetak barcode (QR + logo di tengah) — admin/petugas perpustakaan bisa pilih buku mana saja
 * yang mau dicetak & berapa jumlah label per buku (default = stok, tapi bisa diubah bebas,
 * misal cuma perlu cetak label tambahan untuk 3 eksemplar yang labelnya rusak/hilang, bukan
 * cetak ulang semua). Reuse endpoint `/api/perpustakaan/books` yang sudah ada (sudah
 * menghasilkan `barcodeQr` dgn logo tertanam), bukan bikin endpoint baru. */
export default function BarcodePrintSheet({ backHref }: { backHref: string }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  const selectedBooks = books.filter(b => selected.has(b.id));
  usePrintTitle(showPreview ? buildPrintFilename(
    "Barcode_Buku",
    selectedBooks.length === 1 ? selectedBooks[0].title : `${selectedBooks.length}-Judul`,
  ) : null);

  useEffect(() => {
    fetch("/api/perpustakaan/books").then(r => r.json()).then((data: Book[]) => {
      const withBarcode = Array.isArray(data) ? data.filter(b => b.barcode && b.barcodeQr) : [];
      setBooks(withBarcode);
      setSelected(new Set(withBarcode.map(b => b.id)));
      setQty(Object.fromEntries(withBarcode.map(b => [b.id, String(Math.max(1, b.stock))])));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function toggleBook(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(prev => (prev.size === books.length ? new Set() : new Set(books.map(b => b.id))));
  }

  const cells: BarcodeCell[] = [];
  for (const b of books) {
    if (!selected.has(b.id) || !b.barcode || !b.barcodeQr) continue;
    const n = Math.max(0, parseInt(qty[b.id] ?? "0", 10) || 0);
    for (let i = 0; i < n; i++) {
      cells.push({ key: `${b.id}-${i}`, title: b.title, barcode: b.barcode, qr: b.barcodeQr });
    }
  }

  if (loading) {
    return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <style>{"@page { size: A4; margin: 1cm; }"}</style>

      <PageHeader icon={<QrCode size={22} />} title="Cetak Barcode Buku" description="Pilih buku & jumlah label yang mau dicetak per buku" printHidden />
      <div className="flex items-center justify-between mb-5 print:hidden">
        <Link href={backHref} className="btn-modal-cancel"><ArrowLeft size={18} /> Kembali</Link>
        {showPreview && (
          <button onClick={() => setShowPreview(false)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            Ubah Pilihan
          </button>
        )}
      </div>

      {books.length === 0 ? (
        <p className="text-center py-16 text-gray-400 text-sm">Belum ada buku dengan barcode di katalog.</p>
      ) : !showPreview ? (
        // ===== Langkah 1: pilih buku + jumlah label per buku =====
        <div className="print:hidden">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-semibold text-primary-700">
                {selected.size === books.length ? <CheckSquare size={16} /> : <Square size={16} />}
                Pilih Semua ({selected.size}/{books.length})
              </button>
              <span className="text-xs text-gray-400">Total label akan dicetak: <strong className="text-primary-700">{cells.length}</strong></span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {books.map(b => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <button onClick={() => toggleBook(b.id)} className="shrink-0 text-primary-700">
                    {selected.has(b.id) ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-300" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary-900 truncate">{b.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{b.barcode} · stok {b.stock}</p>
                  </div>
                  <input type="number" min={0} value={qty[b.id] ?? "0"}
                    disabled={!selected.has(b.id)}
                    onChange={e => setQty(p => ({ ...p, [b.id]: e.target.value }))}
                    className="input-field w-20 text-sm disabled:opacity-40 disabled:bg-gray-50" />
                </div>
              ))}
            </div>
          </div>
          <div className="alat-aksi justify-end">
            <button onClick={() => setShowPreview(true)} disabled={cells.length === 0}
              className="btn-modal-save">
              <Printer size={16} /> Lanjut ke Pratinjau Cetak ({cells.length} label)
            </button>
          </div>
        </div>
      ) : (
        // ===== Langkah 2: pratinjau + cetak =====
        <>
          <div className="alat-aksi justify-end mb-4 print:hidden">
            <PrintButton />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 print:grid-cols-5 gap-4 print:gap-3">
            {cells.map(c => (
              <div key={c.key} className="border border-gray-200 rounded-xl p-3 flex flex-col items-center text-center break-inside-avoid">
                <img src={c.qr} alt={c.barcode} className="w-24 h-24" />
                <p className="text-[11px] font-semibold text-primary-900 mt-1.5 line-clamp-2 leading-tight">{c.title}</p>
                <p className="font-mono text-[10px] text-gray-500 mt-0.5">{c.barcode}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
