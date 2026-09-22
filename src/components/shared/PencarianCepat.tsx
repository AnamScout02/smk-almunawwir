"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import Modal from "@/components/admin/Modal";

interface Hasil { grup: string; judul: string; keterangan: string; href: string }

/** PENCARIAN CEPAT (18 Sep 2026) — satu kotak cari untuk seluruh portal.
 * Dibuka dengan Ctrl+K / ⌘K, tombol melayang di layar lebar, atau menu Akun di HP
 * (lewat event `buka-pencarian`, supaya bar atas tiap portal tidak perlu diubah satu per satu).
 * Cakupan hasil ditentukan SERVER menurut peran (src/lib/pencarian-cepat.ts) — bukan di sini. */
export default function PencarianCepat() {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [kata, setKata] = useState("");
  const [hasil, setHasil] = useState<Hasil[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [sorot, setSorot] = useState(0);
  const isian = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tombol = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuka(b => !b); }
    };
    const dariMenu = () => setBuka(true);
    window.addEventListener("keydown", tombol);
    window.addEventListener("buka-pencarian", dariMenu);
    return () => { window.removeEventListener("keydown", tombol); window.removeEventListener("buka-pencarian", dariMenu); };
  }, []);

  useEffect(() => { if (buka) setTimeout(() => isian.current?.focus(), 50); else { setKata(""); setHasil([]); setSorot(0); } }, [buka]);

  useEffect(() => {
    const q = kata.trim();
    if (q.length < 2) { setHasil([]); setMemuat(false); return; }
    setMemuat(true);
    const jeda = setTimeout(() => {
      fetch(`/api/pencarian?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { setHasil(d?.hasil ?? []); setSorot(0); })
        .catch(() => setHasil([]))
        .finally(() => setMemuat(false));
    }, 250);
    return () => clearTimeout(jeda);
  }, [kata]);

  const pergi = useCallback((h: Hasil) => { setBuka(false); router.push(h.href); }, [router]);

  function tombolDaftar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSorot(s => Math.min(s + 1, hasil.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSorot(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && hasil[sorot]) { e.preventDefault(); pergi(hasil[sorot]); }
  }

  return (
    <>
      <button type="button" onClick={() => setBuka(true)} title="Pencarian cepat (Ctrl+K)" aria-label="Pencarian cepat"
        className="hidden lg:flex fixed bottom-6 right-24 z-50 h-12 w-12 items-center justify-center rounded-full bg-white text-primary-900 shadow-panel-naik ring-1 ring-primary-100 transition-transform hover:-translate-y-0.5 print:hidden">
        <Search size={20} />
      </button>

      <Modal open={buka} onClose={() => setBuka(false)} title="Pencarian cepat" description="Siswa, guru, kelas, surat, buku — sesuai hak akses Anda" size="lg">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={isian} value={kata} onChange={e => setKata(e.target.value)} onKeyDown={tombolDaftar}
            placeholder="Ketik nama, NIS, nomor surat, judul buku..." className="input-field pl-10" />
        </div>
        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          {memuat ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Mencari...</p>
          ) : kata.trim().length < 2 ? (
            <p className="py-8 text-center text-sm text-gray-500">Ketik minimal 2 huruf. Tekan <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-xs">Ctrl</kbd>+<kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-xs">K</kbd> kapan saja untuk membuka kotak ini.</p>
          ) : hasil.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Tidak ada yang cocok.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {hasil.map((h, i) => (
                <li key={`${h.href}-${h.judul}-${i}`}>
                  <button type="button" onClick={() => pergi(h)} onMouseEnter={() => setSorot(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === sorot ? "bg-primary-50" : "hover:bg-gray-50"}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-primary-900">{h.judul}</span>
                      {h.keterangan && <span className="block truncate text-xs text-gray-500">{h.keterangan}</span>}
                    </span>
                    <span className="badge-navy shrink-0">{h.grup}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
