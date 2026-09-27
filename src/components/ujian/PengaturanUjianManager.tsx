"use client";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange, CheckCircle2, Loader2, Pencil, Plus, Save, Settings2, Sparkles, Trash2, Info, KeyRound, RefreshCw,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import {
  JENIS_KEGIATAN, jenisKegiatan, namaUsulan, labelSemester, keteranganKegiatan, type KegiatanRingkas,
} from "@/lib/kegiatan-ujian";

interface Kegiatan extends KegiatanRingkas { jumlahUjian: number }
interface Usulan { judul: string; jenis: string; semester: string; tanggalMulai: string; tanggalSelesai: string; academicYearId: string }
interface MuatanKegiatan {
  daftar: Kegiatan[]; tahunAjaran: { id: string; name: string; isActive: boolean }[];
  bolehAtur: boolean; usulanKalender: Usulan[];
}
interface Form {
  jenis: string; nama: string; singkatan: string; semester: string; academicYearId: string;
  tingkat: number[]; tanggalMulai: string; tanggalSelesai: string; aktif: boolean; mekanisme: "RUANG" | "KELAS";
  /** Perputaran TOKEN BERSAMA kegiatan (menit). Inilah yang berlaku untuk token yang dibacakan ke
   *  peserta — setelan "Token berganti tiap" di tiap ujian mapel hanya dipakai bila kegiatan ini
   *  tidak memakai token bersama (temuan user 23 Sep 2026: mengisi 240 di ujian mapel tidak berpengaruh). */
  tokenOtomatisMenit: string;
}

const tglPendek = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";

/** PENGATURAN UJIAN — padanan menu "Setting" pada CBT Bimasoft.
 *
 * 1. Kegiatan Ujian: nama musim ujian (STS / SAS / SAT / PSAJ / UKK / lainnya) yang diberi proktor
 *    dan TAMPIL DI LAYAR PESERTA (permintaan user 13 September 2026). Nama & tanggalnya bisa
 *    diambil langsung dari Kalender Pendidikan supaya tidak berbeda dari kalender resmi.
 * 2. Bawaan ujian baru: durasi, pengacakan, dsb. yang otomatis terisi saat guru membuat ujian.
 * 3. Petunjuk tambahan dari sekolah untuk halaman konfirmasi peserta. */
export default function PengaturanUjianManager({ basePath }: { basePath: string }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<MuatanKegiatan | null>(null);
  const [atur, setAtur] = useState<Record<string, string>>({});
  const [bukaForm, setBukaForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [namaManual, setNamaManual] = useState(false);
  const [simpanKeg, setSimpanKeg] = useState(false);
  const [simpanAtur, setSimpanAtur] = useState(false);
  const [errForm, setErrForm] = useState("");

  const muat = useCallback(() => {
    fetch("/api/teacher/kegiatan-ujian").then(r => r.json()).then(d => { if (!d.error) setData(d); }).catch(() => {});
    fetch("/api/teacher/pengaturan-ujian").then(r => r.json()).then(d => { if (!d.error) setAtur(d); }).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);
  // Token bersama berganti sendiri (berjangka) — daftar kegiatan dimuat ulang berkala supaya token yang tampil
  // selalu yang berlaku, tanpa perlu memuat ulang halaman. Hanya daftar kegiatan; isian Pengaturan tidak ditimpa.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/teacher/kegiatan-ujian").then(r => r.json()).then(d => { if (!d.error) setData(d); }).catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  const bolehAtur = !!data?.bolehAtur;
  const tahunAktif = data?.tahunAjaran.find(t => t.isActive)?.id ?? "";

  function formBaru(isi?: Partial<Form>) {
    const jenis = isi?.jenis ?? "STS";
    const semester = isi?.semester ?? (new Date().getMonth() + 1 >= 7 ? "GANJIL" : "GENAP");
    const j = jenisKegiatan(jenis);
    setForm({
      jenis, semester, nama: namaUsulan(jenis, semester), singkatan: j.singkatan,
      academicYearId: isi?.academicYearId ?? tahunAktif, tingkat: j.tingkatLazim,
      tanggalMulai: isi?.tanggalMulai ?? "", tanggalSelesai: isi?.tanggalSelesai ?? "", aktif: true,
      // STS lazimnya di kelas masing-masing dengan pengawas guru mapel; kegiatan lain dibagi ke ruang ujian.
      mekanisme: jenis === "STS" ? "KELAS" : "RUANG",
      tokenOtomatisMenit: atur["ujian.tokenOtomatisMenit"] ?? "0",
    });
    setNamaManual(false); setEditId(null); setErrForm(""); setBukaForm(true);
  }
  function formEdit(k: Kegiatan) {
    setForm({
      jenis: k.jenis, nama: k.nama, singkatan: k.singkatan, semester: k.semester ?? "",
      academicYearId: k.academicYearId ?? "", tingkat: k.tingkat,
      tanggalMulai: k.tanggalMulai ?? "", tanggalSelesai: k.tanggalSelesai ?? "", aktif: k.aktif, mekanisme: k.mekanisme ?? "RUANG",
      tokenOtomatisMenit: String(k.tokenOtomatisMenit ?? 0),
    });
    setNamaManual(k.nama !== namaUsulan(k.jenis, k.semester)); setEditId(k.id); setErrForm(""); setBukaForm(true);
  }
  /** Ubah isian; nama & singkatan ikut menyesuaikan jenis/semester SELAMA belum diketik manual. */
  function ubahForm(patch: Partial<Form>) {
    setForm(f => {
      if (!f) return f;
      const baru = { ...f, ...patch };
      if ((patch.jenis !== undefined || patch.semester !== undefined) && !namaManual) {
        const nm = namaUsulan(baru.jenis, baru.semester);
        if (nm) baru.nama = nm;
        if (patch.jenis !== undefined) {
          baru.singkatan = jenisKegiatan(baru.jenis).singkatan || baru.singkatan;
          baru.tingkat = jenisKegiatan(baru.jenis).tingkatLazim;
        }
      }
      return baru;
    });
  }

  async function simpanKegiatan() {
    if (!form) return;
    setSimpanKeg(true); setErrForm("");
    try {
      const r = await fetch(editId ? `/api/teacher/kegiatan-ujian/${editId}` : "/api/teacher/kegiatan-ujian", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setErrForm(d.error ?? "Gagal menyimpan."); return; }
      toast.success(editId ? "Kegiatan diperbarui" : "Kegiatan ditambahkan");
      setBukaForm(false); muat();
    } catch { setErrForm("Koneksi bermasalah."); }
    finally { setSimpanKeg(false); }
  }

  /** Buat / putar / matikan TOKEN BERSAMA kegiatan — satu token untuk semua mapel di kegiatan itu
   *  (20 September 2026). Token per-ujian tetap berlaku, jadi ini selalu bisa dibatalkan. */
  async function aturToken(k: Kegiatan, aksi: "buat" | "hapus") {
    if (aksi === "hapus" && !(await confirmDialog(
      `Matikan token bersama ${k.singkatan}? Peserta kembali memakai token berbeda tiap mata pelajaran.`,
    ))) return;
    const r = await fetch(`/api/teacher/kegiatan-ujian/${k.id}/token`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok || !d) { toast.error(d?.error ?? "Gagal mengatur token kegiatan."); return; }
    setData(p => p ? { ...p, daftar: p.daftar.map(x => (x.id === k.id ? { ...x, ...d } : x)) } : p);
    toast.success(aksi === "hapus" ? "Token bersama dimatikan." : d.token ? `Token ${k.singkatan}: ${d.token}` : "Token dibuat.");
  }

  async function aturAktif(k: Kegiatan) {
    const r = await fetch(`/api/teacher/kegiatan-ujian/${k.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktif: !k.aktif }),
    }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal mengubah status."); return; }
    toast.success(k.aktif ? `"${k.singkatan}" dinonaktifkan` : `"${k.singkatan}" diaktifkan`);
    muat();
  }

  async function hapus(k: Kegiatan) {
    if (!(await confirmDialog(`Hapus kegiatan "${k.nama}"?`))) return;
    const r = await fetch(`/api/teacher/kegiatan-ujian/${k.id}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menghapus."); return; }
    toast.success("Kegiatan dihapus"); muat();
  }

  async function simpanPengaturan() {
    setSimpanAtur(true);
    try {
      const r = await fetch("/api/teacher/pengaturan-ujian", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(atur),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Gagal menyimpan."); return; }
      toast.success("Pengaturan ujian disimpan");
    } catch { toast.error("Koneksi bermasalah."); }
    finally { setSimpanAtur(false); }
  }

  // Usulan kalender yang belum dibuat (jenis + semester + tahun belum ada di daftar).
  const usulanBaru = (data?.usulanKalender ?? []).filter(u =>
    !data?.daftar.some(k => k.jenis === u.jenis && (k.semester ?? "") === (jenisKegiatan(u.jenis).perSemester ? u.semester : (k.semester ?? "")) && k.academicYearId === u.academicYearId));

  const cek = (k: string) => atur[k] === "1";
  const setCek = (k: string, v: boolean) => setAtur(a => ({ ...a, [k]: v ? "1" : "0" }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Settings2 size={22} />} title="Pengaturan Ujian"
        description="Nama kegiatan ujian yang tampil di layar peserta, bawaan ujian baru, dan petunjuk sekolah" />

      {!data ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
        <div className="space-y-5">
          {!bolehAtur && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2.5">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">Halaman ini hanya bisa dilihat. Pengaturan diubah oleh Administrator atau Wakil Kepala Kurikulum.</p>
            </div>
          )}

          {/* ——— 1. KEGIATAN UJIAN ——— */}
          <div className="page-card">
            <div className="page-card-header">
              <div>
                <h2 className="font-heading font-bold text-gray-800 text-sm flex items-center gap-2"><CalendarRange size={16} className="text-primary-700" /> Kegiatan Ujian</h2>
                <p className="text-xs text-gray-400 mt-0.5">Nama yang dilihat peserta di layar ujian — STS, SAS, PSAJ, atau lainnya.</p>
              </div>
              {bolehAtur && (
                <button onClick={() => formBaru()} className="btn-modal-save text-xs"><Plus size={14} /> Tambah Kegiatan</button>
              )}
            </div>

            {bolehAtur && usulanBaru.length > 0 && (
              <div className="px-5 py-3.5 border-b border-gray-100 bg-amber-50/50">
                <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} /> Dari Kalender Pendidikan — tinggal pakai, nama & tanggal sudah sesuai kalender
                </p>
                <div className="flex flex-wrap gap-2">
                  {usulanBaru.map((u, i) => (
                    <button key={i} onClick={() => formBaru({ jenis: u.jenis, semester: u.semester, tanggalMulai: u.tanggalMulai, tanggalSelesai: u.tanggalSelesai, academicYearId: u.academicYearId })}
                      className="text-left rounded-xl border border-amber-200 bg-white hover:bg-amber-50 px-3 py-2 transition">
                      <span className="block text-xs font-semibold text-gray-800">{namaUsulan(u.jenis, u.semester)}</span>
                      <span className="block text-xs text-gray-400">{tglPendek(u.tanggalMulai)} – {tglPendek(u.tanggalSelesai)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {data.daftar.length === 0 ? (
              <EmptyState icon={CalendarRange} title="Belum ada kegiatan ujian" description="Tambahkan kegiatan (mis. Sumatif Tengah Semester Ganjil) supaya namanya tampil di layar peserta." />
            ) : (
              <div className="overflow-x-auto scrollbar-visible">
                <table className="data-table">
                  <thead><tr>
                    <th>Kegiatan</th><th>Tahun / Semester</th><th>Peserta</th><th>Tanggal</th>
                    <th className="text-center">Ujian</th><th>Token bersama</th><th className="text-center">Status</th>{bolehAtur && <th className="text-right">Aksi</th>}
                  </tr></thead>
                  <tbody>
                    {data.daftar.map(k => (
                      <tr key={k.id} className={k.aktif ? "" : "opacity-60"}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="badge badge-navy shrink-0">{k.singkatan}</span>
                            <span className="font-semibold text-gray-800">{k.nama}</span>
                          </div>
                        </td>
                        <td className="text-gray-600 text-xs">{k.tahunAjaran ?? "—"}{labelSemester(k.semester) ? ` · ${labelSemester(k.semester)}` : ""}</td>
                        <td className="text-gray-600 text-xs">{k.tingkat.length ? k.tingkat.map(t => ({ 10: "X", 11: "XI", 12: "XII" }[t])).join(", ") : "Semua tingkat"}<span className="block text-gray-400">{k.mekanisme === "KELAS" ? "Per kelas" : "Per ruang"}</span></td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{k.tanggalMulai ? `${tglPendek(k.tanggalMulai)} – ${tglPendek(k.tanggalSelesai)}` : "—"}</td>
                        <td className="text-center">{k.jumlahUjian}</td>
                        <td>
                          {k.token ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-bold tracking-widest text-primary-900 angka">{k.token}</span>
                              {bolehAtur && (
                                <>
                                  <button onClick={() => aturToken(k, "buat")} title="Ganti token sekarang"
                                    className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><RefreshCw size={13} /></button>
                                  <button onClick={() => aturToken(k, "hapus")} title="Matikan token bersama"
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={13} /></button>
                                </>
                              )}
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                {k.tokenBerganti
                                  ? `tiap ${k.tokenOtomatisMenit} mnt · ganti ${new Date(k.tokenBerganti).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`
                                  : "tidak berganti"}
                              </span>
                            </div>
                          ) : bolehAtur ? (
                            <button onClick={() => aturToken(k, "buat")} className="btn-modal-cancel btn-teks px-2.5 text-xs">
                              <KeyRound size={13} /> Buat token
                            </button>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="text-center">
                          <button onClick={() => bolehAtur && aturAktif(k)} disabled={!bolehAtur}
                            className={`status-badge ${k.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"} ${bolehAtur ? "cursor-pointer" : "cursor-default"}`}
                            title={bolehAtur ? "Klik untuk mengubah status" : undefined}>
                            {k.aktif ? "Aktif" : "Nonaktif"}
                          </button>
                        </td>
                        {bolehAtur && (
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => formEdit(k)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => hapus(k)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
              Boleh ada lebih dari satu kegiatan aktif — misalnya PSAJ untuk kelas XII berbarengan dengan SAS untuk kelas X–XI.
              Peserta melihat kegiatan yang sesuai tingkat kelasnya; kartu ujian menampilkan kegiatan milik ujian itu sendiri.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ——— 2. BAWAAN UJIAN BARU ——— */}
            <div className="page-card">
              <div className="page-card-header">
                <div>
                  <h2 className="font-heading font-bold text-gray-800 text-sm">Bawaan Ujian Baru</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Terisi otomatis saat guru membuat ujian — tetap bisa diubah per ujian.</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Durasi (menit)</label>
                    <input type="number" min={1} value={atur["ujian.durasiBawaan"] ?? ""} disabled={!bolehAtur}
                      onChange={e => setAtur(a => ({ ...a, "ujian.durasiBawaan": e.target.value }))} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="label-field">Batas pindah tab</label>
                    <input type="number" min={0} value={atur["ujian.batasPindahTab"] ?? ""} disabled={!bolehAtur}
                      onChange={e => setAtur(a => ({ ...a, "ujian.batasPindahTab": e.target.value }))} className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">0 = hanya dicatat</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Token berganti tiap (menit)</label>
                    <input type="number" min={0} max={240} value={atur["ujian.tokenOtomatisMenit"] ?? ""} disabled={!bolehAtur}
                      onChange={e => setAtur(a => ({ ...a, "ujian.tokenOtomatisMenit": e.target.value }))} className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">0 = token tetap</p>
                  </div>
                  <div>
                    <label className="label-field">Batas putar audio</label>
                    <input type="number" min={0} value={atur["ujian.batasPutarAudio"] ?? ""} disabled={!bolehAtur}
                      onChange={e => setAtur(a => ({ ...a, "ujian.batasPutarAudio": e.target.value }))} className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">kali per soal · 0 = bebas</p>
                  </div>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3">
                  <label className="label-field">Kunci otomatis bila terputus lebih dari (menit)</label>
                  <input type="number" min={0} value={atur["ujian.kunciTerputusMenit"] ?? ""} disabled={!bolehAtur}
                    onChange={e => setAtur(a => ({ ...a, "ujian.kunciTerputusMenit": e.target.value }))} className="input-field w-28" />
                  <p className="text-xs text-purple-700/80 mt-1 leading-snug">
                    Berlaku untuk SEMUA ujian, termasuk yang sudah ada. Siswa yang keluar dari halaman ujian lebih lama dari ini
                    harus dibuka pengawas (Tindakan → Buka Kunci). 0 = tidak pernah dikunci otomatis.
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <label className="label-field" htmlFor="pin-aplikasi">PIN keluar Aplikasi Ujian (Android)</label>
                  <input id="pin-aplikasi" inputMode="numeric" maxLength={8} value={atur["ujian.pinAplikasi"] ?? ""} disabled={!bolehAtur} placeholder="mis. 2468"
                    onChange={e => setAtur(a => ({ ...a, "ujian.pinAplikasi": e.target.value.replace(/\D/g, "") }))} className="input-field w-36 tracking-widest" />
                  <p className="text-xs text-blue-700/80 mt-1 leading-snug">
                    Diminta aplikasi bila peserta ingin keluar SAAT mengerjakan ujian — beri tahu pengawas saja. Kosong = keluar cukup dengan konfirmasi.
                  </p>
                </div>
                {([
                  ["ujian.acakSoal", "Acak urutan soal per siswa"],
                  ["ujian.acakOpsi", "Acak urutan pilihan jawaban"],
                  ["ujian.satuSoalPerHalaman", "Satu soal per halaman"],
                  ["ujian.tampilkanNilai", "Siswa boleh melihat nilainya di beranda (soal & kunci tidak pernah ditampilkan)"],
                  ["ujian.izinKalkulator", "Kalkulator ilmiah di layar peserta"],
                  ["ujian.izinCoretan", "Kertas coretan digital di layar peserta"],
                ] as const).map(([k, label]) => (
                  <label key={k} className={`flex items-center gap-2.5 ${bolehAtur ? "cursor-pointer" : "cursor-default"}`}>
                    <input type="checkbox" checked={cek(k)} disabled={!bolehAtur} onChange={e => setCek(k, e.target.checked)} className="w-4 h-4 accent-[#1B2B6B]" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ——— 3. PETUNJUK TAMBAHAN ——— */}
            <div className="page-card">
              <div className="page-card-header">
                <div>
                  <h2 className="font-heading font-bold text-gray-800 text-sm">Petunjuk Tambahan untuk Peserta</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Tampil di halaman Konfirmasi, di bawah petunjuk bawaan.</p>
                </div>
              </div>
              <div className="p-5">
                <textarea value={atur["ujian.petunjukTambahan"] ?? ""} disabled={!bolehAtur} rows={7}
                  onChange={e => setAtur(a => ({ ...a, "ujian.petunjukTambahan": e.target.value }))}
                  className="input-field w-full" placeholder={"mis. Siswa wajib memakai seragam lengkap.\nHP dikumpulkan di meja pengawas sebelum ujian dimulai."} />
                <p className="text-xs text-gray-400 mt-1">Satu petunjuk per baris.</p>
              </div>
            </div>
          </div>

          {bolehAtur && (
            <div className="alat-aksi alat-teks justify-end">
              <button onClick={simpanPengaturan} disabled={simpanAtur} className="btn-modal-save">
                {simpanAtur ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Pengaturan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ——— formulir kegiatan ——— */}
      <Modal open={bukaForm && !!form} onClose={() => setBukaForm(false)} size="lg" scrollBody
        title={editId ? "Edit Kegiatan Ujian" : "Tambah Kegiatan Ujian"} description="Nama ini tampil di layar peserta ujian"
        footer={<>
          <button type="button" onClick={() => setBukaForm(false)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpanKegiatan} disabled={simpanKeg} className="btn-modal-save flex-1">
            {simpanKeg ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-3.5">
            {errForm && <p className="error-msg">{errForm}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Jenis</label>
                <Select value={form.jenis} onChange={v => ubahForm({ jenis: v })}
                  options={JENIS_KEGIATAN.map(j => ({ value: j.value, label: j.nama ? `${j.singkatan} — ${j.nama}` : "Lainnya (tulis sendiri)" }))} />
              </div>
              <div>
                <label className="label-field">Semester</label>
                <Select value={form.semester} onChange={v => ubahForm({ semester: v })}
                  options={[{ value: "GANJIL", label: "Ganjil" }, { value: "GENAP", label: "Genap" }, { value: "", label: "Tidak per semester" }]} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <div>
                <label className="label-field">Nama kegiatan</label>
                <input value={form.nama} onChange={e => { setNamaManual(true); ubahForm({ nama: e.target.value }); }} className="input-field w-full" placeholder="Sumatif Tengah Semester Ganjil" />
              </div>
              <div>
                <label className="label-field">Singkatan</label>
                <input value={form.singkatan} onChange={e => ubahForm({ singkatan: e.target.value.toUpperCase() })} maxLength={12} className="input-field w-full font-semibold" placeholder="STS" />
              </div>
            </div>
            <div>
              <label className="label-field">Tahun ajaran</label>
              <Select value={form.academicYearId} onChange={v => ubahForm({ academicYearId: v })} placeholder="Pilih tahun ajaran"
                options={(data?.tahunAjaran ?? []).map(t => ({ value: t.id, label: `${t.name}${t.isActive ? " (aktif)" : ""}` }))} />
            </div>
            <div>
              <label className="label-field">Tingkat peserta <span className="text-gray-400 font-normal">— kosongkan semua = seluruh tingkat</span></label>
              <div className="flex gap-2">
                {[10, 11, 12].map(t => {
                  const on = form.tingkat.includes(t);
                  return (
                    <button key={t} type="button" onClick={() => ubahForm({ tingkat: on ? form.tingkat.filter(x => x !== t) : [...form.tingkat, t].sort() })}
                      className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${on ? "bg-primary-700 text-white border-primary-700" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                      Kelas {({ 10: "X", 11: "XI", 12: "XII" } as Record<number, string>)[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label-field">Cara pelaksanaan</label>
              <Select value={form.mekanisme} onChange={v => ubahForm({ mekanisme: v === "KELAS" ? "KELAS" : "RUANG" })}
                options={[
                  { value: "KELAS", label: "Per kelas — di kelas masing-masing, pengawas guru mapel" },
                  { value: "RUANG", label: "Per ruang — peserta dibagi ke ruang ujian (denah)" },
                ]} />
              <p className="text-xs text-gray-400 mt-1">
                {form.mekanisme === "KELAS"
                  ? "Tiap ujian bisa diberi jam berbeda per kelas; pengawas otomatis guru pengampu mapel itu (bisa diganti di Pengawas)."
                  : "Peserta dibagi ke ruang & sesi lewat Denah Ruang; pengawas dibagi per ruang × sesi."}
              </p>
            </div>
            <div>
              <label className="label-field">Token bersama berganti tiap (menit)</label>
              <input type="number" min={0} max={240} value={form.tokenOtomatisMenit}
                onChange={e => ubahForm({ tokenOtomatisMenit: e.target.value })} className="input-field w-full" />
              <p className="text-xs text-gray-400 mt-1">
                0 = tetap, maksimum 240 menit. <span className="text-gray-500">Inilah yang berlaku untuk token yang dibacakan
                ke peserta</span> — setelan &quot;Token berganti tiap&quot; di tiap ujian mapel hanya dipakai bila kegiatan ini
                tidak memakai token bersama.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label-field">Tanggal mulai</label><DatePicker value={form.tanggalMulai} onChange={v => ubahForm({ tanggalMulai: v })} /></div>
              <div><label className="label-field">Tanggal selesai</label><DatePicker value={form.tanggalSelesai} onChange={v => ubahForm({ tanggalSelesai: v })} /></div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.aktif} onChange={e => ubahForm({ aktif: e.target.checked })} className="w-4 h-4 accent-[#1B2B6B]" />
              <span className="text-sm text-gray-700">Aktif — tampil di layar peserta</span>
            </label>

            {/* pratinjau kepala layar peserta */}
            <div>
              <p className="label-field">Pratinjau di layar peserta</p>
              <div className="relative overflow-hidden rounded-xl text-center px-4 py-5" style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", filter: "invert(1)" }} />
                <p className="relative font-heading font-bold text-white text-base uppercase tracking-[0.12em] leading-snug">{form.nama || "Nama Kegiatan"}</p>
                <div className="relative mx-auto mt-1.5 h-[3px] w-16 rounded-full" style={{ background: "linear-gradient(90deg, transparent 0%, #F5C842 50%, transparent 100%)" }} />
                <p className="relative text-gold text-xs font-heading font-semibold uppercase tracking-[0.1em] mt-1.5">
                  {keteranganKegiatan({ semester: form.semester || null, tahunAjaran: data?.tahunAjaran.find(t => t.id === form.academicYearId)?.name ?? null }) || "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
