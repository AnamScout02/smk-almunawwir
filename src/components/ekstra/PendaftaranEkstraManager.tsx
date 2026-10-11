"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, Loader2, Save, UserPlus, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Baris { id: string; ekskulId: string; nama: string; kelas: string; alasan: string | null; dibuat: string }
interface Data {
  kelola: boolean; setelan: { dibuka: boolean; maks: number };
  ekskul: { id: string; nama: string; anggota: number; kuota: number | null; buka: boolean }[];
  menunggu: Baris[];
  riwayat: { id: string; ekskulId: string; nama: string; kelas: string; status: string; catatan: string | null; oleh: string | null; pada: string | null }[];
}
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/** PENDAFTAR EKSKUL — siswa mendaftar dari portalnya; di sini pembina (ekskulnya saja) atau koordinator (semua)
 *  menerima/menolak. Koordinator juga membuka/menutup pendaftaran dan mengatur jumlah pilihan per siswa. */
export default function PendaftaranEkstraManager() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [setelan, setSetelan] = useState({ dibuka: true, maks: "3" });

  const muat = useCallback(() => {
    fetch("/api/ekstra/pendaftaran", { cache: "no-store" }).then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { setGalat(j?.error ?? "Gagal memuat."); return; }
      setD(j); setSetelan({ dibuka: j.setelan.dibuka, maks: String(j.setelan.maks) });
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function putuskan(ids: string[], terima: boolean, label: string) {
    if (ids.length > 1 && !(await confirm(`${terima ? "Terima" : "Tolak"} ${ids.length} pendaftar ${label}?`))) return;
    setSibuk(ids.length > 1 ? label : ids[0]);
    const r = await fetch("/api/ekstra/pendaftaran", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, terima }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan keputusan."); return; }
    if (j.penuh?.length) toast.warning(`Kuota ${j.penuh.join(", ")} penuh — sebagian pendaftar belum bisa diterima.`);
    else toast.success(terima ? `${j.diterima} pendaftar diterima.` : `${j.ditolak} pendaftar ditolak.`);
    muat();
  }
  async function simpanSetelan() {
    setSibuk("setelan");
    const r = await fetch("/api/ekstra/pendaftaran", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setelan: { dibuka: setelan.dibuka, maks: Number(setelan.maks) } }) }).catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menyimpan."); return; }
    toast.success("Setelan pendaftaran tersimpan."); muat();
  }

  const judul = <PageHeader icon={<UserPlus size={22} />} title="Pendaftar" description="Siswa yang mendaftar ke ekstrakurikuler dan menunggu keputusan pembina" />;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<div className="flex min-h-[40vh] items-center justify-center text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></div>;
  const grup = d.ekskul.map(e => ({ ...e, baris: d.menunggu.filter(m => m.ekskulId === e.id) })).filter(g => g.baris.length > 0);
  const namaEkskul = new Map(d.ekskul.map(e => [e.id, e.nama]));
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={d.menunggu.length} label="Menunggu keputusan" icon={UserPlus} color="amber" sorot={d.menunggu.length > 0} />
          <StatTile value={d.ekskul.filter(e => e.buka).length} label="Kegiatan menerima pendaftar" ikon="hadir" color="emerald" />
          <StatTile value={d.setelan.dibuka ? "Dibuka" : "Ditutup"} label="Pendaftaran siswa" ikon="kalender" color={d.setelan.dibuka ? "primary" : "gray"} size="md" />
        </div>

        {d.kelola && (
          <div className="panel p-5">
            <p className="panel-judul">Setelan pendaftaran</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-primary-900"><input type="checkbox" checked={setelan.dibuka} onChange={e => setSetelan(s => ({ ...s, dibuka: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" /> Siswa boleh mendaftar</label>
              <div><label className="label-field" htmlFor="pe-maks">Maksimal kegiatan per siswa</label><input id="pe-maks" className="input-field w-24" inputMode="numeric" maxLength={2} value={setelan.maks} onChange={e => setSetelan(s => ({ ...s, maks: e.target.value.replace(/\D/g, "") }))} /></div>
              <button type="button" onClick={simpanSetelan} disabled={sibuk === "setelan"} className="btn-modal-save">{sibuk === "setelan" ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Jumlah itu menghitung kegiatan yang sudah diikuti dan pendaftaran yang masih menunggu. Kuota dan buka-tutup per kegiatan diatur di menu Pembina &amp; Tautan.</p>
          </div>
        )}

        {grup.length === 0 ? <div className="panel"><p className="py-10 text-center text-sm text-gray-400">Tidak ada pendaftar yang menunggu keputusan.</p></div> : grup.map(g => (
          <section key={g.id} className="panel overflow-hidden">
            <div className="panel-kepala">
              <p className="panel-judul">{g.nama} <span className="angka ml-1 text-xs font-normal text-gray-400">{g.baris.length} pendaftar · {g.anggota}{g.kuota ? ` dari ${g.kuota}` : ""} anggota</span></p>
              <button type="button" disabled={!!sibuk} onClick={() => putuskan(g.baris.map(b => b.id), true, g.nama)} className="btn-modal-save btn-teks px-3 text-xs">{sibuk === g.nama ? <Loader2 className="animate-spin" /> : <CheckCheck />} Terima semua</button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Nama</th><th>Kelas</th><th>Alasan</th><th>Mendaftar</th><th className="text-right">Keputusan</th></tr></thead>
                <tbody>
                  {g.baris.map((b, i) => (
                    <tr key={b.id}>
                      <td className="angka text-gray-400">{i + 1}</td>
                      <td className="font-medium text-primary-900">{b.nama}</td>
                      <td>{b.kelas || "—"}</td>
                      <td className="text-sm text-gray-600">{b.alasan || <span className="text-gray-400">—</span>}</td>
                      <td className="angka text-sm text-gray-500">{tgl(b.dibuat)}</td>
                      <td><div className="flex justify-end gap-1.5">
                        <button type="button" title="Tolak" disabled={!!sibuk} onClick={() => putuskan([b.id], false, g.nama)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><X size={14} /></button>
                        <button type="button" title="Terima" disabled={!!sibuk} onClick={() => putuskan([b.id], true, g.nama)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">{sibuk === b.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {d.riwayat.length > 0 && (
          <section className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Keputusan terakhir</p></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Nama</th><th>Kelas</th><th>Kegiatan</th><th>Keputusan</th><th>Oleh</th></tr></thead>
                <tbody>
                  {d.riwayat.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium text-primary-900">{r.nama}</td><td>{r.kelas || "—"}</td><td>{namaEkskul.get(r.ekskulId) ?? "—"}</td>
                      <td><span className={`status-badge ${r.status === "DITERIMA" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>{r.status === "DITERIMA" ? "Diterima" : "Ditolak"}</span></td>
                      <td className="text-sm text-gray-500">{r.oleh ?? "—"}{r.pada ? ` · ${tgl(r.pada)}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
