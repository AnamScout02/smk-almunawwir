"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AlatPenempatanPkl from "@/components/pkl/AlatPenempatanPkl";
import {
  MapPinned, Search, Loader2, Users, UserX, UserCheck, Save, Pencil, Trash2, ArrowRightLeft, UsersRound, Download, Plus, Truck, BookOpen, Award,
} from "lucide-react";
import JurnalPklModal from "@/components/pkl/JurnalPklModal";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PILIHAN_LAMA, STATUS_PKL, selesaiDari, tglPkl } from "@/lib/pkl-label";
import type { PesertaPkl } from "@/lib/pkl-server";

type Dudi = { id: string; nama: string; kuota: number | null; terisi: number; aktif: boolean; jurusanIds: string[]; kontak: string | null; kecamatan: string | null; bidang: string | null };
type Muatan = { peserta: PesertaPkl[]; dudi: Dudi[]; guru: { id: string; nama: string }[]; jurusan: { id: string; code: string; name: string }[]; belumPeserta: number };

const SARINGAN = [
  { value: "", label: "Semua peserta" },
  { value: "BELUM", label: "Belum dapat DUDI" },
  { value: "DITEMPATKAN", label: "Sudah dapat DUDI" },
  { value: "BERJALAN", label: "Sedang PKL hari ini" },
  { value: "AKAN_MULAI", label: "Belum mulai" },
  { value: "SELESAI", label: "Selesai" },
  { value: "LEWAT", label: "Lewat tanggal selesai" },
  { value: "TANPA_GURU", label: "Belum ada guru pembimbing" },
  { value: "BELUM_DIANTAR", label: "Sudah mulai, belum diantar" },
  { value: "TANPA_KATALOG", label: "Tempat belum terhubung daftar DUDI" },
  { value: "BATAL", label: "Dibatalkan" },
];
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function cocok(p: PesertaPkl, s: string, kini: string) {
  switch (s) {
    case "BELUM": return !p.tempat && p.status !== "CANCELLED";
    case "DITEMPATKAN": return !!p.tempat && p.status !== "CANCELLED";
    case "BERJALAN": return !!p.tempat && p.status === "ONGOING" && p.mulai <= kini && p.selesai >= kini;
    case "AKAN_MULAI": return !!p.tempat && p.status === "ONGOING" && p.mulai > kini;
    case "SELESAI": return p.status === "COMPLETED";
    case "LEWAT": return !!p.tempat && p.status === "ONGOING" && p.selesai < kini;
    case "TANPA_GURU": return !!p.tempat && !p.guruId && p.status === "ONGOING";
    case "BELUM_DIANTAR": return !!p.tempat && p.status === "ONGOING" && p.mulai <= kini && p.selesai >= kini && !p.diantarPada;
    case "TANPA_KATALOG": return p.tanpaKatalog;
    case "BATAL": return p.status === "CANCELLED";
    default: return true;
  }
}

/** Label pilihan DUDI: nama + keterisian, supaya yang penuh terlihat SEBELUM dipilih. */
const labelDudi = (d: Dudi) => `${d.nama}${d.kuota != null ? ` — ${d.terisi}/${d.kuota}${d.terisi >= d.kuota ? " (penuh)" : ""}` : d.terisi ? ` — ${d.terisi} siswa` : ""}${d.aktif ? "" : " · nonaktif"}`;

/** PENEMPATAN SISWA PKL (9 Okt 2026) — tempat PKL dipilih dari daftar DUDI (kuota terhitung), bisa satu per satu atau
 *  banyak siswa sekaligus. Pindah tempat setelah PKL berjalan lewat Mutasi supaya riwayat & alasannya tercatat. */
export default function PenempatanPklManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [m, setM] = useState<Muatan | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [kelas, setKelas] = useState("");
  const [dudiSaring, setDudiSaring] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [ubah, setUbah] = useState<PesertaPkl | null>(null);
  const [mutasi, setMutasi] = useState<PesertaPkl | null>(null);
  const [massal, setMassal] = useState(false);
  const [masuk, setMasuk] = useState(false);
  const [jurnal, setJurnal] = useState<PesertaPkl | null>(null);
  // Dari Laporan Masalah: ?mutasi=<studentId>&laporan=<id> langsung membuka jendela Mutasi siswa itu.
  const [dariLaporan, setDariLaporan] = useState<{ studentId: string; laporanId: string } | null>(null);
  const kini = hariIni();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("saring"), d = q.get("dudi"), c = q.get("cari");
    if (c) queueMicrotask(() => setCari(c));
    if (s && SARINGAN.some(x => x.value === s)) queueMicrotask(() => setSaring(s));
    if (d) queueMicrotask(() => setDudiSaring(d));
    const mu = q.get("mutasi");
    if (mu) queueMicrotask(() => setDariLaporan({ studentId: mu, laporanId: q.get("laporan") ?? "" }));
  }, []);
  useEffect(() => {
    if (!dariLaporan || !m) return;
    const p = m.peserta.find(x => x.studentId === dariLaporan.studentId);
    if (p?.mitraId) queueMicrotask(() => setMutasi(p));
  }, [dariLaporan, m]);

  const muat = useCallback(() => {
    return fetch("/api/pkl/penempatan").then(r => r.json()).then(d => { if (d.error) toast.error(d.error); else setM(d); })
      .catch(() => toast.error("Gagal memuat data penempatan."));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (m?.peserta ?? []).filter(p =>
      (!q || `${p.nama} ${p.nis} ${p.kelas ?? ""} ${p.tempat ?? ""}`.toLowerCase().includes(q)) &&
      (!kelas || p.kelas === kelas) && (!dudiSaring || p.mitraId === dudiSaring) && cocok(p, saring, kini));
  }, [m, cari, saring, kelas, dudiSaring, kini]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}|${kelas}|${dudiSaring}`);

  if (!m) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  const aktif = m.peserta.filter(p => p.status !== "CANCELLED");
  const daftarKelas = [...new Set(m.peserta.map(p => p.kelas).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
  const semuaTerpilih = tersaring.length > 0 && tersaring.every(p => pilih.has(p.studentId));
  const terpilih = m.peserta.filter(p => pilih.has(p.studentId));

  async function hapus(p: PesertaPkl) {
    if (!await confirm(`Keluarkan ${p.nama} dari daftar peserta PKL? Jurnal (${p.jurnal}), monitoring (${p.monitoring}), dan riwayat mutasinya ikut terhapus.`)) return;
    const r = await fetch(`/api/pkl/penempatan/${p.studentId}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Data PKL dihapus"); muat(); } else toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menghapus");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MapPinned size={22} />} title="Penempatan Siswa PKL" description="Menempatkan siswa ke DUDI, menetapkan guru pembimbing, mencatat pengantaran, dan mutasi tempat" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={aktif.length} label="Peserta PKL" icon={Users} color="primary" />
          <StatTile value={aktif.filter(p => p.tempat).length} label="Sudah dapat DUDI" icon={UserCheck} color="emerald" />
          <StatTile value={aktif.filter(p => !p.tempat).length} label="Belum dapat DUDI" icon={UserX} color="amber" sorot={aktif.some(p => !p.tempat)} />
          <StatTile value={aktif.filter(p => p.tempat && !p.guruId).length} label="Belum ada guru pembimbing" icon={UsersRound} color="blue" />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIS, kelas, atau DUDI..." />
          </div>
          <div className="alat-saring"><Select value={saring} onChange={setSaring} options={SARINGAN} /></div>
          <div className="alat-saring"><Select value={kelas} onChange={setKelas} options={[{ value: "", label: "Semua kelas" }, ...daftarKelas.map(k => ({ value: k, label: k }))]} /></div>
          <div className="alat-saring"><Select value={dudiSaring} onChange={setDudiSaring} options={[{ value: "", label: "Semua DUDI" }, ...m.dudi.filter(d => d.terisi > 0 || d.id === dudiSaring).map(d => ({ value: d.id, label: `${d.nama} (${d.terisi})` }))]} /></div>
          <div className="alat-aksi">
            <button type="button" className="btn-modal-cancel btn-teks" onClick={() => setMasuk(true)}><Plus size={16} /> Masukkan Peserta</button>
            <AlatPenempatanPkl onSelesai={muat} />
            <a href="/api/pkl/rekap" className="btn-modal-cancel btn-teks"><Download size={16} /> Rekap Excel</a>
            {(kelas || dudiSaring) && (
              <a href={`/pusat-pkl/sertifikat?${new URLSearchParams({ ...(kelas ? { kelas } : {}), ...(dudiSaring ? { dudi: dudiSaring } : {}) })}`} className="btn-modal-cancel btn-teks"><Award size={16} /> Cetak Sertifikat</a>
            )}
            <button type="button" className="btn-modal-save btn-teks" disabled={!pilih.size} onClick={() => setMassal(true)}>
              <UsersRound size={16} /> Tempatkan {pilih.size || ""} Terpilih
            </button>
          </div>
        </div>

        {m.belumPeserta > 0 && (
          <p className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-500">
            <span className="angka font-semibold text-primary-900">{m.belumPeserta}</span> siswa aktif kelas XI–XII belum dimasukkan sebagai peserta PKL. Gunakan <span className="font-medium">Masukkan Peserta</span> bila mereka memang ikut PKL.
          </p>
        )}

        <div className="panel overflow-hidden">
          {tersaring.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Tidak ada peserta pada saringan ini.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input type="checkbox" aria-label="Pilih semua yang tersaring" className="h-4 w-4 rounded border-gray-300" checked={semuaTerpilih}
                          onChange={e => setPilih(s => { const n = new Set(s); for (const p of tersaring) { if (e.target.checked) n.add(p.studentId); else n.delete(p.studentId); } return n; })} />
                      </th>
                      <th>Siswa</th><th>Tempat PKL</th><th>Waktu</th><th>Guru pembimbing</th><th>Pengantaran</th><th>Status</th><th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hal.potongan.map(p => (
                      <tr key={p.studentId}>
                        <td>
                          <input type="checkbox" aria-label={`Pilih ${p.nama}`} className="h-4 w-4 rounded border-gray-300" checked={pilih.has(p.studentId)}
                            onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(p.studentId); else n.delete(p.studentId); return n; })} />
                        </td>
                        <td>
                          <p className="font-medium text-primary-900"><Link href={`/pusat-pkl/siswa/${p.studentId}`} className="hover:underline" title="Linimasa PKL siswa">{p.nama}</Link></p>
                          <p className="angka text-xs text-gray-400">{p.nis} · {p.kelas ?? "tanpa kelas"}</p>
                        </td>
                        <td>
                          {p.tempat ? (
                            <>
                              <p className="text-gray-700">{p.tempat}</p>
                              <p className="text-xs text-gray-400">{[p.posisi, p.pembimbingIndustri].filter(Boolean).join(" · ") || "posisi belum diisi"}</p>
                              {p.tanpaKatalog && <span className="mt-1 inline-block text-xs text-amber-700">belum terhubung daftar DUDI</span>}
                              {p.mutasi > 0 && <span className="mt-1 block text-xs text-gray-400">{p.mutasi}× pindah tempat</span>}
                            </>
                          ) : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum dapat DUDI</span>}
                        </td>
                        <td className="angka whitespace-nowrap text-sm text-gray-600">
                          {tglPkl(p.mulai)} – {tglPkl(p.selesai)}
                          {p.lamaBulan && <span className="block text-xs text-gray-400">{p.lamaBulan} bulan</span>}
                        </td>
                        <td>{p.guru ?? <span className="text-xs text-gray-400">belum ditentukan</span>}</td>
                        <td className="whitespace-nowrap text-sm">
                          {p.diantarPada ? <span className="angka text-gray-600">{tglPkl(p.diantarPada)}{p.diantarOleh ? <span className="block text-xs text-gray-400">oleh {p.diantarOleh}</span> : null}</span>
                            : <span className="text-xs text-gray-400">{p.tempat ? "belum diantar" : "—"}</span>}
                          {p.dijemputPada && <span className="angka block text-xs text-gray-400">dijemput {tglPkl(p.dijemputPada)}</span>}
                        </td>
                        <td><span className={`status-badge ${STATUS_PKL[p.status]?.kelas ?? ""}`}>{STATUS_PKL[p.status]?.label ?? p.status}</span></td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {p.mitraId && p.status === "ONGOING" && (
                              <button type="button" title="Mutasi (pindah tempat)" onClick={() => setMutasi(p)} className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 transition"><ArrowRightLeft size={14} /></button>
                            )}
                            {p.jurnal > 0 && (
                              <button type="button" title={`Jurnal harian (${p.jurnal})`} onClick={() => setJurnal(p)} className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 transition"><BookOpen size={14} /></button>
                            )}
                            <button type="button" title="Ubah penempatan" onClick={() => setUbah(p)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                            <button type="button" title="Hapus dari peserta PKL" onClick={() => hapus(p)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="siswa" className="border-t border-gray-100" />
            </>
          )}
        </div>
      </div>

      {ubah && <ModalUbah p={ubah} m={m} onTutup={() => setUbah(null)} onSimpan={() => { setUbah(null); muat(); }} onDudiBaru={muat} />}
      {massal && <ModalMassal siswa={terpilih} m={m} onTutup={() => setMassal(false)} onSimpan={() => { setMassal(false); setPilih(new Set()); muat(); }} />}
      {mutasi && <ModalMutasi p={mutasi} m={m} laporanId={dariLaporan?.studentId === mutasi.studentId ? dariLaporan.laporanId : ""}
        onTutup={() => { setMutasi(null); setDariLaporan(null); }} onSimpan={() => { setMutasi(null); setDariLaporan(null); muat(); }} />}
      {jurnal && <JurnalPklModal studentId={jurnal.studentId} nama={jurnal.nama} tempat={jurnal.tempat} onTutup={() => setJurnal(null)} />}
      {masuk && <ModalMasuk onTutup={() => setMasuk(false)} onSimpan={() => { setMasuk(false); muat(); }} />}
    </div>
  );
}

/** Kirim; bila server meminta kepastian (kuota penuh, jurusan tidak tercatat), tanya dulu lalu kirim ulang dengan `paksa`. */
function useKirim() {
  const toast = useToast();
  const confirm = useConfirm();
  return async function kirim(url: string, method: string, body: Record<string, unknown>): Promise<boolean> {
    for (const paksa of [false, true]) {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, paksa }) }).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (r?.ok) return true;
      if (r?.status === 409 && Array.isArray(d?.peringatan) && !paksa) {
        if (!await confirm(`${d.peringatan.join(" ")} Tetap lanjutkan?`)) return false;
        continue;
      }
      toast.error(d?.error ?? "Gagal menyimpan");
      return false;
    }
    return false;
  };
}

/** Isian waktu PKL: tanggal mulai + lama (3 / 6 bulan / lainnya) → tanggal selesai terisi sendiri, tetap bisa diubah. */
function IsianWaktu({ mulai, selesai, lama, set }: { mulai: string; selesai: string; lama: string; set: (v: { mulai?: string; selesai?: string; lama?: string }) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="min-w-0">
        <label className="label-field">Mulai</label>
        <DatePicker value={mulai} onChange={v => set({ mulai: v, ...(lama && v ? { selesai: selesaiDari(v, Number(lama)) } : {}) })} />
      </div>
      <div className="min-w-0">
        <label className="label-field">Lama PKL</label>
        <Select value={lama} onChange={v => set({ lama: v, ...(v && mulai ? { selesai: selesaiDari(mulai, Number(v)) } : {}) })}
          options={[...PILIHAN_LAMA.map(n => ({ value: String(n), label: `${n} bulan` })), { value: "", label: "Lainnya (atur tanggal)" }]} />
      </div>
      <div className="min-w-0">
        <label className="label-field">Selesai</label>
        <DatePicker value={selesai} onChange={v => set({ selesai: v, lama: "" })} />
      </div>
    </div>
  );
}

function PilihDudi({ nilai, set, m, onBaru, kosong }: { nilai: string; set: (v: string) => void; m: Muatan; onBaru?: () => Promise<unknown>; kosong?: string }) {
  const toast = useToast();
  const [nama, setNama] = useState("");
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  async function tambah() {
    if (!nama.trim()) return;
    setSibuk(true);
    const r = await fetch("/api/pkl/dudi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nama }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menambah DUDI"); return; }
    await onBaru?.();
    set(d.id); setNama(""); setBuka(false);
    toast.success("DUDI ditambahkan — lengkapi datanya di Data DUDI");
  }
  return (
    <div>
      <Select value={nilai} onChange={set} placeholder="Pilih DUDI"
        options={[...(kosong ? [{ value: "", label: kosong }] : []), ...m.dudi.filter(d => d.aktif || d.id === nilai).map(d => ({ value: d.id, label: labelDudi(d) }))]} />
      {onBaru && (buka ? (
        <div className="mt-2 flex gap-2">
          <input className="input-field" value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama DUDI baru" />
          <button type="button" className="btn-modal-save shrink-0" disabled={sibuk || !nama.trim()} onClick={tambah}>{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Tambah</button>
        </div>
      ) : (
        <button type="button" className="mt-1.5 text-xs font-medium text-primary-700 hover:underline" onClick={() => setBuka(true)}>DUDI belum ada di daftar? Tambahkan</button>
      ))}
    </div>
  );
}

function ModalUbah({ p, m, onTutup, onSimpan, onDudiBaru }: { p: PesertaPkl; m: Muatan; onTutup: () => void; onSimpan: () => void; onDudiBaru: () => Promise<unknown> }) {
  const kirim = useKirim();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({
    mitraId: p.mitraId ?? "", posisi: p.posisi, pembimbingIndustri: p.pembimbingIndustri, mulai: p.mulai, selesai: p.selesai,
    lama: p.lamaBulan ? String(p.lamaBulan) : "", guruId: p.guruId ?? "", status: p.status,
    diantarPada: p.diantarPada ?? "", diantarOleh: p.diantarOleh ?? "", diterimaOleh: p.diterimaOleh ?? "",
    dijemputPada: p.dijemputPada ?? "", dijemputOleh: p.dijemputOleh ?? "",
  });
  const berjalanDiTempatLain = !!p.mitraId && p.status === "ONGOING" && p.mulai <= hariIni();
  async function simpan() {
    if (!f.mulai || !f.selesai) { toast.error("Tanggal mulai dan selesai wajib diisi."); return; }
    setSibuk(true);
    const ok = await kirim(`/api/pkl/penempatan/${p.studentId}`, "PUT", { ...f, lamaBulan: f.lama ? Number(f.lama) : null });
    setSibuk(false);
    if (ok) { toast.success("Penempatan disimpan"); onSimpan(); }
  }
  return (
    <Modal open onClose={onTutup} size="lg" scrollBody title="Penempatan PKL" description={`${p.nama} · ${p.kelas ?? "tanpa kelas"}`}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
      </>}>
      <>
        <div>
          <label className="label-field">Tempat PKL (DUDI)</label>
          {berjalanDiTempatLain ? (
            <p className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">{p.tempat} — PKL sudah berjalan. Pindah tempat lewat tombol <span className="font-medium">Mutasi</span>.</p>
          ) : <PilihDudi nilai={f.mitraId} set={v => setF(x => ({ ...x, mitraId: v, ...(!x.pembimbingIndustri ? { pembimbingIndustri: m.dudi.find(d => d.id === v)?.kontak ?? "" } : {}) }))} m={m} onBaru={onDudiBaru} kosong="— Belum ditentukan —" />}
          {p.tanpaKatalog && <p className="mt-1.5 text-xs text-amber-700">Tempat lama &ldquo;{p.tempat}&rdquo; diketik bebas. Pilih DUDI yang sesuai dari daftar supaya kuota dan rekapnya terhitung.</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0"><label className="label-field">Posisi / bagian</label><input className="input-field" value={f.posisi} onChange={e => setF(x => ({ ...x, posisi: e.target.value }))} placeholder="mis. Teknisi jaringan" /></div>
          <div className="min-w-0"><label className="label-field">Pembimbing industri</label><input className="input-field" value={f.pembimbingIndustri} onChange={e => setF(x => ({ ...x, pembimbingIndustri: e.target.value }))} /></div>
        </div>
        <IsianWaktu mulai={f.mulai} selesai={f.selesai} lama={f.lama} set={v => setF(x => ({ ...x, ...v }))} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0"><label className="label-field">Guru pembimbing (sekolah)</label>
            <Select value={f.guruId} onChange={v => setF(x => ({ ...x, guruId: v }))} options={[{ value: "", label: "— Belum ditentukan —" }, ...m.guru.map(g => ({ value: g.id, label: g.nama }))]} /></div>
          <div className="min-w-0"><label className="label-field">Status</label>
            <Select value={f.status} onChange={v => setF(x => ({ ...x, status: v }))} options={Object.entries(STATUS_PKL).map(([value, s]) => ({ value, label: s.label }))} /></div>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary-900"><Truck size={15} /> Pengantaran &amp; penjemputan</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0"><label className="label-field">Diantar tanggal</label><DatePicker value={f.diantarPada} onChange={v => setF(x => ({ ...x, diantarPada: v }))} /></div>
            <div className="min-w-0"><label className="label-field">Diantar oleh</label><input className="input-field" value={f.diantarOleh} onChange={e => setF(x => ({ ...x, diantarOleh: e.target.value }))} placeholder="Nama guru" /></div>
            <div className="min-w-0"><label className="label-field">Diterima oleh</label><input className="input-field" value={f.diterimaOleh} onChange={e => setF(x => ({ ...x, diterimaOleh: e.target.value }))} placeholder="Pihak DUDI" /></div>
            <div className="min-w-0"><label className="label-field">Dijemput tanggal</label><DatePicker value={f.dijemputPada} onChange={v => setF(x => ({ ...x, dijemputPada: v }))} /></div>
            <div className="min-w-0"><label className="label-field">Dijemput oleh</label><input className="input-field" value={f.dijemputOleh} onChange={e => setF(x => ({ ...x, dijemputOleh: e.target.value }))} placeholder="Nama guru" /></div>
          </div>
        </div>
      </>
    </Modal>
  );
}

function ModalMassal({ siswa, m, onTutup, onSimpan }: { siswa: PesertaPkl[]; m: Muatan; onTutup: () => void; onSimpan: () => void }) {
  const kirim = useKirim();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ mitraId: "", posisi: "", pembimbingIndustri: "", mulai: "", selesai: "", lama: "", guruId: "TETAP" });
  const dudi = m.dudi.find(d => d.id === f.mitraId);
  const sisa = dudi?.kuota != null ? dudi.kuota - dudi.terisi : null;
  async function simpan() {
    setSibuk(true);
    const ok = await kirim("/api/pkl/penempatan", "POST", {
      studentIds: siswa.map(s => s.studentId), mitraId: f.mitraId || null, posisi: f.posisi, pembimbingIndustri: f.pembimbingIndustri,
      ...(f.mulai && f.selesai ? { mulai: f.mulai, selesai: f.selesai, lamaBulan: f.lama ? Number(f.lama) : null } : {}),
      ...(f.guruId !== "TETAP" ? { guruId: f.guruId } : {}),
    });
    setSibuk(false);
    if (ok) { toast.success(`${siswa.length} siswa diperbarui`); onSimpan(); }
  }
  return (
    <Modal open onClose={onTutup} size="lg" scrollBody title="Penempatan Massal" description={`${siswa.length} siswa terpilih`}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Terapkan ke {siswa.length} Siswa</button>
      </>}>
      <>
        <p className="text-sm text-gray-500">Hanya isian yang diisi yang diubah. Kosongkan yang tidak ingin disentuh — misalnya isi guru pembimbing saja untuk menetapkannya ke semua siswa terpilih.</p>
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">{siswa.slice(0, 8).map(s => s.nama).join(", ")}{siswa.length > 8 ? `, dan ${siswa.length - 8} lainnya` : ""}</p>
        <div>
          <label className="label-field">Tempat PKL (DUDI)</label>
          <PilihDudi nilai={f.mitraId} set={v => setF(x => ({ ...x, mitraId: v }))} m={m} kosong="— Tidak diubah —" />
          {sisa != null && <p className={`mt-1.5 text-xs ${sisa < siswa.length ? "text-amber-700" : "text-gray-500"}`}>Sisa kuota {Math.max(0, sisa)} siswa{sisa < siswa.length ? ` — kurang untuk ${siswa.length} siswa terpilih.` : "."}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0"><label className="label-field">Posisi / bagian</label><input className="input-field" value={f.posisi} onChange={e => setF(x => ({ ...x, posisi: e.target.value }))} placeholder="Tidak diubah" /></div>
          <div className="min-w-0"><label className="label-field">Pembimbing industri</label><input className="input-field" value={f.pembimbingIndustri} onChange={e => setF(x => ({ ...x, pembimbingIndustri: e.target.value }))} placeholder="Tidak diubah" /></div>
        </div>
        <IsianWaktu mulai={f.mulai} selesai={f.selesai} lama={f.lama} set={v => setF(x => ({ ...x, ...v }))} />
        <div>
          <label className="label-field">Guru pembimbing (sekolah)</label>
          <Select value={f.guruId} onChange={v => setF(x => ({ ...x, guruId: v }))}
            options={[{ value: "TETAP", label: "— Tidak diubah —" }, { value: "", label: "Lepaskan guru pembimbing" }, ...m.guru.map(g => ({ value: g.id, label: g.nama }))]} />
        </div>
      </>
    </Modal>
  );
}

function ModalMutasi({ p, m, laporanId, onTutup, onSimpan }: { p: PesertaPkl; m: Muatan; laporanId?: string; onTutup: () => void; onSimpan: () => void }) {
  const kirim = useKirim();
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ mitraId: "", tanggal: hariIni(), alasan: "", posisi: "" });
  const [riwayat, setRiwayat] = useState<{ id: string; tanggal: string; dariNama: string; keNama: string; alasan: string; olehNama: string }[]>([]);
  useEffect(() => {
    fetch(`/api/pkl/penempatan/${p.studentId}/mutasi`).then(r => r.json()).then(d => setRiwayat(d.riwayat ?? [])).catch(() => {});
  }, [p.studentId]);
  async function simpan() {
    if (!f.mitraId || !f.tanggal || f.alasan.trim().length < 5) { toast.error("DUDI tujuan, tanggal, dan alasan wajib diisi."); return; }
    setSibuk(true);
    const ok = await kirim(`/api/pkl/penempatan/${p.studentId}/mutasi`, "POST", { ...f, laporanId: laporanId || undefined });
    setSibuk(false);
    if (ok) { toast.success("Mutasi dicatat"); onSimpan(); }
  }
  return (
    <Modal open onClose={onTutup} size="lg" scrollBody title="Mutasi Tempat PKL" description={`${p.nama} · sekarang di ${p.tempat}`}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />} Pindahkan</button>
      </>}>
      <>
        <p className="text-sm text-gray-500">Tempat lama tersimpan di riwayat bersama alasannya. Catatan pengantaran dikosongkan karena siswa diantar lagi ke tempat baru, dan tautan penilaian pembimbing di tempat lama dicabut.</p>
        <div><label className="label-field">DUDI tujuan</label>
          <Select value={f.mitraId} onChange={v => setF(x => ({ ...x, mitraId: v }))} placeholder="Pilih DUDI tujuan"
            options={m.dudi.filter(d => d.aktif && d.id !== p.mitraId).map(d => ({ value: d.id, label: labelDudi(d) }))} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0"><label className="label-field">Tanggal pindah</label><DatePicker value={f.tanggal} onChange={v => setF(x => ({ ...x, tanggal: v }))} /></div>
          <div className="min-w-0"><label className="label-field">Posisi di tempat baru</label><input className="input-field" value={f.posisi} onChange={e => setF(x => ({ ...x, posisi: e.target.value }))} placeholder="Sama seperti sebelumnya" /></div>
        </div>
        <div><label className="label-field">Alasan pindah</label>
          <textarea className="input-field" rows={3} value={f.alasan} onChange={e => setF(x => ({ ...x, alasan: e.target.value }))} placeholder="mis. DUDI mengurangi jumlah siswa PKL; tidak sesuai kompetensi jurusan" /></div>
        {riwayat.length > 0 && (
          <div>
            <p className="label-kecil mb-2">Riwayat pindah</p>
            <ul className="space-y-2">
              {riwayat.map(r => (
                <li key={r.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                  <p className="text-gray-700"><span className="angka text-gray-400">{tglPkl(r.tanggal)}</span> · {r.dariNama} → {r.keNama}</p>
                  <p className="text-xs text-gray-500">{r.alasan} — dicatat {r.olehNama}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    </Modal>
  );
}

/** Memasukkan seluruh siswa aktif satu tingkat sebagai peserta (yang sudah peserta dilewati) — tempatnya menyusul. */
function ModalMasuk({ onTutup, onSimpan }: { onTutup: () => void; onSimpan: () => void }) {
  const toast = useToast();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ grade: "12", mulai: "", selesai: "", lama: "6" });
  async function simpan() {
    if (!f.mulai || !f.selesai) { toast.error("Tanggal mulai dan selesai wajib diisi."); return; }
    setSibuk(true);
    const r = await fetch("/api/admin/internships/massal", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: Number(f.grade), startDate: f.mulai, endDate: f.selesai }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal memasukkan peserta"); return; }
    toast.success(d.dibuat > 0 ? `${d.dibuat} siswa dimasukkan sebagai peserta PKL` : (d.pesan ?? "Tidak ada yang perlu ditambahkan"));
    onSimpan();
  }
  return (
    <Modal open onClose={onTutup} size="lg" title="Masukkan Peserta PKL" description="Siswa yang sudah menjadi peserta tidak disentuh"
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Masukkan</button>
      </>}>
      <>
        <p className="text-sm text-gray-500">Seluruh siswa aktif pada tingkat yang dipilih dimasukkan sebagai peserta PKL dengan tempat &ldquo;Belum dapat DUDI&rdquo;. Tanggal di sini hanya rencana awal dan bisa diubah per siswa atau per kelompok — misalnya sebagian 3 bulan, sebagian 6 bulan.</p>
        <div><label className="label-field">Tingkat kelas</label>
          <Select value={f.grade} onChange={v => setF(x => ({ ...x, grade: v }))} options={[{ value: "12", label: "Kelas XII" }, { value: "11", label: "Kelas XI" }, { value: "10", label: "Kelas X" }]} /></div>
        <IsianWaktu mulai={f.mulai} selesai={f.selesai} lama={f.lama} set={v => setF(x => ({ ...x, ...v }))} />
      </>
    </Modal>
  );
}
