"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, ShieldBan, UserPlus, UserCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Alert from "@/components/admin/Alert";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import TombolKembali from "@/components/shared/TombolKembali";

interface Kegiatan { id: string; nama: string; singkatan: string; aktif: boolean }
interface Ditahan { id: string; alasan: string; oleh: string | null; waktu: string; studentId: string; nama: string; nis: string; kelas: string }
interface Calon { id: string; nama: string; nis: string; kelas: string }

const ALASAN_BAWAAN = "Belum menyelesaikan administrasi ujian";

/** PESERTA DITAHAN (21 September 2026) — pertanyaan user: "besok ujian, tapi ada 2 siswa di kelas itu belum
 * menyelesaikan administrasi ujian, bagaimana pengecualiannya?". Siswa yang ditahan tidak bisa masuk dengan token
 * pada SEMUA ujian kegiatan itu sampai dilepas; di papan pantau/Ruang Kendali ia tampil "Ditahan". Diisi manual —
 * sengaja tidak terhubung ke modul Bendahara. */
export default function PesertaDitahanManager({ basePath = "/pusat-ujian" }: { basePath?: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  const [daftar, setDaftar] = useState<Ditahan[]>([]);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [calon, setCalon] = useState<Calon[]>([]);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [alasan, setAlasan] = useState(ALASAN_BAWAAN);
  const [sibuk, setSibuk] = useState(false);

  const ambil = useCallback((kid: string, q = "") => {
    const p = new URLSearchParams();
    if (kid) p.set("kegiatanId", kid);
    if (q.trim().length >= 2) p.set("cari", q.trim());
    return fetch(`/api/ujian/peserta-ditahan?${p}`).then(r => r.json()).then(d => {
      if (d.error) { setGalat(d.error); return; }
      setKegiatan(d.kegiatan); setKegiatanId(d.kegiatanId); setDaftar(d.daftar); setCalon(d.siswa);
    }).catch(() => setGalat("Koneksi bermasalah."));
  }, []);

  useEffect(() => { queueMicrotask(() => { ambil("").finally(() => setMuat(false)); }); }, [ambil]);
  // Cari siswa — ditunda 350 ms supaya tidak meminta tiap ketukan.
  useEffect(() => {
    if (!kegiatanId) return;
    const t = setTimeout(() => { ambil(kegiatanId, cari); }, 350);
    return () => clearTimeout(t);
  }, [cari, kegiatanId, ambil]);

  const sudah = new Set(daftar.map(d => d.studentId));
  const togglePilih = (id: string) => setPilih(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function tahan() {
    if (!pilih.size) return toast.error("Pilih siswa dulu.");
    setSibuk(true);
    const r = await fetch("/api/ujian/peserta-ditahan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kegiatanId, studentIds: [...pilih], alasan }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal menyimpan.");
    toast.success(`${d.jumlah} siswa ditahan.`);
    setPilih(new Set()); setCari("");
    ambil(kegiatanId);
  }

  async function lepas(x: Ditahan) {
    if (!(await confirm(`Lepas penahanan ${x.nama}? Siswa ini akan bisa masuk ujian dengan token selama jadwalnya masih dibuka.`))) return;
    const r = await fetch(`/api/ujian/peserta-ditahan?id=${x.id}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal melepas.");
    toast.success(d.pesan);
    ambil(kegiatanId, cari);
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldBan size={22} />} title="Peserta Ditahan"
        description="Siswa yang belum boleh masuk ujian — mis. belum menyelesaikan administrasi. Token ditolak sampai dilepas." />

      <div className="baris-alat mb-5">
        <div className="alat-saring">
          <Select value={kegiatanId} onChange={v => { setKegiatanId(v); setPilih(new Set()); ambil(v, cari); }} placeholder="Pilih kegiatan"
            options={kegiatan.map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama}${k.aktif ? " (aktif)" : ""}` }))} />
        </div>
        <div className="alat-aksi">
          <TombolKembali href={`${basePath}/administrasi`} />
        </div>
      </div>

      {muat ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        : galat ? <Alert variant="error" title="Tidak bisa dibuka">{galat}</Alert> : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-4 min-w-0">
            <div className="panel p-4 sm:p-5 space-y-3">
              <p className="font-heading font-bold text-primary-900 flex items-center gap-2"><UserPlus size={17} /> Tahan siswa</p>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIS, atau kelas (mis. XI TKJ 1)..." className="input-field pl-10 w-full" />
              </div>
              {cari.trim().length >= 2 && (
                <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                  {calon.length === 0 ? <p className="p-3 text-sm text-gray-400">Tidak ada siswa aktif yang cocok.</p> : calon.map(c => (
                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${sudah.has(c.id) ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
                      <input type="checkbox" disabled={sudah.has(c.id)} checked={pilih.has(c.id)} onChange={() => togglePilih(c.id)} className="h-4 w-4 accent-primary-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-gray-800 truncate">{c.nama}</span>
                        <span className="block text-xs text-gray-400">{c.kelas} · {c.nis}{sudah.has(c.id) ? " · sudah ditahan" : ""}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div>
                <label htmlFor="alasan-ditahan" className="label-field">Alasan (tampil ke siswa)</label>
                <input id="alasan-ditahan" value={alasan} onChange={e => setAlasan(e.target.value)} maxLength={200} className="input-field w-full" />
              </div>
              <button type="button" onClick={tahan} disabled={sibuk || !pilih.size} className="btn-modal-save w-full">
                {sibuk ? <Loader2 className="animate-spin" /> : <ShieldBan />} Tahan {pilih.size ? `${pilih.size} siswa` : "siswa terpilih"}
              </button>
            </div>
            <Alert variant="info" title="Cara kerjanya">
              Siswa yang ditahan <b>tidak bisa masuk dengan token</b> pada semua mata pelajaran di kegiatan ini, dan di layarnya tampil
              alasan di atas beserta arahan menghubungi Tata Usaha. Di Papan Pantau &amp; Ruang Kendali ia ditandai <b>Ditahan</b>.
              Setelah administrasinya beres, tekan <b>Lepas</b> — siswa langsung bisa masuk selama jadwal ujiannya masih dibuka;
              bila jadwalnya sudah lewat, buat ujian susulan. Pengerjaan yang sudah dimulai sebelum ditahan tidak terganggu.
            </Alert>
          </div>

          <div className="xl:col-span-7 min-w-0">
            <div className="panel overflow-hidden">
              <div className="panel-kepala">
                <p className="panel-judul"><span className="panel-ikon"><UserCheck size={16} /></span> Sedang ditahan <span className="text-gray-400 font-normal">({daftar.length})</span></p>
              </div>
              {daftar.length === 0 ? (
                <EmptyState icon={UserCheck} title="Tidak ada peserta ditahan" description="Semua siswa boleh mengikuti ujian pada kegiatan ini." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th className="w-10 text-center">No</th><th>Siswa</th><th>Alasan</th><th className="text-right">Aksi</th></tr></thead>
                    <tbody>
                      {daftar.map((x, i) => (
                        <tr key={x.id}>
                          <td className="text-center angka">{i + 1}</td>
                          <td className="min-w-[10rem]">
                            <span className="block font-medium text-gray-800">{x.nama}</span>
                            <span className="block text-xs text-gray-400">{x.kelas} · {x.nis}</span>
                          </td>
                          <td className="min-w-[12rem]">
                            <span className="block text-sm text-gray-700">{x.alasan}</span>
                            <span className="block text-xs text-gray-400">{x.oleh ?? "-"} · {new Date(x.waktu).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </td>
                          <td className="text-right"><button type="button" onClick={() => lepas(x)} className="btn-modal-cancel px-3 text-xs">Lepas</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
