"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardSignature, Loader2, Plus, Search, Printer, Edit2, Trash2, X, UserPlus, Plane } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { SUMBER_BIAYA, labelOf } from "@/lib/tu-konstanta";

interface Pegawai { id?: string; teacherId: string | null; nama: string; nip: string | null; jabatan: string | null; peran?: string; keterangan?: string | null }
interface SuratTugas {
  id: string; nomor: string; tanggal: string; dasar: string | null; maksud: string;
  tempat: string; tempat2: string | null; tempat3: string | null; jam: string | null;
  tanggalBerangkat: string; tanggalKembali: string; transportasi: string | null;
  sumberBiaya: string | null; instansi: string | null; biayaAnggaran: string | null;
  withSppd: boolean; withLaporan: boolean; hasilLaporan: string | null;
  penandaTangan: string | null; keterangan: string | null;
  pegawai: Pegawai[];
}
interface LookupPegawai { id: string; name: string; nip: string | null; position: string }

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  nomor: string; tanggal: string; dasar: string; maksud: string;
  tempat: string; tempat2: string; tempat3: string; jam: string;
  tanggalBerangkat: string; tanggalKembali: string; transportasi: string;
  sumberBiaya: string; instansi: string; biayaAnggaran: string;
  withSppd: boolean; withLaporan: boolean; hasilLaporan: string;
  penandaTangan: string; keterangan: string;
  pegawai: Pegawai[]; pengikut: Pegawai[];
}
const EMPTY: FormState = {
  nomor: "", tanggal: todayStr(), dasar: "", maksud: "",
  tempat: "", tempat2: "", tempat3: "", jam: "",
  tanggalBerangkat: todayStr(), tanggalKembali: todayStr(), transportasi: "Kendaraan Darat",
  sumberBiaya: "", instansi: "Sekolah Menengah Kejuruan", biayaAnggaran: "",
  withSppd: true, withLaporan: true, hasilLaporan: "",
  penandaTangan: "", keterangan: "", pegawai: [], pengikut: [],
};

export default function SuratTugasManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<SuratTugas[]>([]);
  const [lookup, setLookup] = useState<LookupPegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pilihPegawai, setPilihPegawai] = useState("");
  const [pilihPengikut, setPilihPengikut] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/surat-tugas").then(r => r.json()).catch(() => []),
      fetch("/api/admin/pegawai-lookup").then(r => r.json()).catch(() => []),
    ])
      .then(([s, p]) => {
        setRows(Array.isArray(s) ? s : []);
        setLookup(Array.isArray(p) ? p : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, tanggal: todayStr(), tanggalBerangkat: todayStr(), tanggalKembali: todayStr() });
    setPilihPegawai(""); setPilihPengikut("");
    setModalOpen(true);
  }
  function openEdit(s: SuratTugas) {
    setEditingId(s.id);
    setForm({
      nomor: s.nomor, tanggal: s.tanggal.slice(0, 10), dasar: s.dasar ?? "", maksud: s.maksud,
      tempat: s.tempat, tempat2: s.tempat2 ?? "", tempat3: s.tempat3 ?? "", jam: s.jam ?? "",
      tanggalBerangkat: s.tanggalBerangkat.slice(0, 10),
      tanggalKembali: s.tanggalKembali.slice(0, 10), transportasi: s.transportasi ?? "",
      sumberBiaya: s.sumberBiaya ?? "", instansi: s.instansi ?? "", biayaAnggaran: s.biayaAnggaran ?? "",
      withSppd: s.withSppd, withLaporan: s.withLaporan, hasilLaporan: s.hasilLaporan ?? "",
      penandaTangan: s.penandaTangan ?? "", keterangan: s.keterangan ?? "",
      pegawai: s.pegawai.filter(p => p.peran !== "PENGIKUT").map(p => ({ teacherId: p.teacherId, nama: p.nama, nip: p.nip, jabatan: p.jabatan, keterangan: p.keterangan ?? "" })),
      pengikut: s.pegawai.filter(p => p.peran === "PENGIKUT").map(p => ({ teacherId: p.teacherId, nama: p.nama, nip: p.nip, jabatan: p.jabatan, keterangan: p.keterangan ?? "" })),
    });
    setPilihPegawai(""); setPilihPengikut("");
    setModalOpen(true);
  }

  /** Menambah pegawai dari daftar guru — NIP & jabatan ikut terisi otomatis, tapi tetap bisa
   * diedit karena jabatan dalam surat tugas kadang berbeda dari jabatan strukturalnya. */
  type Daftar = "pegawai" | "pengikut";
  function tambahPegawai(teacherId: string, daftar: Daftar = "pegawai") {
    const p = lookup.find(l => l.id === teacherId);
    if (!p) return;
    if ([...form.pegawai, ...form.pengikut].some(x => x.teacherId === teacherId))
      return toast.error("Pegawai itu sudah ada di daftar.");
    setForm(f => ({ ...f, [daftar]: [...f[daftar], { teacherId, nama: p.name, nip: p.nip, jabatan: p.position || null, keterangan: "" }] }));
    setPilihPegawai("");
    setPilihPengikut("");
  }
  function tambahManual(daftar: Daftar = "pegawai") {
    setForm(f => ({ ...f, [daftar]: [...f[daftar], { teacherId: null, nama: "", nip: null, jabatan: null, keterangan: "" }] }));
  }
  function ubahPegawai(i: number, patch: Partial<Pegawai>, daftar: Daftar = "pegawai") {
    setForm(f => ({ ...f, [daftar]: f[daftar].map((p, idx) => idx === i ? { ...p, ...patch } : p) }));
  }
  function hapusPegawai(i: number, daftar: Daftar = "pegawai") {
    setForm(f => ({ ...f, [daftar]: f[daftar].filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!form.maksud.trim()) return toast.error("Maksud penugasan wajib diisi.");
    if (!form.tempat.trim()) return toast.error("Tempat pelaksanaan wajib diisi.");
    if (form.pegawai.filter(p => p.nama.trim()).length === 0) return toast.error("Minimal satu pegawai yang ditugaskan.");
    if (form.tanggalKembali < form.tanggalBerangkat) return toast.error("Tanggal kembali tidak boleh sebelum tanggal berangkat.");

    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/surat-tugas/${editingId}` : "/api/admin/surat-tugas", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        pegawai: form.pegawai.filter(p => p.nama.trim()),
        pengikut: form.pengikut.filter(p => p.nama.trim()),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal menyimpan surat tugas.");
    toast.success(editingId ? "Surat tugas diperbarui." : "Surat tugas dibuat.");
    setModalOpen(false);
    load();
  }

  async function handleDelete(s: SuratTugas) {
    if (!(await confirmDialog(`Hapus surat tugas nomor ${s.nomor}?`))) return;
    const res = await fetch(`/api/admin/surat-tugas/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Surat tugas dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(s =>
      s.nomor.toLowerCase().includes(q) || s.maksud.toLowerCase().includes(q) ||
      s.tempat.toLowerCase().includes(q) || s.pegawai.some(p => p.nama.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const thisYear = new Date().getFullYear();
  const tahunIni = rows.filter(s => new Date(s.tanggal).getFullYear() === thisYear);
  const orangDitugaskan = new Set(tahunIni.flatMap(s => s.pegawai.map(p => p.nama))).size;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardSignature size={22} />} title="Surat Tugas & SPPD"
        description="Penugasan pegawai beserta Surat Perintah Perjalanan Dinas — siap cetak lengkap dengan kolom tanda tangan tempat tujuan" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={tahunIni.length} label={`Surat Tugas ${thisYear}`} icon={ClipboardSignature} color="primary" />
        <StatTile value={orangDitugaskan} label="Pegawai Pernah Ditugaskan" icon={UserPlus} color="blue" />
        <StatTile value={tahunIni.filter(s => s.withSppd).length} label="Disertai SPPD" icon={Plane} color="amber" />
      </div>

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor, maksud, tempat, nama pegawai..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-aksi">
          <Link href="/dashboard/admin/surat-tugas/rekap" className="btn-modal-cancel btn-teks">
            <Printer size={16} /> Rekap Penugasan
          </Link>
          <button onClick={openAdd} className="btn-modal-save">
            <Plus size={16} /> Buat Surat Tugas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardSignature} title="Belum Ada Surat Tugas"
          description="Buat surat tugas pertama lewat tombol di atas — nomornya terbit otomatis." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada surat tugas yang cocok." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nomor</th><th>Tanggal</th><th>Pegawai Ditugaskan</th><th>Maksud</th>
                    <th>Tempat</th><th>Pelaksanaan</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td className="text-xs whitespace-nowrap font-medium">{s.nomor}</td>
                      <td className="whitespace-nowrap">{fmt(s.tanggal)}</td>
                      <td className="text-sm max-w-[14rem]">
                        {s.pegawai.map(p => p.nama).join(", ") || "—"}
                        <span className="block text-xs text-gray-400">{s.pegawai.length} orang</span>
                      </td>
                      <td className="text-sm max-w-[16rem]">{s.maksud}</td>
                      <td className="text-sm">{s.tempat}</td>
                      <td className="text-xs whitespace-nowrap">
                        {fmt(s.tanggalBerangkat)}
                        {s.tanggalKembali !== s.tanggalBerangkat && <> – {fmt(s.tanggalKembali)}</>}
                        {s.withSppd && <span className="block text-xs text-amber-600 font-semibold">+ SPPD</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/admin/surat-tugas/${s.id}/cetak`} title="Cetak surat tugas"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Printer size={14} />
                          </Link>
                          <button onClick={() => openEdit(s)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(s)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} surat tugas</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody size="xl"
        title={editingId ? "Edit Surat Tugas" : "Buat Surat Tugas"}
        description={editingId ? undefined : "Nomor surat terbit otomatis melanjutkan urutan terakhir"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-modal-cancel">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save">
              {saving && <Loader2 size={15} className="animate-spin" />} Simpan
            </button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Nomor Surat {editingId ? "" : "(kosongkan untuk otomatis)"}</label>
              <input value={form.nomor} onChange={e => setForm(f => ({ ...f, nomor: e.target.value }))}
                placeholder="Otomatis" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Tanggal Surat</label>
              <DatePicker value={form.tanggal} onChange={v => setForm(f => ({ ...f, tanggal: v }))} />
            </div>
          </div>

          <div>
            <label className="label-field">Dasar Penugasan</label>
            <input value={form.dasar} onChange={e => setForm(f => ({ ...f, dasar: e.target.value }))}
              placeholder="Contoh: Surat Undangan Dinas Pendidikan Prov. Jatim No. .../2026" className="input-field w-full" />
          </div>

          <div className="page-card p-4">
            <p className="text-sm font-semibold text-primary-900 mb-3">Pegawai yang Ditugaskan</p>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] mb-3">
              <Select value={pilihPegawai} onChange={tambahPegawai} placeholder="Pilih pegawai untuk ditambahkan..."
                options={lookup.map(l => ({ value: l.id, label: `${l.name}${l.nip ? ` — ${l.nip}` : ""}` }))} />
              <button type="button" onClick={() => tambahManual("pegawai")}
                className="btn-modal-cancel whitespace-nowrap">
                <Plus size={15} /> Isi Manual
              </button>
            </div>

            {form.pegawai.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada pegawai dipilih.</p>
            ) : (
              <div className="space-y-2">
                {form.pegawai.map((p, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto] items-center">
                    <input value={p.nama} onChange={e => ubahPegawai(i, { nama: e.target.value })}
                      placeholder="Nama" className="input-field w-full" />
                    <input value={p.nip ?? ""} onChange={e => ubahPegawai(i, { nip: e.target.value })}
                      placeholder="NIP / NUPTK" className="input-field w-full" />
                    <input value={p.jabatan ?? ""} onChange={e => ubahPegawai(i, { jabatan: e.target.value })}
                      placeholder="Jabatan" className="input-field w-full" />
                    <button type="button" onClick={() => hapusPegawai(i)} title="Hapus dari daftar"
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition justify-self-start">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="page-card p-4">
            <p className="text-sm font-semibold text-primary-900 mb-1">Pengikut (opsional)</p>
            <p className="text-xs text-gray-400 mb-3">
              Butir 7 pada SPPD — orang yang ikut berangkat tapi bukan penerima perintah utama
              (mis. sopir, pendamping siswa). Tidak muncul di tabel Surat Tugas.
            </p>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] mb-3">
              <Select value={pilihPengikut} onChange={v => tambahPegawai(v, "pengikut")}
                placeholder="Pilih pegawai sebagai pengikut..."
                options={lookup.map(l => ({ value: l.id, label: `${l.name}${l.nip ? ` — ${l.nip}` : ""}` }))} />
              <button type="button" onClick={() => tambahManual("pengikut")}
                className="btn-modal-cancel whitespace-nowrap">
                <Plus size={15} /> Isi Manual
              </button>
            </div>
            {form.pengikut.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada pengikut.</p>
            ) : (
              <div className="space-y-2">
                {form.pengikut.map((p, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto] items-center">
                    <input value={p.nama} onChange={e => ubahPegawai(i, { nama: e.target.value }, "pengikut")}
                      placeholder="Nama" className="input-field w-full" />
                    <input value={p.jabatan ?? ""} onChange={e => ubahPegawai(i, { jabatan: e.target.value }, "pengikut")}
                      placeholder="Jabatan" className="input-field w-full" />
                    <input value={p.keterangan ?? ""} onChange={e => ubahPegawai(i, { keterangan: e.target.value }, "pengikut")}
                      placeholder="Keterangan" className="input-field w-full" />
                    <button type="button" onClick={() => hapusPegawai(i, "pengikut")} title="Hapus dari daftar"
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition justify-self-start">
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label-field">Maksud Penugasan</label>
            <textarea value={form.maksud} onChange={e => setForm(f => ({ ...f, maksud: e.target.value }))}
              rows={2} placeholder="Contoh: Mengikuti Bimbingan Teknis Kurikulum SMK" className="input-field w-full" />
          </div>

          <div>
            <label className="label-field">Tempat Tujuan</label>
            <input value={form.tempat} onChange={e => setForm(f => ({ ...f, tempat: e.target.value }))}
              placeholder="Tempat tujuan utama" className="input-field w-full" />
            {/* Formulir SPPD sekolah menyediakan tiga baris tujuan — dipakai saat satu penugasan
                menyinggahi beberapa tempat, mis. home visit ke beberapa rumah siswa. */}
            <div className="grid gap-2 md:grid-cols-2 mt-2">
              <input value={form.tempat2} onChange={e => setForm(f => ({ ...f, tempat2: e.target.value }))}
                placeholder="Tujuan kedua (opsional)" className="input-field w-full" />
              <input value={form.tempat3} onChange={e => setForm(f => ({ ...f, tempat3: e.target.value }))}
                placeholder="Tujuan ketiga (opsional)" className="input-field w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label-field">Jam Pelaksanaan</label>
              <input value={form.jam} onChange={e => setForm(f => ({ ...f, jam: e.target.value }))}
                placeholder="07.30 WIB - 16.00 WIB" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Tanggal Berangkat</label>
              <DatePicker value={form.tanggalBerangkat} onChange={v => setForm(f => ({ ...f, tanggalBerangkat: v }))} />
            </div>
            <div>
              <label className="label-field">Tanggal Kembali</label>
              <DatePicker value={form.tanggalKembali} onChange={v => setForm(f => ({ ...f, tanggalKembali: v }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label-field">Transportasi</label>
              <input value={form.transportasi} onChange={e => setForm(f => ({ ...f, transportasi: e.target.value }))}
                placeholder="Kendaraan dinas / pribadi" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Sumber Biaya</label>
              <Select value={form.sumberBiaya} onChange={v => setForm(f => ({ ...f, sumberBiaya: v }))}
                placeholder="Pilih sumber biaya..."
                options={[{ value: "", label: "Tidak disebutkan" }, ...SUMBER_BIAYA.map(s => ({ value: s.value, label: s.label }))]} />
            </div>
            <div>
              <label className="label-field">Penanda Tangan</label>
              <input value={form.penandaTangan} onChange={e => setForm(f => ({ ...f, penandaTangan: e.target.value }))}
                placeholder="Kosongkan = Kepala Sekolah" className="input-field w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Pembebanan Anggaran — Instansi</label>
              <input value={form.instansi} onChange={e => setForm(f => ({ ...f, instansi: e.target.value }))}
                placeholder="Sekolah Menengah Kejuruan" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Pembebanan Anggaran — Biaya</label>
              <input value={form.biayaAnggaran} onChange={e => setForm(f => ({ ...f, biayaAnggaran: e.target.value }))}
                placeholder="Peran Serta Masyarakat" className="input-field w-full" />
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.withSppd}
              onChange={e => setForm(f => ({ ...f, withSppd: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#1B2B6B]" />
            <span className="text-sm">
              <span className="font-medium">Sertakan lembar SPPD</span>
              <span className="block text-xs text-gray-400">
                Lembar kedua, butir 1–9 lengkap dengan kolom singgah yang ditandatangani pejabat di tempat tujuan.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.withLaporan}
              onChange={e => setForm(f => ({ ...f, withLaporan: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#1B2B6B]" />
            <span className="text-sm">
              <span className="font-medium">Sertakan Laporan Perjalanan Dinas</span>
              <span className="block text-xs text-gray-400">
                Lembar ketiga, diisi pegawai setelah tugas selesai — sesuai kalimat di surat tugas
                &quot;dimohon menyerahkan laporan hasil kegiatan&quot;.
              </span>
            </span>
          </label>

          {form.withLaporan && (
            <div>
              <label className="label-field">Hasil Kegiatan (boleh diisi belakangan)</label>
              <textarea value={form.hasilLaporan} onChange={e => setForm(f => ({ ...f, hasilLaporan: e.target.value }))}
                rows={4} placeholder="Kosongkan kalau mau ditulis tangan setelah dicetak."
                className="input-field w-full" />
            </div>
          )}

          <div>
            <label className="label-field">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
