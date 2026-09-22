"use client";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Plus, Save, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Aspek { kunci: string; label: string }
interface Baris { id: string; jenis: string; tanggal: string; semester: string | null; mapel: string | null; kelas: string | null; penilaiNama: string; skor: Record<string, number>; nilaiAkhir: number | null; predikat: string | null; catatan: string | null; tindakLanjut: string | null; guruNama: string; guruMapel: string }
interface Data { penilai: boolean; semester: string[]; aspek: { SUPERVISI: Aspek[]; PKG: Aspek[] }; guru: { id: string; nama: string; mapel: string }[]; daftar: Baris[] }
const SKALA = [{ value: "4", label: "4 — Amat baik" }, { value: "3", label: "3 — Baik" }, { value: "2", label: "2 — Cukup" }, { value: "1", label: "1 — Kurang" }];
const WARNA: Record<string, string> = { "Amat Baik": "bg-emerald-50 text-emerald-700 border-emerald-200", Baik: "bg-blue-50 text-blue-700 border-blue-200", Cukup: "bg-amber-50 text-amber-700 border-amber-200", Kurang: "bg-red-50 text-red-600 border-red-200" };
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** SUPERVISI AKADEMIK & PKG (18 Sep 2026) — penilai mengisi lembar 1–4, guru melihat hasil & tindak lanjutnya. */
export default function SupervisiManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [form, setForm] = useState<null | { teacherId: string; jenis: string; tanggal: string; semester: string; mapel: string; kelas: string; skor: Record<string, string>; catatan: string; tindakLanjut: string }>(null);
  const [buka, setBuka] = useState<Baris | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback((tid?: string) => {
    fetch(`/api/supervisi${tid ? `?teacherId=${tid}` : ""}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else setD(x);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const aspek = (jenis: string) => (jenis === "PKG" ? d?.aspek.PKG : d?.aspek.SUPERVISI) ?? [];
  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const skor = Object.fromEntries(Object.entries(form.skor).filter(([, v]) => v).map(([k, v]) => [k, Number(v)]));
    const r = await fetch("/api/supervisi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, skor, tanggal: `${form.tanggal}T09:00:00+07:00` }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success("Hasil supervisi tersimpan & guru diberi tahu."); setForm(null); muat(teacherId);
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title={d?.penilai ? "Supervisi Akademik & PKG" : "Hasil Supervisi Saya"} description={d?.penilai ? "Lembar supervisi kelas dan penilaian kinerja guru" : "Catatan supervisi dan penilaian kinerja untuk Anda"} />
      {galat ? <EmptyState icon={ClipboardCheck} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          {d.penilai && (
            <div className="baris-alat mb-5">
              <div className="alat-saring"><Select value={teacherId} onChange={v => { setTeacherId(v); muat(v); }} placeholder="Semua guru" options={[{ value: "", label: "Semua guru" }, ...d.guru.map(g => ({ value: g.id, label: `${g.nama} — ${g.mapel}` }))]} /></div>
              <div className="alat-aksi"><button type="button" onClick={() => setForm({ teacherId: teacherId || d.guru[0]?.id || "", jenis: "SUPERVISI", tanggal: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), semester: d.semester[0] ?? "", mapel: "", kelas: "", skor: {}, catatan: "", tindakLanjut: "" })} className="btn-modal-save"><Plus /> Lembar Supervisi Baru</button></div>
            </div>
          )}
          {d.daftar.length === 0 ? <EmptyState icon={ClipboardCheck} title="Belum ada data" description={d.penilai ? "Isi lembar supervisi kelas atau PKG untuk guru." : "Hasil supervisi akan tampil di sini setelah dinilai."} /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Tanggal</th>{d.penilai && <th>Guru</th>}<th>Jenis</th><th className="hidden md:table-cell">Mapel/Kelas</th><th className="text-center">Nilai</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>{d.daftar.map(b => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap text-xs">{tgl(b.tanggal)}<span className="block text-gray-500">{b.penilaiNama}</span></td>
                    {d.penilai && <td className="font-semibold text-primary-900">{b.guruNama}</td>}
                    <td className="text-xs">{b.jenis === "PKG" ? "PKG" : "Supervisi kelas"}</td>
                    <td className="hidden md:table-cell text-xs text-gray-600">{[b.mapel, b.kelas].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-center whitespace-nowrap"><span className="angka font-semibold">{b.nilaiAkhir ?? "—"}</span>{b.predikat && <span className={`ml-1 status-badge ${WARNA[b.predikat] ?? ""}`}>{b.predikat}</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" onClick={() => setBuka(b)} className="btn-modal-cancel px-2.5 text-xs">Rincian</button>
                      {d.penilai && <button type="button" title="Hapus" onClick={async () => { if (await confirm("Hapus lembar supervisi ini?")) { const r = await fetch(`/api/supervisi/${b.id}`, { method: "DELETE" }).catch(() => null); if (r?.ok) muat(teacherId); } }} className="ml-1 p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Lembar supervisi" size="xl" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button></>}>
        {form && d && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Guru</label><Select value={form.teacherId} onChange={v => setForm({ ...form, teacherId: v })} options={d.guru.map(g => ({ value: g.id, label: `${g.nama} — ${g.mapel}` }))} /></div>
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v, skor: {} })} options={[{ value: "SUPERVISI", label: "Supervisi kelas" }, { value: "PKG", label: "Penilaian Kinerja Guru (PKG)" }]} /></div>
              <div><label className="label-field">Tanggal</label><DatePicker value={form.tanggal} onChange={v => setForm({ ...form, tanggal: v })} /></div>
              <div><label className="label-field">Semester</label><Select value={form.semester} onChange={v => setForm({ ...form, semester: v })} options={d.semester.map(s => ({ value: s, label: s }))} /></div>
              {form.jenis === "SUPERVISI" && <>
                <div><label htmlFor="mapel-sup" className="label-field">Mata pelajaran</label><input id="mapel-sup" className="input-field" maxLength={100} value={form.mapel} onChange={e => setForm({ ...form, mapel: e.target.value })} /></div>
                <div><label htmlFor="kelas-sup" className="label-field">Kelas</label><input id="kelas-sup" className="input-field" maxLength={50} value={form.kelas} onChange={e => setForm({ ...form, kelas: e.target.value })} /></div>
              </>}
            </div>
            <div className="space-y-2">
              <p className="label-field">Penilaian (4 amat baik – 1 kurang)</p>
              {aspek(form.jenis).map(a => (
                <div key={a.kunci} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem]">
                  <span className="text-sm text-gray-700">{a.label}</span>
                  <Select value={form.skor[a.kunci] ?? ""} onChange={v => setForm({ ...form, skor: { ...form.skor, [a.kunci]: v } })} placeholder="Belum dinilai" options={[{ value: "", label: "Belum dinilai" }, ...SKALA]} />
                </div>
              ))}
            </div>
            <div><label htmlFor="catatan-sup" className="label-field">Catatan temuan</label><textarea id="catatan-sup" rows={3} maxLength={2000} className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
            <div><label htmlFor="tindak-sup" className="label-field">Tindak lanjut / pembinaan</label><textarea id="tindak-sup" rows={3} maxLength={2000} className="input-field" value={form.tindakLanjut} onChange={e => setForm({ ...form, tindakLanjut: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <Modal open={!!buka} onClose={() => setBuka(null)} title="Rincian supervisi" description={buka ? `${buka.guruNama} · ${tgl(buka.tanggal)}` : undefined} size="lg" scrollBody>
        {buka && d && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">{buka.jenis === "PKG" ? "Penilaian Kinerja Guru" : "Supervisi kelas"}{buka.mapel ? ` · ${buka.mapel}` : ""}{buka.kelas ? ` · ${buka.kelas}` : ""} · penilai {buka.penilaiNama}</p>
            <ul className="divide-y divide-gray-50 rounded-xl border border-gray-100">
              {(buka.jenis === "PKG" ? d.aspek.PKG : d.aspek.SUPERVISI).map(a => (
                <li key={a.kunci} className="flex items-center justify-between gap-3 px-3 py-2"><span className="text-gray-700">{a.label}</span><span className="angka font-semibold text-primary-900">{buka.skor?.[a.kunci] ?? "—"}</span></li>
              ))}
            </ul>
            <p>Nilai akhir: <span className="angka font-bold text-primary-900">{buka.nilaiAkhir ?? "—"}</span> {buka.predikat && <span className={`status-badge ${WARNA[buka.predikat] ?? ""}`}>{buka.predikat}</span>}</p>
            {buka.catatan && <p><span className="font-semibold">Catatan:</span> {buka.catatan}</p>}
            {buka.tindakLanjut && <p><span className="font-semibold">Tindak lanjut:</span> {buka.tindakLanjut}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
