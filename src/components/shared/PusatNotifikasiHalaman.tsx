"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award, Bell, BellRing, BookMarked, CalendarX, CheckCheck, ClipboardCheck, ClipboardList, FileQuestion, HeartPulse,
  Inbox, Megaphone, MessagesSquare, NotebookPen, ShieldAlert, TriangleAlert, Users, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Tindakan { label: string; count: number; href: string }
interface Notif { id: string; dibaca: boolean; waktu: string; jenis: string; judul: string; isi: string; url: string | null }
interface Pengumuman { id: string; judul: string; isi: string; penting: string; wajibKonfirmasi: boolean; sudahDibaca: boolean; oleh: string | null; waktu: string | null }

/** Warna pita per jenis — pembeda antar-kabar seperti yang diminta user (18 September 2026). */
const WARNA: Record<string, string> = {
  ANAK_ALPHA: "bg-red-500", ALPHA_BERUNTUN: "bg-red-500", POIN_PELANGGARAN: "bg-red-500", PERPUS_TERLAMBAT: "bg-red-500", UKS: "bg-red-500",
  ABSENSI_BELUM: "bg-amber-500", PIKET_BELUM: "bg-amber-500", JURNAL_BELUM: "bg-amber-500", PERPUS_JATUH_TEMPO: "bg-amber-500", PENGUMUMAN: "bg-amber-500",
  PERINGATAN_DINI: "bg-purple-500", KONSELING: "bg-purple-500",
  UJIAN_MULAI: "bg-blue-500", TUGAS_BARU: "bg-blue-500", IZIN_SISWA: "bg-blue-500",
  POIN_PRESTASI: "bg-emerald-500", PERPUS_RESERVASI: "bg-emerald-500", SARPRAS: "bg-emerald-600",
  TUGAS_INTERNAL: "bg-indigo-500", KEGIATAN: "bg-teal-600", REKAP_HARIAN_KELAS: "bg-primary-700", UJI: "bg-gray-400",
};
/** Warna chip ikon (latar muda + teks pekat) senada dengan titik di atas. */
const CHIP: Record<string, string> = {
  "bg-red-500": "bg-red-50 text-red-600", "bg-amber-500": "bg-amber-50 text-amber-600",
  "bg-purple-500": "bg-purple-50 text-purple-600", "bg-blue-500": "bg-blue-50 text-blue-600",
  "bg-emerald-500": "bg-emerald-50 text-emerald-600", "bg-emerald-600": "bg-emerald-50 text-emerald-700",
  "bg-indigo-500": "bg-indigo-50 text-indigo-600", "bg-teal-600": "bg-teal-50 text-teal-700",
  "bg-primary-700": "bg-primary-50 text-primary-700", "bg-gray-400": "bg-gray-100 text-gray-500",
};
/** Ikon per jenis supaya tiap kabar kelihatan bedanya sekilas (temuan user 18 Sep 2026:
 * "notifikasi kok keluar seragam" — dulu semuanya titik abu + label "Kabar"). */
const IKON_JENIS: Record<string, LucideIcon> = {
  ABSENSI_BELUM: ClipboardCheck, PIKET_BELUM: ClipboardList, JURNAL_BELUM: NotebookPen, UJIAN_MULAI: FileQuestion,
  TUGAS_BARU: ClipboardList, ANAK_ALPHA: CalendarX, ALPHA_BERUNTUN: CalendarX, POIN_PELANGGARAN: ShieldAlert,
  POIN_PRESTASI: Award, PERINGATAN_DINI: TriangleAlert, PERPUS_JATUH_TEMPO: BookMarked, PERPUS_TERLAMBAT: BookMarked,
  PERPUS_RESERVASI: BookMarked, IZIN_SISWA: CalendarX, REKAP_HARIAN_KELAS: Users, PENGUMUMAN: Megaphone,
  KONSELING: MessagesSquare, SARPRAS: Wrench, UKS: HeartPulse, TUGAS_INTERNAL: ClipboardList, KEGIATAN: Users,
  UJI: BellRing,
};

const NAMA_JENIS: Record<string, string> = {
  ABSENSI_BELUM: "Absensi", PIKET_BELUM: "Piket", JURNAL_BELUM: "Jurnal", UJIAN_MULAI: "Ujian", TUGAS_BARU: "Tugas",
  ANAK_ALPHA: "Kehadiran", ALPHA_BERUNTUN: "Kehadiran", POIN_PELANGGARAN: "Poin", POIN_PRESTASI: "Prestasi",
  PERINGATAN_DINI: "Peringatan dini", PERPUS_JATUH_TEMPO: "Perpustakaan", PERPUS_TERLAMBAT: "Perpustakaan",
  PERPUS_RESERVASI: "Perpustakaan", IZIN_SISWA: "Izin", REKAP_HARIAN_KELAS: "Rekap kelas", PENGUMUMAN: "Pengumuman",
  KONSELING: "Konseling", SARPRAS: "Sarpras", UKS: "UKS", TUGAS_INTERNAL: "Papan tugas", KEGIATAN: "Kegiatan",
  UJI: "Uji coba",
};

function relatif(waktu: string) {
  const detik = Math.round((Date.now() - new Date(waktu).getTime()) / 1000);
  if (detik < 60) return "baru saja";
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return new Date(waktu).toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" });
}

export default function PusatNotifikasiHalaman({ tindakan, notifikasi, pengumuman }: {
  tindakan: Tindakan[]; notifikasi: Notif[]; pengumuman: Pengumuman[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"semua" | "tindakan" | "kabar" | "pengumuman">("semua");
  const [daftar, setDaftar] = useState(notifikasi);

  const belumDibaca = useMemo(() => daftar.filter(n => !n.dibaca).length, [daftar]);
  const jumlahTindakan = tindakan.reduce((a, b) => a + b.count, 0);

  async function tandai(body: { id?: string; semua?: boolean }) {
    const r = await fetch("/api/notifikasi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menandai dibaca."); return; }
    setDaftar(d => d.map(n => (body.semua || n.id === body.id ? { ...n, dibaca: true } : n)));
    if (body.semua) toast.success("Semua ditandai dibaca.");
    router.refresh();
  }

  const TAB: { nilai: typeof tab; label: string; jumlah: number }[] = [
    { nilai: "semua", label: "Semua", jumlah: jumlahTindakan + belumDibaca + pengumuman.filter(p => !p.sudahDibaca).length },
    { nilai: "tindakan", label: "Perlu tindakan", jumlah: jumlahTindakan },
    { nilai: "kabar", label: "Kabar", jumlah: belumDibaca },
    { nilai: "pengumuman", label: "Pengumuman", jumlah: pengumuman.filter(p => !p.sudahDibaca).length },
  ];

  const tampilTindakan = tab === "semua" || tab === "tindakan";
  const tampilKabar = tab === "semua" || tab === "kabar";
  const tampilPengumuman = tab === "semua" || tab === "pengumuman";
  const kosong = (!tampilTindakan || tindakan.length === 0) && (!tampilKabar || daftar.length === 0) && (!tampilPengumuman || pengumuman.length === 0);

  return (
    <div className="space-y-5">
      <div className="baris-alat">
        <div className="alat-tab flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {TAB.map(t => (
            <button key={t.nilai} type="button" onClick={() => setTab(t.nilai)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.nilai ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {t.label}
              {t.jumlah > 0 && (
                <span className={`angka rounded-full px-1.5 text-[11px] ${tab === t.nilai ? "bg-white/20" : "bg-red-500 text-white"}`}>{t.jumlah}</span>
              )}
            </button>
          ))}
        </div>
        {belumDibaca > 0 && (
          <div className="alat-aksi">
            <button type="button" onClick={() => tandai({ semua: true })} className="btn-modal-cancel"><CheckCheck size={15} /> Tandai semua dibaca</button>
          </div>
        )}
      </div>

      {kosong ? (
        <EmptyState icon={Inbox} title="Belum ada kabar" description="Pengingat, kabar penting, dan pengumuman untuk akun Anda akan muncul di sini." />
      ) : (
        <>
          {tampilTindakan && tindakan.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label-kecil border-b border-gray-100 px-5 py-3">Perlu tindakan</p>
              <ul className="divide-y divide-gray-50">
                {tindakan.map(t => (
                  <li key={t.href + t.label}>
                    <Link href={t.href} className="flex items-center gap-3 px-5 py-3.5 text-sm transition hover:bg-gray-50">
                      <TriangleAlert size={16} className="shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 text-gray-700">{t.label}</span>
                      <span className="angka shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tampilPengumuman && pengumuman.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label-kecil border-b border-gray-100 px-5 py-3">Pengumuman</p>
              <ul className="divide-y divide-gray-50">
                {pengumuman.map(p => (
                  <li key={p.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-badge border-amber-200 bg-amber-50 text-amber-700"><Megaphone size={12} /> Pengumuman</span>
                      {p.penting === "PENTING" && <span className="status-badge border-red-200 bg-red-50 text-red-600">Penting</span>}
                      {p.wajibKonfirmasi && !p.sudahDibaca && <span className="status-badge border-blue-200 bg-blue-50 text-blue-700">Perlu konfirmasi</span>}
                      {p.waktu && <span className="ml-auto text-xs text-gray-400">{relatif(p.waktu)}</span>}
                    </div>
                    <p className="mt-1 font-semibold text-primary-900">{p.judul}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-gray-600">{p.isi}</p>
                    {p.oleh && <p className="mt-1 text-xs text-gray-400">— {p.oleh}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tampilKabar && daftar.length > 0 && (
            <section className="panel overflow-hidden">
              <p className="label-kecil border-b border-gray-100 px-5 py-3">Kabar & pengingat</p>
              <ul className="divide-y divide-gray-50">
                {daftar.map(n => {
                  const warna = WARNA[n.jenis] ?? "bg-primary-700";
                  const IkonJenis = IKON_JENIS[n.jenis] ?? Bell;
                  const isi = (
                    <>
                      <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${CHIP[warna] ?? "bg-primary-50 text-primary-700"}`}>
                        <IkonJenis size={17} />
                        {!n.dibaca && <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${warna}`} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm ${n.dibaca ? "font-medium text-gray-600" : "font-semibold text-primary-900"}`}>{n.judul}</span>
                          <span className="status-badge border-gray-200 bg-gray-50 text-gray-600">{NAMA_JENIS[n.jenis] ?? "Kabar"}</span>
                          <span className="ml-auto text-xs text-gray-400">{relatif(n.waktu)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-gray-600">{n.isi}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.url ? (
                        <Link href={n.url} onClick={() => !n.dibaca && tandai({ id: n.id })} className="flex gap-3 px-5 py-3.5 transition hover:bg-gray-50">{isi}</Link>
                      ) : (
                        <button type="button" onClick={() => !n.dibaca && tandai({ id: n.id })} className="flex w-full gap-3 px-5 py-3.5 text-left transition hover:bg-gray-50">{isi}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
      <p className="flex items-center gap-1.5 text-xs text-gray-400"><Bell size={13} /> Kabar disimpan di akun Anda, jadi tetap terbaca walau notifikasi perangkat belum diaktifkan.</p>
    </div>
  );
}
