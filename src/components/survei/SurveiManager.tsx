"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, BarChart3, ClipboardPen, Download, Loader2, Lock, Pencil, Plus, Save, Send, Trash2, Unlock } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import PilihBanyak from "@/components/shared/PilihBanyak";
import { BarDaftar } from "@/components/shared/GrafikRingkas";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Opsi { id: string; name: string }
interface Ringkas { id: string; judul: string; jenis: string; status: string; anonim: boolean; hasilRahasia: boolean; targetRole: string; selesai: string | null; pembuatNama: string; jumlahRespons: number; jumlahPertanyaan: number; createdAt: string }
interface Pertanyaan { id?: string; teks: string; tipe: string; opsi: string[]; kelompok: string | null; wajib: boolean; maksPilih: number }
interface Detail extends Ringkas { deskripsi: string | null; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; pertanyaan: Pertanyaan[] }
interface Data { semua: boolean; bk: boolean; jenis: Record<string, string>; kelas: Opsi[]; jurusan: Opsi[]; jabatan: string[]; daftar: Ringkas[] }
interface Hasil {
  survei: { judul: string; jenis: string; anonim: boolean }; total: number; sasaran: number;
  pertanyaan: { id: string; teks: string; tipe: string; dijawab: number; opsi?: { label: string; jumlah: number }[]; rata?: number | null; maks?: number; isian?: string[] }[];
  akpd: null | { perBidang: { kunci: string; label: string; persen: number }[]; perButir: { teks: string; bidang: string; persen: number }[]; siswaPrioritas: { nama: string; kelas: string; total: number; per: Record<string, number> }[] };
  sosiometri: null | { kelasId: string; kelas: string; responden: number; anggota: number; siswa: { id: string; nama: string; dipilih: number; mengisi: boolean }[]; timbalBalik: [string, string][]; terisolasi: string[] }[];
  perKelas: { kelas: string; jumlah: number }[];
}

const PERAN: Record<string, string> = { ALL: "Semua pengguna", STUDENT: "Siswa", PARENT: "Orang tua", STUDENT_PARENT: "Siswa & orang tua", TEACHER: "Guru & staf" };
const TIPE: Record<string, string> = { PILIHAN: "Pilihan tunggal", CENTANG: "Pilihan ganda (centang)", SKALA: "Skala 1–5", TEKS: "Isian teks", TEMAN: "Pilih teman sekelas" };
const STATUS: Record<string, { label: string; kelas: string }> = {
  DRAF: { label: "Draf", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
  DIBUKA: { label: "Dibuka", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITUTUP: { label: "Ditutup", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
};
const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** KELOLA SURVEI & ANGKET (17 Sep 2026) — survei umum, evaluasi, AKPD, sosiometri; hasil & unduhan Excel. */
export default function SurveiManager({ isiHref }: { isiHref?: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [baru, setBaru] = useState<null | { jenis: string; judul: string }>(null);
  const [edit, setEdit] = useState<Detail | null>(null);
  const [hasil, setHasil] = useState<{ id: string; isi: Hasil | null } | null>(null);
  const [kelasSosio, setKelasSosio] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/survei/kelola", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function bukaEdit(id: string) {
    const d = await fetch(`/api/survei/kelola/${id}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
    if (!d?.survei) { toast.error(d?.error ?? "Gagal memuat survei."); return; }
    setEdit({ ...d.survei, selesai: d.survei.selesai ? tglWib(d.survei.selesai) : null });
  }
  async function bukaHasil(id: string) {
    setHasil({ id, isi: null });
    const d = await fetch(`/api/survei/kelola/${id}/hasil`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
    if (!d?.survei) { toast.error(d?.error ?? "Gagal memuat hasil."); setHasil(null); return; }
    setHasil({ id, isi: d }); setKelasSosio(d.sosiometri?.[0]?.kelasId ?? "");
  }
  async function buat() {
    if (!baru) return;
    setSibuk(true);
    const body = { ...baru, targetRole: "STUDENT", targetKelasIds: data && !data.semua ? data.kelas.map(k => k.id).slice(0, 1) : [] };
    const r = await fetch("/api/survei/kelola", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal membuat."); return; }
    setBaru(null); muat(); bukaEdit(d.id);
  }
  async function simpan() {
    if (!edit) return false;
    setSibuk(true);
    const body = { ...edit, selesai: edit.selesai ? `${edit.selesai}T23:59:59+07:00` : null, pertanyaan: edit.jumlahRespons > 0 ? undefined : edit.pertanyaan };
    const r = await fetch(`/api/survei/kelola/${edit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    toast.success("Survei tersimpan."); muat(); return true;
  }
  async function ubahStatus(id: string, status: string, simpanDulu = false) {
    if (simpanDulu && !(await simpan())) return;
    if (status === "DIBUKA" && !(await confirm("Buka survei sekarang? Sasaran akan menerima notifikasi."))) return;
    const r = await fetch(`/api/survei/kelola/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal."); return; }
    toast.success(status === "DIBUKA" ? "Survei dibuka." : status === "DITUTUP" ? "Survei ditutup." : "Status diperbarui.");
    setEdit(null); muat();
  }
  async function hapus(s: Ringkas) {
    if (!(await confirm(`Hapus survei "${s.judul}" beserta ${s.jumlahRespons} jawabannya?`))) return;
    const r = await fetch(`/api/survei/kelola/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Survei dihapus."); muat(); } else toast.error("Gagal menghapus.");
  }
  const setP = (i: number, p: Partial<Pertanyaan>) => setEdit(e => e && ({ ...e, pertanyaan: e.pertanyaan.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const geser = (i: number, arah: number) => setEdit(e => {
    if (!e) return e;
    const a = [...e.pertanyaan]; const j = i + arah;
    if (j < 0 || j >= a.length) return e;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...e, pertanyaan: a };
  });

  // ── Tampilan HASIL ──
  if (hasil) {
    const h = hasil.isi;
    const sosio = h?.sosiometri?.find(k => k.kelasId === kelasSosio);
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<BarChart3 size={22} />} title={h?.survei.judul ?? "Hasil survei"} description={h ? `${h.total} dari ${h.sasaran} sasaran mengisi (${h.sasaran ? Math.round((h.total / h.sasaran) * 100) : 0}%)${h.survei.anonim ? " · tanpa nama" : ""}` : "Memuat…"} />
        <div className="baris-alat mb-5">
          <div className="alat-aksi">
            <button type="button" onClick={() => setHasil(null)} className="btn-modal-cancel"><ArrowLeft /> Kembali</button>
            <a href={`/api/survei/kelola/${hasil.id}/hasil?format=xlsx`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
          </div>
        </div>
        {!h ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
          <div className="space-y-6">
            {h.perKelas.length > 1 && (
              <div className="panel p-5"><p className="label-kecil mb-3">Responden per kelas</p><BarDaftar data={h.perKelas.map(k => ({ kunci: k.kelas, label: k.kelas, nilai: k.jumlah }))} satuan="orang" /></div>
            )}
            {h.akpd && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
                <div className="panel p-5 min-w-0"><p className="label-kecil mb-3">Kebutuhan per bidang (% jawaban &ldquo;Ya&rdquo;)</p><BarDaftar data={h.akpd.perBidang.map(b => ({ kunci: b.kunci, label: b.label, nilai: b.persen }))} satuan="%" />
                  <p className="label-kecil mb-2 mt-6">Butir paling dibutuhkan</p>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">{h.akpd.perButir.slice(0, 8).map(b => <li key={b.teks}>{b.teks} <span className="text-xs text-gray-500">({b.bidang}, {b.persen}%)</span></li>)}</ol>
                </div>
                <div className="panel overflow-x-auto min-w-0">
                  <p className="label-kecil px-5 pt-4">Siswa dengan kebutuhan terbanyak — prioritas layanan BK</p>
                  <table className="data-table mt-2">
                    <thead><tr><th>Siswa</th><th>Kelas</th><th className="text-center">Pribadi</th><th className="text-center">Sosial</th><th className="text-center">Belajar</th><th className="text-center">Karier</th><th className="text-center">Total</th></tr></thead>
                    <tbody>{h.akpd.siswaPrioritas.map((s, i) => (
                      <tr key={i}><td className="font-medium text-primary-900">{s.nama}</td><td className="text-xs">{s.kelas}</td>{["PRIBADI", "SOSIAL", "BELAJAR", "KARIR"].map(k => <td key={k} className="angka text-center">{s.per[k]}</td>)}<td className="angka text-center font-bold">{s.total}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {h.sosiometri && (
              <div className="panel p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="label-kecil">Sosiometri kelas</p>
                  {h.sosiometri.length > 1 && <div className="w-48"><Select value={kelasSosio} onChange={setKelasSosio} options={h.sosiometri.map(k => ({ value: k.kelasId, label: k.kelas }))} /></div>}
                  {sosio && <span className="text-xs text-gray-500">{sosio.responden}/{sosio.anggota} siswa mengisi</span>}
                </div>
                {sosio && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="min-w-0"><p className="mb-2 text-sm font-semibold text-primary-900">Berapa kali dipilih teman</p>
                      <BarDaftar data={sosio.siswa.map(s => ({ kunci: s.id, label: s.nama, sublabel: s.mengisi ? undefined : "belum mengisi", nilai: s.dipilih, warna: s.dipilih === 0 ? "#dc2626" : undefined }))} satuan="kali" />
                    </div>
                    <div className="min-w-0 space-y-4">
                      <div><p className="mb-1 text-sm font-semibold text-red-700">Tidak dipilih siapa pun (perlu perhatian)</p>
                        {sosio.terisolasi.length ? <p className="text-sm text-gray-700">{sosio.terisolasi.join(", ")}</p> : <p className="text-sm text-gray-500">Tidak ada.</p>}</div>
                      <div><p className="mb-1 text-sm font-semibold text-primary-900">Saling memilih ({sosio.timbalBalik.length} pasang)</p>
                        {sosio.timbalBalik.length ? <ul className="space-y-0.5 text-sm text-gray-700">{sosio.timbalBalik.map(([a, b], i) => <li key={i}>{a} ↔ {b}</li>)}</ul> : <p className="text-sm text-gray-500">Belum ada.</p>}</div>
                      <p className="text-xs text-gray-500">Hasil sosiometri bersifat rahasia — dipakai untuk pengaturan kelompok belajar dan layanan BK, jangan diumumkan ke siswa.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!h.akpd && !h.sosiometri && h.pertanyaan.map((p, i) => (
              <div key={p.id} className="panel p-5 min-w-0">
                <p className="text-sm font-semibold text-primary-900">{i + 1}. {p.teks}</p>
                <p className="mb-3 text-xs text-gray-500">{p.dijawab} jawaban{p.rata != null ? ` · rata-rata ${p.rata.toLocaleString("id-ID")} dari ${p.maks}` : ""}</p>
                {p.opsi && <BarDaftar data={p.opsi.map(o => ({ kunci: o.label, label: o.label, nilai: o.jumlah }))} satuan="orang" />}
                {p.isian && (p.isian.length ? <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm text-gray-700">{p.isian.map((t, j) => <li key={j} className="rounded-lg bg-gray-50 px-3 py-2 whitespace-pre-line">{t}</li>)}</ul> : <p className="text-sm text-gray-500">Belum ada isian.</p>)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Tampilan EDIT ──
  if (edit) {
    const kunciPertanyaan = edit.jumlahRespons > 0;
    const khusus = edit.jenis === "AKPD" || edit.jenis === "SOSIOMETRI";
    const siswaOrtu = ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(edit.targetRole);
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<Pencil size={22} />} title={edit.judul || "Survei"} description={`${data?.jenis[edit.jenis] ?? edit.jenis} · ${STATUS[edit.status]?.label}${kunciPertanyaan ? ` · ${edit.jumlahRespons} jawaban (pertanyaan terkunci)` : ""}`} />
        <div className="baris-alat mb-5">
          <div className="alat-aksi">
            <button type="button" onClick={() => setEdit(null)} className="btn-modal-cancel"><ArrowLeft /> Kembali</button>
            <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-cancel"><Save /> Simpan</button>
            {edit.status !== "DIBUKA" && <button type="button" disabled={sibuk} onClick={() => ubahStatus(edit.id, "DIBUKA", true)} className="btn-modal-save"><Send /> Simpan & Buka</button>}
            {edit.status === "DIBUKA" && <button type="button" disabled={sibuk} onClick={() => ubahStatus(edit.id, "DITUTUP", true)} className="btn-modal-save"><Lock /> Simpan & Tutup</button>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
          <div className="panel p-5 space-y-4 xl:col-span-5 min-w-0">
            <div><label htmlFor="judul-survei" className="label-field">Judul *</label><input id="judul-survei" className="input-field" maxLength={200} value={edit.judul} onChange={e => setEdit({ ...edit, judul: e.target.value })} /></div>
            <div><label htmlFor="deskripsi-survei" className="label-field">Pengantar</label><textarea id="deskripsi-survei" rows={3} className="input-field" maxLength={2000} value={edit.deskripsi ?? ""} onChange={e => setEdit({ ...edit, deskripsi: e.target.value })} placeholder="Tujuan survei & petunjuk singkat" /></div>
            {!khusus && (
              <div><label className="label-field">Ditujukan kepada</label>
                <Select value={edit.targetRole} onChange={v => setEdit({ ...edit, targetRole: v })} options={Object.entries(PERAN).filter(([k]) => data?.semua || ["STUDENT", "PARENT", "STUDENT_PARENT"].includes(k)).map(([value, label]) => ({ value, label }))} /></div>
            )}
            {siswaOrtu && <PilihBanyak label={edit.jenis === "SOSIOMETRI" ? "Kelas *" : data?.semua ? "Kelas (kosongkan = semua)" : "Kelas *"} opsi={(data?.kelas ?? []).map(k => ({ value: k.id, label: k.name }))} nilai={edit.targetKelasIds} onChange={v => setEdit({ ...edit, targetKelasIds: v })} />}
            {siswaOrtu && data?.semua && edit.jenis !== "SOSIOMETRI" && <PilihBanyak label="Jurusan (kosongkan = semua)" opsi={data.jurusan.map(k => ({ value: k.id, label: k.name }))} nilai={edit.targetJurusanIds} onChange={v => setEdit({ ...edit, targetJurusanIds: v })} />}
            {edit.targetRole === "TEACHER" && data?.semua && <PilihBanyak label="Jabatan (kosongkan = semua)" opsi={data.jabatan.map(j => ({ value: j, label: j }))} nilai={edit.targetJabatan} onChange={v => setEdit({ ...edit, targetJabatan: v })} />}
            <div><label className="label-field">Batas pengisian (opsional)</label><DatePicker value={edit.selesai ?? ""} onChange={v => setEdit({ ...edit, selesai: v || null })} placeholder="Tanpa batas" /></div>
            {!khusus && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" disabled={kunciPertanyaan} checked={edit.anonim} onChange={e => setEdit({ ...edit, anonim: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Tanpa nama (anonim)</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={edit.hasilRahasia} onChange={e => setEdit({ ...edit, hasilRahasia: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Hasil hanya untuk saya & BK</label>
              </div>
            )}
          </div>
          <div className="space-y-3 xl:col-span-7 min-w-0">
            {edit.pertanyaan.map((p, i) => (
              <div key={i} className="panel p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="angka mt-2 w-6 shrink-0 text-sm font-bold text-primary-900">{i + 1}.</span>
                  <textarea aria-label={`Pertanyaan ${i + 1}`} rows={2} disabled={kunciPertanyaan} maxLength={500} className="input-field" value={p.teks} onChange={e => setP(i, { teks: e.target.value })} />
                  {!kunciPertanyaan && (
                    <div className="flex shrink-0 flex-col">
                      <button type="button" title="Naik" onClick={() => geser(i, -1)} className="p-1 text-gray-400 hover:text-primary-700"><ArrowUp size={14} /></button>
                      <button type="button" title="Turun" onClick={() => geser(i, 1)} className="p-1 text-gray-400 hover:text-primary-700"><ArrowDown size={14} /></button>
                      <button type="button" title="Hapus" onClick={() => setEdit({ ...edit, pertanyaan: edit.pertanyaan.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                {!kunciPertanyaan && (
                  <div className="grid grid-cols-1 gap-3 pl-8 sm:grid-cols-2">
                    <Select value={p.tipe} onChange={v => setP(i, { tipe: v, opsi: v === "SKALA" ? ["Sangat kurang", "Kurang", "Cukup", "Baik", "Sangat baik"] : v === "PILIHAN" || v === "CENTANG" ? (p.opsi.length ? p.opsi : ["Ya", "Tidak"]) : [] })}
                      options={Object.entries(TIPE).filter(([k]) => k !== "TEMAN" || edit.jenis === "SOSIOMETRI").map(([value, label]) => ({ value, label }))} />
                    <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={p.wajib} onChange={e => setP(i, { wajib: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Wajib dijawab</label>
                    {(p.tipe === "PILIHAN" || p.tipe === "CENTANG" || p.tipe === "SKALA") && (
                      <textarea aria-label={`Pilihan pertanyaan ${i + 1}`} rows={Math.min(Math.max(p.opsi.length, 2), 6)} className="input-field sm:col-span-2" placeholder={p.tipe === "SKALA" ? "Label skala 1 sampai 5, satu per baris" : "Satu pilihan per baris"}
                        value={p.opsi.join("\n")} onChange={e => setP(i, { opsi: e.target.value.split("\n") })} />
                    )}
                    {p.tipe === "TEMAN" && (
                      <div className="flex items-center gap-2 text-sm text-gray-700"><span>Maks. dipilih</span><input type="number" min={1} max={10} className="input-field w-20" value={p.maksPilih} onChange={e => setP(i, { maksPilih: Number(e.target.value) || 3 })} aria-label="Maksimal teman dipilih" /></div>
                    )}
                  </div>
                )}
                {kunciPertanyaan && <p className="pl-8 text-xs text-gray-500">{TIPE[p.tipe]}{p.opsi.length ? ` · ${p.opsi.join(" / ")}` : ""}</p>}
              </div>
            ))}
            {!kunciPertanyaan && (
              <button type="button" onClick={() => setEdit({ ...edit, pertanyaan: [...edit.pertanyaan, { teks: "", tipe: edit.jenis === "SOSIOMETRI" ? "TEMAN" : "PILIHAN", opsi: edit.jenis === "SOSIOMETRI" ? [] : ["Ya", "Tidak"], kelompok: null, wajib: true, maksPilih: 3 }] })}
                className="btn-modal-cancel w-full"><Plus /> Tambah Pertanyaan</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── DAFTAR ──
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardPen size={22} />} title="Kelola Survei & Angket" description={data?.bk ? "Survei umum, evaluasi layanan, AKPD, dan sosiometri kelas" : "Buat survei untuk sasaran tertentu dan lihat hasilnya"} />
      {galat ? <EmptyState icon={ClipboardPen} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-aksi">
              {isiHref && <Link href={isiHref} className="btn-modal-cancel btn-teks"><ClipboardPen /> Survei untuk Saya</Link>}
              <button type="button" onClick={() => setBaru({ jenis: "UMUM", judul: "" })} className="btn-modal-save"><Plus /> Buat Survei</button>
            </div>
          </div>
          {data.daftar.length === 0 ? <EmptyState icon={ClipboardPen} title="Belum ada survei" description="Contoh: kepuasan layanan perpustakaan, evaluasi kegiatan, AKPD awal tahun, sosiometri kelas." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Survei</th><th className="hidden md:table-cell">Jenis</th><th className="text-center">Jawaban</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {data.daftar.map(s => (
                    <tr key={s.id}>
                      <td className="min-w-[12rem]"><p className="font-semibold text-primary-900">{s.judul}</p><p className="text-xs text-gray-500">{PERAN[s.targetRole] ?? s.targetRole} · {s.jumlahPertanyaan} pertanyaan · {s.pembuatNama}</p></td>
                      <td className="hidden md:table-cell text-xs text-gray-600">{data.jenis[s.jenis] ?? s.jenis}{s.anonim ? " · anonim" : ""}</td>
                      <td className="angka text-center">{s.jumlahRespons}</td>
                      <td><span className={`status-badge ${STATUS[s.status]?.kelas}`}>{STATUS[s.status]?.label}</span></td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" title="Hasil" onClick={() => bukaHasil(s.id)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><BarChart3 size={15} /></button>
                        <button type="button" title="Edit" onClick={() => bukaEdit(s.id)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                        {s.status === "DIBUKA"
                          ? <button type="button" title="Tutup" onClick={() => ubahStatus(s.id, "DITUTUP")} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg"><Lock size={14} /></button>
                          : s.status === "DITUTUP" && <button type="button" title="Buka lagi" onClick={() => ubahStatus(s.id, "DIBUKA")} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg"><Unlock size={14} /></button>}
                        <button type="button" title="Hapus" onClick={() => hapus(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Modal open={!!baru} onClose={() => setBaru(null)} title="Buat survei"
        footer={<><button type="button" onClick={() => setBaru(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={buat} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Buat & Susun</button></>}>
        {baru && data && (
          <div className="space-y-4">
            <div><label className="label-field">Jenis</label>
              <Select value={baru.jenis} onChange={v => setBaru({ ...baru, jenis: v })} options={Object.entries(data.jenis).filter(([k]) => (k !== "AKPD" && k !== "SOSIOMETRI") || data.bk || data.kelas.length > 0).map(([value, label]) => ({ value, label }))} /></div>
            <div><label htmlFor="judul-baru" className="label-field">Judul</label><input id="judul-baru" className="input-field" maxLength={200} value={baru.judul} onChange={e => setBaru({ ...baru, judul: e.target.value })} placeholder={baru.jenis === "AKPD" ? "Angket Kebutuhan Peserta Didik (AKPD)" : baru.jenis === "SOSIOMETRI" ? "Sosiometri kelas" : "mis. Kepuasan layanan perpustakaan"} /></div>
            {baru.jenis === "AKPD" && <p className="text-xs text-gray-500">Berisi 20 butir baku (pribadi, sosial, belajar, karier) jawaban Ya/Tidak — bisa diubah sebelum dibuka. Hasil hanya untuk BK.</p>}
            {baru.jenis === "SOSIOMETRI" && <p className="text-xs text-gray-500">Berisi 3 pertanyaan pilih teman sekelas. Pilih kelas sasaran pada langkah berikutnya. Hasil hanya untuk BK & pembuat.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
