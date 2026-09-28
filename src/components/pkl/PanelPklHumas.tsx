"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, ClipboardCheck, Copy, Link2, Loader2, MessageCircle, Plus, Printer, Trash2 } from "lucide-react";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import ImageUpload from "@/components/admin/ImageUpload";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { salinTeks } from "@/lib/salin-teks";

const ASPEK: Record<string, string> = {
  disiplin: "Disiplin & kehadiran", tanggungJawab: "Tanggung jawab", kerjaSama: "Kerja sama", inisiatif: "Inisiatif & kemandirian",
  keterampilan: "Keterampilan teknis", kualitas: "Kualitas hasil kerja", etika: "Etika & sopan santun", k3: "K3",
};
const CARA: Record<string, string> = { KUNJUNGAN: "Kunjungan", TELEPON: "Telepon", DARING: "Daring" };
interface Data {
  monitoring: { id: string; tanggal: string; cara: string; catatan: string; fotoUrl: string | null; olehNama: string }[];
  penilaian: { nilai: Record<string, number> | null; rata: number | null; penilai: string | null; catatan: string | null; pada: string | null; tautanAktif: boolean; tautanSampai: string | null };
  sertifikat: { nomor: string | null; pada: string | null };
}
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Penilaian pembimbing industri (tautan tanpa akun), monitoring pembimbing sekolah, dan sertifikat PKL. */
export default function PanelPklHumas({ internshipId, siswa, perusahaan, sertifikatHref }: { internshipId: string; siswa: string; perusahaan: string; sertifikatHref: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [url, setUrl] = useState("");
  const [form, setForm] = useState<null | { tanggal: string; cara: string; catatan: string; fotoUrl: string }>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch(`/api/pkl/${internshipId}/monitoring`, { cache: "no-store" }).then(r => r.json()).then(x => { if (x.penilaian) setD(x); }).catch(() => {});
  }, [internshipId]);
  useEffect(() => { muat(); }, [muat]);

  async function buatTautan() {
    if (d?.penilaian.tautanAktif && !(await confirm("Tautan lama akan tidak berlaku. Buat tautan baru?"))) return;
    const r = await fetch(`/api/pkl/${internshipId}/tautan-penilaian`, { method: "POST" }).catch(() => null);
    const x = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal membuat tautan."); return; }
    setUrl(x.url); muat();
  }
  async function cabut() {
    if (!(await confirm("Nonaktifkan tautan penilaian?"))) return;
    const r = await fetch(`/api/pkl/${internshipId}/tautan-penilaian`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { setUrl(""); muat(); } else toast.error("Gagal.");
  }
  async function simpanMonitoring() {
    if (!form) return;
    setSibuk(true);
    const r = await fetch(`/api/pkl/${internshipId}/monitoring`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tanggal: `${form.tanggal}T09:00:00+07:00` }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success("Monitoring tercatat."); setForm(null); muat();
  }

  if (!d) return <div className="panel mb-6 flex justify-center p-6 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>;
  const pesanWa = `Assalamu'alaikum. Mohon kesediaan Bapak/Ibu pembimbing di ${perusahaan} memberi penilaian PKL untuk ${siswa} melalui tautan berikut (tanpa perlu login, berlaku 30 hari):\n${url}\nTerima kasih.`;
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
      <div className="panel p-5 space-y-4 min-w-0">
        <div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-navy">Penilaian Pembimbing Industri</h3></div>
        {d.penilaian.nilai ? (
          <div>
            <p className="text-sm text-gray-700">Dinilai <strong>{d.penilaian.penilai}</strong> · {d.penilaian.pada ? tgl(d.penilaian.pada) : ""}</p>
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(d.penilaian.nilai).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span className="text-gray-600">{ASPEK[k] ?? k}</span><span className="angka font-semibold text-primary-900">{v}</span></li>)}
            </ul>
            <p className="mt-2 text-sm">Rata-rata: <span className="angka font-bold text-primary-900">{d.penilaian.rata}</span></p>
            {d.penilaian.catatan && <p className="mt-1 text-xs text-gray-600 whitespace-pre-line">Catatan: {d.penilaian.catatan}</p>}
          </div>
        ) : <p className="text-sm text-gray-400">Belum ada penilaian dari tempat PKL.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={buatTautan} className="btn-modal-save px-3 text-xs"><Link2 /> {d.penilaian.tautanAktif ? "Buat Tautan Baru" : "Buat Tautan Penilaian"}</button>
          {d.penilaian.tautanAktif && <button type="button" onClick={cabut} className="btn-modal-cancel px-3 text-xs"><Trash2 /> Nonaktifkan</button>}
        </div>
        {d.penilaian.tautanAktif && !url && <p className="text-xs text-gray-500">Tautan aktif sampai {d.penilaian.tautanSampai ? tgl(d.penilaian.tautanSampai) : "-"}. Demi keamanan tautan hanya tampil sekali — buat baru bila hilang.</p>}
        {url && (
          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="break-all text-xs text-gray-700">{url}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={async () => (await salinTeks(url)) ? toast.success("Tautan disalin.") : toast.error("Gagal menyalin.")}><Copy /> Salin</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(pesanWa)}`} target="_blank" rel="noopener noreferrer" className="btn-modal-save px-3 text-xs"><MessageCircle /> Kirim lewat WhatsApp</a>
            </div>
          </div>
        )}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Award size={16} className="text-gold" />
            <p className="text-sm font-semibold text-navy">Sertifikat PKL</p>
            {d.sertifikat.nomor && <span className="text-xs text-gray-500">No. {d.sertifikat.nomor}</span>}
            <Link href={sertifikatHref} className="btn-modal-cancel ml-auto px-3 text-xs"><Printer /> {d.sertifikat.nomor ? "Cetak Sertifikat" : "Terbitkan & Cetak"}</Link>
          </div>
          <p className="mt-1 text-xs text-gray-500">Sertifikat memuat QR keaslian yang bisa dipindai perusahaan/perguruan tinggi.</p>
        </div>
      </div>

      <div className="panel p-5 space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-navy">Monitoring Pembimbing</h3>
          <button type="button" onClick={() => setForm({ tanggal: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), cara: "KUNJUNGAN", catatan: "", fotoUrl: "" })} className="btn-modal-save ml-auto px-3 text-xs"><Plus /> Catat</button>
        </div>
        {d.monitoring.length === 0 ? <p className="text-sm text-gray-400">Belum ada catatan kunjungan/komunikasi dengan tempat PKL.</p> : (
          <ul className="divide-y divide-gray-50">
            {d.monitoring.map(m => (
              <li key={m.id} className="py-2.5 text-sm">
                <p className="text-xs text-gray-500">{tgl(m.tanggal)} · {CARA[m.cara] ?? m.cara} · {m.olehNama}</p>
                <p className="text-gray-700 whitespace-pre-line">{m.catatan}</p>
                {m.fotoUrl && <a href={m.fotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary-700 hover:underline">Lihat foto</a>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Catat monitoring PKL" size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || (form?.catatan.trim().length ?? 0) < 5} onClick={simpanMonitoring} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button></>}>
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Tanggal</label><DatePicker value={form.tanggal} onChange={v => setForm({ ...form, tanggal: v })} /></div>
              <div><label className="label-field">Cara</label><Select value={form.cara} onChange={v => setForm({ ...form, cara: v })} options={Object.entries(CARA).map(([value, label]) => ({ value, label }))} /></div>
            </div>
            <div><label htmlFor="catatan-monitoring" className="label-field">Hasil monitoring</label><textarea id="catatan-monitoring" rows={4} maxLength={3000} className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Kehadiran, sikap, pekerjaan yang dilakukan, kendala, masukan dari pembimbing industri" /></div>
            <ImageUpload value={form.fotoUrl} onChange={v => setForm({ ...form, fotoUrl: v })} folder="pkl-jurnal" label="Foto kunjungan (opsional)" />
          </div>
        )}
      </Modal>
    </div>
  );
}
