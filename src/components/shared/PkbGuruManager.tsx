"use client";
import { useCallback, useEffect, useState } from "react";
import { Award, GraduationCap, Loader2, Plus, Printer, Save, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Alert from "@/components/admin/Alert";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Baris {
  id: string; teacherId: string; namaGuru: string; judul: string; jenis: string; penyelenggara: string | null;
  peran: string | null; mulai: string; selesai: string | null; jamPelajaran: number | null;
  nomorSertifikat: string | null; catatan: string | null;
}
interface Data { kelola: boolean; teacherId: string; saya: string; jenis: Record<string, string>; guru: { id: string; nama: string; nip: string }[]; daftar: Baris[] }

const KOSONG = { judul: "", jenis: "PELATIHAN", penyelenggara: "", peran: "Peserta", mulai: "", selesai: "", jamPelajaran: "", nomorSertifikat: "", catatan: "", teacherId: "" };
const tgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** PORTOFOLIO PKB GURU (18 September 2026) — riwayat pelatihan/seminar/diklat tiap guru. Guru mengisi
 * miliknya sendiri; pengelola kepegawaian bisa memilih guru mana pun dan merekap jam PKB-nya. */
export default function PkbGuruManager({ basePath }: { basePath: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [guruId, setGuruId] = useState("");
  const [buka, setBuka] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [sibuk, setSibuk] = useState(false);
  /* Status muat DIPISAH dari `data`. Dulu "sedang memuat" disimpulkan dari `data === null`, jadi
     ketika API menolak (mis. staf TAS tanpa data kepegawaian → 403) galatnya memang tertangkap
     tetapi layar berputar SELAMANYA tanpa keterangan apa pun — varian gotcha #12, ditemukan lewat
     penelusuran seluruh menu 29 September 2026. */
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(() => {
    setMemuat(true); setGalat("");
    fetch(`/api/kepegawaian/pkb${guruId ? `?teacherId=${guruId}` : ""}`, { cache: "no-store" })
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (r.ok && d) { setData(d); return; }
        setGalat(d?.error ?? "Gagal memuat data PKB.");
      })
      .catch(() => setGalat("Gagal memuat data PKB."))
      .finally(() => setMemuat(false));
  }, [guruId]);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    setSibuk(true);
    const r = await fetch("/api/kepegawaian/pkb", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, teacherId: data?.kelola ? (form.teacherId || guruId) : undefined }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success("Catatan PKB tersimpan."); setBuka(false); setForm(KOSONG); muat();
  }

  async function hapus(b: Baris) {
    if (!(await confirm(`Hapus catatan "${b.judul}"?`))) return;
    const r = await fetch(`/api/kepegawaian/pkb/${b.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menghapus."); return; }
    toast.success("Catatan dihapus."); muat();
  }

  const daftar = data?.daftar ?? [];
  const hal = usePaginasi(daftar, 25, guruId);
  const totalJam = daftar.reduce((a, b) => a + (b.jamPelajaran ?? 0), 0);
  const tahunIni = daftar.filter(b => new Date(b.mulai).getUTCFullYear() === new Date().getUTCFullYear()).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Award size={22} />} title="Portofolio PKB"
        description="Pengembangan Keprofesian Berkelanjutan — pelatihan, seminar, diklat, dan MGMP yang diikuti" />

      {memuat ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : !data ? (
        <Alert variant="info" title="Portofolio PKB belum tersedia">
          {galat || "Data PKB tidak bisa dimuat."} Portofolio PKB hanya untuk pegawai yang terdata sebagai guru/tenaga
          kependidikan — hubungi bagian Kepegawaian bila menurut Anda ini keliru.
        </Alert>
      ) : (
        <>
          <div className="kisi-kartu kisi-kartu-3 mb-5">
            <StatTile icon={GraduationCap} color="primary" value={daftar.length} label="Kegiatan tercatat" />
            <StatTile icon={Award} color="emerald" value={tahunIni} label="Tahun berjalan" />
            <StatTile icon={Printer} color="blue" value={totalJam} label="Total jam pelajaran" />
          </div>

          <div className="baris-alat mb-5">
            {data.kelola && (
              <div className="alat-saring">
                <Select value={guruId} onChange={setGuruId} placeholder="Semua guru"
                  options={[{ value: "", label: "Semua guru" }, ...data.guru.map(g => ({ value: g.id, label: `${g.nama}${g.nip ? ` · ${g.nip}` : ""}` }))]} />
              </div>
            )}
            <div className="alat-aksi">
              <a href={`/api/kepegawaian/pkb/ekspor${guruId ? `?teacherId=${guruId}` : ""}`} className="btn-modal-cancel"><Printer size={15} /> Unduh Excel</a>
              <button type="button" onClick={() => { setForm({ ...KOSONG, teacherId: guruId }); setBuka(true); }} className="btn-modal-save"><Plus /> Tambah</button>
            </div>
          </div>

          {daftar.length === 0 ? (
            <EmptyState icon={Award} title="Belum ada catatan PKB"
              description="Catat pelatihan, seminar, workshop, diklat, atau MGMP yang pernah diikuti beserta sertifikatnya." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      {data.kelola && !guruId && <th>Guru</th>}
                      <th>Kegiatan</th><th>Jenis</th><th>Penyelenggara</th><th>Peran</th><th>Tanggal</th><th className="text-center">JP</th><th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hal.potongan.map((b, i) => (
                      <tr key={b.id}>
                        <td className="angka">{hal.awal + i}</td>
                        {data.kelola && !guruId && <td>{b.namaGuru}</td>}
                        <td>
                          <span className="font-medium text-primary-900">{b.judul}</span>
                          {b.nomorSertifikat && <span className="block text-xs text-gray-400">Sertifikat: {b.nomorSertifikat}</span>}
                        </td>
                        <td>{data.jenis[b.jenis] ?? b.jenis}</td>
                        <td>{b.penyelenggara ?? "—"}</td>
                        <td>{b.peran ?? "—"}</td>
                        <td className="whitespace-nowrap">{tgl(b.mulai)}{b.selesai ? ` – ${tgl(b.selesai)}` : ""}</td>
                        <td className="angka text-center">{b.jamPelajaran ?? "—"}</td>
                        <td className="text-right">
                          <button type="button" onClick={() => hapus(b)} title="Hapus"
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="kegiatan" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}

      <Modal open={buka} onClose={() => !sibuk && setBuka(false)} title="Tambah catatan PKB" size="lg" scrollBody
        footer={<>
          <button type="button" onClick={() => setBuka(false)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpan} disabled={sibuk || !form.judul.trim() || !form.mulai} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          {data?.kelola && (
            <div><label className="label-field">Guru</label>
              <Select value={form.teacherId} onChange={v => setForm(f => ({ ...f, teacherId: v }))} placeholder="Pilih guru"
                options={(data?.guru ?? []).map(g => ({ value: g.id, label: g.nama }))} /></div>
          )}
          <div><label className="label-field">Nama kegiatan</label>
            <input className="input-field" maxLength={250} value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Contoh: Diklat Kurikulum Merdeka bagi Guru Kejuruan" /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label-field">Jenis</label>
              <Select value={form.jenis} onChange={v => setForm(f => ({ ...f, jenis: v }))}
                options={Object.entries(data?.jenis ?? {}).map(([value, label]) => ({ value, label: String(label) }))} /></div>
            <div><label className="label-field">Peran</label>
              <Select value={form.peran} onChange={v => setForm(f => ({ ...f, peran: v }))}
                options={["Peserta", "Pemateri", "Panitia"].map(v => ({ value: v, label: v }))} /></div>
            <div><label className="label-field">Penyelenggara</label>
              <input className="input-field" maxLength={200} value={form.penyelenggara} onChange={e => setForm(f => ({ ...f, penyelenggara: e.target.value }))}
                placeholder="Dinas Pendidikan / MGMP / lembaga" /></div>
            <div><label className="label-field">Jam pelajaran (JP)</label>
              <input className="input-field" inputMode="numeric" value={form.jamPelajaran}
                onChange={e => setForm(f => ({ ...f, jamPelajaran: e.target.value.replace(/\D/g, "") }))} placeholder="32" /></div>
            <div><label className="label-field">Mulai</label>
              <DatePicker value={form.mulai} onChange={v => setForm(f => ({ ...f, mulai: v }))} /></div>
            <div><label className="label-field">Selesai</label>
              <DatePicker value={form.selesai} onChange={v => setForm(f => ({ ...f, selesai: v }))} /></div>
          </div>
          <div><label className="label-field">Nomor sertifikat</label>
            <input className="input-field" maxLength={120} value={form.nomorSertifikat} onChange={e => setForm(f => ({ ...f, nomorSertifikat: e.target.value }))} /></div>
          <div><label className="label-field">Catatan</label>
            <textarea rows={3} maxLength={1000} className="input-field" value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))} /></div>
        </div>
      </Modal>
      <span className="hidden">{basePath}</span>
    </div>
  );
}
