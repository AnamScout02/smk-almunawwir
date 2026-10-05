"use client";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange, ClipboardList, FileText, Globe, Loader2, Plus, Save, Settings2, Trash2, Edit2, GripVertical, FormInput,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import ImageUpload from "@/components/admin/ImageUpload";
import {
  bacaKontenSpmb, DOKUMEN_BAKU_SPMB, ISIAN_DATA_SPMB, LABEL_TINGKAT, PERINGKAT_PRESTASI, TINGKAT_PRESTASI,
  type AgendaSpmb, type BarisBiaya, type BobotPrestasi, type Jalur, type Langkah, type Tanya,
} from "@/lib/spmb-konten";

type Jurusan = { id: string; name: string; code: string };
type Kuota = { id: string; majorId: string; kuota: number; major: Jurusan };
type Gelombang = {
  id: string; nama: string; urutan: number; buka: string; tutup: string; biayaDaftar: number;
  catatan: string | null; aktif: boolean; tahunAjaranId: string | null;
  kuota: Kuota[]; _count: { pendaftar: number };
};
type Komponen = { id: string; nama: string; jenis: string; bobot: number; nilaiMaks: number; urutan: number; aktif: boolean; _count: { nilai: number } };
type Syarat = { id: string; nama: string; keterangan: string | null; wajib: boolean; urutan: number; aktif: boolean; _count: { berkas: number } };

/** Urut sesuai ALUR panitia: buka gelombang → tentukan penilaian → atur apa yang diisi calon
 *  → atur berkas yang diunggah → terakhir isi halaman webnya. */
const TAB = [
  { id: "gelombang", label: "Gelombang & Kuota", ikon: CalendarRange },
  { id: "komponen", label: "Komponen Nilai", ikon: ClipboardList },
  { id: "formulir", label: "Isian Data", ikon: FormInput },
  { id: "syarat", label: "Dokumen & Berkas", ikon: FileText },
  { id: "web", label: "Isi Halaman Web", ikon: Globe },
] as const;

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");
const iso = (d: string) => (d ? d.slice(0, 10) : "");

export default function PengaturanSpmbManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<(typeof TAB)[number]["id"]>("gelombang");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const [gelombang, setGelombang] = useState<Gelombang[]>([]);
  const [jurusan, setJurusan] = useState<Jurusan[]>([]);
  const [komponen, setKomponen] = useState<Komponen[]>([]);
  const [syarat, setSyarat] = useState<Syarat[]>([]);
  const [setelan, setSetelan] = useState<Record<string, string>>({});

  const muat = useCallback(async () => {
    const [g, k, sy, st] = await Promise.all([
      fetch("/api/spmb/gelombang").then(r => r.json()).catch(() => null),
      fetch("/api/spmb/komponen").then(r => r.json()).catch(() => null),
      fetch("/api/spmb/syarat").then(r => r.json()).catch(() => null),
      fetch("/api/spmb/pengaturan").then(r => r.json()).catch(() => null),
    ]);
    if (g && !g.error) { setGelombang(g.gelombang ?? []); setJurusan(g.jurusan ?? []); }
    if (Array.isArray(k)) setKomponen(k);
    if (Array.isArray(sy)) setSyarat(sy);
    if (st && !st.error) setSetelan(st);
  }, []);

  useEffect(() => { muat().finally(() => setMemuat(false)); }, [muat]);

  async function kirim(url: string, method: string, body?: unknown) {
    setSibuk(true);
    const r = await fetch(url, {
      method, headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { await muat(); return true; }
    toast.error(d?.error ?? "Gagal menyimpan");
    return false;
  }

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Settings2 size={22} />} title="Pengaturan SPMB"
        description="Gelombang pendaftaran, kuota per jurusan, komponen penilaian, dokumen syarat, dan isi halaman SPMB di situs" />

      <div className="space-y-6">
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {TAB.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`sentuh flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t.id ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <t.ikon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "gelombang" && (
          <TabGelombang daftar={gelombang} jurusan={jurusan} sibuk={sibuk} kirim={kirim}
            confirm={confirm} toast={toast} />
        )}
        {tab === "komponen" && <TabKomponen daftar={komponen} sibuk={sibuk} kirim={kirim} confirm={confirm} />}
        {tab === "syarat" && <TabSyarat daftar={syarat} setelan={setelan} sibuk={sibuk} kirim={kirim} confirm={confirm} toast={toast} />}
        {tab === "web" && <TabWeb setelan={setelan} syarat={syarat} sibuk={sibuk} kirim={kirim} toast={toast} />}
        {tab === "formulir" && <TabFormulir setelan={setelan} sibuk={sibuk} kirim={kirim} toast={toast} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Gelombang & kuota */

type Kirim = (url: string, method: string, body?: unknown) => Promise<boolean>;
type Toast = ReturnType<typeof useToast>;
type Confirm = ReturnType<typeof useConfirm>;

function TabGelombang({ daftar, jurusan, sibuk, kirim, confirm, toast }: {
  daftar: Gelombang[]; jurusan: Jurusan[]; sibuk: boolean; kirim: Kirim; confirm: Confirm; toast: Toast;
}) {
  const kosong = { nama: "", buka: "", tutup: "", biayaDaftar: 0, catatan: "", tahunAjaranId: "", aktif: true };
  const [form, setForm] = useState<typeof kosong | null>(null);
  const [ubah, setUbah] = useState<Gelombang | null>(null);
  const [kuotaUbah, setKuotaUbah] = useState<Record<string, string>>({});

  async function simpanBaru() {
    if (!form) return;
    if (!form.nama.trim() || !form.buka || !form.tutup) { toast.error("Nama, tanggal buka, dan tanggal tutup wajib diisi"); return; }
    if (await kirim("/api/spmb/gelombang", "POST", form)) { setForm(null); toast.success("Gelombang ditambahkan"); }
  }

  async function simpanUbah() {
    if (!ubah) return;
    const kuota: Record<string, number> = {};
    for (const j of jurusan) kuota[j.id] = Number(kuotaUbah[j.id] ?? 0) || 0;
    const ok = await kirim(`/api/spmb/gelombang/${ubah.id}`, "PUT", {
      nama: ubah.nama, buka: iso(ubah.buka), tutup: iso(ubah.tutup), biayaDaftar: ubah.biayaDaftar,
      catatan: ubah.catatan ?? "", tahunAjaranId: ubah.tahunAjaranId ?? "", aktif: ubah.aktif, kuota,
    });
    if (ok) { setUbah(null); toast.success("Gelombang disimpan"); }
  }

  function bukaUbah(g: Gelombang) {
    setUbah({ ...g });
    const k: Record<string, string> = {};
    for (const j of jurusan) k[j.id] = String(g.kuota.find(x => x.majorId === j.id)?.kuota ?? "");
    setKuotaUbah(k);
  }

  return (
    <>
      <div className="alat-aksi flex justify-end">
        <button type="button" onClick={() => setForm({ ...kosong })} className="btn-modal-save">
          <Plus size={16} /> Tambah Gelombang
        </button>
      </div>

      {daftar.length === 0 ? (
        <div className="panel p-5">
          <p className="py-10 text-center text-sm text-gray-400">
            Belum ada gelombang. Pendaftaran di situs tetap tertutup sampai ada gelombang aktif yang tanggalnya berjalan.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">No</th>
                  <th>Gelombang</th>
                  <th>Dibuka</th>
                  <th>Ditutup</th>
                  <th className="text-right">Biaya</th>
                  <th className="text-right">Kuota</th>
                  <th className="text-right">Pendaftar</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((g, i) => {
                  const totalKuota = g.kuota.reduce((a, k) => a + k.kuota, 0);
                  const kini = new Date();
                  const berjalan = g.aktif && new Date(g.buka) <= kini && new Date(g.tutup) >= kini;
                  return (
                    <tr key={g.id}>
                      <td className="angka">{i + 1}</td>
                      <td>
                        <p className="font-medium text-primary-900">{g.nama}</p>
                        {g.catatan && <p className="text-xs text-gray-400">{g.catatan}</p>}
                      </td>
                      <td className="angka">{new Date(g.buka).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="angka">{new Date(g.tutup).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="angka text-right">{g.biayaDaftar ? rupiah(g.biayaDaftar) : "—"}</td>
                      <td className="angka text-right">{totalKuota || "—"}</td>
                      <td className="angka text-right">{g._count.pendaftar}</td>
                      <td>
                        <span className={`status-badge ${berjalan ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : g.aktif ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {berjalan ? "Dibuka" : g.aktif ? "Terjadwal" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => bukaUbah(g)} title="Edit"
                            className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Edit2 size={14} /></button>
                          <button type="button" title="Hapus"
                            onClick={async () => {
                              if (!(await confirm(`Hapus gelombang "${g.nama}"?`))) return;
                              if (await kirim(`/api/spmb/gelombang/${g.id}`, "DELETE")) toast.success("Gelombang dihapus");
                            }}
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title="Tambah Gelombang" size="md"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpanBaru} className="btn-modal-save">
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama gelombang</label>
              <input className="input-field" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                placeholder="Gelombang 1 — Jalur Prestasi" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label-field">Dibuka</label><DatePicker value={form.buka} onChange={v => setForm({ ...form, buka: v })} /></div>
              <div><label className="label-field">Ditutup</label><DatePicker value={form.tutup} onChange={v => setForm({ ...form, tutup: v })} /></div>
            </div>
            <div>
              <label className="label-field">Biaya pendaftaran</label>
              <input className="input-field" type="number" min={0} value={form.biayaDaftar}
                onChange={e => setForm({ ...form, biayaDaftar: Number(e.target.value) || 0 })} />
              <p className="mt-1 text-xs text-gray-500">
                Tahun ajaran SPMB diatur SEKALI di tab Isi Halaman Web, berlaku untuk semua gelombang —
                tidak perlu dipilih per gelombang.
              </p>
            </div>
            <div>
              <label className="label-field">Catatan (tampil di situs)</label>
              <input className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })}
                placeholder="Khusus pendaftar berprestasi" />
            </div>
            <p className="text-xs text-gray-500">Kuota per jurusan diisi setelah gelombang tersimpan, lewat tombol Edit.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!ubah} onClose={() => setUbah(null)} title={`Ubah ${ubah?.nama ?? ""}`} size="lg" scrollBody
        footer={<>
          <button type="button" onClick={() => setUbah(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpanUbah} className="btn-modal-save">
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
          </button>
        </>}>
        {ubah && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama gelombang</label>
              <input className="input-field" value={ubah.nama} onChange={e => setUbah({ ...ubah, nama: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label-field">Dibuka</label><DatePicker value={iso(ubah.buka)} onChange={v => setUbah({ ...ubah, buka: v })} /></div>
              <div><label className="label-field">Ditutup</label><DatePicker value={iso(ubah.tutup)} onChange={v => setUbah({ ...ubah, tutup: v })} /></div>
            </div>
            <div>
              <label className="label-field">Biaya pendaftaran</label>
              <input className="input-field" type="number" min={0} value={ubah.biayaDaftar}
                onChange={e => setUbah({ ...ubah, biayaDaftar: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label-field">Catatan (tampil di situs)</label>
              <input className="input-field" value={ubah.catatan ?? ""} onChange={e => setUbah({ ...ubah, catatan: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={ubah.aktif} onChange={e => setUbah({ ...ubah, aktif: e.target.checked })} />
              Gelombang aktif (pendaftaran dibuka sesuai tanggal di atas)
            </label>

            <div className="border-t border-gray-100 pt-4">
              <p className="font-heading font-semibold text-navy text-sm">Kuota per jurusan</p>
              <p className="mb-3 text-xs text-gray-500">Kosong atau 0 = tidak dibatasi untuk jurusan itu.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {jurusan.map(j => (
                  <div key={j.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{j.name}</span>
                    <input className="input-field w-24 text-right" type="number" min={0} placeholder="0"
                      value={kuotaUbah[j.id] ?? ""} onChange={e => setKuotaUbah({ ...kuotaUbah, [j.id]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Komponen nilai */

function TabKomponen({ daftar, sibuk, kirim, confirm }: { daftar: Komponen[]; sibuk: boolean; kirim: Kirim; confirm: Confirm }) {
  const kosong = { nama: "", jenis: "ANGKA", bobot: 1, nilaiMaks: 100, aktif: true };
  const [form, setForm] = useState<(typeof kosong & { id?: string }) | null>(null);
  const totalBobot = daftar.filter(k => k.aktif && k.jenis !== "LULUS_TIDAK").reduce((a, k) => a + k.bobot, 0);

  return (
    <>
      <div className="panel p-4">
        <p className="text-sm text-gray-600">
          Komponen penilaian ditentukan panitia. Komponen <span className="font-medium">Angka</span> ikut menghitung skor
          akhir sesuai bobotnya; komponen <span className="font-medium">Lulus/Tidak</span> tidak menambah skor tetapi
          menggugurkan pendaftar bila ditandai tidak lulus — itu untuk tes kesehatan atau baca Al-Qur&apos;an sebagai syarat.
          {totalBobot > 0 && <> Total bobot aktif saat ini <span className="angka font-semibold text-primary-900">{totalBobot}</span>.</>}
        </p>
      </div>

      <div className="alat-aksi flex justify-end">
        <button type="button" onClick={() => setForm({ ...kosong })} className="btn-modal-save">
          <Plus size={16} /> Tambah Komponen
        </button>
      </div>

      {daftar.length === 0 ? (
        <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Belum ada komponen penilaian.</p></div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th className="w-10">No</th><th>Komponen</th><th>Jenis</th>
                <th className="text-right">Bobot</th><th className="text-right">Nilai maks</th>
                <th className="text-right">Sudah dinilai</th><th>Status</th><th className="text-right">Aksi</th>
              </tr></thead>
              <tbody>
                {daftar.map((k, i) => (
                  <tr key={k.id}>
                    <td className="angka">{i + 1}</td>
                    <td className="font-medium text-primary-900">{k.nama}</td>
                    <td>
                      <span className={`status-badge ${
                        k.jenis === "ANGKA" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : k.jenis === "PRESTASI" ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {k.jenis === "ANGKA" ? "Angka" : k.jenis === "PRESTASI" ? "Prestasi" : "Lulus/Tidak"}
                      </span>
                    </td>
                    <td className="angka text-right">{k.jenis === "LULUS_TIDAK" ? "—" : k.bobot}</td>
                    <td className="angka text-right">{k.jenis === "LULUS_TIDAK" ? "—" : k.nilaiMaks}</td>
                    <td className="angka text-right">{k._count.nilai}</td>
                    <td>
                      <span className={`status-badge ${k.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {k.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Edit"
                          onClick={() => setForm({ id: k.id, nama: k.nama, jenis: k.jenis, bobot: k.bobot, nilaiMaks: k.nilaiMaks, aktif: k.aktif })}
                          className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Edit2 size={14} /></button>
                        <button type="button" title="Hapus"
                          onClick={async () => {
                            if (!(await confirm(`Hapus komponen "${k.nama}"?`))) return;
                            await kirim(`/api/spmb/komponen/${k.id}`, "DELETE");
                          }}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Komponen" : "Tambah Komponen"} size="md"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} className="btn-modal-save"
            onClick={async () => {
              if (!form?.nama.trim()) return;
              const ok = form.id
                ? await kirim(`/api/spmb/komponen/${form.id}`, "PUT", form)
                : await kirim("/api/spmb/komponen", "POST", form);
              if (ok) setForm(null);
            }}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama komponen</label>
              <input className="input-field" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                placeholder="Tes Tulis / Baca Al-Qur'an / Wawancara" />
            </div>
            <div>
              <label className="label-field">Jenis</label>
              <Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })}
                options={[
                  { value: "ANGKA", label: "Angka — nilai diisi panitia" },
                  { value: "PRESTASI", label: "Prestasi — nilai dari tabel bobot sertifikat" },
                  { value: "LULUS_TIDAK", label: "Lulus/Tidak — syarat gugur" },
                ]} />
              {form.jenis === "PRESTASI" && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Panitia memilih tingkat &amp; peringkat sertifikat; angkanya diambil dari tabel
                  <span className="font-medium"> Bobot sertifikat prestasi</span> di tab ini.
                  Isi <span className="font-medium">Nilai maksimal</span> dengan bobot tertinggi di tabel itu
                  supaya skornya dinormalkan dengan benar.
                </p>
              )}
            </div>
            {form.jenis !== "LULUS_TIDAK" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">Bobot</label>
                  <input className="input-field" type="number" min={1} value={form.bobot}
                    onChange={e => setForm({ ...form, bobot: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="label-field">Nilai maksimal</label>
                  <input className="input-field" type="number" min={1} value={form.nilaiMaks}
                    onChange={e => setForm({ ...form, nilaiMaks: Number(e.target.value) || 100 })} />
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} />
              Aktif (dipakai menilai pendaftar)
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Dokumen syarat */

function TabSyarat({ daftar, setelan, sibuk, kirim, confirm, toast }: {
  daftar: Syarat[]; setelan: Record<string, string>; sibuk: boolean; kirim: Kirim; confirm: Confirm; toast: Toast;
}) {
  const kosong = { nama: "", keterangan: "", wajib: true, aktif: true };
  const [form, setForm] = useState<(typeof kosong & { id?: string }) | null>(null);

  return (
    <>
      <div className="panel p-4">
        <p className="text-sm text-gray-600">
          SELURUH dokumen yang diunggah pendaftar diatur di sini. <span className="font-medium">Dokumen baku</span> punya
          tempat sendiri di data pendaftar sehingga tidak bisa dihapus — hanya bisa dijadikan wajib, opsional, atau
          disembunyikan. <span className="font-medium">Dokumen tambahan</span> bebas ditambah/dihapus panitia tiap tahun.
          Daftar tambahan yang kosong tidak menutup pendaftaran.
        </p>
      </div>

      <PilihanWajib judul="Dokumen baku"
        keterangan="Lima unggahan yang selalu ada di formulir. Pas foto juga dipakai di cetakan formulir pendaftaran."
        isian={DOKUMEN_BAKU_SPMB} setelan={setelan} sibuk={sibuk} kirim={kirim} toast={toast}
        labelSimpan="Simpan Dokumen Baku" />

      <h2 className="font-heading px-1 pt-2 text-sm font-semibold text-navy">Dokumen tambahan</h2>

      <div className="alat-aksi flex justify-end">
        <button type="button" onClick={() => setForm({ ...kosong })} className="btn-modal-save">
          <Plus size={16} /> Tambah Dokumen
        </button>
      </div>

      {daftar.length === 0 ? (
        <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Belum ada dokumen syarat.</p></div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th className="w-10">No</th><th>Dokumen</th><th>Keterangan</th><th>Wajib</th>
                <th className="text-right">Terunggah</th><th>Status</th><th className="text-right">Aksi</th>
              </tr></thead>
              <tbody>
                {daftar.map((s, i) => (
                  <tr key={s.id}>
                    <td className="angka">{i + 1}</td>
                    <td className="font-medium text-primary-900">{s.nama}</td>
                    <td className="text-gray-500">{s.keterangan || "—"}</td>
                    <td>
                      <span className={`status-badge ${s.wajib ? "bg-red-50 text-red-600 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {s.wajib ? "Wajib" : "Opsional"}
                      </span>
                    </td>
                    <td className="angka text-right">{s._count.berkas}</td>
                    <td>
                      <span className={`status-badge ${s.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {s.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Edit"
                          onClick={() => setForm({ id: s.id, nama: s.nama, keterangan: s.keterangan ?? "", wajib: s.wajib, aktif: s.aktif })}
                          className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Edit2 size={14} /></button>
                        <button type="button" title="Hapus"
                          onClick={async () => {
                            if (!(await confirm(`Hapus dokumen syarat "${s.nama}"?`))) return;
                            await kirim(`/api/spmb/syarat/${s.id}`, "DELETE");
                          }}
                          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Dokumen Syarat" : "Tambah Dokumen Syarat"} size="md"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} className="btn-modal-save"
            onClick={async () => {
              if (!form?.nama.trim()) return;
              const ok = form.id ? await kirim(`/api/spmb/syarat/${form.id}`, "PUT", form) : await kirim("/api/spmb/syarat", "POST", form);
              if (ok) setForm(null);
            }}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama dokumen</label>
              <input className="input-field" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                placeholder="Kartu Keluarga" />
            </div>
            <div>
              <label className="label-field">Keterangan untuk pendaftar</label>
              <input className="input-field" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Foto/scan jelas, maksimal 5MB" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.wajib} onChange={e => setForm({ ...form, wajib: e.target.checked })} />
              Wajib diunggah
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} />
              Aktif (diminta di formulir pendaftaran)
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Isi halaman web */

function TabWeb({ setelan, syarat, sibuk, kirim, toast }: {
  setelan: Record<string, string>; syarat: Syarat[]; sibuk: boolean; kirim: Kirim; toast: Toast;
}) {
  const awal = bacaKontenSpmb(setelan);
  const [k, setK] = useState(awal);

  /** Dokumen yang BENAR-BENAR diminta diunggah di formulir — dokumen baku yang tidak disembunyikan
   *  + dokumen tambahan yang aktif. Dipakai menandai Persyaratan yang belum menyebutkannya. */
  const dokumenDiminta = [
    ...DOKUMEN_BAKU_SPMB.filter(d => (setelan[d.kunci] ?? "1") !== "off").map(d => d.label),
    ...syarat.filter(x => x.aktif).map(x => x.nama),
  ];
  // Pencocokan longgar: "Kartu Keluarga (KK)" dianggap sudah disebut oleh "Kartu Keluarga (fotokopi)".
  const inti = (t: string) => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const belumDisebut = dokumenDiminta.filter(d => {
    const kunciDok = inti(d);
    return !k.syarat.some(b => { const x = inti(b); return x.includes(kunciDok) || kunciDok.includes(x); });
  });

  async function simpan() {
    const ok = await kirim("/api/spmb/pengaturan", "PUT", {
      "spmb.tahun": k.tahun, "spmb.judul": k.judul, "spmb.subjudul": k.subjudul, "spmb.deskripsi": k.deskripsi,
      "spmb.kontakNama": k.kontakNama, "spmb.kontakWa": k.kontakWa, "spmb.biaya": k.biaya,
      "spmb.pengumumanTanggal": k.pengumumanTanggal,
      "spmb.alur": JSON.stringify(k.alur), "spmb.syarat": JSON.stringify(k.syarat),
      "spmb.beasiswa": JSON.stringify(k.beasiswa), "spmb.tanyaJawab": JSON.stringify(k.tanyaJawab),
      "spmb.catatan": k.catatan, "spmb.tautanGrup": k.tautanGrup,
      "spmb.jalur": JSON.stringify(k.jalur), "spmb.jadwal": JSON.stringify(k.jadwal),
      "spmb.rincianBiaya": JSON.stringify(k.rincianBiaya),
      "spmb.bobotPrestasi": JSON.stringify(k.bobotPrestasi),
    });
    if (ok) toast.success("Isi halaman SPMB tersimpan");
  }

  return (
    <>
      <div className="panel p-5 space-y-4">
        <h2 className="font-heading font-semibold text-navy text-sm">Judul & keterangan</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label-field">Tahun ajaran SPMB</label>
            <input className="input-field" value={k.tahun} onChange={e => setK({ ...k, tahun: e.target.value })} placeholder="2026/2027" /></div>
          <div><label className="label-field">Judul halaman</label>
            <input className="input-field" value={k.judul} onChange={e => setK({ ...k, judul: e.target.value })} /></div>
        </div>
        <div><label className="label-field">Subjudul</label>
          <input className="input-field" value={k.subjudul} onChange={e => setK({ ...k, subjudul: e.target.value })} /></div>
        <div><label className="label-field">Keterangan pembuka</label>
          <textarea className="input-field" rows={3} value={k.deskripsi} onChange={e => setK({ ...k, deskripsi: e.target.value })} /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label-field">Nama kontak panitia</label>
            <input className="input-field" value={k.kontakNama} onChange={e => setK({ ...k, kontakNama: e.target.value })} /></div>
          <div><label className="label-field">WhatsApp panitia</label>
            <input className="input-field" value={k.kontakWa} onChange={e => setK({ ...k, kontakWa: e.target.value })} placeholder="628xxxxxxxxxx" />
            <p className="mt-1 text-xs text-gray-500">Dipakai tombol &ldquo;Tanya Panitia&rdquo; dan tombol WhatsApp melayang KHUSUS di halaman SPMB. Kosong = memakai nomor di Konten Halaman.</p></div>
          <div><label className="label-field">Tanggal pengumuman</label>
            <DatePicker value={k.pengumumanTanggal} onChange={v => setK({ ...k, pengumumanTanggal: v })} /></div>
        </div>
        <div><label className="label-field">Keterangan biaya</label>
          <textarea className="input-field" rows={2} value={k.biaya} onChange={e => setK({ ...k, biaya: e.target.value })} /></div>
        <div>
          <label className="label-field">Pemberitahuan penting</label>
          <textarea className="input-field" rows={2} value={k.catatan} onChange={e => setK({ ...k, catatan: e.target.value })}
            placeholder="Mis. Gelombang 1 tinggal 5 hari — kosongkan bila tidak perlu" />
          <p className="mt-1 text-xs text-gray-500">Tampil sebagai pita menonjol di atas halaman SPMB. Kosong = tidak tampil.</p>
        </div>
        <div>
          <label className="label-field">Tautan grup WhatsApp pendaftar</label>
          <input className="input-field" value={k.tautanGrup} onChange={e => setK({ ...k, tautanGrup: e.target.value })}
            placeholder="https://chat.whatsapp.com/..." />
        </div>
      </div>

      <DaftarJalur items={k.jalur} onChange={v => setK({ ...k, jalur: v })} />
      <DaftarJadwal items={k.jadwal} onChange={v => setK({ ...k, jadwal: v })} />
      <DaftarBiaya items={k.rincianBiaya} onChange={v => setK({ ...k, rincianBiaya: v })} />
      <TabelBobot bobot={k.bobotPrestasi} onChange={v => setK({ ...k, bobotPrestasi: v })} />

      <DaftarLangkah judul="Alur pendaftaran"
        keterangan="Langkah yang dilalui calon pendaftar, tampil berurutan di halaman SPMB. Gambar OPSIONAL — kosongkan bila tidak perlu."
        items={k.alur} onChange={v => setK({ ...k, alur: v })} labelJudul="Nama langkah" labelIsi="Penjelasan" gambar />

      <div>
        {belumDisebut.length > 0 && (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-heading text-sm font-semibold text-amber-800">
              {belumDisebut.length} dokumen diminta diunggah tetapi tidak disebut di Persyaratan
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {belumDisebut.map(d => <li key={d} className="text-sm text-amber-700">• {d}</li>)}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-amber-700">
              Calon membaca Persyaratan untuk menyiapkan berkas, lalu diminta mengunggah yang tidak pernah disebut.
              Daftar ini juga boleh memuat syarat yang TIDAK diunggah (mis. berkas asli yang dibawa ke sekolah) —
              jadi tidak semua perbedaan itu salah.
            </p>
            <button type="button"
              onClick={() => setK({ ...k, syarat: [...k.syarat, ...belumDisebut] })}
              className="btn-modal-cancel btn-teks mt-3">
              <Plus size={16} /> Tambahkan {belumDisebut.length} dokumen ke Persyaratan
            </button>
          </div>
        )}
        <DaftarTeks judul="Persyaratan"
          keterangan="Yang perlu disiapkan calon, tampil di halaman SPMB. Boleh memuat berkas asli yang dibawa ke sekolah — tidak harus sama persis dengan daftar unggahan."
          items={k.syarat} onChange={v => setK({ ...k, syarat: v })} />
      </div>

      <DaftarLangkah judul="Program beasiswa" keterangan="Kosongkan bila sekolah tidak membuka beasiswa pada tahun ini."
        items={k.beasiswa} onChange={v => setK({ ...k, beasiswa: v })} labelJudul="Nama beasiswa" labelIsi="Ketentuan" gambar />

        <div className="panel p-5">
        <h2 className="font-heading font-semibold text-navy text-sm">Tanya jawab</h2>
        <p className="mb-4 text-xs text-gray-500">Pertanyaan yang sering ditanyakan orang tua, tampil di bagian bawah halaman SPMB.</p>
        {k.tanyaJawab.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada tanya jawab.</p>}
        <div className="space-y-3">
          {k.tanyaJawab.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <GripVertical size={15} className="mt-3 shrink-0 text-gray-300" />
              <div className="min-w-0 flex-1 space-y-2">
                <input className="input-field" value={t.tanya} placeholder="Pertanyaan"
                  onChange={e => { const b = [...k.tanyaJawab]; b[i] = { ...t, tanya: e.target.value }; setK({ ...k, tanyaJawab: b }); }} />
                <textarea className="input-field" rows={2} value={t.jawab} placeholder="Jawaban"
                  onChange={e => { const b = [...k.tanyaJawab]; b[i] = { ...t, jawab: e.target.value }; setK({ ...k, tanyaJawab: b }); }} />
              </div>
              <button type="button" title="Hapus" onClick={() => setK({ ...k, tanyaJawab: k.tanyaJawab.filter((_, j) => j !== i) })}
                className="mt-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setK({ ...k, tanyaJawab: [...k.tanyaJawab, { tanya: "", jawab: "" } as Tanya] })}
          className="btn-modal-cancel mt-4"><Plus size={16} /> Tambah Tanya Jawab</button>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Isi Halaman
        </button>
      </div>
    </>
  );
}

function DaftarLangkah({ judul, keterangan, items, onChange, labelJudul, labelIsi, gambar }: {
  judul: string; keterangan: string; items: Langkah[]; onChange: (v: Langkah[]) => void;
  labelJudul: string; labelIsi: string;
  /** true = tiap langkah boleh diberi gambar (opsional). */
  gambar?: boolean;
}) {
  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">{judul}</h2>
      <p className="mb-4 text-xs text-gray-500">{keterangan}</p>
      {items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada isian.</p>}
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="angka mt-2.5 w-5 shrink-0 text-xs font-semibold text-gray-400">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <input className="input-field" value={it.judul} placeholder={labelJudul}
                onChange={e => { const b = [...items]; b[i] = { ...it, judul: e.target.value }; onChange(b); }} />
              <textarea className="input-field" rows={2} value={it.isi} placeholder={labelIsi}
                onChange={e => { const b = [...items]; b[i] = { ...it, isi: e.target.value }; onChange(b); }} />
              {gambar && (
                <div className="max-w-xs">
                  <ImageUpload value={it.gambar ?? ""} folder="spmb" label="Gambar (opsional)"
                    hint="JPG/PNG/WEBP — maks. 5MB"
                    onChange={url => { const b = [...items]; b[i] = { ...it, gambar: url || undefined }; onChange(b); }} />
                </div>
              )}
            </div>
            <button type="button" title="Hapus" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="mt-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { judul: "", isi: "" }])} className="btn-modal-cancel mt-4">
        <Plus size={16} /> Tambah
      </button>
    </div>
  );
}

function DaftarTeks({ judul, keterangan, items, onChange }: { judul: string; keterangan: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">{judul}</h2>
      <p className="mb-4 text-xs text-gray-500">{keterangan}</p>
      {items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada isian.</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="angka w-5 shrink-0 text-xs font-semibold text-gray-400">{i + 1}</span>
            <input className="input-field min-w-0 flex-1" value={it}
              onChange={e => { const b = [...items]; b[i] = e.target.value; onChange(b); }} />
            <button type="button" title="Hapus" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, ""])} className="btn-modal-cancel mt-4">
        <Plus size={16} /> Tambah
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Jalur, jadwal, biaya, bobot */

/** Jalur pendaftaran. KODE dipakai sebagai nilai tersimpan di `Admission.jalur`, jadi kode yang
 *  sudah pernah dipakai pendaftar TIDAK boleh diganti — namanya boleh. */
function DaftarJalur({ items, onChange }: { items: Jalur[]; onChange: (v: Jalur[]) => void }) {
  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">Jalur pendaftaran</h2>
      <p className="mb-4 text-xs text-gray-500">
        Pilihan jalur di formulir SPMB. Untuk jenjang SMK, Permendikdasmen No. 3 Tahun 2025 tidak
        menetapkan pembagian jalur baku seperti SMA — sekolah menyusunnya sendiri.
        <span className="font-medium text-amber-700"> Kode jangan diubah bila jalur itu sudah dipakai pendaftar.</span>
      </p>
      {items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada jalur.</p>}
      <div className="space-y-3">
        {items.map((j, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="angka mt-2.5 w-5 shrink-0 text-xs font-semibold text-gray-400">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr]">
                <input className="input-field uppercase" value={j.kode} placeholder="KODE"
                  onChange={e => { const b = [...items]; b[i] = { ...j, kode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }; onChange(b); }} />
                <input className="input-field" value={j.nama} placeholder="Nama jalur"
                  onChange={e => { const b = [...items]; b[i] = { ...j, nama: e.target.value }; onChange(b); }} />
              </div>
              <input className="input-field" value={j.keterangan ?? ""} placeholder="Keterangan untuk pendaftar (opsional)"
                onChange={e => { const b = [...items]; b[i] = { ...j, keterangan: e.target.value }; onChange(b); }} />
            </div>
            <button type="button" title="Hapus" onClick={() => onChange(items.filter((_, x) => x !== i))}
              className="mt-1.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { kode: "", nama: "" }])} className="btn-modal-cancel mt-4">
        <Plus size={16} /> Tambah Jalur
      </button>
    </div>
  );
}

function DaftarJadwal({ items, onChange }: { items: AgendaSpmb[]; onChange: (v: AgendaSpmb[]) => void }) {
  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">Jadwal penting</h2>
      <p className="mb-4 text-xs text-gray-500">Tampil sebagai garis waktu di halaman SPMB. Tanggal yang dibiarkan kosong ditulis &ldquo;menyusul&rdquo;.</p>
      {items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada jadwal.</p>}
      <div className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem_auto]">
            <input className="input-field" value={a.label} placeholder="Nama tahapan"
              onChange={e => { const b = [...items]; b[i] = { ...a, label: e.target.value }; onChange(b); }} />
            <DatePicker value={a.tanggal} onChange={v => { const b = [...items]; b[i] = { ...a, tanggal: v }; onChange(b); }} />
            <button type="button" title="Hapus" onClick={() => onChange(items.filter((_, x) => x !== i))}
              className="justify-self-end rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...items, { label: "", tanggal: "" }])} className="btn-modal-cancel mt-4">
        <Plus size={16} /> Tambah Tahapan
      </button>
    </div>
  );
}

function DaftarBiaya({ items, onChange }: { items: BarisBiaya[]; onChange: (v: BarisBiaya[]) => void }) {
  const total = items.reduce((a, x) => a + x.jumlah, 0);
  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">Rincian biaya</h2>
      <p className="mb-4 text-xs text-gray-500">Kosongkan seluruhnya bila sekolah hanya ingin menampilkan keterangan biaya berupa teks.</p>
      {items.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada rincian biaya.</p>}
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={i} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem_auto]">
            <input className="input-field" value={x.nama} placeholder="Nama biaya"
              onChange={e => { const b = [...items]; b[i] = { ...x, nama: e.target.value }; onChange(b); }} />
            <input className="input-field text-right" type="number" min={0} step={1000} value={x.jumlah}
              onChange={e => { const b = [...items]; b[i] = { ...x, jumlah: Math.max(0, Number(e.target.value) || 0) }; onChange(b); }} />
            <button type="button" title="Hapus" onClick={() => onChange(items.filter((_, y) => y !== i))}
              className="justify-self-end rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <p className="mt-3 text-sm text-gray-600">Total: <span className="angka font-semibold text-primary-900">{rupiah(total)}</span></p>
      )}
      <button type="button" onClick={() => onChange([...items, { nama: "", jumlah: 0 }])} className="btn-modal-cancel mt-4">
        <Plus size={16} /> Tambah Baris Biaya
      </button>
    </div>
  );
}

/** Pembobotan sertifikat prestasi: tingkat × peringkat. Pola yang lazim di juknis SPMB daerah
 *  adalah berjenjang — naik dua kali tiap tingkat, turun separuh tiap peringkat — tetapi
 *  angkanya memang kewenangan sekolah/daerah, jadi tabelnya bisa diubah di sini. */
function TabelBobot({ bobot, onChange }: { bobot: BobotPrestasi; onChange: (v: BobotPrestasi) => void }) {
  const nilai = (t: string, p: string) => bobot[t]?.[p] ?? 0;
  function set(t: string, p: string, v: number) {
    onChange({ ...bobot, [t]: { ...(bobot[t] ?? {}), [p]: Math.max(0, v) } });
  }
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-gray-100 bg-white px-5 py-3.5">
        <h2 className="font-heading font-semibold text-navy text-sm">Bobot sertifikat prestasi</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Dipakai panitia saat menilai sertifikat di menu Seleksi &amp; Nilai. Isi 0 bila tingkat itu tidak dihitung.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr>
            <th>Tingkat</th>
            {PERINGKAT_PRESTASI.map(p => <th key={p} className="text-right">Juara {p}</th>)}
          </tr></thead>
          <tbody>
            {TINGKAT_PRESTASI.map(t => (
              <tr key={t}>
                <td className="font-medium text-primary-900">{LABEL_TINGKAT[t]}</td>
                {PERINGKAT_PRESTASI.map(p => (
                  <td key={p} className="text-right">
                    <input className="input-field w-20 py-1.5 text-right" type="number" min={0}
                      value={nilai(t, p)} onChange={e => set(t, p, Number(e.target.value) || 0)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ Isian formulir pendaftar */

type Pilihan = { kunci: string; label: string; ket?: string };

/** Wajib / Opsional / Sembunyikan per isian. Dipakai DUA tab: "Isian Data" (NIK, NISN, alamat,
 *  nama wali) dan "Dokumen & Berkas" (lima dokumen baku) — satu komponen supaya tampilan &
 *  cara simpannya tidak pernah berbeda. Nilai tersimpan sama seperti dulu ("1" wajib, "0"
 *  opsional, "off" disembunyikan), jadi setelan yang sudah ada tetap berlaku. */
function PilihanWajib({ judul, keterangan, isian, setelan, sibuk, kirim, toast, labelSimpan }: {
  judul: string; keterangan: string; isian: readonly Pilihan[];
  setelan: Record<string, string>; sibuk: boolean; kirim: Kirim; toast: Toast; labelSimpan: string;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(isian.map(x => [x.kunci, setelan[x.kunci] ?? "1"])));

  const PILIHAN = [
    { v: "1", label: "Wajib", aktif: "bg-red-50 text-red-700 border-red-200" },
    { v: "0", label: "Opsional", aktif: "bg-blue-50 text-blue-700 border-blue-200" },
    { v: "off", label: "Sembunyikan", aktif: "bg-gray-100 text-gray-600 border-gray-200" },
  ];

  return (
    <div className="panel p-5">
      <h2 className="font-heading font-semibold text-navy text-sm">{judul}</h2>
      <p className="mb-4 text-xs text-gray-500">{keterangan}</p>
      <div className="space-y-4">
        {isian.map(x => (
          <div key={x.kunci}>
            <p className="text-sm font-semibold text-primary-900">{x.label}</p>
            {x.ket ? <p className="mb-1.5 text-xs text-gray-500">{x.ket}</p> : <span className="mb-1.5 block" />}
            <div className="flex flex-wrap gap-2">
              {PILIHAN.map(p => {
                const dipilih = (nilai[x.kunci] ?? "1") === p.v;
                return (
                  <button key={p.v} type="button" onClick={() => setNilai({ ...nilai, [x.kunci]: p.v })}
                    className={`sentuh rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      dipilih ? p.aktif : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" disabled={sibuk} className="btn-modal-save"
          onClick={async () => { if (await kirim("/api/spmb/pengaturan", "PUT", nilai)) toast.success("Tersimpan"); }}>
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {labelSimpan}
        </button>
      </div>
    </div>
  );
}

/** Tab "Isian Data" — HANYA isian data, tanpa dokumen. Dokumen seluruhnya ada di tab
 *  "Dokumen & Berkas" (2 Oktober 2026). */
function TabFormulir({ setelan, sibuk, kirim, toast }: {
  setelan: Record<string, string>; sibuk: boolean; kirim: Kirim; toast: Toast;
}) {
  return (
    <>
      <div className="panel p-4">
        <p className="text-sm text-gray-600">
          Menentukan isian data mana yang <span className="font-medium">wajib</span> diisi calon pendaftar, mana yang
          boleh dikosongkan, dan mana yang tidak usah ditampilkan. Nama, tempat &amp; tanggal lahir, jenis kelamin,
          nomor WhatsApp, sekolah asal, e-mail, konsentrasi keahlian, dan jalur <span className="font-medium">selalu
          wajib</span> — tanpa itu pendaftar tidak bisa diseleksi. Unggahan berkas diatur di tab
          <span className="font-medium"> Dokumen &amp; Berkas</span>.
        </p>
      </div>

      <PilihanWajib judul="Isian data pendaftar"
        keterangan="Di luar isian yang selalu wajib di atas."
        isian={ISIAN_DATA_SPMB} setelan={setelan} sibuk={sibuk} kirim={kirim} toast={toast}
        labelSimpan="Simpan Isian Data" />
    </>
  );
}
