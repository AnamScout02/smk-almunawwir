"use client";
import TimePicker from "@/components/shared/TimePicker";
import DatePicker from "@/components/shared/DatePicker";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Check, Download, Loader2, Pencil, Plus, QrCode, Search, Trash2, UserCheck, Users, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import PilihBanyak from "@/components/shared/PilihBanyak";
import { WaktuPilih, hariIniWib, keIso, rentang } from "@/components/sarpras/sarpras-umum";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import TombolKembali from "@/components/shared/TombolKembali";

interface Opsi { id: string; name: string }
interface Kegiatan { id: string; judul: string; jenis: string; tempat: string | null; mulai: string; selesai: string; sampaiTanggal: string | null; targetRole: string; targetKelasIds?: string[]; targetJurusanIds?: string[]; targetJabatan?: string[]; targetUserIds?: string[]; catatan?: string | null; pembuatNama: string; jumlahHadir: number; milikSaya: boolean; statusPersetujuan: string; catatanPersetujuan: string | null; pemutusNama: string | null }
interface Orang { id: string; nama: string; ket: string }
interface Data { semua: boolean; wali: boolean; bolehMemutus: boolean; kelas: Opsi[]; jurusan: Opsi[]; jabatan: string[]; orang: Orang[]; daftar: Kegiatan[] }
interface Rekap {
  kegiatan: Kegiatan & { catatan: string | null };
  hadir: { id: string; userId: string; nama: string; peran: string; metode: string; keterangan: string | null; waktu: string; kelas: string }[];
  belum: { userId: string; nama: string; peran: string; kelas: string }[];
  jumlahSasaran: number;
  /** Semua tanggal WIB yang dicakup kegiatan; satu hari = satu entri. */
  hari: string[];
  /** Hari yang sedang ditampilkan. */
  tanggal: string;
}

/** Nama kelompok sebuah peserta: siswa & orang tua dikelompokkan per KELAS, guru/staf/admin jadi satu
 *  kelompok. Dipakai di daftar hadir maupun belum hadir supaya panitia bisa memeriksa per rombongan
 *  (permintaan user 30 September 2026). */
const kelompokDari = (p: { peran: string; kelas: string }) =>
  p.kelas || (p.peran === "STUDENT" || p.peran === "PARENT" ? "Tanpa kelas" : "Guru & Staf");

/** Kelompokkan lalu urutkan: kelas menurut nama (numerik), "Guru & Staf" paling akhir. */
function kelompokkan<T extends { peran: string; kelas: string }>(daftar: T[]): [string, T[]][] {
  const peta = new Map<string, T[]>();
  for (const x of daftar) {
    const k = kelompokDari(x);
    (peta.get(k) ?? peta.set(k, []).get(k)!).push(x);
  }
  return [...peta.entries()].sort(([a], [b]) => {
    const akhir = (n: string) => (n === "Guru & Staf" ? 1 : n === "Tanpa kelas" ? 2 : 0);
    return akhir(a) - akhir(b) || a.localeCompare(b, "id", { numeric: true });
  });
}

/** Tanggal WIB (YYYY-MM-DD) dari sebuah instan — dipakai saat mengisi ulang formulir. */
const isoWibKlien = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

const hariPendek = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "30 Sep – 4 Okt" untuk kegiatan berhari-hari; satu hari cukup `rentang()` biasa. */
function labelWaktu(k: { mulai: string; selesai: string; sampaiTanggal: string | null }) {
  const dasar = rentang(k.mulai, k.selesai);
  if (!k.sampaiTanggal) return dasar;
  const akhir = new Date(k.sampaiTanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${dasar} · s.d. ${akhir}`;
}
const JENIS: Record<string, string> = { RAPAT: "Rapat", KEGIATAN: "Kegiatan", UPACARA: "Upacara", PELATIHAN: "Pelatihan / workshop" };
const PERAN: Record<string, string> = { TEACHER: "Guru & staf", STUDENT: "Siswa", PARENT: "Orang tua", STUDENT_PARENT: "Siswa & orang tua", ALL: "Semua pengguna" };
const PERAN_AKUN: Record<string, string> = { TEACHER: "Guru", TAS: "Staf", STUDENT: "Siswa", PARENT: "Orang tua", ADMIN: "Admin" };

/** PRESENSI KEGIATAN (17 Sep 2026) — buat kegiatan, tampilkan QR berganti, rekap hadir/belum hadir, catat manual, unduh. */
export default function KegiatanManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<null | { judul: string; jenis: string; tempat: string; tMulai: string; tSampai: string; jMulai: string; jSelesai: string; targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; targetUserIds: string[]; catatan: string }>(null);
  /** Id kegiatan yang sedang diubah; null = sedang membuat yang baru. */
  const [ubahId, setUbahId] = useState<string | null>(null);
  const [rekap, setRekap] = useState<{ id: string; isi: Rekap | null } | null>(null);
  const [tab, setTab] = useState<"hadir" | "belum">("hadir");
  /** Hari yang sedang dilihat di rekap (kegiatan berhari-hari). Kosong = biarkan server memilih. */
  const [hariRekap, setHariRekap] = useState("");
  /** Baris hadir yang sedang disunting keterangannya (hadir biasa / izin / sakit / terlambat). */
  const [sunting, setSunting] = useState<null | { userId: string; nama: string; keterangan: string }>(null);
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/kegiatan", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const muatRekap = useCallback((id: string, tanggal = "") => {
    fetch(`/api/kegiatan/${id}/presensi${tanggal ? `?tanggal=${tanggal}` : ""}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setRekap({ id, isi: d.kegiatan ? d : null }); if (d.tanggal) setHariRekap(d.tanggal); })
      .catch(() => toast.error("Gagal memuat rekap."));
  }, [toast]);

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    // Jam harian diambil dari hari PERTAMA; `sampaiTanggal` hanya dikirim kalau benar-benar
    // berhari-hari, supaya kegiatan satu hari tetap tersimpan tanpa rentang (perilaku lama).
    const body = {
      ...form,
      mulai: keIso(form.tMulai, form.jMulai),
      selesai: keIso(form.tMulai, form.jSelesai),
      sampaiTanggal: form.tSampai && form.tSampai > form.tMulai ? form.tSampai : "",
    };
    const r = await fetch(ubahId ? `/api/kegiatan/${ubahId}` : "/api/kegiatan", {
      method: ubahId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(ubahId ? "Perubahan kegiatan tersimpan." : "Kegiatan dibuat — tampilkan QR saat acara dimulai.");
    setForm(null); setUbahId(null); muat();
  }
  async function catat(userId: string, keterangan = "") {
    if (!rekap) return;
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, keterangan, tanggal: hariRekap }) }).catch(() => null);
    if (r?.ok) muatRekap(rekap.id, hariRekap); else toast.error("Gagal mencatat.");
  }
  /** Ubah keterangan catatan hadir yang sudah ada. POST-nya upsert, jadi jalur simpannya sama
   *  dengan mencatat manual — yang berubah hanya kolom keterangan. */
  async function simpanSuntingan() {
    if (!rekap || !sunting) return;
    setSibuk(true);
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: sunting.userId, keterangan: sunting.keterangan, tanggal: hariRekap }),
    }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyimpan perubahan."); return; }
    toast.success("Catatan kehadiran diperbarui.");
    setSunting(null);
    muatRekap(rekap.id, hariRekap);
  }

  /** Tandai hadir SATU KELOMPOK sekaligus (satu kelas, atau seluruh guru & staf). */
  async function catatKelompok(nama: string, userIds: string[]) {
    if (!rekap || !userIds.length) return;
    if (!(await confirm(`Tandai HADIR ${userIds.length} orang di ${nama}? Yang benar-benar tidak datang bisa dihapus lagi satu per satu.`))) return;
    setSibuk(true);
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds, tanggal: hariRekap }),
    }).catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(`${userIds.length} orang di ${nama} tercatat hadir.`); muatRekap(rekap.id, hariRekap); }
    else toast.error("Gagal mencatat.");
  }
  async function hapusHadir(userId: string) {
    if (!rekap || !(await confirm("Hapus catatan hadir ini?"))) return;
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi?userId=${encodeURIComponent(userId)}&tanggal=${hariRekap}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) muatRekap(rekap.id, hariRekap); else toast.error("Gagal menghapus.");
  }

  if (rekap) {
    const r = rekap.isi;
    const q = cari.toLowerCase();
    const hadir = (r?.hadir ?? []).filter(h => !q || `${h.nama} ${h.kelas}`.toLowerCase().includes(q));
    const belum = (r?.belum ?? []).filter(h => !q || `${h.nama} ${h.kelas}`.toLowerCase().includes(q));
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<UserCheck size={22} />} title={r?.kegiatan.judul ?? "Rekap presensi"}
          description={r ? `${labelWaktu(r.kegiatan)}${r.kegiatan.tempat ? ` · ${r.kegiatan.tempat}` : ""} · ${r.hadir.length} hadir dari ${r.jumlahSasaran} sasaran` : "Memuat…"} />
        {r && r.hari.length > 1 && (
          <div className="baris-alat mb-5">
            <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
              {r.hari.map((h, i) => (
                <button key={h} type="button" onClick={() => muatRekap(rekap.id, h)}
                  className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${h === r.tanggal ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  Hari {i + 1} <span className="font-normal opacity-80">· {hariPendek(h)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="baris-alat mb-5">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau kelas…" className="input-field pl-10" /></div>
          <div className="alat-tab flex gap-1 rounded-xl border border-gray-100 bg-white p-1">
            {([["hadir", `Hadir (${r?.hadir.length ?? 0})`], ["belum", `Belum (${r?.belum.length ?? 0})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
          <div className="alat-aksi">
            <TombolKembali onClick={() => { setRekap(null); setCari(""); muat(); }} />
            <a href={`/api/kegiatan/${rekap.id}/presensi?format=xlsx&tanggal=${hariRekap}`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
            <Link href={`/layar-kegiatan/${rekap.id}`} className="btn-modal-save btn-teks"><QrCode /> Tampilkan QR</Link>
          </div>
        </div>
        {!r ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (() => {
          // Dikelompokkan per KELAS (siswa/orang tua) dan satu kelompok "Guru & Staf", supaya panitia
          // memeriksa per rombongan — bukan satu daftar panjang bercampur.
          const semuaHadir = r.hadir, semuaBelum = r.belum;
          const grup = tab === "hadir" ? kelompokkan(hadir) : kelompokkan(belum);
          const jumlahHadirGrup = (n: string) => semuaHadir.filter(x => kelompokDari(x) === n).length;
          const jumlahSasaranGrup = (n: string) =>
            jumlahHadirGrup(n) + semuaBelum.filter(x => kelompokDari(x) === n).length;
          if (grup.length === 0) {
            return <p className="py-10 text-center text-sm text-gray-400">{tab === "hadir" ? "Belum ada yang hadir." : "Semua sasaran sudah hadir."}</p>;
          }
          return (
            <div className="space-y-4">
              {grup.map(([nama, baris]) => (
                <div key={nama} className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-[#f5f6fa] px-4 py-2.5">
                    <p className="min-w-0 flex-1 font-heading text-sm font-semibold text-primary-900">{nama}</p>
                    <span className="angka status-badge border-gray-200 bg-white text-gray-600">
                      {jumlahHadirGrup(nama)} / {jumlahSasaranGrup(nama)} hadir
                    </span>
                    {tab === "belum" && (
                      <button type="button" disabled={sibuk} onClick={() => catatKelompok(nama, baris.map(b => b.userId))}
                        className="btn-modal-save btn-teks px-3 text-xs">
                        <UserCheck /> Hadir semua ({baris.length})
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th className="w-10">#</th><th>Nama</th><th className="hidden sm:table-cell">Peran</th>{tab === "hadir" ? <><th>Jam</th><th className="text-right">Aksi</th></> : <th className="text-right">Catat</th>}</tr></thead>
                      <tbody>
                        {tab === "hadir" ? (baris as typeof hadir).map((h, i) => (
                          <tr key={h.id}>
                            <td className="angka text-gray-500">{i + 1}</td>
                            <td><p className="font-medium text-primary-900">{h.nama}</p>{h.keterangan && <p className="text-xs text-amber-700">{h.keterangan}</p>}</td>
                            <td className="hidden sm:table-cell text-xs text-gray-600">{PERAN_AKUN[h.peran] || h.peran}</td>
                            <td className="text-xs whitespace-nowrap">{new Date(h.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}{h.metode === "MANUAL" && <span className="text-gray-400"> · manual</span>}</td>
                            <td className="whitespace-nowrap text-right">
                              <button type="button" title="Ubah keterangan" onClick={() => setSunting({ userId: h.userId, nama: h.nama, keterangan: h.keterangan ?? "" })}
                                className="rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Pencil size={14} /></button>
                              <button type="button" title="Hapus" onClick={() => hapusHadir(h.userId)} className="ml-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        )) : (baris as typeof belum).map((b, i) => (
                          <tr key={b.userId}>
                            <td className="angka text-gray-500">{i + 1}</td>
                            <td className="font-medium text-primary-900">{b.nama}</td>
                            <td className="hidden sm:table-cell text-xs text-gray-600">{PERAN_AKUN[b.peran] || b.peran}</td>
                            <td className="text-right whitespace-nowrap">
                              <button type="button" onClick={() => catat(b.userId)} className="btn-modal-save px-2.5 text-xs"><UserCheck /> Hadir</button>
                              <button type="button" onClick={() => catat(b.userId, "Izin")} className="btn-modal-cancel ml-1 px-2.5 text-xs"><X /> Izin</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        <Modal open={!!sunting} onClose={() => setSunting(null)} title="Ubah catatan kehadiran"
          footer={<>
            <button type="button" onClick={() => setSunting(null)} className="btn-modal-cancel">Batal</button>
            <button type="button" disabled={sibuk} onClick={simpanSuntingan} className="btn-modal-save">
              {sibuk ? <Loader2 className="animate-spin" /> : <Check />} Simpan
            </button>
          </>}>
          {sunting && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600"><span className="font-semibold text-primary-900">{sunting.nama}</span> — {hariPendek(hariRekap)}</p>
              <div>
                <label className="label-field">Keterangan</label>
                <input value={sunting.keterangan} onChange={e => setSunting({ ...sunting, keterangan: e.target.value })}
                  placeholder="Kosongkan kalau hadir biasa" className="input-field" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["", "Izin", "Sakit", "Terlambat", "Dispensasi"].map(k => (
                    <button key={k || "kosong"} type="button" onClick={() => setSunting({ ...sunting, keterangan: k })}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${sunting.keterangan === k ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                      {k || "Hadir biasa"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Orang ini tetap terhitung HADIR. Kalau sebenarnya tidak datang, hapus catatannya lewat tombol tempat sampah —
                namanya akan kembali ke daftar Belum Hadir.
              </p>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  /** Buka formulir berisi data kegiatan yang sudah ada. Jam diambil dari hari pertama; `sampaiTanggal`
   *  kosong berarti kegiatan satu hari. Daftar sasaran dibaca apa adanya dari baris. */
  function mulaiUbah(k: Kegiatan) {
    const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":");
    setUbahId(k.id);
    setForm({
      judul: k.judul, jenis: k.jenis, tempat: k.tempat ?? "",
      tMulai: isoWibKlien(k.mulai),
      tSampai: k.sampaiTanggal ? k.sampaiTanggal.slice(0, 10) : "",
      jMulai: jam(k.mulai), jSelesai: jam(k.selesai),
      targetRole: k.targetRole,
      targetKelasIds: k.targetKelasIds ?? [], targetJurusanIds: k.targetJurusanIds ?? [],
      targetJabatan: k.targetJabatan ?? [], targetUserIds: k.targetUserIds ?? [],
      catatan: k.catatan ?? "",
    });
  }

  /** Keputusan atas usulan kegiatan (18 Sep 2026) — hanya tampil untuk pemegang hak pengumuman. */
  async function putuskan(k: Kegiatan, setuju: boolean) {
    if (!setuju && !(await confirm(`Tolak usulan kegiatan "${k.judul}"?`))) return;
    const catatan = "";
    const r = await fetch(`/api/kegiatan/${k.id}/putuskan`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setuju, catatan }),
    }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menyimpan keputusan."); return; }
    toast.success(setuju ? "Kegiatan disetujui." : "Kegiatan ditolak.");
    muat();
  }

  const siswaOrtu = form && ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(form.targetRole);
  /** Panitia memilih orang satu per satu → saringan peran/kelas/jabatan tidak berlaku lagi. */
  const pilihOrang = !!form && form.targetUserIds.length > 0;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarCheck size={22} />} title="Presensi Kegiatan" description="Rapat, upacara, pelatihan — peserta memindai QR dengan kamera HP" />
      {galat ? <EmptyState icon={CalendarCheck} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5">
            <button type="button" className="btn-modal-save" onClick={() => { setUbahId(null); setForm({ judul: "", jenis: "RAPAT", tempat: "", tMulai: hariIniWib(), tSampai: "", jMulai: "13:00", jSelesai: "15:00", targetRole: data.semua ? "TEACHER" : data.wali ? "PARENT" : "TEACHER", targetKelasIds: data.semua ? [] : data.kelas.map(k => k.id).slice(0, 1), targetJurusanIds: [], targetJabatan: [], targetUserIds: [], catatan: "" }); }}><Plus /> Buat Kegiatan</button>
          </div>
          {data.daftar.length === 0 ? <EmptyState icon={CalendarCheck} title="Belum ada kegiatan" description="Buat kegiatan, lalu tampilkan QR di layar/proyektor saat acara berlangsung." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Kegiatan</th><th className="hidden md:table-cell">Waktu</th><th className="text-center">Hadir</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {data.daftar.map(k => (
                    <tr key={k.id}>
                      <td className="min-w-[12rem]">
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-primary-900">
                          {k.judul}
                          {k.statusPersetujuan === "DIAJUKAN" && <span className="status-badge border-amber-200 bg-amber-50 text-amber-700">Menunggu persetujuan</span>}
                          {k.statusPersetujuan === "DITOLAK" && <span className="status-badge border-red-200 bg-red-50 text-red-600">Ditolak</span>}
                        </p><p className="text-xs text-gray-500">{JENIS[k.jenis]} · {PERAN[k.targetRole] ?? k.targetRole}{k.tempat ? ` · ${k.tempat}` : ""}</p><p className="text-xs text-gray-500 md:hidden">{labelWaktu(k)}</p>
                        {k.statusPersetujuan === "DITOLAK" && k.catatanPersetujuan && <p className="text-xs text-red-600">Catatan: {k.catatanPersetujuan}</p>}</td>
                      <td className="hidden md:table-cell text-xs whitespace-nowrap text-gray-600">{labelWaktu(k)}</td>
                      <td className="angka text-center">{k.jumlahHadir}</td>
                      <td className="text-right whitespace-nowrap">
                        {data.bolehMemutus && k.statusPersetujuan === "DIAJUKAN" && (
                          <>
                            <button type="button" onClick={() => putuskan(k, true)} className="btn-modal-save px-2.5 text-xs"><Check /> Setujui</button>
                            <button type="button" onClick={() => putuskan(k, false)} className="btn-modal-cancel ml-1 px-2.5 text-xs"><X /> Tolak</button>
                          </>
                        )}
                        {k.statusPersetujuan !== "DIAJUKAN" && <Link href={`/layar-kegiatan/${k.id}`} className="btn-modal-save px-2.5 text-xs"><QrCode /> QR</Link>}
                        <button type="button" onClick={() => { setTab("hadir"); setRekap({ id: k.id, isi: null }); muatRekap(k.id); }} className="btn-modal-cancel ml-1 px-2.5 text-xs"><Users /> Rekap</button>
                        <button type="button" title="Ubah kegiatan" onClick={() => mulaiUbah(k)}
                          className="ml-1 rounded-lg p-1.5 text-primary-700 transition-colors hover:bg-primary-50"><Pencil size={14} /></button>
                        <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus kegiatan "${k.judul}" beserta presensinya?`)) { const r = await fetch(`/api/kegiatan/${k.id}`, { method: "DELETE" }).catch(() => null); if (r?.ok) muat(); else toast.error("Gagal menghapus."); } }}
                          className="ml-1 p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Modal open={!!form} onClose={() => { if (!sibuk) { setForm(null); setUbahId(null); } }} title={ubahId ? "Ubah kegiatan" : "Kegiatan baru"} size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || !form?.judul.trim() || (!!form?.tSampai && form.tSampai < form.tMulai)} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button></>}>
        {form && data && (
          <div className="space-y-4">
            <div><label htmlFor="judul-kegiatan" className="label-field">Nama kegiatan *</label><input id="judul-kegiatan" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Rapat dewan guru September" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={Object.entries(JENIS).map(([value, label]) => ({ value, label }))} /></div>
              <div><label htmlFor="tempat-kegiatan" className="label-field">Tempat</label><input id="tempat-kegiatan" className="input-field" maxLength={150} value={form.tempat} onChange={e => setForm({ ...form, tempat: e.target.value })} placeholder="mis. Aula" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WaktuPilih id="jam-mulai-kegiatan" label="Mulai" tanggal={form.tMulai} jam={form.jMulai} onTanggal={v => setForm({ ...form, tMulai: v })} onJam={v => setForm({ ...form, jMulai: v })} />
              <div><label htmlFor="jam-selesai-kegiatan" className="label-field">Selesai (jam)</label><TimePicker value={form.jSelesai} onChange={v => setForm({ ...form, jSelesai: v })} id="jam-selesai-kegiatan" /></div>
              {/* Kegiatan berhari-hari (mis. MPLS): jam hariannya sama, yang berubah hanya tanggalnya.
                  Kosong / sama dengan tanggal mulai = kegiatan satu hari. */}
              <div className="sm:col-span-2">
                <label className="label-field">Sampai tanggal (kosongkan kalau satu hari)</label>
                <DatePicker value={form.tSampai} onChange={v => setForm({ ...form, tSampai: v })} />
                {form.tSampai && form.tSampai > form.tMulai && (
                  <p className="mt-1 text-xs text-gray-500">
                    {Math.round((Date.parse(`${form.tSampai}T00:00:00Z`) - Date.parse(`${form.tMulai}T00:00:00Z`)) / 86400000) + 1} hari,
                    tiap hari pukul {form.jMulai}–{form.jSelesai}. Presensi diulang setiap hari.
                  </p>
                )}
                {form.tSampai && form.tSampai < form.tMulai && (
                  <p className="mt-1 text-xs text-red-600">Tanggal selesai tidak boleh sebelum tanggal mulai.</p>
                )}
              </div>
            </div>
            <div><label className="label-field">Peserta</label>
              <Select value={form.targetRole} onChange={v => setForm({ ...form, targetRole: v })}
                options={Object.entries(PERAN).filter(([k]) => data.semua || (k === "TEACHER") || (data.wali && ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(k))).map(([value, label]) => ({ value, label }))} /></div>
            {/* ORANG TERTENTU menang atas saringan peran/kelas/jabatan — dipakai saat yang ikut bukan
                satu kelas utuh (panitia, perwakilan kelas). Saringan di bawahnya dinonaktifkan supaya
                tidak ada dua aturan yang tampak berlaku bersamaan. */}
            <PilihBanyak label="Orang tertentu (kosongkan kalau pakai sasaran di bawah)"
              opsi={data.orang.map(o => ({ value: o.id, label: `${o.nama} — ${o.ket}` }))}
              nilai={form.targetUserIds} onChange={v => setForm({ ...form, targetUserIds: v })} />
            {pilihOrang ? (
              <p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-900">
                Peserta kegiatan ini <span className="font-semibold">persis {form.targetUserIds.length} orang</span> yang dipilih di atas.
                Sasaran peran/kelas/jabatan diabaikan — kosongkan pilihan orang kalau ingin memakai sasaran.
              </p>
            ) : (<>
              {siswaOrtu && <PilihBanyak label={data.semua ? "Kelas (kosongkan = semua)" : "Kelas *"} opsi={data.kelas.map(k => ({ value: k.id, label: k.name }))} nilai={form.targetKelasIds} onChange={v => setForm({ ...form, targetKelasIds: v })} />}
              {siswaOrtu && data.semua && <PilihBanyak label="Jurusan (kosongkan = semua)" opsi={data.jurusan.map(k => ({ value: k.id, label: k.name }))} nilai={form.targetJurusanIds} onChange={v => setForm({ ...form, targetJurusanIds: v })} />}
              {form.targetRole === "TEACHER" && <PilihBanyak label="Jabatan (kosongkan = semua guru & staf)" opsi={data.jabatan.map(j => ({ value: j, label: j }))} nilai={form.targetJabatan} onChange={v => setForm({ ...form, targetJabatan: v })} />}
            </>)}
            <div><label htmlFor="catatan-kegiatan" className="label-field">Catatan</label><textarea id="catatan-kegiatan" rows={2} maxLength={1000} className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
            <p className="text-xs text-gray-500">Presensi QR dibuka 30 menit sebelum mulai sampai 30 menit setelah selesai, berlaku untuk SETIAP hari kegiatan. Peserta yang tidak membawa HP bisa dicatat manual di Rekap.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
