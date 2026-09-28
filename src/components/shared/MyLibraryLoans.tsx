"use client";
import { useEffect, useState } from "react";
import { BookOpen, Loader2, CalendarClock, CheckCircle2, AlertTriangle, BookMarked } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Loan {
  id: string;
  book: { id: string; title: string; author: string | null; category: string; coverUrl: string | null };
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: string;
  finePaid: boolean;
  isOverdue: boolean;
  daysLate: number;
  daysRemaining: number | null;
  fineAmount: number;
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Halaman "Buku Saya" — riwayat & status peminjaman buku milik user yang login, dipakai lintas
 * portal (siswa/guru/pegawai, lihat 3 wrapper page tipis-nya). Terbuka untuk SIAPAPUN yang
 * berstatus peminjam, bukan cuma petugas perpustakaan. */
export default function MyLibraryLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/perpustakaan/my-loans").then(r => r.json())
      .then((data: Loan[]) => setLoans(Array.isArray(data) ? data : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const active = loans.filter(l => l.status === "DIPINJAM");
  const history = loans.filter(l => l.status !== "DIPINJAM");
  const halRiwayat = usePaginasi(history, 20);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookOpen size={22} />} title="Buku Saya" description="Riwayat & status peminjaman buku perpustakaan" />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : loans.length === 0 ? (
        <EmptyState icon={BookMarked} title="Belum Pernah Meminjam" description="Riwayat peminjaman buku perpustakaan akan muncul di sini." />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading font-semibold text-primary-900 text-sm mb-3">Sedang Dipinjam ({active.length})</h2>
            {active.length === 0 ? (
              <p className="panel text-sm text-gray-400 p-5 text-center">Tidak ada buku yang sedang dipinjam.</p>
            ) : (
              <div className="space-y-2.5">
                {active.map(l => (
                  <div key={l.id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-start gap-3 ${l.isOverdue ? "border-red-200" : "border-gray-100"}`}>
                    <div className={`shrink-0 mt-0.5 p-2 rounded-xl ${l.isOverdue ? "bg-red-50 text-red-600" : "bg-primary-50 text-primary-700"}`}>
                      {l.isOverdue ? <AlertTriangle size={18} /> : <CalendarClock size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary-900 text-sm truncate">{l.book.title}</p>
                      {l.book.author && <p className="text-xs text-gray-400">{l.book.author}</p>}
                      <p className="text-xs text-gray-500 mt-1">
                        Dipinjam {fmtDate(l.borrowDate)} &middot; Jatuh tempo {fmtDate(l.dueDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {l.isOverdue ? (
                        <>
                          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                            Terlambat {l.daysLate} hari
                          </span>
                          {l.fineAmount > 0 && <p className="text-xs text-red-600 font-semibold mt-1">Denda {fmtRupiah(l.fineAmount)}</p>}
                        </>
                      ) : l.daysRemaining !== null && l.daysRemaining <= 0 ? (
                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                          Jatuh tempo hari ini
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          Kurang {l.daysRemaining} hari
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading font-semibold text-primary-900 text-sm mb-3">Riwayat Peminjaman ({history.length})</h2>
            {history.length === 0 ? (
              <p className="panel text-sm text-gray-400 p-5 text-center">Belum ada riwayat peminjaman selesai.</p>
            ) : (
              <div className="panel overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {halRiwayat.potongan.map(l => (
                    <div key={l.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="shrink-0 mt-0.5 p-2 rounded-xl bg-gray-50 text-gray-400"><CheckCircle2 size={18} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-primary-900 text-sm truncate">{l.book.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtDate(l.borrowDate)} &rarr; {l.returnDate ? fmtDate(l.returnDate) : "-"}
                        </p>
                      </div>
                      {l.fineAmount > 0 && (
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${l.finePaid ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                          Denda {fmtRupiah(l.fineAmount)} &middot; {l.finePaid ? "Lunas" : "Belum Lunas"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <Paginasi hal={halRiwayat} satuan="riwayat" className="border-t border-gray-100" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
