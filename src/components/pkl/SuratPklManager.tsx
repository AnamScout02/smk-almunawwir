"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Plus, Printer, Search, Save, Mail, ClipboardSignature, Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { JENIS_SURAT_PKL, KEPERLUAN_TUGAS, type JenisSuratPkl } from "@/lib/pkl-surat";
import { PILIHAN_LAMA, selesaiDari } from "@/lib/pkl-label";
import { SUMBER_BIAYA } from "@/lib/tu-konstanta";
import type { PesertaPkl } from "@/lib/pkl-server";

type Baris = { id: string; jenis: JenisSuratPkl; nomor: string; perihal: string; namaMitra: string; studentIds: string[]; dibuatOleh: string; createdAt: string };
type Dudi = { id: string; nama: string; aktif: boolean };
type Isian = {
  jenis: JenisSuratPkl; tanggal: string; mitraIds: string[]; studentIds: string[]; mulai?: string; selesai?: string; lamaBulan?: number | null;
  guruIds?: string[]; keperluan?: string; berangkat?: string; kembali?: string; jam?: string; transportasi?: string; sumberBiaya?: string; withSppd?: boolean;
};
type Ubah = { id: string; nomor: string; isian: Isian };
type Muatan = { peserta: PesertaPkl[]; dudi: Dudi[]; guru: { id: string; nama: string }[] };
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const tgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** SURAT & SPPD PKL (9 Okt 2026). Surat dibuat dari data PKL tetapi MASUK BUKU AGENDA Tata Usaha: nomornya dari urutan
 *  surat keluar sekolah yang sama, dan isinya tetap bisa disunting TU di Persuratan / Surat Tugas. */
export default function SuratPklManager() {
  const toast = useToast();
  const [surat, setSurat] = useState<Baris[] | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [buat, setBuat] = useState(false);
  const [ubah, setUbah] = useState<Ubah | null>(null);
  const confirm = useConfirm();

  const muat = useCallback(() => {
    return fetch("/api/pkl/surat").then(r => r.json()).then(d => { if (d.error) toast.error(d.error); else setSurat(d.surat); })
      .catch(() => toast.error("Gagal memuat daftar surat."));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (surat ?? []).filter(s => (!saring || s.jenis === saring) && (!q || `${s.nomor} ${s.perihal} ${s.namaMitra}`.toLowerCase().includes(q)));
  }, [surat, cari, saring]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}`);

  async function bukaUbah(id: string) {
    const r = await fetch(`/api/pkl/surat/${id}`).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (r?.ok && d?.isian) setUbah(d); else toast.error(d?.error ?? "Gagal membuka surat");
  }
  async function hapus(s: Baris) {
    if (!await confirm(`Hapus surat ${s.nomor}? Surat ini juga terhapus dari buku agenda Tata Usaha. Bila bukan nomor terakhir, urutan nomor surat sekolah akan berlubang di nomor itu.`)) return;
    const r = await fetch(`/api/pkl/surat/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Surat dihapus"); muat(); } else toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menghapus");
  }

  if (!surat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileText size={22} />} title="Surat & SPPD PKL" description="Permohonan, pengantar, penarikan, dan surat tugas guru — bernomor dari buku agenda Tata Usaha" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={surat.length} label="Surat PKL dibuat" icon={FileText} color="primary" />
          <StatTile value={surat.filter(s => s.jenis !== "TUGAS").length} label="Surat ke DUDI" icon={Mail} color="blue" />
          <StatTile value={surat.filter(s => s.jenis === "TUGAS").length} label="Surat tugas guru" icon={ClipboardSignature} color="emerald" />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nomor, perihal, atau DUDI..." />
          </div>
          <div className="alat-saring">
            <Select value={saring} onChange={setSaring} options={[{ value: "", label: "Semua jenis" }, ...Object.entries(JENIS_SURAT_PKL).map(([value, j]) => ({ value, label: j.label }))]} />
          </div>
          <div className="alat-aksi"><button type="button" className="btn-modal-save btn-teks" onClick={() => setBuat(true)}><Plus size={16} /> Buat Surat</button></div>
        </div>

        <p className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500">
          Nomor surat diambil dari urutan surat keluar sekolah, jadi tidak pernah kembar dengan surat Tata Usaha. Surat yang dibuat di sini juga muncul di
Persuratan dan Surat Tugas. Mengubah dari sini menyusun ulang isinya dari data PKL (nomor tetap); menyunting kalimat secara bebas atau mengganti penanda tangan tetap dilakukan Tata Usaha di Persuratan.
        </p>

        <div className="panel overflow-hidden">
          {tersaring.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{surat.length ? "Tidak ada surat pada saringan ini." : "Belum ada surat PKL yang dibuat."}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Nomor</th><th>Jenis &amp; perihal</th><th>DUDI</th><th className="text-right">Siswa</th><th>Dibuat</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {hal.potongan.map((s, i) => (
                      <tr key={s.id}>
                        <td className="angka">{hal.awal + i}</td>
                        <td className="angka whitespace-nowrap font-medium text-primary-900">{s.nomor}</td>
                        <td><p className="text-sm font-medium text-gray-700">{JENIS_SURAT_PKL[s.jenis]?.label ?? s.jenis}</p><p className="text-xs text-gray-500">{s.perihal}</p></td>
                        <td className="text-sm text-gray-600">{s.namaMitra}</td>
                        <td className="angka text-right">{s.studentIds.length || "—"}</td>
                        <td className="angka whitespace-nowrap text-sm text-gray-600">{tgl(s.createdAt)}<span className="block text-xs text-gray-400">{s.dibuatOleh}</span></td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/pusat-pkl/surat/${s.id}/cetak`} className="btn-modal-cancel px-3 text-xs"><Printer size={14} /> Cetak</Link>
                            <button type="button" title="Ubah surat" onClick={() => bukaUbah(s.id)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                            <button type="button" title="Hapus surat" onClick={() => hapus(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="surat" className="border-t border-gray-100" />
            </>
          )}
        </div>
      </div>
      {buat && <ModalBuat onTutup={() => setBuat(false)} />}
      {ubah && <ModalBuat ubah={ubah} onTutup={() => setUbah(null)} />}
    </div>
  );
}

function ModalBuat({ onTutup, ubah }: { onTutup: () => void; ubah?: Ubah }) {
  const toast = useToast();
  const router = useRouter();
  const [m, setM] = useState<Muatan | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const a = ubah?.isian;
  const [jenis, setJenis] = useState<JenisSuratPkl>(a?.jenis ?? "PERMOHONAN");
  const [tanggal, setTanggal] = useState(a?.tanggal ?? hariIni());
  const [dudi, setDudi] = useState<string[]>(a ? [a.mitraIds[0] ?? "", a.mitraIds[1] ?? "", a.mitraIds[2] ?? ""] : ["", "", ""]);
  const [siswa, setSiswa] = useState<Set<string>>(new Set(a?.studentIds ?? []));
  const [semua, setSemua] = useState(!!ubah && (a?.jenis ?? "") !== "TUGAS");
  const [cari, setCari] = useState("");
  const [waktu, setWaktu] = useState({ mulai: a?.mulai ?? "", selesai: a?.selesai ?? "", lama: a?.lamaBulan ? String(a.lamaBulan) : "" });
  const [tugas, setTugas] = useState({ keperluan: a?.keperluan ?? "MONITORING", berangkat: a?.berangkat ?? hariIni(), kembali: a?.kembali ?? hariIni(), jam: a?.jam ?? "", transportasi: a?.transportasi ?? "", sumberBiaya: a?.sumberBiaya ?? "", withSppd: a?.withSppd ?? true });
  const [guru, setGuru] = useState<Set<string>>(new Set(a?.guruIds ?? []));

  useEffect(() => {
    fetch("/api/pkl/penempatan").then(r => r.json()).then(d => { if (!d.error) setM(d); }).catch(() => {});
  }, []);

  const dudiDipilih = (jenis === "TUGAS" ? dudi : dudi.slice(0, 1)).filter(Boolean);
  const diDudi = useMemo(() => (m?.peserta ?? []).filter(p => p.mitraId && dudiDipilih.includes(p.mitraId) && p.status !== "CANCELLED"), [m, dudiDipilih]);

  // Memilih DUDI mengisi sendiri: siswa yang ditempatkan di sana, tanggal PKL mereka, dan guru pembimbingnya.
  function pilihDudi(i: number, v: string) {
    const baru = dudi.map((x, j) => (j === i ? v : x));
    setDudi(baru);
    const aktif = (jenis === "TUGAS" ? baru : baru.slice(0, 1)).filter(Boolean);
    const di = (m?.peserta ?? []).filter(p => p.mitraId && aktif.includes(p.mitraId) && p.status !== "CANCELLED");
    setSiswa(new Set(di.map(p => p.studentId)));
    setGuru(new Set(di.map(p => p.guruId).filter((x): x is string => !!x)));
    if (di[0]) setWaktu({ mulai: di[0].mulai, selesai: di[0].selesai, lama: di[0].lamaBulan ? String(di[0].lamaBulan) : "" });
  }

  const daftarSiswa = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (semua ? (m?.peserta ?? []).filter(p => p.status !== "CANCELLED") : diDudi).filter(p => !q || `${p.nama} ${p.kelas ?? ""} ${p.nis}`.toLowerCase().includes(q));
  }, [m, semua, diDudi, cari]);

  async function simpan() {
    if (!dudiDipilih.length) { toast.error("Pilih DUDI tujuan surat."); return; }
    setSibuk(true);
    const body = jenis === "TUGAS"
      ? { jenis, tanggal, mitraIds: dudiDipilih, studentIds: [...siswa], guruIds: [...guru], ...tugas }
      : { jenis, tanggal, mitraIds: dudiDipilih, studentIds: [...siswa], mulai: waktu.mulai, selesai: waktu.selesai, lamaBulan: waktu.lama ? Number(waktu.lama) : null };
    const r = await fetch(ubah ? `/api/pkl/surat/${ubah.id}` : "/api/pkl/surat", { method: ubah ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan surat"); return; }
    toast.success(ubah ? `Surat ${d.nomor} diperbarui` : `Surat ${d.nomor} dibuat`);
    router.push(`/pusat-pkl/surat/${d.id}/cetak`);
  }

  const opsiDudi = (kosong: string) => [{ value: "", label: kosong }, ...(m?.dudi ?? []).filter(d => d.aktif).map(d => ({ value: d.id, label: d.nama }))];
  return (
    <Modal open onClose={onTutup} size="xl" scrollBody title={ubah ? "Ubah Surat PKL" : "Buat Surat PKL"} description={ubah ? `${ubah.nomor} — nomor tetap, isi disusun ulang dari isian ini` : "Nomor diterbitkan dari buku agenda Tata Usaha saat disimpan"}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk || !m} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Save />} {ubah ? "Simpan & Lihat Surat" : "Buat & Lihat Surat"}</button>
      </>}>
      {!m ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0"><label className="label-field">Jenis surat</label>
              {ubah ? <p className="input-field bg-gray-50 text-gray-500">{JENIS_SURAT_PKL[jenis].label}</p>
                : <Select value={jenis} onChange={v => { setJenis(v as JenisSuratPkl); setSiswa(new Set()); setGuru(new Set()); setDudi(["", "", ""]); }} options={Object.entries(JENIS_SURAT_PKL).map(([value, j]) => ({ value, label: j.label }))} />}</div>
            <div className="min-w-0"><label className="label-field">Tanggal surat</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
          </div>

          {ubah && jenis !== "TUGAS" && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Menyimpan menyusun ulang isi surat dari isian ini. Kalimat yang pernah disunting tangan di Persuratan akan tergantikan.</p>}
          {jenis === "TUGAS" ? (
            <>
              <div><label className="label-field">Keperluan</label>
                <Select value={tugas.keperluan} onChange={v => setTugas(t => ({ ...t, keperluan: v }))} options={Object.entries(KEPERLUAN_TUGAS).map(([value, label]) => ({ value, label }))} /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="min-w-0"><label className="label-field">DUDI tujuan {i + 1}{i ? " (opsional)" : ""}</label>
                    <Select value={dudi[i]} onChange={v => pilihDudi(i, v)} options={opsiDudi(i ? "— Tidak ada —" : "Pilih DUDI")} /></div>
                ))}
              </div>
              <div>
                <label className="label-field">Guru yang ditugaskan</label>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 p-2">
                  {m.guru.map(g => (
                    <label key={g.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={guru.has(g.id)} onChange={e => setGuru(s => { const n = new Set(s); if (e.target.checked) n.add(g.id); else n.delete(g.id); return n; })} /> {g.nama}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{guru.size} guru dipilih. Guru pembimbing siswa di DUDI terpilih dicentang otomatis.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0"><label className="label-field">Berangkat</label><DatePicker value={tugas.berangkat} onChange={v => setTugas(t => ({ ...t, berangkat: v, kembali: t.kembali < v ? v : t.kembali }))} /></div>
                <div className="min-w-0"><label className="label-field">Kembali</label><DatePicker value={tugas.kembali} onChange={v => setTugas(t => ({ ...t, kembali: v }))} /></div>
                <div className="min-w-0"><label className="label-field">Jam</label><input className="input-field" value={tugas.jam} onChange={e => setTugas(t => ({ ...t, jam: e.target.value }))} placeholder="mis. 08.00 WIB – selesai" /></div>
                <div className="min-w-0"><label className="label-field">Kendaraan</label><input className="input-field" value={tugas.transportasi} onChange={e => setTugas(t => ({ ...t, transportasi: e.target.value }))} placeholder="mis. Kendaraan sekolah" /></div>
                <div className="min-w-0"><label className="label-field">Sumber biaya</label>
                  <Select value={tugas.sumberBiaya} onChange={v => setTugas(t => ({ ...t, sumberBiaya: v }))} options={[{ value: "", label: "— Tidak diisi —" }, ...SUMBER_BIAYA.map(x => ({ value: x.value, label: x.label }))]} /></div>
              </div>
              <label className="sentuh flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={tugas.withSppd} onChange={e => setTugas(t => ({ ...t, withSppd: e.target.checked }))} />
                Sertakan SPPD dan lembar Laporan Perjalanan Dinas
              </label>
            </>
          ) : (
            <>
              <div><label className="label-field">DUDI tujuan</label><Select value={dudi[0]} onChange={v => pilihDudi(0, v)} options={opsiDudi("Pilih DUDI")} /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0"><label className="label-field">Mulai PKL</label><DatePicker value={waktu.mulai} onChange={v => setWaktu(w => ({ ...w, mulai: v, ...(w.lama && v ? { selesai: selesaiDari(v, Number(w.lama)) } : {}) }))} /></div>
                <div className="min-w-0"><label className="label-field">Lama</label>
                  <Select value={waktu.lama} onChange={v => setWaktu(w => ({ ...w, lama: v, ...(v && w.mulai ? { selesai: selesaiDari(w.mulai, Number(v)) } : {}) }))}
                    options={[...PILIHAN_LAMA.map(n => ({ value: String(n), label: `${n} bulan` })), { value: "", label: "Lainnya" }]} /></div>
                <div className="min-w-0"><label className="label-field">Selesai PKL</label><DatePicker value={waktu.selesai} onChange={v => setWaktu(w => ({ ...w, selesai: v, lama: "" }))} /></div>
              </div>
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="label-field !mb-0">Siswa yang dicantumkan ({siswa.size})</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={semua} onChange={e => setSemua(e.target.checked)} /> Tampilkan semua peserta
                  </label>
                </div>
                {(semua || daftarSiswa.length > 8) && <input className="input-field mb-2" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, kelas, NIS..." />}
                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 p-2">
                  {daftarSiswa.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">{dudi[0] ? "Belum ada siswa yang ditempatkan di DUDI ini. Centang “Tampilkan semua peserta” untuk surat permohonan sebelum penempatan." : "Pilih DUDI dulu."}</p>
                  ) : daftarSiswa.slice(0, 300).map(p => (
                    <label key={p.studentId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={siswa.has(p.studentId)} onChange={e => setSiswa(s => { const n = new Set(s); if (e.target.checked) n.add(p.studentId); else n.delete(p.studentId); return n; })} />
                      <span className="min-w-0 flex-1 truncate">{p.nama}</span><span className="angka shrink-0 text-xs text-gray-400">{p.kelas ?? "—"}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
