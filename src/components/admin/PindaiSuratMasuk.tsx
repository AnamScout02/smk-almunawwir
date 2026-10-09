"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanLine, Upload, FileCheck2 } from "lucide-react";
import KameraBerkas, { kameraTersedia } from "@/components/spmb/KameraBerkas";
import PemindaiDokumen from "@/components/spmb/PemindaiDokumen";
import { deteksiDokumen, kanvasKeFile, type Sudut } from "@/lib/pindai-dokumen";
import { kecilkanFoto } from "@/lib/olah-foto";
import { uraiSurat, type UsulanSurat } from "@/lib/urai-surat";

type Isi = { nomor?: string; tanggal?: string; pihak?: string; perihal?: string };
const LABEL: Record<keyof UsulanSurat, string> = { nomor: "Nomor", tanggal: "Tanggal", pengirim: "Dari", perihal: "Perihal" };

/** PINDAI SURAT MASUK (9 Okt 2026) — foto surat dari kamera/galeri diluruskan & dijernihkan (pemindai SPMB, CLAUDE.md #138),
 *  disimpan ke folder rahasia, lalu teksnya dibaca OCR di peramban untuk MENGUSULKAN nomor, tanggal, pengirim, dan perihal.
 *  Usulan tidak pernah mengisi sendiri: petugas menekan "Pakai" per isian atau "Pakai semua yang kosong". PDF disimpan apa adanya
 *  (tanpa dibaca). */
export default function PindaiSuratMasuk({ fileUrl, isi, onBerkas, onPakai }: {
  fileUrl: string; isi: Isi; onBerkas: (url: string) => void; onPakai: (k: keyof Isi, v: string) => void;
}) {
  const [adaKamera, setAdaKamera] = useState(false);
  const [kamera, setKamera] = useState(false);
  const [pindai, setPindai] = useState<{ kanvas: HTMLCanvasElement; sudut: Sudut | null; file: File } | null>(null);
  const [tahap, setTahap] = useState<"" | "menyimpan" | "membaca">("");
  const [galat, setGalat] = useState("");
  const [usulan, setUsulan] = useState<UsulanSurat | null>(null);
  const isian = useRef<HTMLInputElement>(null);
  useEffect(() => { setAdaKamera(kameraTersedia()); }, []);

  async function terima(file: File) {
    setGalat(""); setUsulan(null);
    if (file.type === "application/pdf") { await simpan(file, null); return; }
    const olah = await kecilkanFoto(file, 2200).catch(() => null);
    if (!olah?.kanvas) { setGalat("Foto tidak terbaca. Coba JPG atau PNG."); return; }
    setPindai({ kanvas: olah.kanvas, sudut: deteksiDokumen(olah.kanvas), file: olah.file });
  }
  async function simpan(file: File, kanvas: HTMLCanvasElement | null) {
    setTahap("menyimpan");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/admin/surat/pindai", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setGalat(j.error ?? "Gagal menyimpan pindaian."); return; }
      onBerkas(j.url);
      if (!kanvas) return;
      setTahap("membaca");
      // OCR di peramban (tesseract.js, dimuat saat dipakai) — teks ASLI, bukan huruf besar, supaya perihal enak dibaca.
      const { createWorker } = await import("tesseract.js");
      const pekerja = await createWorker("ind");
      try { const { data } = await pekerja.recognize(kanvas); setUsulan(uraiSurat(data.text ?? "")); }
      finally { await pekerja.terminate().catch(() => {}); }
    } catch { setGalat("Pindaian tersimpan, tetapi teksnya tidak bisa dibaca. Isi manual."); }
    finally { setTahap(""); }
  }
  const peta: Record<keyof UsulanSurat, keyof Isi> = { nomor: "nomor", tanggal: "tanggal", pengirim: "pihak", perihal: "perihal" };
  const ada = usulan ? (Object.keys(LABEL) as (keyof UsulanSurat)[]).filter(k => usulan[k]) : [];
  const tglTampil = (v: string) => new Date(`${v}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="rounded-xl border border-gray-100 bg-[#f5f6fa] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {adaKamera && <button type="button" className="btn-modal-save" disabled={!!tahap} onClick={() => setKamera(true)}><Camera size={16} /> Pindai dengan Kamera</button>}
        <button type="button" className="btn-modal-cancel" disabled={!!tahap} onClick={() => isian.current?.click()}><Upload size={16} /> Pilih Foto / PDF</button>
        <input ref={isian} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void terima(f); }} />
        {tahap && <span className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> {tahap === "menyimpan" ? "Menyimpan pindaian…" : "Membaca isi surat…"}</span>}
        {fileUrl && !tahap && <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"><FileCheck2 size={16} /> Pindaian tersimpan — lihat</a>}
      </div>
      {galat && <p className="error-msg mt-2">{galat}</p>}
      {usulan && (ada.length === 0 ? <p className="mt-2 text-sm text-gray-500">Tidak ada yang terbaca dari surat ini. Isi manual.</p> : (
        <div className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-900"><ScanLine size={16} /> Terbaca dari surat — periksa dulu</p>
            <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => ada.forEach(k => { if (!isi[peta[k]]) onPakai(peta[k], usulan[k]); })}>Pakai semua yang kosong</button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {ada.map(k => (
              <li key={k} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-xs text-gray-400">{LABEL[k]}</span>
                <span className="min-w-0 flex-1 break-words text-gray-700">{k === "tanggal" ? tglTampil(usulan[k]) : usulan[k]}</span>
                {isi[peta[k]] === usulan[k] ? <span className="shrink-0 text-xs text-emerald-700">dipakai</span>
                  : <button type="button" className="shrink-0 text-xs font-semibold text-primary-700 hover:underline" onClick={() => onPakai(peta[k], usulan[k])}>Pakai</button>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">Pembacaan otomatis bisa keliru pada stempel, tulisan tangan, dan kop bergambar.</p>
        </div>
      ))}
      {kamera && <KameraBerkas mode="dokumen" onTutup={() => setKamera(false)} onFoto={f => { setKamera(false); void terima(f); }} />}
      {pindai && (
        <PemindaiDokumen kanvas={pindai.kanvas} sudutAwal={pindai.sudut}
          onPakai={async hasil => { const f = await kanvasKeFile(hasil, pindai.file.name).catch(() => null); const p = pindai; setPindai(null); await simpan(f ?? p.file, hasil); }}
          onAsli={() => { const p = pindai; setPindai(null); void simpan(p.file, p.kanvas); }}
          onTutup={() => { const p = pindai; setPindai(null); void simpan(p.file, p.kanvas); }} />
      )}
    </div>
  );
}
