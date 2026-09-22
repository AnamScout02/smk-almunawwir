"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Maximize } from "lucide-react";

interface Isi { judul: string; tempat: string | null; mulai: string; selesai: string; qr: string; berlakuSampai: string; hadir: number; terakhir: { nama: string; waktu: string }[] }

/** LAYAR QR PRESENSI — tampil di proyektor/TV; QR berganti tiap 30 detik (diperbarui otomatis). */
export default function LayarQrKegiatan({ id, kembaliHref }: { id: string; kembaliHref: string }) {
  const [isi, setIsi] = useState<Isi | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    let henti = false;
    let t: ReturnType<typeof setTimeout>;
    const ambil = async () => {
      const r = await fetch(`/api/kegiatan/${id}/qr`, { cache: "no-store" }).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (henti) return;
      if (!r?.ok) setGalat(d?.error ?? "Gagal memuat QR — mencoba lagi…"); else { setGalat(""); setIsi(d); }
      const sisa = d?.berlakuSampai ? new Date(d.berlakuSampai).getTime() - Date.now() : 10000;
      t = setTimeout(ambil, Math.min(Math.max(sisa - 3000, 5000), 30000));
    };
    ambil();
    return () => { henti = true; clearTimeout(t); };
  }, [id]);
  const jam = (s: string) => new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return (
    <div className="flex min-h-dvh flex-col bg-primary-900 px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <Link href={kembaliHref} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"><ArrowLeft size={16} /> Kembali</Link>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"><Maximize size={16} /> Layar penuh</button>
      </div>
      {!isi ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/70"><Loader2 size={28} className="animate-spin" />{galat}</div>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-center gap-8 py-6 lg:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-3xl bg-white p-4 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isi.qr} alt="QR presensi" className="h-[min(70vw,60vh)] w-[min(70vw,60vh)]" />
          </div>
          <div className="min-w-0 text-center lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">Presensi</p>
            <h1 className="mt-2 font-heading text-3xl font-bold leading-tight lg:text-5xl">{isi.judul}</h1>
            <p className="mt-2 text-lg text-white/70">{jam(isi.mulai)}–{jam(isi.selesai)}{isi.tempat ? ` · ${isi.tempat}` : ""}</p>
            <p className="mt-6 text-lg">Buka kamera HP, arahkan ke QR, lalu ketuk tautannya.</p>
            <p className="mt-1 text-sm text-white/60">QR berganti otomatis tiap 30 detik. Masuk dengan akun sekolah masing-masing.</p>
            <p className="angka mt-8 font-heading text-6xl font-bold text-gold">{isi.hadir}</p>
            <p className="text-white/70">peserta sudah hadir</p>
            {isi.terakhir.length > 0 && <p className="mt-3 text-sm text-white/60">Terbaru: {isi.terakhir.map(t => t.nama).join(", ")}</p>}
            {galat && <p className="mt-3 text-sm text-amber-300">{galat}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
