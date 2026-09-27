"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Loader2, RotateCcw, UserPlus } from "lucide-react";
import Modal from "@/components/admin/Modal";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

interface Calon { id: string; nis: string; nama: string; kelas: string; keterangan: string; nilai?: number; kkm?: number }
interface Turunan { id: string; title: string; jenis: string; isPublished: boolean; startTime: string; jumlahPeserta: number; _count: { attempts: number } }
interface Data { susulan: Calon[]; remedial: Calon[]; turunan: Turunan[] }

const hariIni = () => {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 10);
};

/** Panel UJIAN SUSULAN & REMEDIAL di tab Hasil (17 Sep 2026): calon peserta dihitung server (belum mengerjakan / di bawah KKM),
 * guru memilih siswa + jadwal, ujian turunan dibuat dengan soal yang sama dan peserta terbatas (belum diterbitkan). */
export default function TurunanUjianPanel({ examId, basePath, bolehUbah }: { examId: string; basePath: string; bolehUbah: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [jenis, setJenis] = useState<"SUSULAN" | "REMEDIAL" | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [tanggal, setTanggal] = useState(hariIni());
  const [jamMulai, setJamMulai] = useState("07:30");
  const [jamTutup, setJamTutup] = useState("12:00");
  const [durasi, setDurasi] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(() => {
    fetch(`/api/teacher/exams/${examId}/turunan`, { cache: "no-store" }).then(r => r.json())
      .then(d => { if (Array.isArray(d.susulan)) setData(d); }).catch(() => {});
  }, [examId]);
  useEffect(() => { muat(); }, [muat]);

  function buka(j: "SUSULAN" | "REMEDIAL") {
    const daftar = j === "SUSULAN" ? data?.susulan : data?.remedial;
    setPilih(new Set(daftar?.map(s => s.id) ?? []));
    setJenis(j);
  }

  async function buat() {
    if (!jenis) return;
    setMenyimpan(true);
    const r = await fetch(`/api/teacher/exams/${examId}/turunan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jenis, siswaIds: [...pilih],
        startTime: new Date(`${tanggal}T${jamMulai}:00+07:00`).toISOString(),
        endTime: new Date(`${tanggal}T${jamTutup}:00+07:00`).toISOString(),
        ...(durasi ? { duration: Number(durasi) } : {}),
      }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpan(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal membuat ujian."); return; }
    toast.success(`Ujian ${jenis === "SUSULAN" ? "susulan" : "remedial"} dibuat untuk ${d.peserta} siswa — periksa lalu terbitkan.`);
    setJenis(null);
    muat();
  }

  if (!data) return null;
  const daftar = jenis === "SUSULAN" ? data.susulan : jenis === "REMEDIAL" ? data.remedial : [];

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-primary-900 text-sm">Ujian susulan & remedial</h3>
          <p className="text-xs text-gray-500">
            {data.susulan.length} siswa belum mengerjakan · {data.remedial.length} siswa di bawah KKM. Soal disalin dari ujian ini, peserta dibatasi. Nilai remedial diakui paling tinggi sama dengan KKM.
          </p>
        </div>
        {bolehUbah && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => buka("SUSULAN")} disabled={!data.susulan.length} className="btn-modal-cancel"><UserPlus size={15} /> Buat Susulan</button>
            <button type="button" onClick={() => buka("REMEDIAL")} disabled={!data.remedial.length} className="btn-modal-save"><RotateCcw size={15} /> Buat Remedial</button>
          </div>
        )}
      </div>
      {data.turunan.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-50 border-t border-gray-100">
          {data.turunan.map(t => (
            <li key={t.id}>
              <Link href={`${basePath}/${t.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-primary-700">
                <span className={`status-badge ${t.jenis === "REMEDIAL" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{t.jenis === "REMEDIAL" ? "Remedial" : "Susulan"}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-primary-900">{t.title}</span>
                <span className="shrink-0 text-xs text-gray-500">{t._count.attempts}/{t.jumlahPeserta} mengerjakan · {t.isPublished ? "terbit" : "draf"}</span>
                <ChevronRight size={15} className="shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!jenis} onClose={() => !menyimpan && setJenis(null)} size="xl" scrollBody
        title={jenis === "SUSULAN" ? "Buat ujian susulan" : "Buat ujian remedial"}
        description={`${pilih.size} dari ${daftar.length} siswa dipilih`}
        footer={<>
          <button type="button" onClick={() => setJenis(null)} disabled={menyimpan} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={buat} disabled={menyimpan || !pilih.size} className="btn-modal-save">
            {menyimpan ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />} Buat Ujian
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label-field">Tanggal</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
            <div><label className="label-field">Mulai</label><TimePicker value={jamMulai} onChange={v => setJamMulai(v)} /></div>
            <div><label className="label-field">Tutup</label><TimePicker value={jamTutup} onChange={v => setJamTutup(v)} /></div>
          </div>
          <div className="sm:w-56">
            <label className="label-field">Durasi (menit)</label>
            <input type="number" min={5} max={600} value={durasi} onChange={e => setDurasi(e.target.value)} placeholder="Sama dengan ujian induk" className="input-field" />
          </div>
          <div className="rounded-xl border border-gray-100">
            <label className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm font-semibold">
              <input type="checkbox" checked={pilih.size === daftar.length && daftar.length > 0}
                onChange={e => setPilih(e.target.checked ? new Set(daftar.map(s => s.id)) : new Set())} className="h-4 w-4 rounded border-gray-300" />
              Pilih semua
            </label>
            <ul className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
              {daftar.map(s => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input type="checkbox" checked={pilih.has(s.id)} className="h-4 w-4 rounded"
                      onChange={e => setPilih(p => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                    <span className="min-w-0 flex-1"><span className="font-medium text-primary-900">{s.nama}</span> <span className="text-xs text-gray-500">· {s.kelas} · {s.nis}</span></span>
                    <span className="shrink-0 text-xs text-gray-500">{s.keterangan}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500">Ujian baru belum diterbitkan: periksa soal & pengaturannya, lalu terbitkan dan bagikan tokennya ke peserta.</p>
        </div>
      </Modal>
    </div>
  );
}
