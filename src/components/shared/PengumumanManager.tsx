"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import PilihBanyak from "@/components/shared/PilihBanyak";
import { useToast } from "@/components/shared/ToastProvider";

interface Pengumuman {
  id: string; title: string; content: string; targetRole: string; priority: string; active: boolean;
  startDate: string; endDate: string | null; createdAt: string;
  targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[];
  wajibKonfirmasi: boolean; pembuatNama: string | null; jumlahDibaca: number; milikSaya: boolean;
}
interface Opsi { id: string; name: string }
interface Data { semua: boolean; kelas: Opsi[]; jurusan: Opsi[]; jabatan: string[]; daftar: Pengumuman[] }
interface Pembaca { judul: string; total: number; dibaca: number; baris: { nama: string; peran: string; keterangan: string; dibacaAt: string | null }[] }

const PERAN: Record<string, string> = {
  ALL: "Semua pengguna", STUDENT: "Siswa", PARENT: "Orang tua", STUDENT_PARENT: "Siswa & orang tua", TEACHER: "Guru & staf", ADMIN: "Admin",
};
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const kosong = () => ({
  title: "", content: "", targetRole: "ALL", priority: "NORMAL", active: true, startDate: hariIni(), endDate: "",
  targetKelasIds: [] as string[], targetJurusanIds: [] as string[], targetJabatan: [] as string[], wajibKonfirmasi: false, kirimNotifikasi: true,
});
const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** PENGELOLA PENGUMUMAN (17 Sep 2026) — Admin/TU & pimpinan: semua sasaran; wali kelas: siswa & orang tua kelas walinya.
 * Sasaran rinci per kelas/jurusan/jabatan, notifikasi ke kotak masuk, konfirmasi baca + statistik pembaca. */
export default function PengumumanManager({ kotakHref }: { kotakHref?: string }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState(false);
  const [edit, setEdit] = useState<Pengumuman | null>(null);
  const [form, setForm] = useState(kosong());
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pembaca, setPembaca] = useState<Pembaca | null>(null);
  const [saringBaca, setSaringBaca] = useState("BELUM");

  const muat = useCallback(() => {
    fetch("/api/pengumuman/kelola", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const namaKelas = useMemo(() => new Map((data?.kelas ?? []).map(k => [k.id, k.name])), [data]);
  const namaJurusan = useMemo(() => new Map((data?.jurusan ?? []).map(k => [k.id, k.name.split(" — ")[0]])), [data]);

  function bukaBaru() {
    const f = kosong();
    if (data && !data.semua) { f.targetRole = "STUDENT_PARENT"; f.targetKelasIds = data.kelas.length === 1 ? [data.kelas[0].id] : []; }
    setForm(f); setEdit(null); setPesan(""); setBuka(true);
  }
  function bukaUbah(a: Pengumuman) {
    setForm({
      title: a.title, content: a.content, targetRole: a.targetRole, priority: a.priority, active: a.active,
      startDate: tglWib(a.startDate), endDate: a.endDate ? tglWib(a.endDate) : "",
      targetKelasIds: a.targetKelasIds, targetJurusanIds: a.targetJurusanIds, targetJabatan: a.targetJabatan,
      wajibKonfirmasi: a.wajibKonfirmasi, kirimNotifikasi: false,
    });
    setEdit(a); setPesan(""); setBuka(true);
  }

  async function simpan() {
    if (!form.title.trim() || !form.content.trim()) { setPesan("Judul dan isi wajib diisi."); return; }
    setSibuk(true);
    const body = { ...form, startDate: `${form.startDate}T00:00:00+07:00`, endDate: form.endDate ? `${form.endDate}T23:59:59+07:00` : null };
    const r = await fetch(edit ? `/api/pengumuman/kelola/${edit.id}` : "/api/pengumuman/kelola", {
      method: edit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { setPesan(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(edit ? "Pengumuman diperbarui." : form.kirimNotifikasi && form.active ? "Pengumuman terbit & dikirim ke kotak notifikasi sasaran." : "Pengumuman tersimpan.");
    setBuka(false); muat();
  }
  async function hapus(a: Pengumuman) {
    if (!(await confirm(`Hapus pengumuman "${a.title}"?`))) return;
    const r = await fetch(`/api/pengumuman/kelola/${a.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Pengumuman dihapus."); muat(); } else toast.error("Gagal menghapus.");
  }
  async function aktifkan(a: Pengumuman) {
    const r = await fetch(`/api/pengumuman/kelola/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !a.active }) }).catch(() => null);
    if (r?.ok) muat(); else toast.error("Gagal mengubah status.");
  }
  async function lihatPembaca(a: Pengumuman) {
    setSaringBaca("BELUM");
    setPembaca({ judul: a.title, total: -1, dibaca: 0, baris: [] });
    const r = await fetch(`/api/pengumuman/kelola/${a.id}/pembaca`, { cache: "no-store" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal memuat pembaca."); setPembaca(null); return; }
    setPembaca(d);
  }

  function sasaranTeks(a: Pengumuman) {
    const rinci = [
      ...a.targetKelasIds.map(id => namaKelas.get(id) ?? "kelas?"),
      ...a.targetJurusanIds.map(id => namaJurusan.get(id) ?? "jurusan?"),
      ...a.targetJabatan,
    ];
    return `${PERAN[a.targetRole] ?? a.targetRole}${rinci.length ? ` · ${rinci.slice(0, 4).join(", ")}${rinci.length > 4 ? ` +${rinci.length - 4}` : ""}` : ""}`;
  }

  const aktif = (data?.daftar ?? []).filter(a => a.active);
  const nonaktif = (data?.daftar ?? []).filter(a => !a.active);
  const siswaOrtu = ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(form.targetRole);
  const barisPembaca = (pembaca?.baris ?? []).filter(b => saringBaca === "SEMUA" || (saringBaca === "SUDAH" ? !!b.dibacaAt : !b.dibacaAt));

  const tabel = (daftar: Pengumuman[]) => (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Pengumuman</th><th className="hidden md:table-cell">Sasaran</th><th className="hidden lg:table-cell">Berlaku</th><th className="text-center">Dibaca</th><th className="text-center">Status</th><th className="text-right">Aksi</th></tr></thead>
        <tbody>
          {daftar.map(a => (
            <tr key={a.id}>
              <td className="min-w-[14rem]">
                <div className="flex items-start gap-2">
                  {a.priority === "URGENT" && <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-semibold text-primary-900">{a.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{a.content}</p>
                    <p className="mt-0.5 text-xs text-gray-400 md:hidden">{sasaranTeks(a)}</p>
                    {a.pembuatNama && <p className="mt-0.5 text-xs text-gray-400">oleh {a.pembuatNama}</p>}
                  </div>
                </div>
              </td>
              <td className="hidden md:table-cell text-xs text-gray-600">{sasaranTeks(a)}</td>
              <td className="hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">
                {new Date(a.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} –{" "}
                {a.endDate ? new Date(a.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "tanpa batas"}
              </td>
              <td className="text-center">
                <button type="button" onClick={() => lihatPembaca(a)} title="Lihat pembaca"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50">
                  <Eye size={14} /> <span className="angka">{a.jumlahDibaca}</span>{a.wajibKonfirmasi ? "" : "*"}
                </button>
              </td>
              <td className="text-center">
                <button type="button" onClick={() => aktifkan(a)}
                  className={`status-badge ${a.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                  {a.active ? "Aktif" : "Nonaktif"}
                </button>
              </td>
              <td className="text-right whitespace-nowrap">
                <button type="button" onClick={() => bukaUbah(a)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                <button type="button" onClick={() => hapus(a)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Bell size={22} />} title="Kelola Pengumuman"
        description={data ? `${aktif.length} aktif · ${nonaktif.length} nonaktif${data.semua ? "" : " · kelas wali Anda"}` : "Buat pengumuman untuk sasaran tertentu dan pantau siapa yang sudah membaca"} />
      {galat ? <EmptyState icon={Bell} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-aksi">
              {kotakHref && <Link href={kotakHref} className="btn-modal-cancel btn-teks"><Bell /> Kotak Pengumuman Saya</Link>}
              <button type="button" onClick={bukaBaru} className="btn-modal-save"><Plus /> Buat Pengumuman</button>
            </div>
          </div>
          <p className="mb-5 text-xs text-gray-500">
            Pengumuman aktif tampil di dashboard & kotak pengumuman sasaran. Centang <strong>Wajib konfirmasi dibaca</strong> agar penerima menekan
            &ldquo;Saya sudah membaca&rdquo; — pengumuman itu masuk daftar &ldquo;Perlu tindakan&rdquo; mereka dan angkanya bisa dipantau di kolom Dibaca
            (* = tanpa kewajiban konfirmasi).
          </p>
          {data.daftar.length === 0 ? (
            <EmptyState icon={Bell} title="Belum ada pengumuman" description='Tekan "Buat Pengumuman" untuk membuat pengumuman pertama.' />
          ) : (
            <div className="space-y-6">
              {aktif.length > 0 && <GroupedSection title="Aktif" count={aktif.length} icon={Bell}>{tabel(aktif)}</GroupedSection>}
              {nonaktif.length > 0 && <GroupedSection title="Nonaktif" count={nonaktif.length} icon={Bell} variant="warning">{tabel(nonaktif)}</GroupedSection>}
            </div>
          )}
        </>
      )}

      <Modal scrollBody size="lg" open={buka} onClose={() => !sibuk && setBuka(false)} title={edit ? "Ubah Pengumuman" : "Buat Pengumuman"}
        footer={<>
          <button type="button" onClick={() => setBuka(false)} disabled={sibuk} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpan} disabled={sibuk} className="btn-modal-save flex-1">{sibuk && <Loader2 className="animate-spin" />} {edit ? "Simpan" : "Terbitkan"}</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label htmlFor="judul-pengumuman" className="label-field">Judul *</label>
            <input id="judul-pengumuman" value={form.title} maxLength={200} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder="Contoh: Rapat orang tua kelas XI" />
          </div>
          <div>
            <label htmlFor="isi-pengumuman" className="label-field">Isi *</label>
            <textarea id="isi-pengumuman" rows={5} maxLength={5000} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="input-field" placeholder="Tulis isi pengumuman…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Ditujukan kepada</label>
              <Select value={form.targetRole} onChange={v => setForm(f => ({ ...f, targetRole: v }))}
                options={Object.entries(PERAN).filter(([k]) => data?.semua || ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(k)).map(([value, label]) => ({ value, label }))} />
            </div>
            <div>
              <label className="label-field">Prioritas</label>
              <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={[{ value: "NORMAL", label: "Biasa" }, { value: "URGENT", label: "Penting (merah)" }]} />
            </div>
          </div>
          {siswaOrtu && (
            <PilihBanyak label={data?.semua ? "Kelas (kosongkan = semua kelas)" : "Kelas *"} opsi={(data?.kelas ?? []).map(k => ({ value: k.id, label: k.name }))}
              nilai={form.targetKelasIds} onChange={v => setForm(f => ({ ...f, targetKelasIds: v }))} />
          )}
          {siswaOrtu && data?.semua && (
            <PilihBanyak label="Jurusan (kosongkan = semua jurusan)" opsi={data.jurusan.map(k => ({ value: k.id, label: k.name }))}
              nilai={form.targetJurusanIds} onChange={v => setForm(f => ({ ...f, targetJurusanIds: v }))} />
          )}
          {form.targetRole === "TEACHER" && data?.semua && (
            <PilihBanyak label="Jabatan (kosongkan = semua guru & staf)" opsi={data.jabatan.map(j => ({ value: j, label: j }))}
              nilai={form.targetJabatan} onChange={v => setForm(f => ({ ...f, targetJabatan: v }))} />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label-field">Mulai berlaku</label><DatePicker value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} /></div>
            <div><label className="label-field">Berlaku s/d (opsional)</label><DatePicker value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} placeholder="Tanpa batas" /></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.wajibKonfirmasi} onChange={e => setForm(f => ({ ...f, wajibKonfirmasi: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
              Wajib konfirmasi dibaca
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
              Tampilkan sekarang (aktif)
            </label>
            {!edit && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.kirimNotifikasi} onChange={e => setForm(f => ({ ...f, kirimNotifikasi: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
                Kirim ke kotak notifikasi sasaran (bila berlaku hari ini)
              </label>
            )}
          </div>
          {pesan && <p className="error-msg">{pesan}</p>}
        </div>
      </Modal>

      <Modal open={!!pembaca} onClose={() => setPembaca(null)} size="xl" title="Pembaca pengumuman" description={pembaca?.judul}>
        {pembaca && pembaca.total < 0 ? (
          <div className="flex justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
        ) : pembaca && (
          <div className="space-y-4">
            <div className="kisi-kartu-3">
              <div className="rounded-xl border border-gray-100 p-3"><p className="text-xs text-gray-500">Sasaran</p><p className="angka text-xl font-bold text-primary-900">{pembaca.total}</p></div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><p className="text-xs text-emerald-700">Sudah membaca</p><p className="angka text-xl font-bold text-emerald-800">{pembaca.dibaca}</p></div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"><p className="text-xs text-amber-700">Belum</p><p className="angka text-xl font-bold text-amber-800">{pembaca.total - pembaca.dibaca}</p></div>
            </div>
            <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
              {[["BELUM", "Belum"], ["SUDAH", "Sudah"], ["SEMUA", "Semua"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setSaringBaca(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${saringBaca === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
              ))}
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-gray-100">
              <table className="data-table">
                <thead><tr><th>Nama</th><th>Peran</th><th>Kelas / anak</th><th>Dibaca</th></tr></thead>
                <tbody>
                  {barisPembaca.slice(0, 500).map((b, i) => (
                    <tr key={i}>
                      <td className="font-medium text-primary-900">{b.nama}</td>
                      <td className="text-xs">{b.peran}</td>
                      <td className="text-xs text-gray-600">{b.keterangan || "—"}</td>
                      <td className="text-xs whitespace-nowrap">{b.dibacaAt ? new Date(b.dibacaAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : <span className="text-amber-700">Belum</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {barisPembaca.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">Tidak ada data.</p>}
              {barisPembaca.length > 500 && <p className="px-4 py-2 text-center text-xs text-gray-500">Menampilkan 500 dari {barisPembaca.length}.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
