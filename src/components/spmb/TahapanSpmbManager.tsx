"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ListChecks, Search, Loader2, Check, Clock, AlertTriangle, XCircle, Download, MessageCircle, FileText, Shirt,
  ClipboardList, HeartPulse, Send, Copy, ExternalLink, Save, Undo2, Users, Mail, Wallet, Plus, Trash2, Percent, Printer,
} from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { salinTeks } from "@/lib/salin-teks";
import {
  INFO_TAHAP, LABEL_SYARAT_BAYAR, hitungImt, peringatanButaWarna, pesanKabar, rupiah,
  type InfoBayar, type InfoMpls, type SyaratBayar, type IsiTahap, type IsianTahap, type KodeTahap, type SetelanSeragam, type StatusTahap, type TahapCalon, type IsiSeragam,
} from "@/lib/spmb-tahapan";

type Baris = {
  id: string; nomor: string | null; nama: string; jurusan: string; phone: string; email: string; gelombangId: string | null;
  status: string; verifikasiStatus: string; diperbaiki: boolean;
  centang: Record<string, StatusTahap>; berjalan: { kode: KodeTahap; judul: string; status: StatusTahap } | null;
  tuntas: boolean; ditolak: boolean; grupDiklik: boolean; grupBergabung: boolean; sudahSiswa: boolean;
  bayar: { sah: number; menunggu: number; sisa: number; tagihan: number; lunas: boolean };
  sesiId: string | null; sesi: string | null;
};
type Rekap = {
  bayarRingkas: { tagihanPerCalon: number; biayaGelombang: { nama: string; biaya: number }[]; syarat: SyaratBayar; uangMuka: number; terkumpul: number; menungguPeriksa: number; lunas: number };
  data: Baris[]; kode: KodeTahap[]; rekapTahap: Record<KodeTahap, number>;
  perGelombang: { id: string; nama: string; adaGrup: boolean; pendaftar: number; klikGrup: number; bergabung: number; sesi: { id: string; label: string; kuota: number; terisi: number }[] }[];
};

type Detail = {
  calon: {
    id: string; nomor: string | null; nama: string; jurusan: string; phone: string; email: string; lahir: string; tempatLahir: string | null;
    gender: string | null; sekolahAsal: string | null; wali: string | null; alamat: string | null; status: string; gelombang: string | null;
    nik: string | null; nisn: string | null; jalur: string; wilayah: string | null; perujuk: string | null;
    verifikasiStatus: string; verifikasiPesan: string | null; verifikasiDokumen: string[]; verifikasiAt: string | null; verifikasiOleh: string | null;
    perbaikanAt: string | null; seragam: IsiSeragam | null; seragamAt: string | null;
    asesmen: IsiTahap; asesmenAt: string | null; asesmenOleh: string | null;
    pemeriksaan: IsiTahap; pemeriksaanAt: string | null; pemeriksaanOleh: string | null;
    grupDiklik: boolean; grupBergabung: boolean; daftarUlangAt: string | null; keteranganPotongan: string | null; sesiId: string | null;
  };
  sesiPilihan: { id: string; tanggal: string; jamMulai: string; jamSelesai: string; tempat: string | null; kuota: number; terisi: number; sisa: number }[];
  langganan: number;
  kabar: { id: string; judul: string; isi: string; perangkat: number; createdAt: string }[];
  bayar: InfoBayar;
  pembayaran: {
    id: string; jumlah: number; tanggal: string; metode: string; bukti: string | null; catatan: string | null; status: string;
    alasanTolak: string | null; dicatatOleh: string | null; disahkanOleh: string | null;
  }[];
  berkas: { kunci: string; label: string; url: string | null }[];
  tahap: TahapCalon[]; tuntas: boolean; ditolak: boolean;
  isian: { asesmen: IsianTahap[]; pemeriksaan: IsianTahap[] };
  setelanSeragam: SetelanSeragam; mpls: InfoMpls; sekolah: string; tautan: string | null;
};

const SARINGAN = [
  { value: "", label: "Semua tahap" },
  { value: "VERIFIKASI", label: "Menunggu verifikasi" },
  { value: "PERBAIKAN", label: "Diminta perbaikan" },
  { value: "DIPERBAIKI", label: "Sudah diperbaiki — periksa ulang" },
  { value: "SERAGAM", label: "Belum pilih seragam" },
  { value: "ASESMEN", label: "Menunggu asesmen" },
  { value: "PEMERIKSAAN", label: "Menunggu cek kesehatan" },
  { value: "DITERIMA", label: "Menunggu pengumuman" },
  { value: "DAFTAR_ULANG", label: "Menunggu daftar ulang" },
  { value: "TUNTAS", label: "Tuntas — resmi MPLS" },
  { value: "K_DITERIMA", label: "Keputusan: diterima" },
  { value: "K_CADANGAN", label: "Keputusan: cadangan" },
  { value: "K_DITOLAK", label: "Keputusan: tidak diterima" },
  { value: "BAYAR_MENUNGGU", label: "Bukti bayar menunggu diperiksa" },
  { value: "BELUM_LUNAS", label: "Pembayaran belum lunas" },
  { value: "LUNAS", label: "Pembayaran lunas" },
];

const IKON_STATUS: Record<StatusTahap, { ikon: typeof Check; kelas: string; label: string }> = {
  SELESAI: { ikon: Check, kelas: "bg-emerald-600 text-white", label: "Selesai" },
  BERJALAN: { ikon: Clock, kelas: "bg-primary-50 text-primary-700 ring-1 ring-primary-100", label: "Sedang berjalan" },
  PERBAIKAN: { ikon: AlertTriangle, kelas: "bg-amber-100 text-amber-700", label: "Perlu perbaikan" },
  BERHENTI: { ikon: XCircle, kelas: "bg-red-100 text-red-600", label: "Berhenti" },
  MENUNGGU: { ikon: Clock, kelas: "bg-gray-100 text-gray-300", label: "Menunggu" },
};

const SINGKAT: Record<KodeTahap, string> = {
  DAFTAR: "Daftar", VERIFIKASI: "Verif", SERAGAM: "Seragam", ASESMEN: "Asesmen", PEMERIKSAAN: "Kesehatan", DITERIMA: "Hasil", DAFTAR_ULANG: "D. Ulang",
};

export default function TahapanSpmbManager() {
  const [rekap, setRekap] = useState<Rekap | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState("");
  const [gelombang, setGelombang] = useState("");
  const [saring, setSaring] = useState("");
  const [sesiSaring, setSesiSaring] = useState("");
  // Menu lama "Daftar Ulang" dialihkan ke sini dengan ?saring=… (tautan & penanda lama tetap sampai).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("saring");
    if (v && SARINGAN.some(x => x.value === v)) queueMicrotask(() => setSaring(v));
  }, []);
  const [bukaId, setBukaId] = useState<string | null>(null);

  const muat = useCallback(() => {
    return fetch(`/api/spmb/tahapan${gelombang ? `?gelombangId=${gelombang}` : ""}`)
      .then(r => r.json()).then(d => { if (!d.error) setRekap(d); })
      .catch(() => {}).finally(() => setMemuat(false));
  }, [gelombang]);
  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (rekap?.data ?? []).filter(b => {
      if (q && !`${b.nama} ${b.nomor ?? ""} ${b.jurusan} ${b.phone}`.toLowerCase().includes(q)) return false;
      if (sesiSaring && (sesiSaring === "TANPA" ? b.sesiId : b.sesiId !== sesiSaring)) return false;
      if (!saring) return true;
      if (saring === "TUNTAS") return b.tuntas;
      if (saring === "K_DITERIMA") return ["DITERIMA", "ACCEPTED"].includes(b.status);
      if (saring === "K_CADANGAN") return b.status === "CADANGAN";
      if (saring === "K_DITOLAK") return ["DITOLAK", "REJECTED"].includes(b.status);
      if (saring === "BAYAR_MENUNGGU") return b.bayar.menunggu > 0;
      if (saring === "BELUM_LUNAS") return !b.ditolak && !b.bayar.lunas;
      if (saring === "LUNAS") return b.bayar.lunas;
      if (saring === "PERBAIKAN") return b.verifikasiStatus === "PERBAIKAN";
      if (saring === "DIPERBAIKI") return b.diperbaiki;
      if (saring === "VERIFIKASI") return b.berjalan?.kode === "VERIFIKASI" && b.berjalan.status === "BERJALAN";
      return b.berjalan?.kode === saring;
    });
  }, [rekap, cari, saring, sesiSaring]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}|${gelombang}|${sesiSaring}`);
  const opsiSesi = (rekap?.perGelombang.find(g => g.id === gelombang)?.sesi ?? []);

  if (memuat && !rekap) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
  );

  const kode = rekap?.kode ?? [];
  const total = rekap?.data.length ?? 0;
  const tuntas = rekap?.data.filter(b => b.tuntas).length ?? 0;
  const perluPeriksa = rekap?.data.filter(b => b.berjalan?.kode === "VERIFIKASI" && b.berjalan.status === "BERJALAN").length ?? 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ListChecks size={22} />} title="Tahapan Calon Siswa"
        description="Verifikasi berkas, ukuran seragam, asesmen awal, cek fisik & kesehatan — sampai calon resmi mengikuti MPLS" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile value={total} label="Pendaftar" icon={Users} color="primary" />
          <StatTile value={perluPeriksa} label="Menunggu verifikasi berkas" icon={FileText} color="amber" sorot={perluPeriksa > 0} />
          <StatTile value={rekap?.bayarRingkas.menungguPeriksa ?? 0} label="Bukti bayar menunggu diperiksa" icon={Wallet} color="red" sorot={(rekap?.bayarRingkas.menungguPeriksa ?? 0) > 0} />
          <StatTile value={rekap?.rekapTahap.SERAGAM ?? 0} label="Sudah pilih seragam" icon={Shirt} color="blue" />
          <StatTile value={tuntas} label="Resmi peserta MPLS" icon={Check} color="emerald" />
        </div>

        {/* Progres per tahap */}
        <div className="panel p-5">
          <p className="panel-judul mb-4">Kemajuan per tahap</p>
          <div className="space-y-3">
            {kode.map(k => {
              const n = rekap?.rekapTahap[k] ?? 0;
              const p = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={k} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate text-gray-600">{INFO_TAHAP[k].judul}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} /></div>
                  <span className="angka w-20 text-right text-gray-500">{n} / {total}</span>
                </div>
              );
            })}
          </div>
          {rekap && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-500">
              Pembayaran terkumpul <span className="angka font-semibold text-navy">{rupiah(rekap.bayarRingkas.terkumpul)}</span> ·{" "}
              <span className="angka">{rekap.bayarRingkas.lunas}</span> calon lunas · biaya daftar ulang{" "}
              <span className="angka">{rekap.bayarRingkas.biayaGelombang.some(g => g.biaya)
                ? rekap.bayarRingkas.biayaGelombang.filter(g => g.biaya).map(g => `${g.nama} ${rupiah(g.biaya)}`).join(", ")
                : rekap.bayarRingkas.tagihanPerCalon ? rupiah(rekap.bayarRingkas.tagihanPerCalon) : "belum ditetapkan"}</span> ·
              syarat ikut MPLS: {LABEL_SYARAT_BAYAR[rekap.bayarRingkas.syarat]}{rekap.bayarRingkas.syarat === "UANG_MUKA" ? ` ${rupiah(rekap.bayarRingkas.uangMuka)}` : ""}
            </p>
          )}
        </div>

        {/* Grup WA per gelombang */}
        {(rekap?.perGelombang.length ?? 0) > 0 && (
          <div className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Grup WhatsApp per gelombang</p></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Gelombang</th><th className="text-right">Pendaftar</th><th className="text-right">Membuka tautan grup</th><th className="text-right">Menyatakan bergabung</th><th>Tautan grup</th></tr></thead>
                <tbody>
                  {rekap!.perGelombang.map(g => (
                    <tr key={g.id}>
                      <td className="font-medium text-primary-900">{g.nama}</td>
                      <td className="angka text-right">{g.pendaftar}</td>
                      <td className="angka text-right">{g.klikGrup}</td>
                      <td className="angka text-right">{g.bergabung}</td>
                      <td>{g.adaGrup
                        ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Terpasang</span>
                        : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum diisi</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
              WhatsApp tidak mengizinkan situs membaca isi grup, jadi angka ini dari calon yang menekan tombol grup dan yang menyatakan sudah bergabung.
              Tautan grup diisi di Pengaturan SPMB → Gelombang & Kuota.
            </p>
          </div>
        )}

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, nomor pendaftaran, jurusan, WA..." />
          </div>
          <div className="alat-saring">
            <Select value={gelombang} onChange={v => { setGelombang(v); setSesiSaring(""); }} placeholder="Semua gelombang"
              options={[{ value: "", label: "Semua gelombang" }, ...(rekap?.perGelombang ?? []).map(g => ({ value: g.id, label: g.nama }))]} />
          </div>
          <div className="alat-saring"><Select value={saring} onChange={setSaring} options={SARINGAN} /></div>
          {opsiSesi.length > 0 && (
            <div className="alat-saring">
              <Select value={sesiSaring} onChange={setSesiSaring}
                options={[{ value: "", label: "Semua sesi" }, { value: "TANPA", label: "Belum memilih sesi" },
                  ...opsiSesi.map(x => ({ value: x.id, label: `${x.label} (${x.terisi}/${x.kuota})` }))]} />
            </div>
          )}
          <div className="alat-aksi">
            <a href={`/api/spmb/tahapan/seragam${gelombang ? `?gelombangId=${gelombang}` : ""}`} className="btn-modal-cancel btn-teks">
              <Download size={16} /> Rekap Seragam
            </a>
            <a href={`/api/spmb/tahapan/pembayaran${gelombang ? `?gelombangId=${gelombang}` : ""}`} className="btn-modal-cancel btn-teks">
              <Download size={16} /> Rekap Pembayaran
            </a>
            <a href="/api/admin/export/admissions" className="btn-modal-cancel btn-teks">
              <Download size={16} /> Data Pendaftar
            </a>
          </div>
        </div>

        <div className="panel overflow-hidden">
          {tersaring.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Belum ada calon pada saringan ini.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">No</th>
                      <th>Calon</th>
                      {kode.map(k => <th key={k} className="text-center">{SINGKAT[k]}</th>)}
                      <th className="text-right">Pembayaran</th>
                      <th>Tahap sekarang</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hal.potongan.map((b, i) => (
                      <tr key={b.id}>
                        <td className="angka">{hal.awal + i}</td>
                        <td>
                          <p className="font-medium text-primary-900">{b.nama}</p>
                          <p className="text-xs text-gray-400">{b.nomor} · {b.jurusan || "—"}</p>
                        </td>
                        {kode.map(k => {
                          const st = IKON_STATUS[b.centang[k] ?? "MENUNGGU"];
                          return (
                            <td key={k} className="text-center">
                              <span title={`${INFO_TAHAP[k].judul}: ${st.label}`} className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${st.kelas}`}>
                                <st.ikon size={13} />
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-right">
                          {b.bayar.lunas ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Lunas</span>
                            : <span className="angka text-sm text-gray-600">{b.bayar.sah ? rupiah(b.bayar.sah) : "—"}</span>}
                          {b.bayar.menunggu > 0 && <span className="mt-1 block text-xs text-amber-700">+{rupiah(b.bayar.menunggu)} diperiksa</span>}
                        </td>
                        <td>
                          {b.tuntas ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Resmi MPLS</span>
                            : b.ditolak ? <span className="status-badge bg-red-50 text-red-600 border-red-200">Tidak diterima</span>
                            : b.diperbaiki ? <span className="status-badge bg-blue-50 text-blue-700 border-blue-200">Sudah diperbaiki</span>
                            : b.berjalan?.status === "PERBAIKAN" ? <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Menunggu perbaikan</span>
                            : <span className="text-sm text-gray-600">{b.berjalan?.judul}</span>}
                          {b.sesi && <span className="angka mt-1 block text-xs text-gray-400">Sesi {b.sesi}</span>}
                        </td>
                        <td className="text-right">
                          <button type="button" onClick={() => setBukaId(b.id)} className="btn-modal-save px-3 text-xs">Buka</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="calon" className="border-t border-gray-100" />
            </>
          )}
        </div>
      </div>

      {bukaId && <DetailCalon id={bukaId} onTutup={() => setBukaId(null)} onBerubah={muat} />}
    </div>
  );
}

/* ─────────────────────────────── Detail calon ─────────────────────────────── */

const TAB_DETAIL = [
  { id: "berkas", label: "Data & Berkas", ikon: FileText },
  { id: "seragam", label: "Seragam", ikon: Shirt },
  { id: "asesmen", label: "Asesmen", ikon: ClipboardList },
  { id: "pemeriksaan", label: "Fisik & Kesehatan", ikon: HeartPulse },
  { id: "bayar", label: "Daftar Ulang & Bayar", ikon: Wallet },
  { id: "kabar", label: "Kabari Calon", ikon: Send },
] as const;

function DetailCalon({ id, onTutup, onBerubah }: { id: string; onTutup: () => void; onBerubah: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<(typeof TAB_DETAIL)[number]["id"]>("berkas");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    return fetch(`/api/spmb/tahapan/${id}`).then(r => r.json()).then(x => { if (!x.error) setD(x); else toast.error(x.error); })
      .catch(() => toast.error("Gagal memuat data calon"));
  }, [id, toast]);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(body: Record<string, unknown>, pesanOk: string) {
    setSibuk(true);
    const r = await fetch(`/api/spmb/tahapan/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(pesanOk); await muat(); onBerubah(); return true; }
    toast.error(x?.error ?? "Gagal menyimpan");
    return false;
  }

  return (
    <Modal open onClose={onTutup} size="xl" scrollBody title={d ? d.calon.nama : "Memuat..."}
      description={d ? `${d.calon.nomor ?? ""} · ${d.calon.jurusan || "—"}${d.calon.gelombang ? ` · ${d.calon.gelombang}` : ""}` : undefined}>
      {!d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          {/* Garis tahapan ringkas */}
          <div className="flex flex-wrap gap-1.5">
            {d.tahap.map(t => {
              const st = IKON_STATUS[t.status];
              return (
                <span key={t.kode} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${st.kelas}`}>
                  <st.ikon size={12} /> {t.judul}
                </span>
              );
            })}
          </div>

          <BarisKeputusan d={d} sibuk={sibuk} onTutup={onTutup} onBerubah={async () => { await muat(); onBerubah(); }} />

          {d.sesiPilihan.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3">
              <span className="text-sm font-medium text-gray-600">Sesi kedatangan</span>
              <div className="min-w-[16rem] flex-1">
                <Select value={d.calon.sesiId ?? ""} onChange={v => kirim({ aksi: "sesi", sesiId: v }, v ? "Sesi ditetapkan" : "Sesi dilepas")}
                  options={[{ value: "", label: "Belum memilih" }, ...d.sesiPilihan.map(x => ({
                    value: x.id, label: `${x.tanggal} ${x.jamMulai}–${x.jamSelesai}${x.tempat ? ` · ${x.tempat}` : ""} (${x.terisi}/${x.kuota})`,
                  }))]} />
              </div>
            </div>
          )}

          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {TAB_DETAIL.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`sentuh flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t.id ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <t.ikon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "berkas" && <TabBerkas d={d} sibuk={sibuk} kirim={kirim} />}
          {tab === "seragam" && <TabSeragamPanitia d={d} sibuk={sibuk} kirim={kirim} />}
          {tab === "asesmen" && <TabIsian key="asesmen" jenis="asesmen" d={d} sibuk={sibuk} kirim={kirim} />}
          {tab === "pemeriksaan" && <TabIsian key="pemeriksaan" jenis="pemeriksaan" d={d} sibuk={sibuk} kirim={kirim} />}
          {tab === "bayar" && <TabBayar d={d} sibuk={sibuk} kirim={kirim} />}
          {tab === "kabar" && <TabKabar d={d} />}
        </div>
      )}
    </Modal>
  );
}

type KirimDetail = (body: Record<string, unknown>, pesanOk: string) => Promise<boolean>;

function waktu(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "";
}

function TabBerkas({ d, sibuk, kirim }: { d: Detail; sibuk: boolean; kirim: KirimDetail }) {
  const confirm = useConfirm();
  const c = d.calon;
  const [pesan, setPesan] = useState(c.verifikasiPesan ?? "");
  const [dokumen, setDokumen] = useState<string[]>(c.verifikasiDokumen);
  const [modePerbaikan, setModePerbaikan] = useState(false);
  const data: [string, string | null][] = [
    ["Tempat, tanggal lahir", `${c.tempatLahir ?? "—"}, ${new Date(c.lahir + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}`],
    ["Jenis kelamin", c.gender === "L" ? "Laki-laki" : c.gender === "P" ? "Perempuan" : c.gender],
    ["NIK", c.nik], ["NISN", c.nisn], ["Jalur", c.jalur], ["Diajak oleh (referral)", c.perujuk],
    ["Sekolah asal", c.sekolahAsal], ["Orang tua / wali", c.wali], ["WhatsApp", c.phone], ["E-mail", c.email],
    ["Wilayah", c.wilayah], ["Alamat", c.alamat],
  ];

  return (
    <div className="space-y-5">
      {c.verifikasiStatus === "TERVERIFIKASI" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p><Check size={15} className="mr-1 inline" /> Berkas terverifikasi {waktu(c.verifikasiAt)}{c.verifikasiOleh ? ` oleh ${c.verifikasiOleh}` : ""}.</p>
          <button type="button" disabled={sibuk} className="btn-modal-cancel btn-teks"
            onClick={async () => { if (await confirm("Batalkan verifikasi? Tahap berikutnya ikut terkunci lagi bagi calon.")) kirim({ aksi: "batal-verifikasi" }, "Verifikasi dibatalkan"); }}>
            <Undo2 size={16} /> Batalkan
          </button>
        </div>
      )}
      {c.verifikasiStatus === "PERBAIKAN" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Menunggu perbaikan dari calon</p>
          <p className="whitespace-pre-line">{c.verifikasiPesan}</p>
        </div>
      )}
      {c.verifikasiStatus === "BELUM" && c.perbaikanAt && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Calon mengirim perbaikan berkas {waktu(c.perbaikanAt)}. Periksa lagi berkas di bawah.
          {c.verifikasiPesan && <span className="mt-1 block text-blue-700">Pesan sebelumnya: {c.verifikasiPesan}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {data.map(([k, v]) => (
          <div key={k} className="min-w-0"><p className="text-xs text-gray-400">{k}</p><p className="break-words text-gray-700">{v || "—"}</p></div>
        ))}
      </div>

      <div>
        <p className="label-field">Berkas</p>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {d.berkas.map(b => (
            <div key={b.kunci} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              {modePerbaikan && (
                <input type="checkbox" checked={dokumen.includes(b.kunci)} aria-label={`Minta unggah ulang ${b.label}`}
                  onChange={e => setDokumen(x => e.target.checked ? [...x, b.kunci] : x.filter(k => k !== b.kunci))} />
              )}
              <FileText size={16} className="shrink-0 text-gray-400" />
              <span className="min-w-0 flex-1 text-sm text-gray-700">{b.label}</span>
              {b.url
                ? <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">Lihat <ExternalLink size={13} /></a>
                : <span className="text-sm text-gray-400">Tidak diunggah</span>}
            </div>
          ))}
        </div>
      </div>

      {modePerbaikan ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">Centang berkas yang harus diunggah ulang (boleh tidak ada), lalu tulis pesan untuk calon. Pesan tampil di halaman tahapan calon.</p>
          <textarea className="input-field min-h-[90px]" value={pesan} onChange={e => setPesan(e.target.value)}
            placeholder="Contoh: Foto Kartu Keluarga buram, mohon unggah ulang dengan foto yang jelas." />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setModePerbaikan(false)} className="btn-modal-cancel">Batal</button>
            <button type="button" disabled={sibuk || !pesan.trim()} className="btn-modal-save"
              onClick={async () => { if (await kirim({ aksi: "perbaikan", pesan, dokumen }, "Permintaan perbaikan dikirim")) setModePerbaikan(false); }}>
              <Send size={16} /> Kirim ke Calon
            </button>
          </div>
        </div>
      ) : c.verifikasiStatus !== "TERVERIFIKASI" && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setModePerbaikan(true)} className="btn-modal-cancel btn-teks"><AlertTriangle size={16} /> Minta Perbaikan</button>
          <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: "verifikasi" }, "Berkas terverifikasi")} className="btn-modal-save btn-teks">
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Berkas Lengkap — Verifikasi
          </button>
        </div>
      )}
    </div>
  );
}

function TabSeragamPanitia({ d, sibuk, kirim }: { d: Detail; sibuk: boolean; kirim: KirimDetail }) {
  const { setelanSeragam: s, calon: c } = d;
  const [pilihan, setPilihan] = useState<Record<string, string>>(() => Object.fromEntries((c.seragam?.pilihan ?? []).map(p => [p.item, p.ukuran])));
  const [catatan, setCatatan] = useState(c.seragam?.catatan ?? "");
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {c.seragamAt ? `Dipilih ${waktu(c.seragamAt)}.` : "Calon belum memilih ukuran."} Panitia boleh mengisi atau mengubah atas nama calon
        (mis. setelah diukur langsung). Ukuran yang dipilih calon terkunci begitu asesmen diselesaikan.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {s.item.map(i => (
          <div key={i.nama}>
            <label className="label-field">{i.nama}</label>
            <Select value={pilihan[i.nama] ?? ""} onChange={v => setPilihan(p => ({ ...p, [i.nama]: v }))} placeholder="Pilih ukuran"
              options={i.ukuran.map(u => ({ value: u.label, label: u.keterangan ? `${u.label} — ${u.keterangan}` : u.label }))} />
          </div>
        ))}
      </div>
      <div><label className="label-field">Catatan</label><input className="input-field" value={catatan} onChange={e => setCatatan(e.target.value)} /></div>
      <div className="flex flex-wrap justify-end gap-2">
        {c.seragamAt && (
          <button type="button" disabled={sibuk} className="btn-modal-cancel btn-teks"
            onClick={() => kirim({ aksi: "buka-ulang", tahap: "SERAGAM" }, "Tahap seragam dibuka ulang")}><Undo2 size={16} /> Buka Ulang</button>
        )}
        <button type="button" disabled={sibuk || s.item.some(i => !pilihan[i.nama])} className="btn-modal-save"
          onClick={() => kirim({ aksi: "seragam", pilihan: s.item.map(i => ({ item: i.nama, ukuran: pilihan[i.nama] })), catatan }, "Ukuran seragam disimpan")}>
          <Save size={16} /> Simpan
        </button>
      </div>
    </div>
  );
}

function TabIsian({ jenis, d, sibuk, kirim }: { jenis: "asesmen" | "pemeriksaan"; d: Detail; sibuk: boolean; kirim: KirimDetail }) {
  const isian = d.isian[jenis];
  const tersimpan = d.calon[jenis];
  const selesaiAt = jenis === "asesmen" ? d.calon.asesmenAt : d.calon.pemeriksaanAt;
  const oleh = jenis === "asesmen" ? d.calon.asesmenOleh : d.calon.pemeriksaanOleh;
  const [nilai, setNilai] = useState<Record<string, string>>(() => Object.fromEntries(tersimpan.jawaban.map(j => [j.id, j.nilai])));
  const [catatan, setCatatan] = useState(tersimpan.catatan ?? "");
  const set = (k: string, v: string) => setNilai(x => ({ ...x, [k]: v }));

  // Penanda khusus pemeriksaan: IMT otomatis & peringatan buta warna (hanya peringatan — keputusan di panitia).
  const tinggi = isian.find(i => i.bukuInduk === "height");
  const berat = isian.find(i => i.bukuInduk === "weight");
  const imt = jenis === "pemeriksaan" && tinggi && berat ? hitungImt(Number(nilai[tinggi.id]), Number(nilai[berat.id])) : null;
  const tesWarna = isian.find(i => /buta warna|ishihara/i.test(i.label));
  const peringatan = jenis === "pemeriksaan" && tesWarna ? peringatanButaWarna(nilai[tesWarna.id] ?? "", d.calon.jurusan) : null;
  const lama = tersimpan.jawaban.filter(j => !isian.some(i => i.id === j.id) && j.nilai);

  const kelompok = Array.from(new Set(isian.map(i => i.kelompok || "Umum")));
  const judul = jenis === "asesmen" ? "asesmen awal" : "cek fisik & kesehatan";

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        {selesaiAt ? <><Check size={14} className="mr-1 inline text-emerald-600" />Selesai {waktu(selesaiAt)}{oleh ? ` oleh ${oleh}` : ""}.</> : `Isi ${judul} sesuai jawaban/hasil calon. Simpan Draf boleh kapan saja; Selesai mencentang tahap ini di halaman calon.`}
        {" "}Isian ini rahasia: hanya panitia, wali kelas, BK, dan admin yang bisa melihatnya.
      </p>

      {kelompok.map(k => (
        <div key={k}>
          <p className="label-kecil mb-2 text-primary-700">{k}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isian.filter(i => (i.kelompok || "Umum") === k).map(i => (
              <div key={i.id} className={i.jenis === "PANJANG" ? "sm:col-span-2" : ""}>
                <label className="label-field">{i.label}{i.wajib && <span className="ml-0.5 text-red-500">*</span>}{i.satuan && <span className="text-gray-400"> ({i.satuan})</span>}</label>
                <InputIsian isian={i} nilai={nilai[i.id] ?? ""} onChange={v => set(i.id, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {imt && (
        <p className={`rounded-xl border p-3 text-sm ${imt.kategori === "Normal" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          IMT (indeks massa tubuh): <span className="angka font-semibold">{imt.nilai}</span> — {imt.kategori}
        </p>
      )}
      {peringatan && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertTriangle size={14} className="mr-1 inline" />{peringatan}</p>}

      {lama.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
          <p className="mb-1 text-xs text-gray-400">Isian lama (pertanyaannya sudah dihapus dari pengaturan)</p>
          {lama.map(j => <p key={j.id} className="text-gray-600"><span className="text-gray-400">{j.label}:</span> {j.nilai}</p>)}
        </div>
      )}

      <div><label className="label-field">Catatan tambahan</label><textarea className="input-field min-h-[70px]" value={catatan} onChange={e => setCatatan(e.target.value)} /></div>

      <div className="flex flex-wrap justify-end gap-2">
        {selesaiAt && (
          <button type="button" disabled={sibuk} className="btn-modal-cancel btn-teks"
            onClick={() => kirim({ aksi: "buka-ulang", tahap: jenis === "asesmen" ? "ASESMEN" : "PEMERIKSAAN" }, "Tahap dibuka ulang")}>
            <Undo2 size={16} /> Buka Ulang
          </button>
        )}
        <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: jenis, jawaban: nilai, catatan, selesai: false }, "Draf tersimpan")} className="btn-modal-cancel">
          <Save size={16} /> Simpan Draf
        </button>
        <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: jenis, jawaban: nilai, catatan, selesai: true }, "Tahap diselesaikan")} className="btn-modal-save btn-teks">
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {selesaiAt ? "Simpan" : "Selesai & Centang"}
        </button>
      </div>
    </div>
  );
}

function InputIsian({ isian: i, nilai, onChange }: { isian: IsianTahap; nilai: string; onChange: (v: string) => void }) {
  if (i.jenis === "PANJANG") return <textarea className="input-field min-h-[80px]" value={nilai} onChange={e => onChange(e.target.value)} />;
  if (i.jenis === "ANGKA") return <input className="input-field" inputMode="decimal" value={nilai} onChange={e => onChange(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))} />;
  if (i.jenis === "YA_TIDAK" || i.jenis === "PILIHAN") {
    const opsi = i.jenis === "YA_TIDAK" ? ["Ya", "Tidak"] : i.pilihan ?? [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {opsi.map(o => (
          <button key={o} type="button" onClick={() => onChange(nilai === o ? "" : o)}
            className={`sentuh rounded-lg border px-3 py-1.5 text-sm transition ${nilai === o ? "border-primary-700 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300"}`}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  return <input className="input-field" value={nilai} onChange={e => onChange(e.target.value)} />;
}

function TabKabar({ d }: { d: Detail }) {
  const toast = useToast();
  const berjalan = d.tahap.find(t => t.status !== "SELESAI") ?? null;
  const [teks, setTeks] = useState(() => pesanKabar({
    nama: d.calon.nama, nomor: d.calon.nomor ?? "", sekolah: d.sekolah, tautan: d.tautan ?? "",
    tahap: berjalan, tuntas: d.tuntas, mpls: d.mpls,
  }));
  const wa = d.calon.phone.replace(/\D/g, "").replace(/^0/, "62");
  const subjek = `SPMB ${d.sekolah} — ${d.calon.nomor ?? d.calon.nama}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Pesan disusun dari tahap calon saat ini dan memuat tautan halaman tahapannya. Ubah bila perlu, lalu kirim lewat WhatsApp panitia atau e-mail.
      </p>
      <p className={`rounded-xl border p-3 text-sm ${d.langganan ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-100 bg-gray-50 text-gray-500"}`}>
        {d.langganan
          ? `Pemberitahuan otomatis AKTIF di ${d.langganan} perangkat calon — setiap verifikasi, hasil, dan pengesahan pembayaran langsung terkirim ke HP-nya.`
          : "Calon belum mengaktifkan pemberitahuan di halaman tahapannya — kabar penting perlu dikirim lewat WhatsApp/e-mail di bawah."}
      </p>
      <textarea className="input-field min-h-[220px] font-mono text-sm" value={teks} onChange={e => setTeks(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-modal-cancel btn-teks"
          onClick={async () => { (await salinTeks(teks)) ? toast.success("Pesan tersalin") : toast.error("Gagal menyalin"); }}>
          <Copy size={16} /> Salin
        </button>
        {d.calon.email && (
          <a href={`mailto:${d.calon.email}?subject=${encodeURIComponent(subjek)}&body=${encodeURIComponent(teks)}`} className="btn-modal-cancel btn-teks">
            <Mail size={16} /> Kirim E-mail
          </a>
        )}
        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(teks)}`} target="_blank" rel="noopener noreferrer" className="btn-modal-save btn-teks">
            <MessageCircle size={16} /> Kirim lewat WhatsApp
          </a>
        )}
      </div>
      {d.kabar.length > 0 && (
        <div>
          <p className="label-field">Kabar otomatis yang sudah terkirim</p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {d.kabar.map(k => (
              <li key={k.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium text-navy">{k.judul} <span className="text-xs font-normal text-gray-400">· {waktu(k.createdAt)} · {k.perangkat ? `${k.perangkat} perangkat` : "belum sampai ke HP"}</span></p>
                <p className="text-gray-600">{k.isi}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TabBayar({ d, sibuk, kirim }: { d: Detail; sibuk: boolean; kirim: KirimDetail }) {
  const confirm = useConfirm();
  const b = d.bayar;
  const [catat, setCatat] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [metode, setMetode] = useState("TUNAI");
  const [catatan, setCatatan] = useState("");
  const [potongan, setPotongan] = useState(b.potongan ? String(b.potongan) : "");
  const [ketPotongan, setKetPotongan] = useState(d.calon.keteranganPotongan ?? "");
  const [tolakId, setTolakId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const angka = (v: string) => Number(v.replace(/\D/g, "")) || 0;
  const tahapDU = d.tahap.find(t => t.kode === "DAFTAR_ULANG");
  const LABEL: Record<string, string> = {
    SAH: "bg-emerald-50 text-emerald-700 border-emerald-200", MENUNGGU: "bg-amber-50 text-amber-700 border-amber-200", DITOLAK: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Tagihan", b.tagihan], ["Sudah sah", b.sah], ["Menunggu diperiksa", b.menunggu], ["Sisa", b.sisa]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">{k}</p><p className="angka font-semibold text-navy">{rupiah(v as number)}</p></div>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        Syarat menuntaskan daftar ulang: <span className="font-medium text-gray-700">{LABEL_SYARAT_BAYAR[b.syarat]}{b.wajib > 0 ? ` (${rupiah(b.wajib)})` : ""}</span>.
        {" "}Pembayaran tetap bisa dicatat setelah MPLS dan setelah calon menjadi siswa.
      </p>

      {/* Konfirmasi daftar ulang */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-4">
        <div className="text-sm">
          <p className="font-semibold text-navy">Konfirmasi daftar ulang</p>
          <p className="text-gray-500">{d.calon.daftarUlangAt ? `Dikonfirmasi ${waktu(d.calon.daftarUlangAt)}.` : "Belum dikonfirmasi calon."}
            {tahapDU?.status === "SELESAI" ? " Tahap tuntas." : d.calon.daftarUlangAt && !b.cukup ? " Menunggu syarat pembayaran." : ""}</p>
        </div>
        {d.calon.daftarUlangAt
          ? <button type="button" disabled={sibuk} className="btn-modal-cancel btn-teks"
              onClick={async () => { if (await confirm("Batalkan konfirmasi daftar ulang calon ini?")) kirim({ aksi: "daftar-ulang", konfirmasi: false }, "Konfirmasi dibatalkan"); }}>
              <Undo2 size={16} /> Batalkan</button>
          : <button type="button" disabled={sibuk} className="btn-modal-save btn-teks" onClick={() => kirim({ aksi: "daftar-ulang", konfirmasi: true }, "Daftar ulang dikonfirmasi")}>
              <Check size={16} /> Konfirmasi atas Nama Calon</button>}
      </div>

      {/* Riwayat */}
      <div>
        <p className="label-field">Riwayat pembayaran</p>
        {d.pembayaran.length === 0 ? <p className="text-sm text-gray-400">Belum ada pembayaran.</p> : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {d.pembayaran.map(p => (
              <div key={p.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="angka font-semibold text-navy">{rupiah(p.jumlah)}</span>
                  <span className="text-gray-500">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} · {p.metode === "TUNAI" ? "Tunai" : "Transfer"}</span>
                  <span className={`status-badge ${LABEL[p.status] ?? ""}`}>{p.status === "SAH" ? "Sah" : p.status === "MENUNGGU" ? "Menunggu" : "Ditolak"}</span>
                  {p.bukti && <a href={p.bukti} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">Bukti <ExternalLink size={13} /></a>}
                  <div className="ml-auto flex gap-1">
                    {p.status !== "SAH" && (
                      <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: "bayar-sahkan", pembayaranId: p.id }, "Pembayaran disahkan")} className="btn-modal-save px-3 text-xs">Sahkan</button>
                    )}
                    {p.status === "MENUNGGU" && (
                      <button type="button" onClick={() => { setTolakId(p.id); setAlasan(""); }} className="btn-modal-cancel px-3 text-xs">Tolak</button>
                    )}
                    <button type="button" title="Hapus" disabled={sibuk}
                      onClick={async () => { if (await confirm(`Hapus catatan pembayaran ${rupiah(p.jumlah)}?`)) kirim({ aksi: "bayar-hapus", pembayaranId: p.id }, "Catatan dihapus"); }}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {p.dicatatOleh ? `Dicatat ${p.dicatatOleh}` : "Dikirim calon"}{p.disahkanOleh ? ` · ${p.status === "DITOLAK" ? "ditolak" : "disahkan"} ${p.disahkanOleh}` : ""}{p.catatan ? ` · ${p.catatan}` : ""}
                </p>
                {p.alasanTolak && <p className="text-xs text-red-600">Alasan: {p.alasanTolak}</p>}
                {tolakId === p.id && (
                  <div className="flex flex-wrap gap-2">
                    <input className="input-field flex-1" value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Alasan, mis. nominal tidak sesuai bukti" />
                    <button type="button" onClick={() => setTolakId(null)} className="btn-modal-cancel">Batal</button>
                    <button type="button" disabled={sibuk || !alasan.trim()} className="btn-hapus"
                      onClick={async () => { if (await kirim({ aksi: "bayar-tolak", pembayaranId: p.id, alasan }, "Bukti ditolak")) setTolakId(null); }}>Tolak</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {catat ? (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <p className="text-sm text-gray-500">Pembayaran yang dicatat panitia langsung berstatus sah.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className="label-field">Jumlah (Rp)</label>
              <input className="input-field angka" inputMode="numeric" value={jumlah}
                onChange={e => { const n = angka(e.target.value); setJumlah(n ? n.toLocaleString("id-ID") : ""); }} /></div>
            <div><label className="label-field">Tanggal</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
            <div><label className="label-field">Metode</label>
              <Select value={metode} onChange={setMetode} options={[{ value: "TUNAI", label: "Tunai" }, { value: "TRANSFER", label: "Transfer" }]} /></div>
          </div>
          <div><label className="label-field">Catatan</label><input className="input-field" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Mis. cicilan ke-2" /></div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setCatat(false)} className="btn-modal-cancel">Batal</button>
            <button type="button" disabled={sibuk || !angka(jumlah)} className="btn-modal-save"
              onClick={async () => { if (await kirim({ aksi: "bayar-tambah", jumlah: angka(jumlah), tanggal, metode, catatan }, "Pembayaran dicatat")) { setCatat(false); setJumlah(""); setCatatan(""); } }}>
              <Save size={16} /> Simpan
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={() => setCatat(true)} className="btn-modal-save btn-teks"><Plus size={16} /> Catat Pembayaran</button>
        </div>
      )}

      {/* Potongan */}
      <div className="space-y-3 rounded-xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-navy">Potongan biaya (beasiswa, saudara kandung, dll.)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <div><label className="label-field">Jumlah (Rp)</label>
            <input className="input-field angka" inputMode="numeric" value={potongan ? angka(potongan).toLocaleString("id-ID") : ""} onChange={e => setPotongan(String(angka(e.target.value)))} /></div>
          <div><label className="label-field">Keterangan</label><input className="input-field" value={ketPotongan} onChange={e => setKetPotongan(e.target.value)} placeholder="Beasiswa Tahfidz" /></div>
          <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: "potongan", jumlah: angka(potongan), keterangan: ketPotongan }, "Potongan disimpan")} className="btn-modal-cancel btn-teks">
            <Percent size={16} /> Simpan Potongan
          </button>
        </div>
      </div>
    </div>
  );
}

const LABEL_KEPUTUSAN: Record<string, { label: string; kelas: string }> = {
  DITERIMA: { label: "Diterima", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ACCEPTED: { label: "Diterima", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CADANGAN: { label: "Cadangan", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DITOLAK: { label: "Tidak diterima", kelas: "bg-red-50 text-red-600 border-red-200" },
  REJECTED: { label: "Tidak diterima", kelas: "bg-red-50 text-red-600 border-red-200" },
};

/** Keputusan seleksi + cetak formulir + hapus — dulu di menu Pendaftar (DISATUKAN ke sini 6 Okt 2026).
 *  Keputusan massal dari peringkat & kuota tetap di menu Pengumuman; ini untuk keputusan per calon. */
function BarisKeputusan({ d, sibuk, onTutup, onBerubah }: { d: Detail; sibuk: boolean; onTutup: () => void; onBerubah: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [proses, setProses] = useState(false);
  const k = LABEL_KEPUTUSAN[d.calon.status];
  async function setStatus(status: string) {
    setProses(true);
    const r = await fetch(`/api/admin/admissions/${d.calon.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => null);
    setProses(false);
    if (r?.ok) { toast.success("Keputusan disimpan"); await onBerubah(); } else toast.error("Gagal menyimpan keputusan");
  }
  async function hapus() {
    if (!(await confirm(`Hapus data pendaftar ${d.calon.nama}? Seluruh berkas, tahapan, dan pembayarannya ikut terhapus dan tidak bisa dikembalikan.`))) return;
    const r = await fetch(`/api/admin/admissions/${d.calon.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Pendaftar dihapus"); onTutup(); await onBerubah(); } else toast.error("Gagal menghapus");
  }
  const tombol = (status: string, label: string, kelas: string) => (
    <button type="button" disabled={proses || sibuk} onClick={() => setStatus(status)} className={`${kelas} px-3 text-xs`}>{label}</button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 p-3">
      <span className="text-sm font-medium text-gray-600">Keputusan seleksi:</span>
      {k ? <span className={`status-badge ${k.kelas}`}>{k.label}</span> : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum diputuskan</span>}
      <div className="ml-auto flex flex-wrap gap-1.5">
        {!["DITERIMA", "ACCEPTED"].includes(d.calon.status) && tombol("DITERIMA", "Terima", "btn-modal-save")}
        {d.calon.status !== "CADANGAN" && tombol("CADANGAN", "Cadangan", "btn-modal-cancel")}
        {!["DITOLAK", "REJECTED"].includes(d.calon.status) && tombol("DITOLAK", "Tolak", "btn-modal-cancel")}
        {k && tombol("PENDING", "Batalkan keputusan", "btn-modal-cancel")}
        <a href={`/pusat-spmb/pendaftar/${d.calon.id}/cetak`} className="btn-modal-cancel px-3 text-xs"><Printer size={13} /> Cetak Formulir</a>
        <button type="button" onClick={hapus} title="Hapus pendaftar" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
