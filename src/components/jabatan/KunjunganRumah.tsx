"use client";
import { useCallback, useEffect, useState } from "react";
import { Home, Loader2, MapPin, Plus, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

interface Siswa { id: string; nama: string; nis: string; kelas: string; alamat: string }
interface Catatan { id: string; catatan: string; status: string; tanggal: string; oleh: string; siswa: string; kelas: string }

/** KUNJUNGAN RUMAH (wali kelas, 17 Sep 2026) — tercatat di Rekam BK jenis "Home Visit". */
/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function KunjunganRumah() {
  const toast = useToast();
  const [data, setData] = useState<{ siswa: Siswa[]; catatan: Catatan[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tanggal, setTanggal] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState("");
  const [selesai, setSelesai] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/teacher/kunjungan-rumah", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    setMenyimpan(true);
    const r = await fetch("/api/teacher/kunjungan-rumah", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, tanggal, catatan, selesai }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpan(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success("Kunjungan rumah tercatat.");
    setBuka(false); setCatatan(""); setStudentId(""); setSelesai(false);
    muat();
  }

  const alamat = data?.siswa.find(s => s.id === studentId)?.alamat;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Home size={22} />} title="Kunjungan Rumah" description="Catat hasil kunjungan ke rumah siswa — tersimpan di Rekam BK agar BK ikut menindaklanjuti" />
      {galat ? <EmptyState icon={Home} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5">
            <button type="button" onClick={() => setBuka(true)} className="btn-modal-save btn-teks"><Plus size={15} /> Catat Kunjungan</button>
          </div>
          {data.catatan.length === 0 ? <EmptyState icon={Home} title="Belum ada kunjungan" description="Kunjungan rumah yang dicatat akan tampil di sini." /> : (
            <div className="panel overflow-hidden">
              <ul className="divide-y divide-gray-50">
                {data.catatan.map(c => (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary-900">{c.siswa} <span className="text-xs font-normal text-gray-500">· {c.kelas}</span></p>
                      <span className={`status-badge ${c.status === "SELESAI" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{c.status === "SELESAI" ? "Selesai" : "Perlu tindak lanjut"}</span>
                      <span className="ml-auto text-xs text-gray-500">{new Date(c.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} · {c.oleh}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{c.catatan}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Modal open={buka} onClose={() => !menyimpan && setBuka(false)} title="Catat kunjungan rumah" size="lg"
        footer={<>
          <button type="button" onClick={() => setBuka(false)} disabled={menyimpan} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpan} disabled={menyimpan || !studentId || catatan.trim().length < 10} className="btn-modal-save">
            {menyimpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Siswa</label><Select value={studentId} onChange={setStudentId} placeholder="Pilih siswa" options={(data?.siswa ?? []).map(s => ({ value: s.id, label: `${s.nama} — ${s.kelas}` }))} /></div>
          {alamat && <p className="flex items-start gap-1.5 text-xs text-gray-600"><MapPin size={13} className="mt-0.5 shrink-0" /> {alamat}</p>}
          <div><label className="label-field">Tanggal kunjungan</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
          <div>
            <label htmlFor="hasil-kunjungan" className="label-field">Hasil kunjungan</label>
            <textarea id="hasil-kunjungan" value={catatan} onChange={e => setCatatan(e.target.value)} rows={5} maxLength={3000} className="input-field"
              placeholder="Siapa yang ditemui, kondisi di rumah, kesepakatan dengan orang tua, rencana tindak lanjut" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={selesai} onChange={e => setSelesai(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Masalah sudah selesai (tidak perlu tindak lanjut BK)
          </label>
        </div>
      </Modal>
    </div>
  );
}
