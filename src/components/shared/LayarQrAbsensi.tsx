"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, Maximize2, Play, QrCode, Save, ShieldCheck, Users } from "lucide-react";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import TombolKembali from "@/components/shared/TombolKembali";

interface Daftar { gerbang: boolean; kelas: { id: string; name: string }[]; jamBuka: string; jamTutup: string; bolehAtur: boolean }
interface Layar {
  token: { isi: string; berlakuSampai: string }; stasiunLabel: string; jamBuka: string; jamTutup: string;
  rekap: { totalSiswa: number; hadir: number }; indikasiTitip: number;
  pindaiTerakhir: { id: string; nama: string; kelas: string; metode: string; hasil: string; jam: string }[];
}

/** LAYAR QR ABSEN MANDIRI — kiosk yang dibiarkan terbuka di gerbang atau kelas. QR berganti tiap 30 detik; siswa
 * memindainya dari menu Absen Mandiri di HP masing-masing. Dipakai admin/TAS, petugas piket, dan wali kelas. */
export default function LayarQrAbsensi({ backHref }: { backHref: string }) {
  const toast = useToast();
  const [daftar, setDaftar] = useState<Daftar | null>(null);
  const [galat, setGalat] = useState("");
  const [stasiun, setStasiun] = useState("");
  const [mulai, setMulai] = useState(false);
  const [jam, setJam] = useState({ buka: "", tutup: "" });
  const [simpan, setSimpan] = useState(false);

  useEffect(() => {
    fetch("/api/absensi-qr/layar?daftar=1")
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error ?? "Gagal memuat."); return d as Daftar; })
      .then(d => { setDaftar(d); setStasiun(d.gerbang ? "GERBANG" : d.kelas[0]?.id ?? ""); setJam({ buka: d.jamBuka, tutup: d.jamTutup }); })
      .catch(e => setGalat(e.message));
  }, []);

  async function simpanJam() {
    setSimpan(true);
    const r = await fetch("/api/absensi-qr/layar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jamBuka: jam.buka, jamTutup: jam.tutup }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpan(false);
    if (r?.ok) toast.success("Jam absen mandiri disimpan."); else toast.error(d?.error ?? "Gagal menyimpan.");
  }

  const latar = { background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" };

  if (mulai && stasiun) return <Tampilan stasiun={stasiun} backHref={backHref} onBerhenti={() => setMulai(false)} />;

  return (
    <div className="min-h-dvh flex items-center justify-center p-6" style={latar}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center"><QrCode size={24} /></div>
          <div><h1 className="font-heading text-xl font-bold text-primary-900">Layar QR Absen Mandiri</h1><p className="text-sm text-gray-500">Pasang di gerbang atau kelas, biarkan terbuka.</p></div>
        </div>
        {galat ? (
          <p className="error-msg p-3">{galat}</p>
        ) : !daftar ? (
          <div className="flex justify-center py-8 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : (
          <>
            <div>
              <label className="label-field">Stasiun</label>
              <Select value={stasiun} onChange={setStasiun} options={[
                ...(daftar.gerbang ? [{ value: "GERBANG", label: "Gerbang sekolah (semua kelas)" }] : []),
                ...daftar.kelas.map(k => ({ value: k.id, label: `Kelas ${k.name}` })),
              ]} />
            </div>
            {daftar.bolehAtur ? (
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <div><label className="label-field" htmlFor="jam-buka">Jam buka</label><input id="jam-buka" className="input-field font-mono" value={jam.buka} onChange={e => setJam({ ...jam, buka: e.target.value })} /></div>
                <div><label className="label-field" htmlFor="jam-tutup">Jam tutup</label><input id="jam-tutup" className="input-field font-mono" value={jam.tutup} onChange={e => setJam({ ...jam, tutup: e.target.value })} /></div>
                <button type="button" onClick={simpanJam} disabled={simpan} className="btn-modal-cancel h-[42px] px-3" title="Simpan jam">{simpan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}</button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Absen mandiri dibuka pukul {daftar.jamBuka}–{daftar.jamTutup} WIB.</p>
            )}
            <button type="button" onClick={() => setMulai(true)} disabled={!stasiun} className="btn-modal-save w-full py-3">
              <Play size={18} /> Tampilkan QR
            </button>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-500 leading-relaxed flex gap-2">
              <ShieldCheck size={16} className="text-primary-700 shrink-0" />
              QR berganti tiap 30 detik dan hanya berlaku ±1 menit. Siswa memindai dari menu <strong>Absen Mandiri</strong> di akun masing-masing; absensi yang sudah diisi wali kelas tidak ditimpa.
            </div>
          </>
        )}
        <TombolKembali href={backHref} className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-primary-700 text-xs" />
      </div>
    </div>
  );
}

function Tampilan({ stasiun, backHref, onBerhenti }: { stasiun: string; backHref: string; onBerhenti: () => void }) {
  const [data, setData] = useState<Layar | null>(null);
  const [gambar, setGambar] = useState("");
  const [sisa, setSisa] = useState(30);
  const [jamDinding, setJamDinding] = useState(new Date());
  const tokenRef = useRef("");

  const muat = useCallback(async () => {
    const r = await fetch(`/api/absensi-qr/layar?stasiun=${encodeURIComponent(stasiun)}`).catch(() => null);
    if (!r?.ok) return;
    const d: Layar = await r.json();
    setData(d);
    if (d.token.isi !== tokenRef.current) {
      tokenRef.current = d.token.isi;
      const QR = (await import("qrcode")).default;
      setGambar(await QR.toDataURL(d.token.isi, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F1A45", light: "#FFFFFF" } }));
    }
  }, [stasiun]);

  useEffect(() => {
    muat();
    const t = setInterval(() => {
      setJamDinding(new Date());
      const berlaku = tokenRef.current && data ? new Date(data.token.berlakuSampai).getTime() - Date.now() : 30_000;
      setSisa(Math.max(0, Math.ceil(berlaku / 1000)));
      if (berlaku <= 500) muat();
    }, 1000);
    const segar = setInterval(muat, 8000);
    return () => { clearInterval(t); clearInterval(segar); };
  }, [muat, data]);

  useEffect(() => { document.documentElement.requestFullscreen?.().catch(() => {}); return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }; }, []);

  return (
    <div className="min-h-dvh p-4 sm:p-8 flex flex-col lg:flex-row items-center justify-center gap-8 relative"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute top-4 left-4 flex gap-3 text-xs">
        <button type="button" onClick={onBerhenti} className="flex items-center gap-1.5 text-white/40 hover:text-white/80"><ArrowLeft size={13} /> Ganti stasiun</button>
        <Link href={backHref} className="text-white/40 hover:text-white/80">Keluar layar</Link>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="flex items-center gap-1 text-white/40 hover:text-white/80"><Maximize2 size={12} /> Layar penuh</button>
      </div>

      <div className="flex flex-col items-center">
        <p className="text-gold text-sm font-semibold uppercase tracking-widest mb-2">Absen Mandiri · {data?.stasiunLabel ?? "…"}</p>
        <div className="bg-white rounded-3xl p-4 shadow-2xl">
          {gambar ? <img src={gambar} alt="QR absensi" className="w-[min(70vw,420px)] h-[min(70vw,420px)]" /> : <div className="w-[min(70vw,420px)] h-[min(70vw,420px)] flex items-center justify-center text-gray-300"><Loader2 size={32} className="animate-spin" /></div>}
        </div>
        <div className="mt-4 w-[min(70vw,420px)] h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gold transition-all duration-1000 ease-linear" style={{ width: `${(sisa / 30) * 100}%` }} />
        </div>
        <p className="text-white/60 text-sm mt-2">QR berganti dalam {sisa} detik · buka menu <strong className="text-white">Absen Mandiri</strong> di HP lalu pindai</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <p className="font-heading font-bold text-white text-5xl tabular-nums text-center lg:text-left">
          {jamDinding.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
            <p className="text-white/50 text-xs flex items-center gap-1"><Users size={12} /> Hadir hari ini</p>
            <p className="text-white font-heading font-bold text-3xl tabular-nums">{data?.rekap.hadir ?? "–"}<span className="text-white/40 text-base"> / {data?.rekap.totalSiswa ?? "–"}</span></p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
            <p className="text-white/50 text-xs">Jam absen mandiri</p>
            <p className="text-white font-heading font-bold text-xl tabular-nums">{data ? `${data.jamBuka}–${data.jamTutup}` : "–"}</p>
          </div>
        </div>
        {!!data?.indikasiTitip && (
          <div className="rounded-2xl bg-amber-500/15 border border-amber-400/30 p-3 text-amber-200 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {data.indikasiTitip} perangkat dipakai lebih dari satu siswa hari ini — periksa di rekap absensi.
          </div>
        )}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-2">Pindaian terakhir</p>
          {!data?.pindaiTerakhir.length ? <p className="text-white/40 text-sm">Belum ada.</p> : (
            <ul className="space-y-1.5">
              {data.pindaiTerakhir.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.hasil === "DIBUAT" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span className="text-white/80 flex-1 truncate">{p.nama}</span>
                  <span className="text-white/40 text-xs">{p.kelas}</span>
                  <span className="text-white/40 text-xs font-mono">{p.jam}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
