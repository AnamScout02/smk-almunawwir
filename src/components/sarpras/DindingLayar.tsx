"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, Power, Home, VolumeX, Volume1, Volume2, Maximize2, X, TriangleAlert,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CornerDownLeft, PlayCircle, MonitorPlay, RotateCcw, Radio,
  ScreenShare, PackagePlus, Volume,
} from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

export interface LayarRingkas { id: string; nama: string; ruang: string; status: string; ip: string | null }

type Tombol = "daya" | "bangunkan" | "beranda" | "kembali" | "ok" | "atas" | "bawah" | "kiri" | "kanan"
  | "bisu" | "volumeNaik" | "volumeTurun" | "putarJeda" | "sumber";

/** DINDING LAYAR — tangkapan layar semua TV + remote virtual (24 September 2026).
 *
 * Dua alasan fitur ini ada, keduanya dari kebutuhan nyata:
 * 1. Sarpras ingin tahu TV mana sedang menampilkan apa tanpa keliling kelas.
 * 2. Remote TV sekolah sering hilang/habis baterai — dengan remote virtual, TV tetap bisa dikendalikan.
 *
 * Yang perlu dijaga saat mengubah berkas ini:
 * - **Mode langsung hanya di tampilan perbesar**, satu TV saja. Mengalirkan semua TV sekaligus akan
 *   menghabiskan jaringan sekolah (aliran berhenti sendiri setelah 2 menit di sisi server).
 * - **Pesan galat harus datang dari server.** Dulu gambar yang gagal hanya menampilkan kalimat tebakan
 *   ("TV tidak menjawab") padahal server tahu persis alasannya (menunggu izin ADB, TV tidur, dll).
 *   Karena `<img>` tidak bisa membaca badan balasan, alasannya diambil ulang lewat fetch saat gambar gagal. */
export default function DindingLayar({ layar, bolehKelola }: { layar: LayarRingkas[]; bolehKelola: boolean }) {
  const [versi, setVersi] = useState<Record<string, number>>({});
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [besar, setBesar] = useState<LayarRingkas | null>(null);
  const [langsung, setLangsung] = useState(false);
  const [berkala, setBerkala] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);

  const ambil = useCallback((id: string) => {
    setGalat(g => ({ ...g, [id]: "" }));
    setVersi(v => ({ ...v, [id]: Date.now() }));
  }, []);
  const ambilSemua = useCallback(() => { for (const l of layar) ambil(l.id); }, [layar, ambil]);

  useEffect(() => { ambilSemua(); }, [ambilSemua]);
  useEffect(() => {
    if (!berkala) return;
    const t = setInterval(ambilSemua, 20_000);
    return () => clearInterval(t);
  }, [berkala, ambilSemua]);

  /** Gambar gagal → tanyakan alasan sebenarnya ke server. */
  const cariAlasan = useCallback(async (id: string) => {
    let pesan = "TV tidak menjawab.";
    try {
      const r = await fetch(`/api/sarpras/layar/${id}/tangkapan?v=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.error) pesan = d.error;
      }
    } catch { /* jaringan putus — pakai pesan bawaan */ }
    if (hidup.current) setGalat(g => ({ ...g, [id]: pesan }));
  }, []);

  const kirim = async (l: LayarRingkas, isi: { tombol?: Tombol; aksi?: "buka-papan" | "mulai-ulang" | "terima-layar" | "pasang-papan" | "unduh-suara" }) => {
    if (isi.tombol === "daya" && !await confirm(`Tekan tombol daya pada "${l.nama}"? TV masuk standby, dan setelah itu TIDAK bisa dinyalakan lagi dari sistem selama tersambung lewat WiFi.`)) return;
    if (isi.aksi === "mulai-ulang" && !await confirm(`Mulai ulang "${l.nama}"? TV padam sekitar satu menit.`)) return;
    setSibuk(true);
    try {
      const r = await fetch(`/api/sarpras/layar/${l.id}/aksi`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi),
      });
      const d = await r.json().catch(() => null);
      if (r.ok) {
        // Tombol remote biasa (panah, volume, OK) TIDAK memunculkan toast: satu penekanan volume saja bisa
        // belasan kali, dan tiap kali muncul pemberitahuan "Perintah terkirim" layarnya jadi penuh notifikasi
        // (keluhan user 25 Sep 2026: "tidak perlu"). Umpan baliknya memang sudah ada — gambarnya diambil ulang.
        // Aksi besar (buka papan, mulai ulang, mode terima layar, pasang aplikasi) TETAP diberi tahu karena
        // hasilnya tidak selalu kelihatan di tangkapan layar.
        if (isi.aksi) toast.success(d?.pesan || "Perintah terkirim");
        setTimeout(() => ambil(l.id), 700);
      } else toast.error(d?.pesan || d?.error || "Perintah gagal");
    } finally { setSibuk(false); }
  };

  if (layar.length === 0) return null;

  const TombolRemote = ({ l, tombol, judul, children, kelas = "" }: { l: LayarRingkas; tombol: Tombol; judul: string; children: React.ReactNode; kelas?: string }) => (
    <button type="button" disabled={sibuk} onClick={() => kirim(l, { tombol })} title={judul} aria-label={judul}
      className={`flex h-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40 ${kelas}`}>
      {children}
    </button>
  );

  return (
    <div className="panel overflow-hidden mb-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-white px-5 py-3">
        {/* `basis-full` di HP: keterangan panjang ini WAJIB dapat barisnya sendiri. Dengan `flex-1` saja,
            kotak centang & tombol di sebelahnya tidak bisa menyusut sehingga seluruh kekurangan ruang
            ditimpakan ke teks — di layar 360px teksnya menyempit sampai satu huruf per baris
            (temuan user 24 Sep 2026). */}
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h3 className="font-heading font-semibold text-primary-900 text-sm">Monitoring visual</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Gambar diambil langsung dari TV lewat ADB. Aplikasi berproteksi (Netflix dsb.) dan tayangan dari colokan HDMI akan tampak hitam — itu batas Android, bukan TV rusak. Setiap pengambilan tercatat di Log Aktivitas.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          <input type="checkbox" checked={berkala} onChange={e => setBerkala(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Segarkan tiap 20 detik
        </label>
        <button type="button" onClick={ambilSemua} className="btn-modal-cancel"><RefreshCw /> Ambil ulang</button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {layar.map(l => (
          <div key={l.id} className="overflow-hidden rounded-xl border border-gray-100">
            <div className="relative aspect-video bg-gray-900">
              {versi[l.id] && !galat[l.id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`/api/sarpras/layar/${l.id}/tangkapan?v=${versi[l.id]}`} alt={`Layar ${l.nama}`}
                  className="h-full w-full object-contain" onError={() => cariAlasan(l.id)} />
              ) : null}
              {!versi[l.id] && !galat[l.id] && <span className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 size={22} className="animate-spin" /></span>}
              {galat[l.id] && (
                <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-amber-200">
                  <span><TriangleAlert size={18} className="mx-auto mb-1" />{galat[l.id]}</span>
                </span>
              )}
              <button type="button" onClick={() => { setLangsung(false); setBesar(l); }} title="Perbesar & remote"
                className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70"><Maximize2 size={14} /></button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary-900">{l.nama}</p>
                <p className="truncate text-xs text-gray-500">{l.ruang}{l.ip ? ` · ${l.ip}` : ""}</p>
              </div>
              <button type="button" onClick={() => ambil(l.id)} title="Ambil ulang" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><RefreshCw size={14} /></button>
              {bolehKelola && <>
                <button type="button" onClick={() => kirim(l, { tombol: "beranda" })} title="Kembali ke beranda TV" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Home size={14} /></button>
                <button type="button" onClick={() => kirim(l, { tombol: "bisu" })} title="Bisukan" className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg"><VolumeX size={14} /></button>
                <button type="button" onClick={() => kirim(l, { tombol: "daya" })} title="Matikan (standby)" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Power size={14} /></button>
              </>}
            </div>
          </div>
        ))}
      </div>

      {besar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setBesar(null)}>
          {/* `max-h-[95dvh]` + gulir: panel remote bertambah panjang tiap ada tombol baru, dan tanpa batas ini
              baris atas (Tutup · Ambil ulang · Mode langsung) terdorong keluar layar sehingga jendelanya tidak
              bisa ditutup lagi (temuan user 25 Sep 2026). Baris atas dibuat menempel supaya selalu terjangkau. */}
          <div className="flex max-h-[95dvh] w-full max-w-6xl flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-2 flex shrink-0 flex-wrap items-center gap-2 bg-black/85 py-1 text-white">
              <span className="font-heading font-semibold">{besar.nama}</span>
              <span className="text-sm text-white/60">{besar.ruang}</span>
              <label className="ml-auto flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                <input type="checkbox" checked={langsung} onChange={e => { setLangsung(e.target.checked); ambil(besar.id); }} className="h-4 w-4 rounded border-white/30" />
                <Radio size={14} /> Mode langsung
              </label>
              <button type="button" onClick={() => ambil(besar.id)} title="Ambil ulang" className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><RefreshCw size={16} /></button>
              <button type="button" onClick={() => setBesar(null)} title="Tutup" className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><X size={16} /></button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-4">
              <div className="lg:col-span-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={langsung
                    ? `/api/sarpras/layar/${besar.id}/langsung?v=${versi[besar.id] ?? 0}`
                    : `/api/sarpras/layar/${besar.id}/tangkapan?v=${versi[besar.id] ?? 0}`}
                  alt={`Layar ${besar.nama}`} className="w-full rounded-xl bg-gray-900" onError={() => cariAlasan(besar.id)} />
                {langsung && <p className="mt-2 text-xs text-white/50">Mode langsung ±1 gambar/detik, berhenti sendiri setelah 2 menit supaya tidak membebani jaringan.</p>}
                {galat[besar.id] && <p className="mt-2 text-xs text-amber-300">{galat[besar.id]}</p>}
              </div>

              {bolehKelola && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">Remote</p>
                  <div className="grid grid-cols-3 gap-2">
                    <span />
                    <TombolRemote l={besar} tombol="atas" judul="Atas"><ChevronUp size={18} /></TombolRemote>
                    <span />
                    <TombolRemote l={besar} tombol="kiri" judul="Kiri"><ChevronLeft size={18} /></TombolRemote>
                    <TombolRemote l={besar} tombol="ok" judul="OK" kelas="bg-white/20 font-semibold">OK</TombolRemote>
                    <TombolRemote l={besar} tombol="kanan" judul="Kanan"><ChevronRight size={18} /></TombolRemote>
                    <span />
                    <TombolRemote l={besar} tombol="bawah" judul="Bawah"><ChevronDown size={18} /></TombolRemote>
                    <span />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <TombolRemote l={besar} tombol="kembali" judul="Kembali"><CornerDownLeft size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="beranda" judul="Beranda"><Home size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="putarJeda" judul="Putar / jeda"><PlayCircle size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="volumeTurun" judul="Volume turun"><Volume1 size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="bisu" judul="Bisukan"><VolumeX size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="volumeNaik" judul="Volume naik"><Volume2 size={16} /></TombolRemote>
                    <TombolRemote l={besar} tombol="sumber" judul="Ganti sumber (HDMI/TV)" kelas="text-xs">HDMI</TombolRemote>
                    <TombolRemote l={besar} tombol="bangunkan" judul="Bangunkan layar" kelas="text-xs">Bangun</TombolRemote>
                    <TombolRemote l={besar} tombol="daya" judul="Matikan (standby)" kelas="text-red-300"><Power size={16} /></TombolRemote>
                  </div>

                  <div className="mt-3 space-y-2">
                    <button type="button" disabled={sibuk} onClick={() => kirim(besar, { aksi: "buka-papan" })}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-3 py-2.5 text-sm font-semibold text-[#0A1030] transition hover:brightness-110 disabled:opacity-40">
                      <MonitorPlay size={16} /> Buka Papan Sekolah
                    </button>
                    {/* MODE TERIMA LAYAR — supaya petugas tidak perlu mencari remote saat rapat. Ini Miracast
                        (Wi-Fi Direct): hanya laptop Windows; MacBook memakai Google Cast lewat Chrome. */}
                    <button type="button" disabled={sibuk} onClick={() => kirim(besar, { aksi: "terima-layar" })}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40">
                      <ScreenShare size={16} /> Mode Terima Layar
                    </button>
                    <button type="button" disabled={sibuk} onClick={() => kirim(besar, { aksi: "pasang-papan" })}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40">
                      <PackagePlus size={16} /> Pasang aplikasi papan
                    </button>
                    {/* Data suara Google TTS diunduh per bahasa; TV sekolah berbahasa Inggris, jadi suara
                        Indonesia perlu ditambahkan sekali per TV agar pengumuman dibacakan dengan benar. */}
                    <button type="button" disabled={sibuk} onClick={() => kirim(besar, { aksi: "unduh-suara" })}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40">
                      <Volume size={16} /> Unduh suara Indonesia
                    </button>
                    <button type="button" disabled={sibuk} onClick={() => kirim(besar, { aksi: "mulai-ulang" })}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-40">
                      <RotateCcw size={16} /> Mulai ulang TV
                    </button>
                    <p className="pt-1 text-xs leading-relaxed text-white/45">
                      <b>Mode Terima Layar</b> menaruh TV menunggu pantulan layar (Windows: <b>Win</b>+<b>K</b>), dan
                      papan otomatis ditahan 1 jam supaya tidak menyambar layar di sela rapat. MacBook tidak mendukung
                      Miracast — pakai Chrome → Cast.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
