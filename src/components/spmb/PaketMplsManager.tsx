"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Loader2, CalendarDays, Users, QrCode, RefreshCw, UserPlus, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import TimePicker from "@/components/shared/TimePicker";
import { useToast } from "@/components/shared/ToastProvider";
import type { InfoMpls } from "@/lib/spmb-tahapan";

type Data = {
  mpls: InfoMpls; resmi: number; siapIkut: number; baru: number;
  belumSiswa: { id: string; nomor: string | null; nama: string; jurusan: string }[];
  kegiatan: { id: string; judul: string; mulai: string; selesai: string; sampaiTanggal: string | null; tempat: string | null; peserta: number; pembuatNama: string; _count: { presensi: number } } | null;
  halamanKegiatan: string;
};

const jamDari = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).replace(".", ":");
const tgl = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+07:00` : iso)
  .toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Paket MPLS (7 Okt 2026): satu tombol membuat Kegiatan MPLS berhari-hari (presensi QR tiap hari) dengan peserta
 *  otomatis = calon yang resmi mengikuti MPLS dan sudah dijadikan siswa. */
export default function PaketMplsManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("15:00");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => fetch("/api/spmb/mpls").then(r => r.json()).then((x: Data & { error?: string }) => {
    if (x.error) return;
    setD(x);
    if (x.kegiatan) { setJamMulai(jamDari(x.kegiatan.mulai)); setJamSelesai(jamDari(x.kegiatan.selesai)); }
  }).catch(() => {}), []);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    setSibuk(true);
    const r = await fetch("/api/spmb/mpls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jamMulai, jamSelesai }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(`Kegiatan MPLS disimpan — ${x.peserta} peserta`); muat(); } else toast.error(x?.error ?? "Gagal menyimpan");
  }

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const m = d.mpls;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Flag size={22} />} title="MPLS" description="Presensi MPLS berhari-hari lewat Kegiatan — peserta otomatis dari calon yang resmi" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={d.resmi} label="Calon resmi peserta MPLS" icon={Users} color="emerald" />
          <StatTile value={d.siapIkut} label="Sudah jadi siswa (masuk presensi)" icon={UserPlus} color="primary" />
          <StatTile value={d.belumSiswa.length} label="Belum dijadikan siswa" icon={AlertTriangle} color="amber" sorot={d.belumSiswa.length > 0} />
        </div>

        <div className="panel p-5 space-y-4">
          <p className="panel-judul">Jadwal MPLS</p>
          {m.mulai ? (
            <p className="flex items-start gap-2 text-sm text-gray-700"><CalendarDays size={16} className="mt-0.5 shrink-0 text-primary-700" />
              <span>{m.judul} · {tgl(m.mulai)}{m.selesai && m.selesai > m.mulai ? ` s.d. ${tgl(m.selesai)}` : ""}{m.tempat ? ` · ${m.tempat}` : ""}</span></p>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Tanggal MPLS belum diisi. Isi di <Link href="/pusat-spmb/pengaturan?tab=tahapan" className="font-semibold underline">Pengaturan SPMB → Tahapan Calon</Link> (bagian MPLS) dulu.
            </p>
          )}
          <div className="baris-alat items-end">
            <div className="alat-saring"><label className="label-field">Jam mulai harian</label><TimePicker value={jamMulai} onChange={setJamMulai} /></div>
            <div className="alat-saring"><label className="label-field">Jam selesai harian</label><TimePicker value={jamSelesai} onChange={setJamSelesai} /></div>
            <div className="alat-aksi">
              <button type="button" disabled={sibuk || !m.mulai} onClick={simpan} className="btn-modal-save btn-teks">
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : d.kegiatan ? <RefreshCw size={16} /> : <Flag size={16} />}
                {d.kegiatan ? " Perbarui Kegiatan & Peserta" : " Buat Kegiatan MPLS"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Presensi diulang tiap hari MPLS dengan QR yang berganti — ditayangkan dari halaman Kegiatan. Kehadiran juga mengisi absensi harian siswa
            (hanya bila hari itu belum ada catatan). Tekan Perbarui setiap ada calon baru yang tuntas atau dijadikan siswa.
          </p>
        </div>

        {d.kegiatan && (
          <div className="panel flex flex-wrap items-center gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><QrCode size={20} /></span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-heading font-semibold text-navy">{d.kegiatan.judul}</p>
              <p className="text-gray-500">
                {d.kegiatan.peserta} peserta · {d.kegiatan._count.presensi} catatan hadir · dibuat {d.kegiatan.pembuatNama}
                {d.baru > 0 && <span className="ml-1 font-semibold text-amber-700">· {d.baru} peserta baru belum dimasukkan — tekan Perbarui</span>}
              </p>
            </div>
            <Link href={d.halamanKegiatan} className="btn-modal-cancel btn-teks"><QrCode size={16} /> Buka Presensi & QR</Link>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">Calon resmi yang belum dijadikan siswa</p>
            <Link href="/pusat-spmb/konversi" className="panel-tautan">Jadi Siswa</Link></div>
          {d.belumSiswa.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Semua calon resmi sudah dijadikan siswa.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Nama</th><th>Nomor</th><th>Jurusan</th></tr></thead>
                <tbody>
                  {d.belumSiswa.map((c, i) => (
                    <tr key={c.id}><td className="angka">{i + 1}</td><td className="font-medium text-primary-900">{c.nama}</td><td className="angka">{c.nomor ?? "—"}</td><td>{c.jurusan || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Presensi Kegiatan memakai akun, jadi calon baru bisa dipresensi setelah dijadikan siswa (akun siswanya terbuat di menu Jadi Siswa).</p>
        </div>
      </div>
    </div>
  );
}
