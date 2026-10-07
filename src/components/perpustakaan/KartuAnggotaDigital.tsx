"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AlertTriangle, BookMarked, BookmarkPlus, Loader2, Sun, User, Wallet } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";

interface Data {
  anggota: { nama: string; jenis: "SISWA" | "GURU" | "PEGAWAI"; identitas: string; kelas: string | null; foto: string | null };
  qr: string; pinjamanAktif: number; terlambat: number; pesanan: number; tunggakan: number;
  aturan: { maksPinjam: number; masaHari: number };
}

const JENIS = { SISWA: "Siswa", GURU: "Guru", PEGAWAI: "Pegawai" };
const NAVY = "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)";

/** KARTU ANGGOTA DIGITAL — QR yang sama dengan kartu tanda cetak, untuk dipindai petugas di meja sirkulasi atau
 * kiosk kunjungan. Layar dijaga tetap menyala (Screen Wake Lock) selama kartu ditampilkan. */
/** `mode="identitas"` — dipakai halaman /kartu-identitas: kartu yang sama (QR identitas sama dengan kartu
 * cetak) tanpa angka pinjaman/denda, karena di situ fungsinya kartu pengenal untuk presensi & layanan. */
export default function KartuAnggotaDigital({ mode = "perpustakaan" }: { mode?: "perpustakaan" | "identitas" }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [layarMenyala, setLayarMenyala] = useState(false);

  useEffect(() => {
    fetch("/api/perpustakaan/kartu-saya")
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error ?? "Gagal memuat kartu."); return d; })
      .then(setData).catch(e => setGalat(e.message));
  }, []);

  useEffect(() => {
    let kunci: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const minta = () => nav.wakeLock?.request("screen").then(k => { kunci = k; setLayarMenyala(true); }).catch(() => setLayarMenyala(false));
    minta();
    const saatTampil = () => { if (document.visibilityState === "visible") minta(); };
    document.addEventListener("visibilitychange", saatTampil);
    return () => { document.removeEventListener("visibilitychange", saatTampil); kunci?.release().catch(() => {}); };
  }, []);

  if (galat) return <div className="p-6"><EmptyState icon={User} title="Kartu belum tersedia" description={galat} /></div>;
  if (!data) return <div className="flex justify-center py-24 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
      <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: NAVY }}>
        <div className="relative p-5">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "155.56px 155.56px", filter: "invert(1)" }} />
          <div className="relative flex items-center gap-3">
            {data.anggota.foto ? (
              <Image src={data.anggota.foto} alt="" width={56} height={56} className="w-14 h-14 rounded-2xl object-cover border-2 border-gold/60" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 text-white/60 flex items-center justify-center"><User size={26} /></div>
            )}
            <div className="min-w-0">
              <p className="text-gold text-[11px] font-semibold uppercase tracking-[0.14em]">{mode === "identitas" ? "Kartu Identitas Digital" : "Kartu Anggota Perpustakaan"}</p>
              <p className="font-heading font-bold text-white text-lg leading-tight truncate">{data.anggota.nama}</p>
              <p className="text-white/60 text-xs">{JENIS[data.anggota.jenis]}{data.anggota.kelas ? ` · ${data.anggota.kelas}` : ""}</p>
            </div>
          </div>
        </div>
        <div className="bg-white mx-4 mb-4 rounded-2xl p-4 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qr} alt="QR kartu anggota" className="w-60 h-60 max-w-full" />
          <p className="font-mono font-bold text-primary-900 tracking-widest mt-1">{data.anggota.identitas}</p>
        </div>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />
      </div>

      {mode === "perpustakaan" && <div className="grid grid-cols-3 gap-2 text-center">
        <div className="page-card p-3"><BookMarked size={16} className="mx-auto text-primary-700" /><p className="font-heading font-bold text-primary-900">{data.pinjamanAktif}/{data.aturan.maksPinjam}</p><p className="text-xs text-gray-400 uppercase">dipinjam</p></div>
        <div className="page-card p-3"><BookmarkPlus size={16} className="mx-auto text-primary-700" /><p className="font-heading font-bold text-primary-900">{data.pesanan}</p><p className="text-xs text-gray-400 uppercase">pesanan</p></div>
        <div className={`page-card p-3 ${data.tunggakan ? "ring-1 ring-red-200" : ""}`}><Wallet size={16} className={`mx-auto ${data.tunggakan ? "text-red-600" : "text-primary-700"}`} /><p className={`font-heading font-bold ${data.tunggakan ? "text-red-600" : "text-primary-900"}`}>Rp{data.tunggakan.toLocaleString("id-ID")}</p><p className="text-xs text-gray-400 uppercase">denda</p></div>
      </div>}

      {mode === "perpustakaan" && data.terlambat > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {data.terlambat} buku sudah melewati batas pengembalian. Kembalikan secepatnya supaya denda tidak bertambah.
        </div>
      )}

      <div className="panel p-4 text-sm text-gray-600 space-y-1.5">
        <p className="font-semibold text-primary-900 flex items-center gap-1.5"><Sun size={15} className="text-gold-dark" /> Tunjukkan kartu ini ke petugas</p>
        {mode === "identitas"
          ? <p>Naikkan kecerahan layar supaya QR mudah terbaca pemindai. QR ini sama dengan yang tercetak di kartu Anda — dipakai untuk presensi di gerbang, peminjaman buku, dan layanan sekolah lain.</p>
          : <p>Naikkan kecerahan layar supaya QR mudah terbaca pemindai. Masa pinjam {data.aturan.masaHari} hari, maksimal {data.aturan.maksPinjam} buku.</p>}
        <p className="text-xs text-gray-400">{layarMenyala ? "Layar dijaga tetap menyala selama halaman ini terbuka." : "Kartu cetak (kartu pelajar/kartu tanda) juga bisa dipakai."}</p>
      </div>
    </div>
  );
}
