"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Check, Download, Loader2, Plus, QrCode, Search, Trash2, UserCheck, Users, X } from "lucide-react";
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
interface Kegiatan { id: string; judul: string; jenis: string; tempat: string | null; mulai: string; selesai: string; targetRole: string; pembuatNama: string; jumlahHadir: number; milikSaya: boolean; statusPersetujuan: string; catatanPersetujuan: string | null; pemutusNama: string | null }
interface Data { semua: boolean; wali: boolean; bolehMemutus: boolean; kelas: Opsi[]; jurusan: Opsi[]; jabatan: string[]; daftar: Kegiatan[] }
interface Rekap {
  kegiatan: Kegiatan & { catatan: string | null };
  hadir: { id: string; userId: string; nama: string; peran: string; metode: string; keterangan: string | null; waktu: string; kelas: string }[];
  belum: { userId: string; nama: string; peran: string; kelas: string }[];
  jumlahSasaran: number;
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
  const [form, setForm] = useState<null | { judul: string; jenis: string; tempat: string; tMulai: string; jMulai: string; jSelesai: string; targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; catatan: string }>(null);
  const [rekap, setRekap] = useState<{ id: string; isi: Rekap | null } | null>(null);
  const [tab, setTab] = useState<"hadir" | "belum">("hadir");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/kegiatan", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const muatRekap = useCallback((id: string) => {
    fetch(`/api/kegiatan/${id}/presensi`, { cache: "no-store" }).then(r => r.json()).then(d => setRekap({ id, isi: d.kegiatan ? d : null })).catch(() => toast.error("Gagal memuat rekap."));
  }, [toast]);

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const body = { ...form, mulai: keIso(form.tMulai, form.jMulai), selesai: keIso(form.tMulai, form.jSelesai) };
    const r = await fetch("/api/kegiatan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success("Kegiatan dibuat — tampilkan QR saat acara dimulai.");
    setForm(null); muat();
  }
  async function catat(userId: string, keterangan = "") {
    if (!rekap) return;
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, keterangan }) }).catch(() => null);
    if (r?.ok) muatRekap(rekap.id); else toast.error("Gagal mencatat.");
  }
  async function hapusHadir(userId: string) {
    if (!rekap || !(await confirm("Hapus catatan hadir ini?"))) return;
    const r = await fetch(`/api/kegiatan/${rekap.id}/presensi?userId=${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) muatRekap(rekap.id); else toast.error("Gagal menghapus.");
  }

  if (rekap) {
    const r = rekap.isi;
    const q = cari.toLowerCase();
    const hadir = (r?.hadir ?? []).filter(h => !q || `${h.nama} ${h.kelas}`.toLowerCase().includes(q));
    const belum = (r?.belum ?? []).filter(h => !q || `${h.nama} ${h.kelas}`.toLowerCase().includes(q));
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<UserCheck size={22} />} title={r?.kegiatan.judul ?? "Rekap presensi"}
          description={r ? `${rentang(r.kegiatan.mulai, r.kegiatan.selesai)}${r.kegiatan.tempat ? ` · ${r.kegiatan.tempat}` : ""} · ${r.hadir.length} hadir dari ${r.jumlahSasaran} sasaran` : "Memuat…"} />
        <div className="baris-alat mb-5">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau kelas…" className="input-field pl-10" /></div>
          <div className="alat-tab flex gap-1 rounded-xl border border-gray-100 bg-white p-1">
            {([["hadir", `Hadir (${r?.hadir.length ?? 0})`], ["belum", `Belum (${r?.belum.length ?? 0})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
          <div className="alat-aksi">
            <TombolKembali onClick={() => { setRekap(null); setCari(""); muat(); }} />
            <a href={`/api/kegiatan/${rekap.id}/presensi?format=xlsx`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
            <Link href={`/layar-kegiatan/${rekap.id}`} className="btn-modal-save btn-teks"><QrCode /> Tampilkan QR</Link>
          </div>
        </div>
        {!r ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
          <div className="panel overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">#</th><th>Nama</th><th className="hidden sm:table-cell">Peran / kelas</th>{tab === "hadir" ? <><th>Jam</th><th className="text-right">Aksi</th></> : <th className="text-right">Catat</th>}</tr></thead>
              <tbody>
                {tab === "hadir" ? hadir.map((h, i) => (
                  <tr key={h.id}>
                    <td className="angka text-gray-500">{i + 1}</td>
                    <td><p className="font-medium text-primary-900">{h.nama}</p>{h.keterangan && <p className="text-xs text-amber-700">{h.keterangan}</p>}</td>
                    <td className="hidden sm:table-cell text-xs text-gray-600">{h.kelas || PERAN_AKUN[h.peran] || h.peran}</td>
                    <td className="text-xs whitespace-nowrap">{new Date(h.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}{h.metode === "MANUAL" && <span className="text-gray-400"> · manual</span>}</td>
                    <td className="text-right"><button type="button" title="Hapus" onClick={() => hapusHadir(h.userId)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button></td>
                  </tr>
                )) : belum.map((b, i) => (
                  <tr key={b.userId}>
                    <td className="angka text-gray-500">{i + 1}</td>
                    <td className="font-medium text-primary-900">{b.nama}</td>
                    <td className="hidden sm:table-cell text-xs text-gray-600">{b.kelas || b.peran}</td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" onClick={() => catat(b.userId)} className="btn-modal-save px-2.5 text-xs"><UserCheck /> Hadir</button>
                      <button type="button" onClick={() => catat(b.userId, "Izin")} className="btn-modal-cancel ml-1 px-2.5 text-xs"><X /> Izin</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(tab === "hadir" ? hadir : belum).length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">{tab === "hadir" ? "Belum ada yang hadir." : "Semua sasaran sudah hadir."}</p>}
          </div>
        )}
      </div>
    );
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
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarCheck size={22} />} title="Presensi Kegiatan" description="Rapat, upacara, pelatihan — peserta memindai QR dengan kamera HP" />
      {galat ? <EmptyState icon={CalendarCheck} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5">
            <button type="button" className="btn-modal-save" onClick={() => setForm({ judul: "", jenis: "RAPAT", tempat: "", tMulai: hariIniWib(), jMulai: "13:00", jSelesai: "15:00", targetRole: data.semua ? "TEACHER" : data.wali ? "PARENT" : "TEACHER", targetKelasIds: data.semua ? [] : data.kelas.map(k => k.id).slice(0, 1), targetJurusanIds: [], targetJabatan: [], catatan: "" })}><Plus /> Buat Kegiatan</button>
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
                        </p><p className="text-xs text-gray-500">{JENIS[k.jenis]} · {PERAN[k.targetRole] ?? k.targetRole}{k.tempat ? ` · ${k.tempat}` : ""}</p><p className="text-xs text-gray-500 md:hidden">{rentang(k.mulai, k.selesai)}</p>
                        {k.statusPersetujuan === "DITOLAK" && k.catatanPersetujuan && <p className="text-xs text-red-600">Catatan: {k.catatanPersetujuan}</p>}</td>
                      <td className="hidden md:table-cell text-xs whitespace-nowrap text-gray-600">{rentang(k.mulai, k.selesai)}</td>
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
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Kegiatan baru" size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || !form?.judul.trim()} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button></>}>
        {form && data && (
          <div className="space-y-4">
            <div><label htmlFor="judul-kegiatan" className="label-field">Nama kegiatan *</label><input id="judul-kegiatan" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Rapat dewan guru September" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={Object.entries(JENIS).map(([value, label]) => ({ value, label }))} /></div>
              <div><label htmlFor="tempat-kegiatan" className="label-field">Tempat</label><input id="tempat-kegiatan" className="input-field" maxLength={150} value={form.tempat} onChange={e => setForm({ ...form, tempat: e.target.value })} placeholder="mis. Aula" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WaktuPilih id="jam-mulai-kegiatan" label="Mulai" tanggal={form.tMulai} jam={form.jMulai} onTanggal={v => setForm({ ...form, tMulai: v })} onJam={v => setForm({ ...form, jMulai: v })} />
              <div><label htmlFor="jam-selesai-kegiatan" className="label-field">Selesai (jam, hari yang sama)</label><TimePicker value={form.jSelesai} onChange={v => setForm({ ...form, jSelesai: v })} id="jam-selesai-kegiatan" /></div>
            </div>
            <div><label className="label-field">Peserta</label>
              <Select value={form.targetRole} onChange={v => setForm({ ...form, targetRole: v })}
                options={Object.entries(PERAN).filter(([k]) => data.semua || (k === "TEACHER") || (data.wali && ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(k))).map(([value, label]) => ({ value, label }))} /></div>
            {siswaOrtu && <PilihBanyak label={data.semua ? "Kelas (kosongkan = semua)" : "Kelas *"} opsi={data.kelas.map(k => ({ value: k.id, label: k.name }))} nilai={form.targetKelasIds} onChange={v => setForm({ ...form, targetKelasIds: v })} />}
            {siswaOrtu && data.semua && <PilihBanyak label="Jurusan (kosongkan = semua)" opsi={data.jurusan.map(k => ({ value: k.id, label: k.name }))} nilai={form.targetJurusanIds} onChange={v => setForm({ ...form, targetJurusanIds: v })} />}
            {form.targetRole === "TEACHER" && <PilihBanyak label="Jabatan (kosongkan = semua guru & staf)" opsi={data.jabatan.map(j => ({ value: j, label: j }))} nilai={form.targetJabatan} onChange={v => setForm({ ...form, targetJabatan: v })} />}
            <div><label htmlFor="catatan-kegiatan" className="label-field">Catatan</label><textarea id="catatan-kegiatan" rows={2} maxLength={1000} className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
            <p className="text-xs text-gray-500">Presensi QR dibuka 30 menit sebelum mulai sampai 30 menit setelah selesai. Peserta yang tidak membawa HP bisa dicatat manual di Rekap.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
