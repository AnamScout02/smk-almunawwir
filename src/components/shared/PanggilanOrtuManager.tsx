"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, FileSignature, Loader2, Mail, Printer, UserCheck, UserX, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Panggilan {
  id: string; tingkat: string; poin: number; alasan: string; status: string; otomatis: boolean; jadwal: string | null;
  tempat: string | null; keperluan: string | null; suratId: string | null; catatan: string | null; createdAt: string;
  siswa: string; nis: string; kelas: string; studentId: string;
}

const STATUS: Record<string, { label: string; kelas: string }> = {
  DRAF: { label: "Draf — atur jadwal", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  TERBIT: { label: "Surat terbit", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  HADIR: { label: "Orang tua hadir", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  TIDAK_HADIR: { label: "Tidak hadir", kelas: "bg-red-50 text-red-600 border-red-200" },
  BATAL: { label: "Dibatalkan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};
const WARNA_TINGKAT: Record<string, string> = {
  "SP 1": "bg-amber-50 text-amber-700 border-amber-200", "SP 2": "bg-orange-50 text-orange-700 border-orange-200",
  "SP 3": "bg-red-50 text-red-600 border-red-200", "Dikembalikan ke Orang Tua": "bg-red-50 text-red-700 border-red-300",
  MANUAL: "bg-gray-50 text-gray-600 border-gray-200",
};
const jadwalTeks = (d: string) => new Date(d).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** PANGGILAN ORANG TUA (17 Sep 2026) — draf otomatis dari akumulasi poin, jadwal, terbit jadi surat bernomor, catat kehadiran.
 * `cetakHref(p)` = alamat cetak sesuai portal (Admin → Persuratan, Guru → halaman cetak portal guru). */
export default function PanggilanOrtuManager({ portal }: { portal: "admin" | "guru" }) {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState<"AKTIF" | "SEMUA">("AKTIF");
  const [data, setData] = useState<{ kelola: boolean; daftar: Panggilan[] } | null>(null);
  const [atur, setAtur] = useState<Panggilan | null>(null);
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("09:00");
  const [tempat, setTempat] = useState("Ruang BK");
  const [keperluan, setKeperluan] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(() => {
    setData(null);
    fetch(`/api/teacher/panggilan-ortu?status=${tab}`, { cache: "no-store" }).then(r => r.json())
      .then(d => setData(Array.isArray(d.daftar) ? d : { kelola: false, daftar: [] })).catch(() => setData({ kelola: false, daftar: [] }));
  }, [tab]);
  useEffect(() => { muat(); }, [muat]);

  const cetakHref = (p: Panggilan) => (portal === "admin" ? `/dashboard/admin/persuratan/${p.suratId}/cetak` : `/dashboard/teacher/kesiswaan/panggilan/${p.id}/cetak`);

  function bukaAtur(p: Panggilan) {
    const d = p.jadwal ? new Date(new Date(p.jadwal).getTime() + 7 * 3600_000) : null;
    setTanggal(d ? d.toISOString().slice(0, 10) : "");
    setJam(d ? d.toISOString().slice(11, 16) : "09:00");
    setTempat(p.tempat ?? "Ruang BK");
    setKeperluan(p.keperluan ?? "");
    setAtur(p);
  }

  async function simpanDanTerbitkan(terbit: boolean) {
    if (!atur) return;
    if (!tanggal) { toast.warning("Pilih tanggal pertemuan."); return; }
    setSibuk(atur.id);
    const r = await fetch(`/api/teacher/panggilan-ortu/${atur.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jadwal: new Date(`${tanggal}T${jam}:00+07:00`).toISOString(), tempat, keperluan }),
    }).catch(() => null);
    if (!r?.ok) { setSibuk(""); const d = await r?.json().catch(() => null); toast.error(d?.error ?? "Gagal menyimpan jadwal."); return; }
    if (terbit) {
      const t = await fetch(`/api/teacher/panggilan-ortu/${atur.id}/terbitkan`, { method: "POST" }).catch(() => null);
      const d = await t?.json().catch(() => null);
      setSibuk("");
      if (!t?.ok) { toast.error(d?.error ?? "Gagal menerbitkan surat."); return; }
      toast.success(`Surat ${d.nomor} terbit dan orang tua sudah diberi tahu.`);
    } else {
      setSibuk("");
      toast.success("Jadwal disimpan.");
    }
    setAtur(null);
    muat();
  }

  async function ubahStatus(p: Panggilan, status: string, pesan: string) {
    if (!(await confirmDialog(pesan))) return;
    setSibuk(p.id);
    const r = await fetch(`/api/teacher/panggilan-ortu/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    muat();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Mail size={22} />} title="Panggilan Orang Tua"
        description="Draf otomatis saat poin pelanggaran mencapai tingkat SP — atur jadwal, terbitkan surat bernomor, lalu catat kehadiran" />

      <div className="baris-alat mb-5">
        <div className="alat-tab flex w-fit gap-1 rounded-xl border border-gray-100 bg-white p-1">
          {([["AKTIF", "Perlu ditindaklanjuti"], ["SEMUA", "Semua"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <p className="alat-saring text-xs text-gray-500">Tingkat: SP 1 (≥25 poin) · SP 2 (≥51) · SP 3 (≥76) · Dikembalikan ke orang tua (≥100), poin bersih semester berjalan.</p>
      </div>

      {!data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : data.daftar.length === 0 ? (
        <EmptyState icon={Mail} title="Tidak ada panggilan" description="Draf muncul otomatis ketika poin pelanggaran siswa mencapai tingkat SP." />
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {data.daftar.map(p => {
              const st = STATUS[p.status] ?? STATUS.DRAF;
              return (
                <li key={p.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary-900">{p.siswa} <span className="text-xs font-normal text-gray-500">· {p.kelas} · {p.nis}</span></p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`status-badge ${WARNA_TINGKAT[p.tingkat] ?? WARNA_TINGKAT.MANUAL}`}>{p.tingkat === "MANUAL" ? "Manual" : p.tingkat}</span>
                      <span className={`status-badge ${st.kelas}`}>{st.label}</span>
                      <span className="text-xs text-gray-500">{p.poin} poin</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{p.alasan}</p>
                    {p.jadwal && <p className="text-xs text-gray-600"><CalendarClock size={12} className="mr-1 inline" />{jadwalTeks(p.jadwal)} WIB · {p.tempat}</p>}
                  </div>
                  {data.kelola && (
                    <div className="flex flex-wrap items-center gap-2">
                      {p.status === "DRAF" && (
                        <>
                          <button type="button" onClick={() => ubahStatus(p, "BATAL", `Batalkan panggilan ${p.siswa}?`)} className="btn-modal-cancel"><X size={15} /> Batalkan</button>
                          <button type="button" onClick={() => bukaAtur(p)} className="btn-modal-save"><FileSignature size={15} /> Atur & Terbitkan</button>
                        </>
                      )}
                      {p.status === "TERBIT" && (
                        <>
                          <Link href={cetakHref(p)} className="btn-modal-cancel"><Printer size={15} /> Cetak Surat</Link>
                          <button type="button" onClick={() => ubahStatus(p, "TIDAK_HADIR", "Catat orang tua TIDAK hadir?")} disabled={sibuk === p.id} className="btn-modal-cancel"><UserX size={15} /> Tidak hadir</button>
                          <button type="button" onClick={() => ubahStatus(p, "HADIR", "Catat orang tua sudah hadir?")} disabled={sibuk === p.id} className="btn-modal-save"><UserCheck size={15} /> Hadir</button>
                        </>
                      )}
                      {(p.status === "HADIR" || p.status === "TIDAK_HADIR") && p.suratId && (
                        <Link href={cetakHref(p)} className="btn-modal-cancel"><Printer size={15} /> Cetak Surat</Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal open={!!atur} onClose={() => !sibuk && setAtur(null)} title="Atur panggilan" description={atur ? `${atur.siswa} · ${atur.kelas} · ${atur.tingkat}` : undefined}
        footer={<>
          <button type="button" onClick={() => simpanDanTerbitkan(false)} disabled={!!sibuk} className="btn-modal-cancel">Simpan Jadwal</button>
          <button type="button" onClick={() => simpanDanTerbitkan(true)} disabled={!!sibuk} className="btn-modal-save">
            {sibuk ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Terbitkan Surat
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label-field">Tanggal pertemuan</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
            <div><label className="label-field">Jam</label><TimePicker value={jam} onChange={v => setJam(v)} /></div>
          </div>
          <div><label htmlFor="tempat-panggilan" className="label-field">Tempat</label><input id="tempat-panggilan" value={tempat} onChange={e => setTempat(e.target.value)} className="input-field" /></div>
          <div><label htmlFor="keperluan-panggilan" className="label-field">Keperluan</label><input id="keperluan-panggilan" value={keperluan} onChange={e => setKeperluan(e.target.value)} className="input-field" placeholder="Pembinaan kedisiplinan" /></div>
          <p className="text-xs text-gray-500">Terbitkan = surat keluar bernomor (klasifikasi B.11) tercatat di Agenda Persuratan, dan orang tua menerima notifikasi jadwalnya.</p>
        </div>
      </Modal>
    </div>
  );
}
