"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2, GraduationCap } from "lucide-react";

export interface LookupStudent {
  id: string; name: string; nis: string; className?: string | null;
  majorCode?: string; enrollYear?: number | null; status?: string;
  graduationIjazahNo?: string | null; skhunNo?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LULUS: "bg-blue-50 text-blue-700 border-blue-200",
  KELUAR: "bg-red-50 text-red-600 border-red-200",
  PINDAH: "bg-amber-50 text-amber-700 border-amber-200",
};

/** Pencarian siswa lintas status (termasuk ALUMNI) untuk modul Tata Usaha — dipakai bersama
 * Buku Tamu (kategori Wali Murid) & Legalisir (pemohon alumni). Sengaja komponen terpisah supaya
 * satu-satunya tempat memanggil /api/admin/siswa-lookup, bukan diduplikasi di tiap form. */
export default function StudentPicker({
  value, onChange, placeholder = "Ketik nama / NIS siswa (min. 2 huruf)...",
}: {
  value: LookupStudent | null;
  onChange: (s: LookupStudent | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LookupStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/siswa-lookup?q=${encodeURIComponent(q.trim())}`)
        .then(r => r.json())
        .then(d => { setResults(Array.isArray(d) ? d : []); setOpen(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300); // debounce — jangan tembak API tiap ketukan huruf
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-primary-100 bg-primary-50">
        <div className="min-w-0">
          <p className="font-medium text-sm text-primary-900 truncate">{value.name}</p>
          <p className="text-xs text-gray-500">
            {value.nis}
            {value.className ? ` · ${value.className}` : ""}
            {value.enrollYear ? ` · Angkatan ${value.enrollYear}` : ""}
            {value.status ? ` · ${value.status}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} title="Hapus pilihan"
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition shrink-0">
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder} className="input-field pl-10 w-full" />
      {loading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}

      {open && results.length > 0 && (
        <div className="absolute z-[60] mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg scrollbar-visible">
          {results.map(s => (
            <button key={s.id} type="button"
              onClick={() => { onChange(s); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 hover:bg-primary-50 transition border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{s.name}</span>
                {s.status && (
                  <span className={`px-1.5 py-0.5 rounded-full border text-xs font-semibold shrink-0 ${STATUS_STYLE[s.status] ?? STATUS_STYLE.AKTIF}`}>
                    {s.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {s.nis}{s.className ? ` · ${s.className}` : ""}{s.enrollYear ? ` · Angkatan ${s.enrollYear}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {open && !loading && q.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-[60] mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg px-3 py-4 text-center">
          <GraduationCap size={20} className="mx-auto text-gray-300 mb-1" />
          <p className="text-xs text-gray-400">Siswa tidak ditemukan — isi datanya manual saja.</p>
        </div>
      )}
    </div>
  );
}
