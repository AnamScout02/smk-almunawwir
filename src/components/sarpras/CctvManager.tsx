"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cctv, Loader2, RefreshCw, Settings2, Maximize2, X, TriangleAlert, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Pengaturan {
  host: string; pengguna: string; adaSandi: boolean; kanal: number;
  namaKanal: Record<number, string>; bolehAtur: boolean; error?: string;
}

/** LAYAR CCTV — cuplikan kamera sekolah di dashboard (24 September 2026).
 *
 * DVR sekolah bermerek Dahua dan menyediakan foto sesaat lewat HTTP, jadi tidak perlu aplikasi DVR, tidak perlu
 * pemutar video, dan tidak perlu membuka port ke internet. Yang tampil adalah FOTO yang disegarkan berkala —
 * bukan video langsung; itu pilihan sadar supaya server tidak terbebani transcoding.
 *
 * Penyegaran otomatis sengaja OPT-IN dan berhenti saat halaman ditinggalkan, dan setiap pembukaan layar
 * tercatat di Log Aktivitas. */
export default function CctvManager({ tanpaKerangka }: { tanpaKerangka?: boolean } = {}) {
  const [p, setP] = useState<Pengaturan | null>(null);
  const [galat, setGalat] = useState("");
  const [versi, setVersi] = useState<Record<number, number>>({});
  const [rusak, setRusak] = useState<Record<number, string>>({});
  const [besar, setBesar] = useState<number | null>(null);
  const [berkala, setBerkala] = useState(false);
  const [atur, setAtur] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [form, setForm] = useState({ host: "", pengguna: "", sandi: "", kanal: "", namaKanal: "" });
  const toast = useToast();
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);

  const muat = useCallback(() => fetch("/api/cctv/pengaturan", { cache: "no-store" })
    .then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setGalat(d?.error || "Gagal memuat"); return; }
      setP(d); setGalat("");
      setForm(f => ({
        ...f, host: d.host, pengguna: d.pengguna, kanal: String(d.kanal || ""),
        namaKanal: Object.entries(d.namaKanal || {}).map(([n, v]) => `${n}=${v}`).join(", "),
      }));
    })
    .catch(() => setGalat("Gagal memuat")), []);

  useEffect(() => { muat(); }, [muat]);

  /** `<img>` tidak bisa membaca badan balasan, jadi alasan gagalnya ditanyakan ulang ke server — tanpa ini
   * semua kegagalan terlihat sama ("kamera tidak mengirim gambar") padahal server tahu persis penyebabnya
   * (sandi salah, akun tidak berwenang, DVR tidak menjawab). */
  const cariAlasan = useCallback(async (n: number) => {
    let pesan = "Kamera tidak mengirim gambar.";
    try {
      const r = await fetch(`/api/cctv/${n}/cuplikan?v=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) { const d = await r.json().catch(() => null); if (d?.error) pesan = d.error; }
    } catch { /* jaringan putus */ }
    if (hidup.current) setRusak(x => ({ ...x, [n]: pesan }));
  }, []);

  const segarkan = useCallback(() => {
    setVersi(v => {
      const baru = { ...v };
      for (let i = 1; i <= (p?.kanal ?? 0); i++) baru[i] = Date.now();
      return baru;
    });
    setRusak({});
  }, [p?.kanal]);

  useEffect(() => { if (p?.kanal) segarkan(); }, [p?.kanal, segarkan]);
  useEffect(() => {
    if (!berkala) return;
    const t = setInterval(segarkan, 15_000);
    return () => clearInterval(t);
  }, [berkala, segarkan]);

  const simpan = async () => {
    setSibuk(true);
    try {
      const r = await fetch("/api/cctv/pengaturan", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
      toast.success("Pengaturan tersimpan");
      setForm(f => ({ ...f, sandi: "" }));
      setAtur(false); await muat();
    } finally { setSibuk(false); }
  };

  if (!p && !galat) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} flex items-center justify-center min-h-[60vh] text-gray-400`}><Loader2 size={24} className="animate-spin" /></div>;
  if (!p) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} text-center text-gray-400 py-20`}>{galat}</div>;

  const kanal = Array.from({ length: p.kanal }, (_, i) => i + 1);
  const belumSiap = !p.host || !p.pengguna || !p.adaSandi || !p.kanal;

  return (
    <div className={tanpaKerangka ? "" : "p-6 lg:p-8 pt-16 lg:pt-8"}>
      {!tanpaKerangka && (
      <PageHeader icon={<Cctv size={22} />} title="CCTV Sekolah"
        description="Cuplikan kamera dari DVR sekolah — gambar disegarkan berkala, bukan rekaman video" />
      )}

      <div className="baris-alat mb-5">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          <input type="checkbox" checked={berkala} onChange={e => setBerkala(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Segarkan tiap 15 detik
        </label>
        <div className="alat-aksi">
          <button type="button" onClick={segarkan} className="btn-modal-cancel"><RefreshCw /> Ambil ulang</button>
          {p.bolehAtur && <button type="button" onClick={() => setAtur(true)} className="btn-modal-cancel btn-teks"><Settings2 /> Pengaturan DVR</button>}
        </div>
      </div>

      {belumSiap ? (
        <div className="panel overflow-hidden">
          <EmptyState icon={Cctv} title="CCTV belum diatur"
            description={p.bolehAtur
              ? "Isi alamat DVR, nama pengguna, sandi, dan jumlah kamera lewat tombol Pengaturan DVR di atas."
              : "Pengaturan DVR belum diisi oleh admin."} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kanal.map(n => (
            <div key={n} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="relative aspect-video bg-gray-900">
                {versi[n] && !rusak[n] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/api/cctv/${n}/cuplikan?v=${versi[n]}`} alt={`Kamera ${n}`} className="h-full w-full object-cover"
                    onError={() => cariAlasan(n)} />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-amber-200">
                    {rusak[n] ? <span><TriangleAlert size={18} className="mx-auto mb-1" />{rusak[n]}</span> : <Loader2 size={20} className="animate-spin text-white/60" />}
                  </span>
                )}
                <button type="button" onClick={() => setBesar(n)} title="Perbesar"
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white hover:bg-black/70"><Maximize2 size={14} /></button>
              </div>
              <div className="px-3 py-2 text-sm font-semibold text-primary-900">
                {p.namaKanal[n] ?? `Kamera ${n}`}
                <span className="ml-2 text-xs font-normal text-gray-400">kanal {n}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {besar !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setBesar(null)}>
          <div className="w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-white">
              <span className="font-heading font-semibold">{p.namaKanal[besar] ?? `Kamera ${besar}`}</span>
              <button type="button" onClick={segarkan} className="ml-auto rounded-lg bg-white/10 p-2 hover:bg-white/20"><RefreshCw size={16} /></button>
              <button type="button" onClick={() => setBesar(null)} className="rounded-lg bg-white/10 p-2 hover:bg-white/20"><X size={16} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cctv/${besar}/cuplikan?v=${versi[besar] ?? 0}`} alt={`Kamera ${besar}`} className="w-full rounded-xl bg-gray-900" />
          </div>
        </div>
      )}

      <Modal open={atur} onClose={() => setAtur(false)} title="Pengaturan DVR" size="md" scrollBody
        footer={<>
          <button type="button" onClick={() => setAtur(false)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Alamat DVR</label>
            <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="202.202.101.29" className="input-field font-mono" />
            <p className="mt-1 text-xs text-gray-500">Alamat di jaringan lokal saja. Sistem menghubungi DVR dari server, jadi DVR tidak perlu dibuka ke internet.</p>
          </div>
          <div>
            <label className="label-field">Nama pengguna DVR</label>
            <input value={form.pengguna} onChange={e => setForm({ ...form, pengguna: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Sandi DVR</label>
            <input type="password" value={form.sandi} onChange={e => setForm({ ...form, sandi: e.target.value })}
              placeholder={p.adaSandi ? "(tersimpan — kosongkan bila tidak diubah)" : ""} className="input-field" />
            <p className="mt-1 text-xs text-gray-500">Disimpan terenkripsi dan tidak pernah dikirim kembali ke browser.</p>
          </div>
          <div>
            <label className="label-field">Jumlah kamera</label>
            <input value={form.kanal} onChange={e => setForm({ ...form, kanal: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="input-field" />
          </div>
          <div>
            <label className="label-field">Nama kamera (opsional)</label>
            <input value={form.namaKanal} onChange={e => setForm({ ...form, namaKanal: e.target.value })}
              placeholder="1=Gerbang, 2=Lobi, 3=Koridor Lantai 1" className="input-field" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
