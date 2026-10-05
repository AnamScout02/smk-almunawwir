"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Plus, Pencil, Trash2, Loader2, Trophy, Users, ExternalLink, Search, Download, FileText, Receipt, Link2, EyeOff,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import ImageUpload from "@/components/admin/ImageUpload";
import FileUpload from "@/components/shared/FileUpload";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { salinTeks } from "@/lib/salin-teks";
import {
  JENIS_EVENT, TINGKAT_EVENT, STATUS_DAFTAR, LABEL_JENIS, LABEL_TINGKAT, STATUS_DAFTAR_INFO,
  tglEvent, pendaftaranTerbuka, rupiah,
} from "@/lib/event-label";

type Event = {
  id: string; judul: string; slug: string; penyelenggara: string; milikSekolah: boolean; jenis: string; tingkat: string;
  deskripsi: string; syarat: string | null; fasilitas: string | null; berbayar: boolean; biaya: number | null;
  biayaCatatan: string | null; rekening: string | null; mulai: string | null; selesai: string | null; tutupDaftar: string | null;
  posterUrl: string | null; panduanUrl: string | null; tautanLuar: string | null; kontak: string | null;
  jurusanIds: string[]; aktif: boolean; tampilPublik: boolean; jumlahDaftar: number;
};
type Pendaftar = {
  id: string; namaPeserta: string; asalSekolah: string | null; kontak: string; catatan: string | null; karyaTautan: string | null;
  status: string; juara: string | null; catatanPanitia: string | null; createdAt: string;
  nis: string | null; kelas: string | null; studentId: string | null; adaKarya: boolean; adaBukti: boolean;
};

const KOSONG = {
  judul: "", penyelenggara: "", milikSekolah: true, jenis: "LOMBA", tingkat: "SEKOLAH", deskripsi: "", syarat: "", fasilitas: "",
  berbayar: false, biaya: "", biayaCatatan: "", rekening: "", mulai: "", selesai: "", tutupDaftar: "",
  posterUrl: "", panduanUrl: "", tautanLuar: "", kontak: "", jurusanIds: [] as string[], aktif: true, tampilPublik: true,
};
type Isian = typeof KOSONG;

const keTgl = (v: string | null) => (v ? v.slice(0, 10) : "");
const opsi = (daftar: string[], label: Record<string, string>) => daftar.map(v => ({ value: v, label: label[v] ?? v }));

/** LOMBA & EVENT — pengelola (Admin, staf TU, dan guru berjabatan JABATAN_EVENT). Satu komponen untuk dua
 *  portal (DESIGN_SYSTEM §13). Event MILIK SEKOLAH menerima peserta luar lewat /lomba/<slug>; lomba pihak
 *  luar yang diteruskan sekolah hanya bisa didaftari siswa (atau lewat `tautanLuar` penyelenggara). */
export default function EventManager() {
  const confirm = useConfirm();
  const toast = useToast();
  const [daftar, setDaftar] = useState<Event[]>([]);
  const [jurusan, setJurusan] = useState<{ id: string; name: string }[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("aktif");
  const [buka, setBuka] = useState(false);
  const [ubah, setUbah] = useState<Event | null>(null);
  const [isian, setIsian] = useState<Isian>({ ...KOSONG });
  const [simpanan, setSimpanan] = useState(false);
  const [pesan, setPesan] = useState("");
  const [lihat, setLihat] = useState<Event | null>(null);

  const muat = useCallback(() => {
    setMemuat(true);
    fetch("/api/admin/event")
      .then(r => r.json())
      .then(d => { setDaftar(d.daftar ?? []); setJurusan(d.jurusan ?? []); })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const set = <K extends keyof Isian>(k: K, v: Isian[K]) => setIsian(f => ({ ...f, [k]: v }));

  function bukaBaru() { setIsian({ ...KOSONG }); setUbah(null); setPesan(""); setBuka(true); }
  function bukaUbah(e: Event) {
    setIsian({
      judul: e.judul, penyelenggara: e.penyelenggara, milikSekolah: e.milikSekolah, jenis: e.jenis, tingkat: e.tingkat,
      deskripsi: e.deskripsi, syarat: e.syarat ?? "", fasilitas: e.fasilitas ?? "", berbayar: e.berbayar,
      biaya: e.biaya ? String(e.biaya) : "", biayaCatatan: e.biayaCatatan ?? "", rekening: e.rekening ?? "",
      mulai: keTgl(e.mulai), selesai: keTgl(e.selesai), tutupDaftar: keTgl(e.tutupDaftar),
      posterUrl: e.posterUrl ?? "", panduanUrl: e.panduanUrl ?? "", tautanLuar: e.tautanLuar ?? "", kontak: e.kontak ?? "",
      jurusanIds: e.jurusanIds, aktif: e.aktif, tampilPublik: e.tampilPublik,
    });
    setUbah(e); setPesan(""); setBuka(true);
  }

  async function simpan() {
    if (!isian.judul.trim() || !isian.deskripsi.trim()) { setPesan("Nama event dan deskripsi wajib diisi."); return; }
    if (isian.mulai && isian.selesai && isian.selesai < isian.mulai) { setPesan("Tanggal selesai tidak boleh sebelum tanggal mulai."); return; }
    setSimpanan(true);
    try {
      const r = await fetch(ubah ? `/api/admin/event/${ubah.id}` : "/api/admin/event", {
        method: ubah ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isian),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setPesan(d?.error || "Gagal menyimpan."); return; }
      toast.success(ubah ? "Event diperbarui" : "Event dibuat");
      setBuka(false); muat();
    } catch { setPesan("Koneksi gagal."); } finally { setSimpanan(false); }
  }

  async function hapus(e: Event) {
    const ok = await confirm(e.jumlahDaftar
      ? `Hapus "${e.judul}"? ${e.jumlahDaftar} pendaftaran beserta berkas karya & bukti bayarnya ikut terhapus. Untuk menutup pendaftaran saja, nonaktifkan eventnya.`
      : `Hapus "${e.judul}"?`);
    if (!ok) return;
    const r = await fetch(`/api/admin/event/${e.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Event dihapus"); muat(); } else toast.error("Gagal menghapus.");
  }

  async function salinTautan(e: Event) {
    const ok = await salinTeks(`${window.location.origin}/lomba/${e.slug}`);
    if (ok) toast.success("Tautan disalin"); else toast.error("Gagal menyalin — salin dari halaman event.");
  }

  const kini = new Date();
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar.filter(e => {
      if (saring === "aktif" && !e.aktif) return false;
      if (saring === "buka" && !pendaftaranTerbuka(e)) return false;
      if (saring === "arsip" && e.aktif) return false;
      return !q || `${e.judul} ${e.penyelenggara}`.toLowerCase().includes(q);
    });
  }, [daftar, cari, saring]);

  const jumlahBuka = daftar.filter(e => pendaftaranTerbuka(e, kini)).length;
  const totalPendaftar = daftar.reduce((a, e) => a + e.jumlahDaftar, 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Trophy size={22} />} title="Lomba & Event"
        description="Event milik sekolah (terbuka untuk umum) dan lomba pihak luar yang diikuti siswa" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={daftar.filter(e => e.aktif).length} label="Event aktif" ikon="prestasi" color="primary" />
          <StatTile value={jumlahBuka} label="Pendaftaran dibuka" ikon="pintu" color="emerald" />
          <StatTile value={totalPendaftar} label="Total pendaftar" ikon="akun" color="blue" />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama event atau penyelenggara..." className="input-field pl-10" />
          </div>
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {[["aktif", "Aktif"], ["buka", "Pendaftaran Dibuka"], ["arsip", "Nonaktif"], ["semua", "Semua"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSaring(k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saring === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
          <div className="alat-aksi">
            <a href="/lomba" className="btn-modal-cancel btn-teks"><ExternalLink size={16} /> Halaman Publik</a>
            <button type="button" onClick={bukaBaru} className="btn-modal-save"><Plus size={16} /> Tambah Event</button>
          </div>
        </div>

        {memuat ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        ) : tampil.length === 0 ? (
          <EmptyState icon={Trophy} title={daftar.length ? "Tidak ada event yang cocok" : "Belum ada event"}
            description={daftar.length ? "Ubah kata cari atau saringan." : 'Klik "Tambah Event" untuk mengumumkan lomba atau event pertama.'} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tampil.map(e => {
              const terbuka = pendaftaranTerbuka(e, kini);
              return (
                <div key={e.id} className={`panel flex min-w-0 overflow-hidden ${e.aktif ? "" : "opacity-60"}`}>
                  <div className="relative hidden w-28 shrink-0 bg-gray-100 sm:block">
                    {e.posterUrl
                      ? <Image src={e.posterUrl} alt="" fill sizes="112px" className="object-cover" />
                      : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-900 to-primary-700 text-white/40"><Trophy size={28} /></div>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`status-badge ${terbuka ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {terbuka ? "Pendaftaran dibuka" : e.aktif ? "Pendaftaran ditutup" : "Nonaktif"}
                      </span>
                      <span className="status-badge bg-blue-50 text-blue-700 border-blue-200">{LABEL_JENIS.id[e.jenis] ?? e.jenis} · {LABEL_TINGKAT.id[e.tingkat] ?? e.tingkat}</span>
                      {e.milikSekolah && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Milik sekolah</span>}
                      {!e.tampilPublik && <span className="status-badge bg-gray-50 text-gray-600 border-gray-200"><EyeOff size={11} /> Hanya siswa</span>}
                    </div>
                    <h3 className="font-heading font-semibold text-primary-900">{e.judul}</h3>
                    <p className="text-sm text-gray-500">
                      {e.penyelenggara}
                      {e.tutupDaftar && <> · tutup {tglEvent(e.tutupDaftar, "id-ID", false)}</>}
                      {e.berbayar && <> · {e.biaya ? rupiah(e.biaya) : "Berbayar"}</>}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <button type="button" onClick={() => setLihat(e)} className="btn-modal-save px-3 text-xs">
                        <Users size={12} /> Pendaftar ({e.jumlahDaftar})
                      </button>
                      <button type="button" onClick={() => bukaUbah(e)} className="btn-modal-cancel px-3 text-xs"><Pencil size={12} /> Ubah</button>
                      <button type="button" onClick={() => salinTautan(e)} className="btn-modal-cancel px-3 text-xs"><Link2 size={12} /> Salin Tautan</button>
                      <button type="button" onClick={() => hapus(e)} className="btn-hapus px-3 text-xs"><Trash2 size={12} /> Hapus</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal scrollBody size="xl" open={buka} onClose={() => !simpanan && setBuka(false)} title={ubah ? "Ubah Event" : "Tambah Event"}
        footer={<>
          <button type="button" onClick={() => setBuka(false)} disabled={simpanan} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpan} disabled={simpanan} className="btn-modal-save flex-1">
            {simpanan && <Loader2 size={16} className="animate-spin" />} {simpanan ? "Menyimpan..." : "Simpan"}
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[[true, "Event milik sekolah", "Pendaftaran terbuka untuk umum (sekolah lain, masyarakat) dan siswa."],
              [false, "Lomba pihak luar", "Diselenggarakan pihak lain; sekolah meneruskan & mengirim siswanya."]].map(([v, j, k]) => (
              <button key={String(v)} type="button" onClick={() => set("milikSekolah", v as boolean)}
                className={`rounded-xl border p-3 text-left transition ${isian.milikSekolah === v ? "border-primary-700 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <p className="text-sm font-semibold text-primary-900">{j as string}</p>
                <p className="mt-0.5 text-xs text-gray-500">{k as string}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="label-field">Nama Event *</label>
            <input value={isian.judul} onChange={e => set("judul", e.target.value)} className="input-field" placeholder="Cth: Lomba Desain Poster Hari Santri 2026" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label-field">Penyelenggara</label>
              <input value={isian.penyelenggara} onChange={e => set("penyelenggara", e.target.value)} className="input-field" placeholder="Kosong = nama sekolah" />
            </div>
            <div><label className="label-field">Jenis</label><Select value={isian.jenis} onChange={v => set("jenis", v)} options={opsi(JENIS_EVENT, LABEL_JENIS.id)} /></div>
            <div><label className="label-field">Tingkat</label><Select value={isian.tingkat} onChange={v => set("tingkat", v)} options={opsi(TINGKAT_EVENT, LABEL_TINGKAT.id)} /></div>
          </div>
          <div>
            <label className="label-field">Deskripsi *</label>
            <textarea rows={4} value={isian.deskripsi} onChange={e => set("deskripsi", e.target.value)} className="input-field" placeholder="Tema, kategori, dan gambaran singkat — ini yang dibaca calon peserta." />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Syarat Peserta</label>
              <textarea rows={3} value={isian.syarat} onChange={e => set("syarat", e.target.value)} className="input-field" placeholder="Satu syarat per baris" />
            </div>
            <div>
              <label className="label-field">Fasilitas & Hadiah</label>
              <textarea rows={3} value={isian.fasilitas} onChange={e => set("fasilitas", e.target.value)} className="input-field" placeholder="Satu per baris, cth: E-sertifikat" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="label-field">Mulai</label><DatePicker value={isian.mulai} onChange={v => set("mulai", v)} /></div>
            <div><label className="label-field">Selesai</label><DatePicker value={isian.selesai} onChange={v => set("selesai", v)} /></div>
            <div><label className="label-field">Batas Pendaftaran</label><DatePicker value={isian.tutupDaftar} onChange={v => set("tutupDaftar", v)} /></div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">Pendaftaran ditutup otomatis pukul 23.59 WIB pada tanggal batas. Kosong = dibuka selama event aktif.</p>

          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isian.berbayar} onChange={e => set("berbayar", e.target.checked)} className="h-4 w-4 rounded accent-primary-700" />
            <span className="text-sm text-gray-700">Berbayar (peserta wajib mengunggah bukti bayar)</span>
          </label>
          {isian.berbayar && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label-field">Biaya (Rp)</label>
                <input inputMode="numeric" value={isian.biaya} onChange={e => set("biaya", e.target.value.replace(/\D/g, ""))} className="input-field" placeholder="50000" />
              </div>
              <div>
                <label className="label-field">Keterangan Biaya</label>
                <input value={isian.biayaCatatan} onChange={e => set("biayaCatatan", e.target.value)} className="input-field" placeholder="Cth: per tim" />
              </div>
              <div>
                <label className="label-field">Rekening Tujuan</label>
                <input value={isian.rekening} onChange={e => set("rekening", e.target.value)} className="input-field" placeholder="Bank, nomor, atas nama" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImageUpload value={isian.posterUrl} onChange={u => set("posterUrl", u)} folder="event" label="Poster (opsional)" aspect="portrait" />
            <div className="space-y-3">
              <FileUpload value={isian.panduanUrl} onChange={u => set("panduanUrl", u)} folder="event" label="Panduan / Juknis (PDF)" accept="application/pdf" hint="PDF — maks. 5MB" />
              <div>
                <label className="label-field">Narahubung</label>
                <input value={isian.kontak} onChange={e => set("kontak", e.target.value)} className="input-field" placeholder="Nama & nomor WhatsApp panitia" />
              </div>
            </div>
          </div>
          <div>
            <label className="label-field">Tautan Pendaftaran Penyelenggara</label>
            <input value={isian.tautanLuar} onChange={e => set("tautanLuar", e.target.value)} className="input-field" placeholder="https://… (kosongkan bila pendaftaran lewat situs ini)" />
            <p className="mt-1 text-xs text-gray-400">Bila diisi, tombol Daftar membuka situs penyelenggara dan formulir di situs ini tidak dipakai.</p>
          </div>

          {jurusan.length > 0 && (
            <div>
              <label className="label-field">Khusus Jurusan</label>
              <div className="flex flex-wrap gap-2">
                {jurusan.map(j => {
                  const pilih = isian.jurusanIds.includes(j.id);
                  return (
                    <button key={j.id} type="button"
                      onClick={() => set("jurusanIds", pilih ? isian.jurusanIds.filter(x => x !== j.id) : [...isian.jurusanIds, j.id])}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${pilih ? "border-primary-700 bg-primary-700 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {j.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-400">Tidak dipilih = semua jurusan. Berlaku untuk siswa; peserta luar tidak disaring.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={isian.aktif} onChange={e => set("aktif", e.target.checked)} className="h-4 w-4 rounded accent-primary-700" />
              <span className="text-sm text-gray-700">Aktif</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={isian.tampilPublik} onChange={e => set("tampilPublik", e.target.checked)} className="h-4 w-4 rounded accent-primary-700" />
              <span className="text-sm text-gray-700">Tampil di website (tanpa centang = hanya terlihat siswa)</span>
            </label>
          </div>
          {pesan && <p className="error-msg">{pesan}</p>}
        </div>
      </Modal>

      {lihat && <PendaftarModal event={lihat} onClose={() => { setLihat(null); muat(); }} />}
    </div>
  );
}

function PendaftarModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [daftar, setDaftar] = useState<Pendaftar[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ubah, setUbah] = useState<Pendaftar | null>(null);
  const [isi, setIsi] = useState({ status: "", juara: "", catatanPanitia: "" });
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    setMemuat(true);
    fetch(`/api/admin/event/${event.id}/pendaftaran`)
      .then(r => r.json())
      .then(d => setDaftar(d.daftar ?? []))
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, [event.id]);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!ubah) return;
    setSibuk(true);
    try {
      const r = await fetch(`/api/admin/event/${event.id}/pendaftaran`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: ubah.id, ...isi }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
      toast.success("Tersimpan"); setUbah(null); muat();
    } catch { toast.error("Koneksi gagal."); } finally { setSibuk(false); }
  }

  async function hapus(p: Pendaftar) {
    if (!await confirm(`Hapus pendaftaran ${p.namaPeserta} beserta berkasnya?`)) return;
    const r = await fetch(`/api/admin/event/${event.id}/pendaftaran?pid=${p.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Dihapus"); muat(); } else toast.error("Gagal menghapus.");
  }

  return (
    <>
    <Modal open onClose={onClose} size="xl" scrollBody title="Pendaftar" description={event.judul}
      footer={<>
        <a href={`/api/admin/event/${event.id}/ekspor`} className="btn-modal-cancel flex-1"><Download size={16} /> Unduh Excel</a>
        <button type="button" onClick={onClose} className="btn-modal-save flex-1">Selesai</button>
      </>}>
      {memuat ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : daftar.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar.</p>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Peserta</th><th>Kontak</th><th>Berkas</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
              <tbody>
                {daftar.map((p, i) => {
                  const st = STATUS_DAFTAR_INFO[p.status] ?? STATUS_DAFTAR_INFO.DIAJUKAN;
                  return (
                    <tr key={p.id}>
                      <td className="angka">{i + 1}</td>
                      <td>
                        <p className="font-medium text-primary-900">{p.namaPeserta}</p>
                        <p className="text-xs text-gray-500">{p.studentId ? `${p.kelas ?? "Siswa"}${p.nis ? ` · ${p.nis}` : ""}` : p.asalSekolah ?? "Peserta luar"}</p>
                        {p.catatan && <p className="mt-0.5 text-xs text-gray-400">“{p.catatan}”</p>}
                      </td>
                      <td className="text-sm">{p.kontak}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {p.adaKarya && <a href={`/api/event/berkas/${p.id}/karya`} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"><FileText size={12} /> Karya</a>}
                          {p.karyaTautan && <a href={p.karyaTautan} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"><ExternalLink size={12} /> Tautan</a>}
                          {p.adaBukti && <a href={`/api/event/berkas/${p.id}/bukti`} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"><Receipt size={12} /> Bukti bayar</a>}
                          {!p.adaKarya && !p.karyaTautan && !p.adaBukti && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${st.gaya}`}>{st.label}{p.status === "JUARA" && p.juara ? ` · ${p.juara}` : ""}</span>
                        {p.catatanPanitia && <p className="mt-0.5 text-xs text-gray-400">{p.catatanPanitia}</p>}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button type="button" title="Ubah status" onClick={() => { setUbah(p); setIsi({ status: p.status, juara: p.juara ?? "", catatanPanitia: p.catatanPanitia ?? "" }); }}
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button type="button" title="Hapus" onClick={() => hapus(p)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
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

    </Modal>
      <Modal open={!!ubah} onClose={() => !sibuk && setUbah(null)} title="Status Pendaftaran" description={ubah?.namaPeserta}
        footer={<>
          <button type="button" onClick={() => setUbah(null)} disabled={sibuk} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpan} disabled={sibuk} className="btn-modal-save flex-1">{sibuk && <Loader2 size={16} className="animate-spin" />} Simpan</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Status</label>
            <Select value={isi.status} onChange={v => setIsi(s => ({ ...s, status: v }))}
              options={STATUS_DAFTAR.map(s => ({ value: s, label: STATUS_DAFTAR_INFO[s].label }))} />
          </div>
          {isi.status === "JUARA" && (
            <div>
              <label className="label-field">Peringkat *</label>
              <input value={isi.juara} onChange={e => setIsi(s => ({ ...s, juara: e.target.value }))} className="input-field" placeholder="Cth: Juara 1, Harapan 2" />
            </div>
          )}
          <div>
            <label className="label-field">Catatan Panitia</label>
            <textarea rows={3} value={isi.catatanPanitia} onChange={e => setIsi(s => ({ ...s, catatanPanitia: e.target.value }))} className="input-field"
              placeholder="Tampil ke siswa di menu Lomba & Event (mis. alasan ditolak)" />
          </div>
        </div>
      </Modal>
    </>
  );
}

