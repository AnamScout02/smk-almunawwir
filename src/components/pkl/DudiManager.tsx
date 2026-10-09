"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Search, Loader2, Plus, Pencil, Trash2, Save, Users, FileWarning, BadgeCheck, LocateFixed, Download, X, Link2, Copy, Scale, MessageCircle } from "lucide-react";
import { salinTeks } from "@/lib/salin-teks";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import FileUpload from "@/components/shared/FileUpload";
import ImageUpload from "@/components/admin/ImageUpload";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { keadaanMou, tglPkl } from "@/lib/pkl-label";

type Jurusan = { id: string; code: string; name: string; skills: string[] };
type Dudi = {
  id: string; name: string; address: string | null; kabupaten: string | null; kecamatan: string | null; lat: number | null; lng: number | null;
  industryField: string | null; pimpinan: string | null; pimpinanJabatan: string | null; contactPerson: string | null; contactPhone: string | null;
  email: string | null; website: string | null; mouStartDate: string | null; mouEndDate: string | null; mouDocumentUrl: string | null;
  quota: number | null; jurusanIds: string[]; pekerjaan: string[]; fasilitas: string | null; jamKerja: string | null; notes: string | null;
  aktif: boolean; usulan?: boolean; calonPemberiKerja: boolean; terisi: number; selesai: number; rataNilai: number | null;
  adaPortal: boolean; alumniBekerja: number; alumniEksPkl: number; logoUrl: string | null; tampilPublik: boolean;
};
/** Nilai industri rata-rata sebesar ini dari siswa yang sudah selesai = layak disarankan sebagai calon pemberi kerja. */
const AMBANG_SARAN_BKK = 85;
const KOSONG = {
  name: "", address: "", kabupaten: "", kecamatan: "", lat: "", lng: "", industryField: "", pimpinan: "", pimpinanJabatan: "", contactPerson: "", contactPhone: "",
  email: "", website: "", mouStartDate: "", mouEndDate: "", mouDocumentUrl: "", quota: "", jurusanIds: [] as string[], pekerjaan: [] as string[],
  fasilitas: "", jamKerja: "", notes: "", aktif: true, calonPemberiKerja: false, logoUrl: "", tampilPublik: true,
};
type Isian = typeof KOSONG;
const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

/** DATA DUDI (9 Okt 2026) — data lengkap tiap tempat PKL: alamat & titik lokasi, pimpinan & narahubung, MoU, kuota,
 *  jurusan yang diterima, dan pekerjaan yang tersedia. Kuota terisi dihitung dari penempatan yang sedang berjalan. */
export default function DudiManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ dudi: Dudi[]; jurusan: Jurusan[] } | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [buka, setBuka] = useState<Dudi | "BARU" | null>(null);
  const [portal, setPortal] = useState<Dudi | null>(null);

  const muat = useCallback(() => {
    return fetch("/api/pkl/dudi").then(r => r.json()).then(d => { if (d.error) toast.error(d.error); else setData(d); return d as { dudi: Dudi[] }; })
      .catch(() => { toast.error("Gagal memuat data DUDI."); return null; });
  }, [toast]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("saring"), b = q.get("buka");
    if (s) queueMicrotask(() => setSaring(s));
    muat().then(d => { const x = b && d?.dudi?.find(y => y.id === b); if (x) setBuka(x); });
  }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.dudi ?? []).filter(d => {
      if (q && !`${d.name} ${d.industryField ?? ""} ${d.kecamatan ?? ""} ${d.kabupaten ?? ""} ${d.contactPerson ?? ""}`.toLowerCase().includes(q)) return false;
      if (!saring) return true;
      if (saring === "USULAN") return !!d.usulan;
      if (saring === "NONAKTIF") return !d.aktif;
      if (saring === "PENUH") return d.quota != null && d.terisi >= d.quota;
      if (saring === "KOSONG") return d.aktif && d.terisi === 0;
      if (saring === "BKK") return d.calonPemberiKerja;
      if (saring === "SARAN_BKK") return !d.calonPemberiKerja && (d.alumniBekerja > 0 || (d.rataNilai ?? 0) >= AMBANG_SARAN_BKK);
      return keadaanMou(d.mouEndDate).kode === saring;
    });
  }, [data, cari, saring]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}`);

  if (!data) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const semua = data.dudi;
  const perluMou = semua.filter(d => ["SEGERA", "HABIS"].includes(keadaanMou(d.mouEndDate).kode)).length;

  async function hapus(d: Dudi) {
    if (!await confirm(`Hapus ${d.name} dari daftar DUDI?`)) return;
    const r = await fetch(`/api/pkl/dudi/${d.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("DUDI dihapus"); muat(); } else toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menghapus");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Building2 size={22} />} title="Data DUDI" description="Dunia usaha & dunia industri tempat PKL: data lengkap, MoU, kuota, dan siswa yang ditempatkan" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={semua.filter(d => d.aktif).length} label="DUDI aktif" icon={Building2} color="primary" />
          <StatTile value={semua.reduce((a, d) => a + d.terisi, 0)} label="Siswa sedang PKL" icon={Users} color="emerald" />
          <StatTile value={semua.reduce((a, d) => a + Math.max(0, (d.quota ?? 0) - d.terisi), 0)} label="Sisa kuota" icon={BadgeCheck} color="blue" />
          <StatTile value={perluMou} label="MoU habis / segera habis" icon={FileWarning} color="amber" sorot={perluMou > 0} />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, bidang, kecamatan, narahubung..." />
          </div>
          <div className="alat-saring">
            <Select value={saring} onChange={setSaring} options={[
              { value: "", label: "Semua DUDI" }, { value: "KOSONG", label: "Aktif, belum ditempati" }, { value: "PENUH", label: "Kuota penuh" },
              { value: "AKTIF", label: "MoU aktif" }, { value: "SEGERA", label: "MoU segera habis" }, { value: "HABIS", label: "MoU habis" }, { value: "TANPA", label: "Belum ada MoU" },
              { value: "BKK", label: "Calon pemberi kerja" }, { value: "SARAN_BKK", label: "Disarankan jadi calon pemberi kerja" }, { value: "NONAKTIF", label: "Dinonaktifkan" }, { value: "USULAN", label: "Usulan dari web (belum diperiksa)" },
            ]} />
          </div>
          <div className="alat-aksi">
            <Link href="/pusat-pkl/dudi/kabar" className="btn-modal-cancel btn-teks"><MessageCircle size={16} /> Kabar ke DUDI</Link>
            <Link href="/pusat-pkl/pembanding" className="btn-modal-cancel btn-teks"><Scale size={16} /> Pembanding</Link>
            <a href="/api/pkl/rekap" className="btn-modal-cancel"><Download size={16} /> Rekap Excel</a>
            <button type="button" className="btn-modal-save" onClick={() => setBuka("BARU")}><Plus size={16} /> Tambah DUDI</button>
          </div>
        </div>

        <div className="panel overflow-hidden">
          {tersaring.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{semua.length ? "Tidak ada DUDI pada saringan ini." : "Belum ada DUDI. Tambahkan tempat PKL pertama."}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>DUDI</th><th>Lokasi</th><th>Narahubung</th><th className="text-right">Sedang PKL</th><th className="text-right">Kuota</th><th>MoU</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {hal.potongan.map((d, i) => {
                      const mou = keadaanMou(d.mouEndDate);
                      return (
                        <tr key={d.id} className={d.aktif ? "" : "opacity-60"}>
                          <td className="angka">{hal.awal + i}</td>
                          <td>
                            <p className="flex items-center gap-2 font-medium text-primary-900">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {d.logoUrl && <img src={d.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />}<Link href={`/pusat-pkl/dudi/${d.id}`} className="hover:underline" title="Riwayat DUDI">{d.name}</Link></p>
                            <p className="text-xs text-gray-400">{d.industryField || "bidang belum diisi"}{d.aktif ? "" : " · nonaktif"}{d.calonPemberiKerja ? " · calon pemberi kerja" : ""}{d.usulan && <span className="text-amber-700"> · usulan dari web, belum diperiksa</span>}</p>
                          </td>
                          <td className="text-sm text-gray-600">{[d.kecamatan, d.kabupaten].filter(Boolean).join(", ") || <span className="text-gray-300">—</span>}
                            {d.lat == null && <span className="block text-xs text-gray-400">titik lokasi belum diisi</span>}</td>
                          <td className="text-sm text-gray-600">{d.contactPerson || <span className="text-gray-300">—</span>}{d.contactPhone && <span className="angka block text-xs text-gray-400">{d.contactPhone}</span>}</td>
                          <td className="angka text-right">
                            {d.terisi > 0 ? <Link href={`/pusat-pkl/penempatan?dudi=${d.id}`} className="font-semibold text-primary-700 hover:underline">{d.terisi}</Link> : 0}
                            {d.selesai > 0 && <span className="block text-xs text-gray-400">{d.selesai} selesai{d.rataNilai != null ? ` · nilai ${d.rataNilai.toFixed(1)}` : ""}</span>}
                            {d.alumniBekerja > 0 && <span className="block text-xs text-emerald-700">{d.alumniBekerja} alumni bekerja di sini{d.alumniEksPkl ? ` (${d.alumniEksPkl} eks-PKL)` : ""}</span>}
                            {!d.calonPemberiKerja && (d.alumniBekerja > 0 || (d.rataNilai ?? 0) >= AMBANG_SARAN_BKK) && <span className="block text-xs text-amber-700">disarankan: calon pemberi kerja</span>}
                          </td>
                          <td className="angka text-right">{d.quota ?? "—"}{d.quota != null && d.terisi >= d.quota && <span className="block text-xs text-amber-700">penuh</span>}</td>
                          <td><span className={`status-badge ${mou.kelas}`}>{mou.label}</span>{d.mouEndDate && <span className="angka mt-1 block text-xs text-gray-400">s.d. {tglPkl(d.mouEndDate)}</span>}</td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" title={d.adaPortal ? "Tautan portal industri (aktif)" : "Buat tautan portal industri"} onClick={() => setPortal(d)}
                                className={`p-1.5 rounded-lg transition ${d.adaPortal ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-primary-700 hover:bg-primary-50"}`}><Link2 size={14} /></button>
                              <button type="button" title="Ubah data DUDI" onClick={() => setBuka(d)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                              <button type="button" title="Hapus DUDI" onClick={() => hapus(d)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="DUDI" className="border-t border-gray-100" />
            </>
          )}
        </div>
      </div>

      {portal && <ModalPortal d={portal} onTutup={() => { setPortal(null); muat(); }} />}
      {buka && <ModalDudi d={buka === "BARU" ? null : buka} jurusan={data.jurusan} onTutup={() => setBuka(null)} onSimpan={() => { setBuka(null); muat(); }} />}
    </div>
  );
}

function ModalDudi({ d, jurusan, onTutup, onSimpan }: { d: Dudi | null; jurusan: Jurusan[]; onTutup: () => void; onSimpan: () => void }) {
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [kerja, setKerja] = useState("");
  const [f, setF] = useState<Isian>(() => d ? {
    name: d.name, address: d.address ?? "", kabupaten: d.kabupaten ?? "", kecamatan: d.kecamatan ?? "", lat: d.lat?.toString() ?? "", lng: d.lng?.toString() ?? "",
    industryField: d.industryField ?? "", pimpinan: d.pimpinan ?? "", pimpinanJabatan: d.pimpinanJabatan ?? "", contactPerson: d.contactPerson ?? "", contactPhone: d.contactPhone ?? "",
    email: d.email ?? "", website: d.website ?? "", mouStartDate: iso(d.mouStartDate), mouEndDate: iso(d.mouEndDate), mouDocumentUrl: d.mouDocumentUrl ?? "",
    quota: d.quota?.toString() ?? "", jurusanIds: d.jurusanIds, pekerjaan: d.pekerjaan, fasilitas: d.fasilitas ?? "", jamKerja: d.jamKerja ?? "", notes: d.notes ?? "",
    aktif: d.aktif, calonPemberiKerja: d.calonPemberiKerja, logoUrl: d.logoUrl ?? "", tampilPublik: d.tampilPublik,
  } : KOSONG);
  const set = <K extends keyof Isian>(k: K, v: Isian[K]) => setF(x => ({ ...x, [k]: v }));
  const teks = (k: keyof Isian, label: string, o: { ph?: string; mode?: "numeric" | "decimal" | "tel" | "email" } = {}) => (
    <div className="min-w-0"><label className="label-field">{label}</label>
      <input className="input-field" inputMode={o.mode} value={f[k] as string} onChange={e => set(k, e.target.value as never)} placeholder={o.ph} /></div>
  );
  function tambahKerja() {
    const v = kerja.split(",").map(x => x.trim()).filter(Boolean);
    if (v.length) set("pekerjaan", [...new Set([...f.pekerjaan, ...v])]);
    setKerja("");
  }
  function lokasiSaya() {
    if (!navigator.geolocation) { toast.error("Perangkat ini tidak menyediakan lokasi."); return; }
    navigator.geolocation.getCurrentPosition(
      p => setF(x => ({ ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })),
      () => toast.error("Lokasi tidak bisa dibaca. Izinkan akses lokasi, atau isi lintang & bujur dari Google Maps."),
      { enableHighAccuracy: true, timeout: 10000 });
  }
  async function simpan() {
    if (!f.name.trim()) { toast.error("Nama DUDI wajib diisi."); return; }
    setSibuk(true);
    const r = await fetch(d ? `/api/pkl/dudi/${d.id}` : "/api/pkl/dudi", { method: d ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success("Data DUDI disimpan"); onSimpan(); } else toast.error(x?.error ?? "Gagal menyimpan");
  }
  // Saran pekerjaan = kompetensi jurusan yang dicentang (Major.skills) — supaya kecocokan kompetensi nanti memakai istilah yang sama.
  const saran = [...new Set(jurusan.filter(j => f.jurusanIds.includes(j.id)).flatMap(j => j.skills))].filter(s => !f.pekerjaan.includes(s)).slice(0, 12);

  return (
    <Modal open onClose={onTutup} size="xl" scrollBody title={d ? "Ubah Data DUDI" : "Tambah DUDI"} description={d ? d.name : "Tempat PKL baru"}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
      </>}>
      <>
        <p className="label-kecil">Identitas</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teks("name", "Nama DUDI *", { ph: "mis. CV Banyuwangi Komputer" })}
          {teks("industryField", "Bidang usaha", { ph: "mis. Jasa servis komputer & jaringan" })}
          {teks("pimpinan", "Nama pimpinan")}
          {teks("pimpinanJabatan", "Jabatan pimpinan", { ph: "mis. Direktur / Pemilik" })}
        </div>

        <ImageUpload value={f.logoUrl} onChange={v => set("logoUrl", v)} folder="mitra-industri" label="Logo DUDI" />
        <label className="sentuh flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={f.tampilPublik} onChange={e => set("tampilPublik", e.target.checked)} />
          Tampilkan logo di deret mitra halaman SPMB &amp; beranda
        </label>

        <p className="label-kecil pt-2">Alamat &amp; lokasi</p>
        <div><label className="label-field">Alamat lengkap</label><textarea className="input-field" rows={2} value={f.address} onChange={e => set("address", e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teks("kecamatan", "Kecamatan")}
          {teks("kabupaten", "Kabupaten / kota")}
          {teks("lat", "Lintang (latitude)", { ph: "-8.3015", mode: "decimal" })}
          {teks("lng", "Bujur (longitude)", { ph: "114.2140", mode: "decimal" })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-modal-cancel btn-teks" onClick={lokasiSaya}><LocateFixed size={16} /> Pakai lokasi saya sekarang</button>
          <span className="text-xs text-gray-500">Tekan saat berada di tempat DUDI. Titik ini dipakai peta PKL dan presensi berbasis lokasi.</span>
        </div>

        <p className="label-kecil pt-2">Narahubung</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teks("contactPerson", "Nama narahubung / pembimbing")}
          {teks("contactPhone", "Telepon / WhatsApp", { mode: "tel" })}
          {teks("email", "E-mail", { mode: "email" })}
          {teks("website", "Situs web")}
        </div>

        <p className="label-kecil pt-2">Kerja sama</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="min-w-0"><label className="label-field">MoU mulai</label><DatePicker value={f.mouStartDate} onChange={v => set("mouStartDate", v)} /></div>
          <div className="min-w-0"><label className="label-field">MoU berakhir</label><DatePicker value={f.mouEndDate} onChange={v => set("mouEndDate", v)} /></div>
          {teks("quota", "Kuota siswa PKL", { ph: "mis. 4", mode: "numeric" })}
        </div>
        <FileUpload value={f.mouDocumentUrl} onChange={v => set("mouDocumentUrl", v)} folder="mitra-industri" label="Dokumen MoU (pindaian / foto)" accept="application/pdf,image/*" hint="PDF atau foto — maks. 5MB" />

        <p className="label-kecil pt-2">Penerimaan siswa</p>
        <div>
          <label className="label-field">Jurusan yang diterima</label>
          <div className="flex flex-wrap gap-2">
            {jurusan.map(j => {
              const pilih = f.jurusanIds.includes(j.id);
              return (
                <button key={j.id} type="button" aria-pressed={pilih} onClick={() => set("jurusanIds", pilih ? f.jurusanIds.filter(x => x !== j.id) : [...f.jurusanIds, j.id])}
                  className={`sentuh rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${pilih ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{j.code}</button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Kosongkan bila menerima semua jurusan.</p>
        </div>
        <div>
          <label className="label-field">Pekerjaan yang tersedia untuk siswa</label>
          {f.pekerjaan.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {f.pekerjaan.map(p => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                  {p}<button type="button" title={`Hapus ${p}`} onClick={() => set("pekerjaan", f.pekerjaan.filter(x => x !== p))} className="text-primary-500 hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="input-field" value={kerja} onChange={e => setKerja(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); tambahKerja(); } }}
              placeholder="mis. Perakitan komputer, instalasi jaringan (pisahkan dengan koma)" />
            <button type="button" className="btn-modal-cancel shrink-0" onClick={tambahKerja}><Plus /> Tambah</button>
          </div>
          {saran.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">Dari kompetensi jurusan:
              {saran.map(s => <button key={s} type="button" onClick={() => set("pekerjaan", [...f.pekerjaan, s])} className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600 hover:bg-gray-50">+ {s}</button>)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teks("jamKerja", "Jam kerja", { ph: "mis. Senin–Sabtu 08.00–16.00" })}
          {teks("fasilitas", "Fasilitas untuk siswa", { ph: "mis. makan siang, uang saku, mess" })}
        </div>
        <div><label className="label-field">Catatan</label><textarea className="input-field" rows={2} value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="sentuh flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={f.aktif} onChange={e => set("aktif", e.target.checked)} /> Aktif (muncul di pilihan penempatan)</label>
          <label className="sentuh flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={f.calonPemberiKerja} onChange={e => set("calonPemberiKerja", e.target.checked)} /> Calon pemberi kerja lulusan (BKK)</label>
        </div>
      </>
    </Modal>
  );
}

/** Tautan portal industri satu DUDI. Token asli hanya terlihat SEKALI saat dibuat — yang lama langsung mati bila dibuat ulang. */
function ModalPortal({ d, onTutup }: { d: Dudi; onTutup: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [url, setUrl] = useState("");
  const [ada, setAda] = useState(d.adaPortal);
  const [sibuk, setSibuk] = useState(false);
  async function buat() {
    if (ada && !await confirm("Buat tautan baru? Tautan lama yang sudah dibagikan ke pihak DUDI langsung tidak berlaku.")) return;
    setSibuk(true);
    const r = await fetch(`/api/pkl/dudi/${d.id}/portal`, { method: "POST" }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok && x?.url) { setUrl(x.url); setAda(true); } else toast.error(x?.error ?? "Gagal membuat tautan");
  }
  async function cabut() {
    if (!await confirm("Cabut tautan portal? Pihak DUDI tidak bisa lagi membuka portalnya sampai dibuatkan tautan baru.")) return;
    setSibuk(true);
    const r = await fetch(`/api/pkl/dudi/${d.id}/portal`, { method: "DELETE" }).catch(() => null);
    setSibuk(false);
    if (r?.ok) { setUrl(""); setAda(false); toast.success("Tautan dicabut"); } else toast.error("Gagal mencabut tautan");
  }
  const pesan = `Assalamualaikum. Berikut tautan Portal Industri PKL untuk ${d.name}: presensi siswa, paraf jurnal, nilai akhir, dan lapor masalah ke sekolah.\n${url}\nMohon tidak dibagikan ke pihak lain.`;
  return (
    <Modal open onClose={onTutup} size="lg" title="Portal Industri" description={d.name}
      footer={<>
        {ada && <button type="button" className="btn-hapus flex-1" disabled={sibuk} onClick={cabut}>Cabut Tautan</button>}
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={buat}>{sibuk ? <Loader2 className="animate-spin" /> : <Link2 />} {ada ? "Buat Tautan Baru" : "Buat Tautan"}</button>
      </>}>
      <>
        <p className="text-sm text-gray-600">Satu tautan untuk pembimbing di {d.name}, tanpa akun: melihat siswa yang ditempatkan di sana, mengisi presensi harian, memparaf jurnal, mengisi nilai akhir, dan melapor masalah ke Humas.</p>
        {url ? (
          <>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="angka break-all text-sm text-emerald-800">{url}</p>
            </div>
            <div className="alat-aksi alat-teks">
              <button type="button" className="btn-modal-cancel" onClick={async () => { (await salinTeks(url)) ? toast.success("Tautan disalin") : toast.error("Gagal menyalin"); }}><Copy size={16} /> Salin Tautan</button>
              {d.contactPhone && <a className="btn-modal-cancel" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/${d.contactPhone.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(pesan)}`}>Kirim lewat WhatsApp</a>}
            </div>
            <p className="text-xs text-amber-700">Simpan atau kirim sekarang — demi keamanan, tautan ini tidak bisa ditampilkan lagi setelah jendela ditutup. Bila hilang, buat tautan baru.</p>
          </>
        ) : (
          <p className="rounded-xl border border-gray-100 bg-[#f5f6fa] p-3 text-sm text-gray-600">{ada ? "DUDI ini sudah punya tautan aktif. Tautannya tidak disimpan di sistem, jadi tidak bisa ditampilkan ulang — buat tautan baru bila perlu mengirim lagi." : "Belum ada tautan portal untuk DUDI ini."}</p>
        )}
      </>
    </Modal>
  );
}
