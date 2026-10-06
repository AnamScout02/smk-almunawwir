"use client";
import { useEffect, useState } from "react";
import { Monitor, ChevronDown, X } from "lucide-react";

type Layar = { studentId: string; nama: string; nis: string; kelas: string; waktu: number; fokus: boolean };

/** LAYAR PROKTOR (5 Oktober 2026) — kisi potret jendela ujian peserta yang memakai MyAlwis Ujian Windows
 *  (src/lib/proktor-layar.ts). Hanya memuat saat dibuka, segar tiap 10 detik, berhenti saat ditutup / halaman
 *  ditinggalkan. Peserta yang jendelanya tidak fokus (Alt-Tab dsb.) ditandai merah dan diletakkan paling depan. */
export default function LayarProktorPanel({ examId }: { examId: string }) {
  const [buka, setBuka] = useState(false);
  const [layar, setLayar] = useState<Layar[]>([]);
  const [selisih, setSelisih] = useState(0);
  const [versi, setVersi] = useState(0);
  const [besar, setBesar] = useState<Layar | null>(null);

  useEffect(() => {
    let hidup = true;
    const muat = () => fetch(`/api/teacher/exams/${examId}/proktor`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (hidup && d) { setLayar(d.layar ?? []); setSelisih(Date.now() - d.sekarang); setVersi(v => v + 1); } })
      .catch(() => {});
    muat();
    // Saat tertutup tetap menghitung jumlahnya, tetapi jauh lebih jarang — supaya tombol menyebut berapa layar tersedia.
    const t = setInterval(() => { if (!document.hidden) muat(); }, buka ? 10_000 : 30_000);
    return () => { hidup = false; clearInterval(t); };
  }, [examId, buka]);

  const lalu = (w: number) => {
    const d = Math.max(0, Math.round((Date.now() - selisih - w) / 1000));
    return d < 60 ? `${d} dtk lalu` : `${Math.round(d / 60)} mnt lalu`;
  };
  const urut = [...layar].sort((a, b) => Number(a.fokus) - Number(b.fokus));
  const tidakFokus = layar.filter(l => !l.fokus).length;

  return (
    <div className="panel mb-5 overflow-hidden">
      <button type="button" onClick={() => setBuka(b => !b)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <span className="flex items-center gap-2 font-heading text-sm font-semibold text-primary-900">
          <Monitor size={16} /> Layar Peserta
          <span className="status-badge bg-gray-50 text-gray-600 border-gray-200 angka">{layar.length}</span>
          {tidakFokus > 0 && <span className="status-badge bg-red-50 text-red-700 border-red-200"><span className="angka">{tidakFokus}</span> tidak fokus</span>}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${buka ? "rotate-180" : ""}`} />
      </button>
      {buka && (
        <div className="border-t border-gray-100 p-4">
          {!layar.length ? (
            <p className="py-10 text-center text-sm text-gray-400">
              Belum ada layar. Potret hanya dikirim peserta yang mengerjakan lewat aplikasi MyAlwis Ujian untuk Windows.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {urut.map(l => (
                <button key={l.studentId} type="button" onClick={() => setBesar(l)}
                  className={`min-w-0 overflow-hidden rounded-xl border text-left transition hover:shadow-md ${l.fokus ? "border-gray-200" : "border-red-300 ring-2 ring-red-200"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- potret langsung, tidak lewat pengoptimal gambar */}
                  <img src={`/api/teacher/exams/${examId}/proktor/${l.studentId}?v=${versi}`} alt={`Layar ${l.nama}`}
                    className="aspect-video w-full bg-gray-100 object-cover" loading="lazy" />
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-semibold text-primary-900">{l.nama}</p>
                    <p className="truncate text-xs text-gray-500">{l.kelas} · {lalu(l.waktu)}</p>
                    {!l.fokus && <p className="text-xs font-semibold text-red-600">Jendela ujian tidak fokus</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Yang terlihat hanya jendela ujian di aplikasi Windows (bukan seluruh layar komputer), disimpan sementara di server
            selama ujian dan tidak diarsipkan. Peserta melihat tanda &quot;Layar dipantau pengawas&quot;.
          </p>
        </div>
      )}

      {besar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setBesar(null)}>
          <div className="relative max-h-full w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setBesar(null)} aria-label="Tutup"
              className="absolute -top-10 right-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/teacher/exams/${examId}/proktor/${besar.studentId}?v=${versi}`} alt={`Layar ${besar.nama}`} className="w-full rounded-xl bg-gray-900" />
            <p className="mt-2 text-center text-sm text-white">{besar.nama} · {besar.kelas} · {besar.nis}{!besar.fokus ? " · jendela ujian tidak fokus" : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}
