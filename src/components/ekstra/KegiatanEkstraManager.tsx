"use client";
import { useCallback, useEffect, useState } from "react";
import { Camera, Images, Loader2, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import MonthPicker from "@/components/shared/MonthPicker";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { kecilkanFoto } from "@/lib/olah-foto";

interface Kegiatan { id: string; extracurricularId: string; tanggal: string; materi: string | null; foto: string[]; sumber: string | null; oleh: string; peran: string; hadir: number; peserta: number }
interface Data { bulan: string; kelola: boolean; ekskul: { id: string; nama: string }[]; kegiatan: Kegiatan[] }
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** KEGIATAN & FOTO — riwayat pertemuan tiap ekskul beserta foto bukti kegiatannya. Foto bisa diunggah di sini (koordinator,
 *  pembina ber-akun) atau lewat tautan pembina luar; keduanya masuk pertemuan yang sama. */
export default function KegiatanEkstraManager() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [ekskul, setEkskul] = useState("");
  const [bulan, setBulan] = useState(hariIni().slice(0, 7));
  const [tanggal, setTanggal] = useState(hariIni());
  const [unggah, setUnggah] = useState(false);

  useEffect(() => { const q = new URLSearchParams(window.location.search).get("ekskul"); if (q) setEkskul(q); }, []);
  const muat = useCallback(() => {
    fetch(`/api/ekstra/kegiatan?bulan=${bulan}${ekskul ? `&extracurricularId=${ekskul}` : ""}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null)).then(x => { if (x) setD(x); }).catch(() => {});
  }, [bulan, ekskul]);
  useEffect(() => { muat(); }, [muat]);

  async function kirimFoto(files: FileList | null) {
    if (!files?.length || !ekskul) return;
    setUnggah(true);
    let ok = 0;
    for (const f of [...files].slice(0, 6)) {
      const kecil = (await kecilkanFoto(f, 1600).catch(() => null))?.file ?? f;
      const fd = new FormData(); fd.set("extracurricularId", ekskul); fd.set("tanggal", tanggal); fd.set("file", kecil);
      const r = await fetch("/api/ekstra/kegiatan", { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) ok += 1; else { const j = await r?.json().catch(() => null); toast.error(j?.error ?? "Foto gagal diunggah."); break; }
    }
    setUnggah(false);
    if (ok) { toast.success(`${ok} foto tersimpan.`); if (tanggal.slice(0, 7) !== bulan) setBulan(tanggal.slice(0, 7)); else muat(); }
  }
  async function hapus(k: Kegiatan, url: string) {
    if (!(await confirm("Hapus foto ini?"))) return;
    const r = await fetch(`/api/ekstra/kegiatan?journalId=${k.id}&url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Foto gagal dihapus."); return; }
    muat();
  }

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const nama = (id: string) => d.ekskul.find(e => e.id === id)?.nama ?? "";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Images size={22} />} title="Kegiatan & Foto" description="Riwayat pertemuan dan foto bukti kegiatan tiap ekstrakurikuler" />
      <div className="space-y-6">
        <div className="baris-alat">
          <div className="alat-saring"><Select value={ekskul} onChange={setEkskul} options={[{ value: "", label: "Semua ekstrakurikuler" }, ...d.ekskul.map(e => ({ value: e.id, label: e.nama }))]} /></div>
          <div className="alat-saring"><MonthPicker value={bulan} onChange={setBulan} /></div>
        </div>

        <section className="panel p-5">
          <h2 className="font-heading text-sm font-semibold text-primary-900">Unggah foto kegiatan</h2>
          {!ekskul ? <p className="mt-2 text-sm text-gray-400">Pilih dulu ekstrakurikulernya di atas.</p> : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-56"><label className="label-field">Tanggal kegiatan</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
              <label className={`btn-modal-save cursor-pointer ${unggah ? "pointer-events-none opacity-60" : ""}`}>
                {unggah ? <Loader2 className="animate-spin" /> : <Camera />} Pilih / ambil foto
                <input type="file" accept="image/*" multiple className="sr-only" onChange={e => { void kirimFoto(e.target.files); e.target.value = ""; }} />
              </label>
              <p className="text-xs text-gray-500 sm:flex-1">Paling banyak 6 foto per pertemuan. Foto dikecilkan dulu di perangkat supaya cepat terkirim.</p>
            </div>
          )}
        </section>

        {d.kegiatan.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada kegiatan tercatat pada bulan ini.</p> : d.kegiatan.map(k => (
          <section key={k.id} className="panel p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-heading text-sm font-semibold text-primary-900">{nama(k.extracurricularId)} · {tgl(k.tanggal)}</h2>
              {k.sumber === "PORTAL" && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">lewat tautan pembina</span>}
              {k.foto.length === 0 && <span className="status-badge bg-red-50 text-red-600 border-red-200">tanpa foto</span>}
            </div>
            <p className="mt-1 text-sm text-gray-600">{k.materi || <span className="text-gray-400">Kegiatan belum ditulis.</span>}</p>
            <p className="mt-1 text-xs text-gray-400">{k.peserta ? `${k.hadir} dari ${k.peserta} anggota hadir` : "absensi belum diisi"}{k.oleh ? ` · dicatat ${k.oleh}` : ""}</p>
            {k.foto.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {k.foto.map(f => (
                  <li key={f} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- berkas unggahan, tidak lewat pengoptimal gambar */}
                    <a href={f} target="_blank" rel="noreferrer"><img src={f} alt={`Foto kegiatan ${nama(k.extracurricularId)} ${k.tanggal}`} loading="lazy" className="aspect-square w-full object-cover" /></a>
                    <button type="button" title="Hapus foto" onClick={() => hapus(k, f)} className="absolute right-1 top-1 rounded-lg bg-white/90 p-1.5 text-gray-500 hover:text-red-600"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
