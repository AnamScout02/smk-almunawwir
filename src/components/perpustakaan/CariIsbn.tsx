"use client";
import { useEffect, useState } from "react";
import { Loader2, ScanBarcode, Search, X } from "lucide-react";
import { usePindaiKamera } from "@/lib/pindai-kamera";
import { rapikanIsbn } from "@/lib/isbn";

export type HasilIsbn = { isbn: string; title: string; author: string; publisher: string; coverUrl: string; sumber: string };
type Pilihan = { title: string; author: string; publisher: string; isbn: string };

/** Baris "Isi otomatis" di formulir buku: pindai barcode belakang buku (kamera, Chrome/Android lewat HTTPS), ketik ISBN /
 *  pemindai USB, ATAU ketik JUDUL — data buku diambil dari katalog terbuka (/api/perpustakaan/isbn). Hanya mengisi formulir.
 *  Setiap hasil — ketemu, tidak ketemu, atau gagal — SELALU ditulis jelas (laporan user: "malah tidak muncul apa-apa"). */
export default function CariIsbn({ onHasil }: { onHasil: (h: HasilIsbn) => void }) {
  const [teks, setTeks] = useState("");
  const [kamera, setKamera] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ baik: boolean; teks: string } | null>(null);
  const [pilihan, setPilihan] = useState<Pilihan[] | null>(null);
  const [adaKunci, setAdaKunci] = useState(true);
  const [bukaKunci, setBukaKunci] = useState(false);
  const [kunci, setKunci] = useState("");

  // Keadaan kunci ditanyakan saat formulir dibuka, supaya ajakan memasang kunci tampil TANPA harus mencari dulu.
  useEffect(() => { fetch("/api/perpustakaan/isbn").then(r => (r.ok ? r.json() : null)).then(d => { if (d) setAdaKunci(d.adaKunci !== false); }).catch(() => {}); }, []);

  async function cari(masukan: string) {
    const q = masukan.trim();
    if (!q) return;
    setSibuk(true); setPesan(null); setPilihan(null);
    const r = await fetch(`/api/perpustakaan/isbn?q=${encodeURIComponent(q)}`).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok || !d) { setPesan({ baik: false, teks: d?.error ?? "Katalog tidak bisa dihubungi. Isi manual saja." }); return; }
    setAdaKunci(d.adaKunci !== false);
    if (d.ditemukan) { setPesan({ baik: true, teks: `Ditemukan di ${d.sumber}: "${d.title}". Periksa dulu isinya sebelum disimpan.` }); onHasil(d); return; }
    if (d.isbn) {
      setPesan({ baik: false, teks: `ISBN ${d.isbn} tidak ada di katalog terbuka — sering terjadi pada buku pelajaran terbitan Indonesia. Nomornya dipakai sebagai barcode; coba ketik JUDUL bukunya di kotak ini, atau isi manual.` });
      onHasil({ isbn: d.isbn, title: "", author: "", publisher: "", coverUrl: "", sumber: "" });
      return;
    }
    if (d.pilihan?.length) { setPilihan(d.pilihan); setPesan({ baik: true, teks: `${d.pilihan.length} buku berjudul mirip — ketuk yang sesuai.` }); }
    else setPesan({ baik: false, teks: `Tidak ada buku berjudul "${q}" di katalog terbuka. Isi manual saja.` });
  }
  async function pilih(p: Pilihan) {
    setPilihan(null);
    if (p.isbn) { setTeks(p.isbn); await cari(p.isbn); return; }   // lewat jalur ISBN supaya sampulnya ikut disalin
    setPesan({ baik: true, teks: `Diisi dari katalog: "${p.title}" (tanpa ISBN & sampul). Periksa dulu isinya.` });
    onHasil({ isbn: "", title: p.title, author: p.author, publisher: p.publisher, coverUrl: "", sumber: "katalog" });
  }
  async function simpanKunci() {
    setSibuk(true);
    const r = await fetch("/api/perpustakaan/isbn", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kunci }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { setPesan({ baik: false, teks: d?.error ?? "Kunci gagal disimpan." }); return; }
    setAdaKunci(true); setBukaKunci(false); setKunci(""); setPesan({ baik: true, teks: "Kunci Google Books terpasang. Coba cari lagi." });
  }
  const { videoRef, status } = usePindaiKamera({ aktif: kamera, format: ["ean_13"], onKode: k => { if (rapikanIsbn(k)) { setKamera(false); setTeks(k); cari(k); } } });

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3">
      <label htmlFor="isbn-buku" className="label-field">Isi otomatis dari ISBN atau judul</label>
      <div className="flex flex-wrap gap-2">
        <input id="isbn-buku" value={teks} onChange={e => setTeks(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); cari(teks); } }}
          placeholder="Pindai / ketik ISBN (978…) atau judul buku" className="input-field min-w-0 flex-1" />
        <button type="button" onClick={() => cari(teks)} disabled={sibuk || !teks.trim()} className="btn-modal-cancel btn-teks">{sibuk ? <Loader2 className="animate-spin" /> : <Search />} Cari</button>
        <button type="button" onClick={() => { setPesan(null); setKamera(k => !k); }} className="btn-modal-cancel btn-teks">{kamera ? <X /> : <ScanBarcode />} {kamera ? "Tutup Kamera" : "Pindai"}</button>
      </div>
      {kamera && (
        <div className="mt-3">
          {status === "aktif" || status === "meminta-izin"
            ? <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
            : <video ref={videoRef} className="hidden" />}
          <p className="mt-1.5 text-xs text-gray-500">
            {status === "aktif" ? "Arahkan kamera ke barcode di sampul belakang buku."
              : status === "meminta-izin" ? "Meminta izin kamera…"
              : status === "perlu-https" ? "Kamera hanya bisa dibuka lewat alamat https sekolah. Ketik nomornya atau pakai pemindai barcode USB."
              : status === "tidak-didukung" ? "Peramban ini tidak bisa membaca barcode batang (mis. Safari iPhone). Ketik nomornya atau pakai pemindai barcode USB."
              : status === "ditolak" ? "Izin kamera ditolak. Izinkan kamera untuk situs ini, atau ketik nomornya."
              : "Kamera tidak bisa dibuka. Ketik nomornya."}
          </p>
        </div>
      )}
      {sibuk && <p className="mt-2 text-sm text-gray-500">Mencari di katalog…</p>}
      {pesan && <p role="status" className={`mt-2 rounded-lg border px-3 py-2 text-sm ${pesan.baik ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{pesan.teks}</p>}
      {pilihan && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          {pilihan.map((p, i) => (
            <li key={`${p.isbn}-${i}`}>
              <button type="button" onClick={() => pilih(p)} className="sentuh block w-full px-3 py-2 text-left text-sm transition hover:bg-primary-50">
                <span className="block font-medium text-primary-900">{p.title}</span>
                <span className="block text-xs text-gray-500">{[p.author, p.publisher, p.isbn && `ISBN ${p.isbn}`].filter(Boolean).join(" · ") || "tanpa keterangan"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!adaKunci && (
        <div className="mt-2 text-xs text-gray-500">
          Hasil untuk buku Indonesia jauh lebih lengkap bila sekolah memasang kunci API Google Books (gratis).{" "}
          <button type="button" onClick={() => setBukaKunci(b => !b)} className="btn-modal-cancel btn-teks mt-2">{bukaKunci ? "Tutup" : "Pasang Kunci Google Books"}</button>
          {bukaKunci && (
            <div className="mt-2 space-y-2">
              <p>Buka console.cloud.google.com → buat proyek → aktifkan &quot;Books API&quot; → Credentials → Create API key. Tempel kuncinya di sini.</p>
              <div className="flex flex-wrap gap-2">
                <input aria-label="Kunci API Google Books" type="password" autoComplete="off" value={kunci} onChange={e => setKunci(e.target.value)} placeholder="AIza…" className="input-field min-w-0 flex-1" />
                <button type="button" onClick={simpanKunci} disabled={sibuk || !kunci.trim()} className="btn-modal-save btn-teks">Simpan Kunci</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
