"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Camera, ClipboardCheck, Flag, Loader2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import BarisPintasan from "@/components/shared/BarisPintasan";
import { KisiMenuPortal } from "@/components/shared/NavPortal";
import { MENU_PUSAT_EKSTRA } from "@/lib/menu-portal";

interface Ekskul {
  id: string; nama: string; jenis: string; anggota: number; jadwalRutin: string | null; pembinaAkun: string[]; pembinaLuar: string | null; adaTautan: boolean; pendaftar?: number;
  pertemuanBulanIni: number; persenHadir: number | null; fotoBulanIni: number; tanpaFoto: number; terakhir: string | null;
  agenda: { judul: string; jenis: string; mulai: string; tempat: string | null }[];
}
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/** BERANDA PUSAT EKSTRAKURIKULER — keadaan tiap ekskul bulan ini. Angka dari /api/ekstra/ringkasan. */
export default function DasborEkstra() {
  const [d, setD] = useState<{ kelola: boolean; hariIni: string; ekskul: Ekskul[] } | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    fetch("/api/ekstra/ringkasan", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat."); else setD(j); })
      .catch(() => setGalat("Gagal memuat."));
  }, []);
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div>;
  const e = d.ekskul, anggota = e.reduce((n, x) => n + x.anggota, 0), pertemuan = e.reduce((n, x) => n + x.pertemuanBulanIni, 0);
  const pendaftar = e.reduce((n, x) => n + (x.pendaftar ?? 0), 0);
  const tanpaPembina = e.filter(x => !x.pembinaAkun.length && !x.pembinaLuar).length;
  const bulan = new Date(`${d.hariIni}T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Flag size={22} />} title="Beranda" description={`${e.length} kegiatan · ${bulan}${d.kelola ? "" : " · ekstrakurikuler yang Anda bina"}`} />
      <div className="space-y-6">
        {pendaftar > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="min-w-0 flex-1"><b className="angka">{pendaftar}</b> siswa mendaftar dan menunggu keputusan pembina.</p>
            <Link href="/pusat-ekstra/pendaftaran" className="btn-modal-cancel btn-teks px-3 text-xs">Buka Pendaftar</Link>
          </div>
        )}
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={e.length} label="Ekstrakurikuler & organisasi" icon={Flag} color="primary" />
          <StatTile value={anggota} label="Keanggotaan siswa" icon={Users} color="blue" />
          <StatTile value={pertemuan} label="Pertemuan bulan ini" icon={ClipboardCheck} color="emerald" />
          <StatTile value={tanpaPembina} label="Belum punya pembina" icon={CalendarClock} color={tanpaPembina ? "amber" : "gray"} sorot={tanpaPembina > 0} />
        </div>
        <BarisPintasan items={[
          { href: "/pusat-ekstra/absensi", label: "Absensi Latihan", ikon: ClipboardCheck },
          { href: "/pusat-ekstra/kegiatan", label: "Kegiatan & Foto", ikon: Camera },
          { href: "/pusat-ekstra/anggota", label: "Ekskul & Anggota", ikon: Users },
          { href: "/pusat-ekstra/agenda", label: "Jadwal & Lomba", ikon: CalendarClock },
        ]} />
        <KisiMenuPortal items={d.kelola ? MENU_PUSAT_EKSTRA : MENU_PUSAT_EKSTRA.filter(m => m.href !== "/pusat-ekstra/pembina")} />
        {e.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada ekstrakurikuler.</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {e.map(x => (
              <section key={x.id} className="panel min-w-0 p-5">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 font-heading text-base font-semibold text-primary-900">{x.nama}</h2>
                  <span className={`status-badge ${x.jenis === "INTRA" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{x.jenis === "INTRA" ? "Organisasi intra" : "Ekstrakurikuler"}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Pembina: {[...x.pembinaAkun, ...(x.pembinaLuar ? [`${x.pembinaLuar} (luar sekolah)`] : [])].join(", ") || <span className="font-semibold text-amber-700">belum ada</span>}
                </p>
                {x.jadwalRutin && <p className="text-sm text-gray-500">Jadwal: {x.jadwalRutin}</p>}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#f5f6fa] px-2 py-2"><dd className="angka text-lg font-semibold text-primary-900">{x.anggota}</dd><dt className="text-xs text-gray-500">anggota</dt></div>
                  <div className="rounded-xl bg-[#f5f6fa] px-2 py-2"><dd className="angka text-lg font-semibold text-primary-900">{x.pertemuanBulanIni}</dd><dt className="text-xs text-gray-500">pertemuan</dt></div>
                  <div className="rounded-xl bg-[#f5f6fa] px-2 py-2"><dd className="angka text-lg font-semibold text-primary-900">{x.persenHadir === null ? "—" : `${x.persenHadir}%`}</dd><dt className="text-xs text-gray-500">hadir</dt></div>
                </dl>
                <p className="mt-3 text-xs text-gray-500">
                  {x.terakhir ? `Kegiatan terakhir ${tgl(x.terakhir)}` : "Belum ada kegiatan tercatat"}
                  {x.pertemuanBulanIni > 0 && <> · {x.fotoBulanIni} foto{x.tanpaFoto > 0 && <span className="font-semibold text-amber-700"> · {x.tanpaFoto} pertemuan tanpa foto</span>}</>}
                  {d.kelola && x.pembinaLuar && !x.adaTautan && <span className="block font-semibold text-amber-700">Pembina luar belum diberi tautan absensi.</span>}
                </p>
                {x.agenda.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
                    {x.agenda.map((a, i) => <li key={i} className="flex min-w-0 gap-2"><span className="angka shrink-0 text-gray-400">{tgl(a.mulai)}</span><span className="min-w-0 truncate text-gray-700">{a.judul}</span></li>)}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/pusat-ekstra/absensi" className="btn-modal-cancel px-3 text-xs">Absensi</Link>
                  <Link href={`/pusat-ekstra/kegiatan?ekskul=${x.id}`} className="btn-modal-cancel px-3 text-xs">Kegiatan & foto</Link>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
