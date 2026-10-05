"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Edit2, Link2, Loader2, Lock, Plus, Printer, Save, Search, Share2, Trash2, UsersRound, Wand2,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { salinTeks } from "@/lib/salin-teks";
import { LABEL_JENIS } from "@/lib/spmb-perujuk-label";

type Perujuk = {
  id: string; kode: string; nama: string; jenis: string; kontak: string | null;
  keterangan: string | null; aktif: boolean;
  _count: { pendaftar: number }; diterima: number;
};

const WARNA_JENIS: Record<string, string> = {
  SISWA: "bg-blue-50 text-blue-700 border-blue-200",
  PEGAWAI: "bg-purple-50 text-purple-700 border-purple-200",
  LUAR: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function PerujukSpmbManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [data, setData] = useState<Perujuk[]>([]);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");

  const kosong = { kode: "", nama: "", jenis: "LUAR", kontak: "", keterangan: "", aktif: true, dipakai: 0 };
  const [form, setForm] = useState<(typeof kosong & { id?: string }) | null>(null);
  const [massal, setMassal] = useState<{ jenis: string; bentuk: string } | null>(null);

  const muat = useCallback(async () => {
    const d = await fetch("/api/spmb/perujuk").then(r => r.json()).catch(() => null);
    if (Array.isArray(d)) setData(d);
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
    if (r?.ok) { await muat(); return d ?? {}; }
    toast.error(d?.error ?? "Gagal menyimpan");
    return null;
  }

  const tautan = (kode: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/admissions?ref=${encodeURIComponent(kode)}`;

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data.filter(p => {
      if (saring === "aktif" && !p.aktif) return false;
      if (saring === "nonaktif" && p.aktif) return false;
      if (["SISWA", "PEGAWAI", "LUAR"].includes(saring) && p.jenis !== saring) return false;
      if (!q) return true;
      return p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q);
    });
  }, [data, cari, saring]);

  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}`);
  const aktif = data.filter(p => p.aktif).length;
  const terujuk = data.reduce((a, p) => a + p._count.pendaftar, 0);
  const diterima = data.reduce((a, p) => a + p.diterima, 0);

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UsersRound size={22} />} title="Perujuk & Kode Referral"
        description="Siapa yang boleh mengajak calon murid, dan berapa pendaftar yang datang dari masing-masing" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={data.length} label="Total perujuk" ikon="akun" color="primary" />
          <StatTile value={aktif} label="Kode aktif" ikon="hadir" color="emerald" />
          <StatTile value={terujuk} label="Pendaftar terujuk" ikon="siswa-wali" color="blue" />
          <StatTile value={diterima} label="Diterima dari rujukan" ikon="lunas" color="purple" />
        </div>

        <div className="panel p-4">
          <p className="text-sm text-gray-600">
            Tiap perujuk punya satu <span className="font-medium">kode unik</span>. Yang dibagikan bukan kodenya,
            melainkan <span className="font-medium">tautan</span> atau <span className="font-medium">QR</span>-nya —
            calon yang membukanya langsung mendapat formulir dengan kode sudah terisi, tanpa mengetik apa pun.
            Kode yang salah ketik tidak pernah menggagalkan pendaftaran.
          </p>
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari nama atau kode perujuk..." />
          </div>
          <div className="alat-saring">
            <Select value={saring} onChange={setSaring} options={[
              { value: "semua", label: "Semua perujuk" },
              { value: "aktif", label: "Kode aktif" },
              { value: "nonaktif", label: "Nonaktif" },
              { value: "SISWA", label: "Siswa" },
              { value: "PEGAWAI", label: "Guru / Pegawai" },
              { value: "LUAR", label: "Perujuk luar" },
            ]} />
          </div>
          <div className="alat-aksi">
            <a href="/pusat-spmb/perujuk/cetak" className="btn-modal-cancel btn-teks"><Printer size={16} /> Cetak Kartu</a>
            <button type="button" onClick={() => setMassal({ jenis: "SISWA", bentuk: "angka" })}
              className="btn-modal-cancel btn-teks"><Wand2 size={16} /> Buat Kode Massal</button>
            <button type="button" onClick={() => setForm({ ...kosong })} className="btn-modal-save">
              <Plus size={16} /> Tambah Perujuk
            </button>
          </div>
        </div>

        {tersaring.length === 0 ? (
          <div className="panel p-5">
            <p className="py-10 text-center text-sm text-gray-400">
              {data.length === 0
                ? "Belum ada perujuk. Tekan Buat Kode Massal untuk membuatkan kode seluruh siswa atau guru sekaligus, atau Tambah Perujuk untuk alumni & orang luar."
                : "Tidak ada perujuk yang cocok dengan saringan."}
            </p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr>
                  <th className="w-10">No</th><th>Perujuk</th><th>Kode</th><th>Jenis</th>
                  <th className="text-right">Pendaftar</th><th className="text-right">Diterima</th>
                  <th>Status</th><th className="text-right">Aksi</th>
                </tr></thead>
                <tbody>
                  {hal.potongan.map((p, i) => (
                    <tr key={p.id}>
                      <td className="angka">{hal.awal + i}</td>
                      <td>
                        <p className="font-medium text-primary-900">{p.nama}</p>
                        {p.keterangan && <p className="text-xs text-gray-400">{p.keterangan}</p>}
                      </td>
                      <td className="angka font-semibold text-primary-700">{p.kode}</td>
                      <td><span className={`status-badge ${WARNA_JENIS[p.jenis] ?? ""}`}>{LABEL_JENIS[p.jenis] ?? p.jenis}</span></td>
                      <td className="angka text-right">{p._count.pendaftar}</td>
                      <td className="angka text-right font-semibold text-primary-900">{p.diterima}</td>
                      <td>
                        <span className={`status-badge ${p.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {p.aktif ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button type="button" title="Salin tautan ajak"
                            onClick={async () => {
                              // salinTeks, bukan navigator.clipboard — situs juga dibuka lewat HTTP (CLAUDE.md #28)
                              const ok = await salinTeks(tautan(p.kode));
                              ok ? toast.success("Tautan ajak disalin") : toast.error("Tautan belum tersalin — salin manual dari kolom Kode");
                            }}
                            className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Link2 size={14} /></button>
                          <a href={`/pusat-spmb/qr?ref=${encodeURIComponent(p.kode)}`} title="Kartu QR perujuk"
                            className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Printer size={14} /></a>
                          <button type="button" title="Edit"
                            onClick={() => setForm({ id: p.id, kode: p.kode, nama: p.nama, jenis: p.jenis, kontak: p.kontak ?? "", keterangan: p.keterangan ?? "", aktif: p.aktif, dipakai: p._count.pendaftar })}
                            className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Edit2 size={14} /></button>
                          <button type="button" title="Hapus"
                            onClick={async () => {
                              if (!(await confirm(`Hapus perujuk "${p.nama}"?`))) return;
                              if (await kirim(`/api/spmb/perujuk/${p.id}`, "DELETE")) toast.success("Perujuk dihapus");
                            }}
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginasi hal={hal} satuan="perujuk" className="border-t border-gray-100" />
          </div>
        )}
      </div>

      {/* --- Tambah / ubah perujuk --- */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Perujuk" : "Tambah Perujuk"} size="md"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} className="btn-modal-save"
            onClick={async () => {
              if (!form?.nama.trim()) { toast.error("Nama perujuk wajib diisi"); return; }
              if (form.id && !form.kode.trim()) { toast.error("Kode tidak boleh dikosongkan saat mengubah"); return; }
              const ok = form.id
                ? await kirim(`/api/spmb/perujuk/${form.id}`, "PUT", form)
                : await kirim("/api/spmb/perujuk", "POST", form);
              if (ok) {
                setForm(null);
                toast.success(ok.kode && !form.kode ? `Perujuk tersimpan — kodenya ${ok.kode}` : "Perujuk tersimpan");
              }
            }}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama perujuk</label>
              <input className="input-field" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="label-field">Kode {!form.id && <span className="font-normal text-gray-400">(boleh dikosongkan)</span>}</label>
              <input className="input-field uppercase" value={form.kode} disabled={form.dipakai > 0}
                onChange={e => setForm({ ...form, kode: e.target.value.toUpperCase().slice(0, 40) })}
                placeholder={form.id ? "" : "Dikosongkan = dibuatkan angka 6 digit"} />
              {form.dipakai > 0 ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700">
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  Terkunci — kode ini sudah dipakai {form.dipakai} pendaftar. Tautan &amp; QR-nya sudah beredar;
                  menggantinya membuat semua yang sudah dibagikan berhenti berlaku. Bila perlu kode baru,
                  nonaktifkan perujuk ini lalu buat yang baru.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  {form.id
                    ? "Masih bisa diubah karena belum ada pendaftar yang memakainya."
                    : "Dikosongkan, sistem membuatkan kode ANGKA 6 digit — mudah didiktekan lewat telepon. Siswa & pegawai memakai NIS/NIP lewat tombol Buat Kode Massal."}
                </p>
              )}
            </div>
            <div>
              <label className="label-field">Jenis</label>
              <Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })}
                options={[
                  { value: "LUAR", label: "Perujuk Luar (alumni, wali murid, tokoh)" },
                  { value: "SISWA", label: "Siswa" },
                  { value: "PEGAWAI", label: "Guru / Pegawai" },
                ]} />
            </div>
            <div>
              <label className="label-field">Nomor WhatsApp (opsional)</label>
              <input className="input-field" value={form.kontak}
                onChange={e => setForm({ ...form, kontak: e.target.value.replace(/[^0-9+\s-]/g, "") })}
                placeholder="08xxxxxxxxxx" />
              <p className="mt-1 text-xs text-gray-500">Hanya untuk panitia menghubungi — tidak pernah ditampilkan di situs.</p>
            </div>
            <div>
              <label className="label-field">Keterangan (opsional)</label>
              <input className="input-field" value={form.keterangan}
                onChange={e => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Mis. Alumni angkatan 2019" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} />
              Kode aktif (bisa dipakai mendaftar)
            </label>
          </div>
        )}
      </Modal>

      {/* --- Buat kode massal --- */}
      <Modal open={!!massal} onClose={() => setMassal(null)} title="Buat Kode Perujuk Massal" size="md"
        footer={<>
          <button type="button" onClick={() => setMassal(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} className="btn-modal-save"
            onClick={async () => {
              const d = await kirim("/api/spmb/perujuk/massal", "POST", massal);
              if (d) { setMassal(null); toast.success(`${d.dibuat ?? 0} kode dibuat, ${d.dilewati ?? 0} dilewati (sudah punya)`); }
            }}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} Buat Kode
          </button>
        </>}>
        {massal && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Untuk siapa</label>
              <Select value={massal.jenis} onChange={v => setMassal({ ...massal, jenis: v })}
                options={[
                  { value: "SISWA", label: "Seluruh siswa aktif" },
                  { value: "PEGAWAI", label: "Seluruh guru / pegawai ber-NIP" },
                ]} />
            </div>
            <div>
              <label className="label-field">Bentuk kode</label>
              <Select value={massal.bentuk} onChange={v => setMassal({ ...massal, bentuk: v })}
                options={[
                  { value: "angka", label: "Angka NIS/NIP saja (disarankan)" },
                  { value: "berakhiran", label: "Angka + 4 karakter acak" },
                ]} />
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-sm leading-relaxed text-amber-800">
                {massal.bentuk === "angka"
                  ? "Tanda baca NIS dibuang — 924/001.10.2.1 menjadi 9240011021. Diperiksa ke data sekolah: 1.180 NIS menghasilkan 1.180 kode unik tanpa satu pun bentrok, dan kode ini TIDAK berlaku di pemindai kartu gerbang karena pemindai mencocokkan NIS persis. NIP seperti TMP-004 yang hanya menyisakan 3 angka otomatis memakai bentuk TMP004."
                  : "Ditambah 4 karakter acak, sehingga kode sama sekali tidak bisa dicocokkan balik ke NIS. Lebih aman, tetapi lebih panjang untuk didiktekan."}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Aman ditekan berulang — yang sudah punya kode dilewati, bukan dibuat ganda.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
