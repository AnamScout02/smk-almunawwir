export const dynamic = "force-dynamic";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { muatPeserta } from "@/lib/pkl-server";
import { keadaanMou } from "@/lib/pkl-label";
import AgendaPklPanel from "@/components/pkl/AgendaPklPanel";

export const metadata = { title: "Kalender PKL" };

const HARI = 86_400_000;
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const tgl = (d: Date, tahun = true) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(tahun ? { year: "numeric" } : {}), timeZone: "UTC" });

/** KALENDER PKL (9 Okt 2026) — gelombang PKL di satu garis waktu + agenda 60 hari ke depan.
 *  "Gelombang" TIDAK disimpan: ia = kelompok siswa bertanggal mulai & selesai sama (lama PKL tidak seragam, 3/6 bulan),
 *  dihitung dari `muatPeserta` yang sama dengan Penempatan. Akses dijaga layout Pusat PKL. */
export default async function Page() {
  const hariIni = utc(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [peserta, dudi] = await Promise.all([
    muatPeserta(),
    prisma.industryPartner.findMany({ where: { aktif: true, mouEndDate: { not: null } }, select: { id: true, name: true, mouEndDate: true } }),
  ]);
  const aktif = peserta.filter(p => p.status !== "CANCELLED");
  const peta = new Map<string, { mulai: Date; selesai: Date; siswa: number; ditempatkan: number; dudi: Set<string>; kelas: Set<string>; diantar: number; dijemput: number }>();
  for (const p of aktif) {
    const k = `${p.mulai}|${p.selesai}`;
    const g = peta.get(k) ?? { mulai: utc(p.mulai), selesai: utc(p.selesai), siswa: 0, ditempatkan: 0, dudi: new Set<string>(), kelas: new Set<string>(), diantar: 0, dijemput: 0 };
    g.siswa++; if (p.kelas) g.kelas.add(p.kelas);
    if (p.tempat) { g.ditempatkan++; g.dudi.add(p.mitraId ?? p.tempat); }
    if (p.diantarPada) g.diantar++; if (p.dijemputPada) g.dijemput++;
    peta.set(k, g);
  }
  const gel = [...peta.values()].sort((a, b) => a.mulai.getTime() - b.mulai.getTime() || a.selesai.getTime() - b.selesai.getTime());
  const awal = gel.length ? new Date(Date.UTC(gel[0].mulai.getUTCFullYear(), gel[0].mulai.getUTCMonth(), 1)) : hariIni;
  const maks = gel.reduce((m, g) => Math.max(m, g.selesai.getTime()), hariIni.getTime());
  const akhir = new Date(Date.UTC(new Date(maks).getUTCFullYear(), new Date(maks).getUTCMonth() + 1, 1));
  const rentang = Math.max(1, akhir.getTime() - awal.getTime());
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - awal.getTime()) / rentang) * 100));
  const bulan: { label: string; kiri: number; lebar: number }[] = [];
  for (let d = new Date(awal); d < akhir; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    bulan.push({ label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" }), kiri: pos(d), lebar: pos(n) - pos(d) });
  }
  const batas = new Date(hariIni.getTime() + 60 * HARI);
  const dalam = (d: Date) => d >= hariIni && d <= batas;
  const agenda = [
    ...gel.filter(g => dalam(g.mulai)).map(g => ({ t: g.mulai, jenis: "Mulai PKL", kelas: "bg-blue-50 text-blue-700 border-blue-200", teks: `${g.siswa} siswa berangkat — ${g.siswa - g.ditempatkan > 0 ? `${g.siswa - g.ditempatkan} belum dapat DUDI` : `${g.dudi.size} DUDI`}`, href: "/pusat-pkl/penempatan" })),
    ...gel.filter(g => dalam(g.selesai)).map(g => ({ t: g.selesai, jenis: "Selesai PKL", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", teks: `${g.siswa} siswa selesai — siapkan penjemputan, nilai, dan sertifikat`, href: "/pusat-pkl/penempatan?saring=BERJALAN" })),
    ...dudi.filter(d => dalam(d.mouEndDate as Date)).map(d => ({ t: d.mouEndDate as Date, jenis: "MoU berakhir", kelas: "bg-amber-50 text-amber-700 border-amber-200", teks: d.name, href: `/pusat-pkl/dudi?buka=${d.id}` })),
  ].sort((a, b) => a.t.getTime() - b.t.getTime());
  const berjalan = gel.filter(g => g.mulai <= hariIni && g.selesai >= hariIni);
  const mouHabis = dudi.filter(d => keadaanMou(d.mouEndDate, hariIni).kode === "HABIS").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarRange size={22} />} title="Kalender PKL" description="Gelombang PKL di satu garis waktu dan agenda 60 hari ke depan" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={gel.length} label="Gelombang PKL" ikon="kalender" color="primary" />
          <StatTile value={berjalan.reduce((a, g) => a + g.siswa, 0)} label="Siswa di gelombang berjalan" ikon="pkl" color="blue" />
          <StatTile value={agenda.length} label="Agenda 60 hari ke depan" ikon="jam" color="emerald" />
          <StatTile value={mouHabis} label="MoU sudah habis" ikon="peringatan" color="amber" sorot={mouHabis > 0} />
        </div>

        <div className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">Garis waktu gelombang</p></div>
          {gel.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada peserta PKL.</p> : (
            <div className="overflow-x-auto">
              <div className="min-w-[44rem] p-5">
                <div className="relative mb-2 ml-56 h-5 text-xs text-gray-400">
                  {bulan.map(b => <span key={b.label} className="absolute top-0 truncate border-l border-gray-200 pl-1" style={{ left: `${b.kiri}%`, width: `${b.lebar}%` }}>{b.label}</span>)}
                </div>
                <ul className="space-y-2">
                  {gel.map(g => {
                    const lewat = g.selesai < hariIni, jalan = g.mulai <= hariIni && !lewat;
                    const hari = Math.round((g.selesai.getTime() - g.mulai.getTime()) / HARI) + 1;
                    return (
                      <li key={`${g.mulai.toISOString()}${g.selesai.toISOString()}`} className="flex items-center gap-3">
                        <div className="w-56 shrink-0 text-sm">
                          <p className="font-medium text-primary-900">{tgl(g.mulai, false)} – {tgl(g.selesai)}</p>
                          <p className="text-xs text-gray-500"><span className="angka">{g.siswa}</span> siswa · <span className="angka">{g.dudi.size}</span> DUDI · ±{Math.round(hari / 30)} bulan{g.siswa - g.ditempatkan > 0 && <span className="text-amber-700"> · {g.siswa - g.ditempatkan} belum dapat DUDI</span>}</p>
                        </div>
                        <div className="relative h-7 min-w-0 flex-1 rounded-lg bg-gray-50">
                          {bulan.map(b => <span key={b.label} className="absolute inset-y-0 border-l border-gray-100" style={{ left: `${b.kiri}%` }} />)}
                          <div className={`absolute inset-y-1 rounded-md ${lewat ? "bg-gray-300" : jalan ? "bg-primary-700" : "bg-primary-300"}`}
                            style={{ left: `${pos(g.mulai)}%`, width: `${Math.max(0.8, pos(new Date(g.selesai.getTime() + HARI)) - pos(g.mulai))}%` }} title={[...g.kelas].sort().join(", ")} />
                          <span className="absolute inset-y-0 w-px bg-red-500" style={{ left: `${pos(hariIni)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-xs text-gray-500">
                  <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary-700" /> berjalan</span>
                  <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary-300" /> akan datang</span>
                  <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-gray-300" /> sudah lewat</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-px bg-red-500" /> hari ini</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <AgendaPklPanel />

        <div className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">Mulai, selesai & MoU — 60 hari ke depan</p></div>
          {agenda.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada agenda PKL dalam 60 hari ke depan.</p> : (
            <ul className="divide-y divide-gray-100">
              {agenda.map((a, i) => {
                const sisa = Math.round((a.t.getTime() - hariIni.getTime()) / HARI);
                return (
                  <li key={i}>
                    <Link href={a.href} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm transition hover:bg-gray-50">
                      <span className="angka w-28 shrink-0 font-medium text-primary-900">{tgl(a.t)}</span>
                      <span className={`status-badge shrink-0 ${a.kelas}`}>{a.jenis}</span>
                      <span className="min-w-0 flex-1 text-gray-600">{a.teks}</span>
                      <span className="angka shrink-0 text-xs text-gray-400">{sisa === 0 ? "hari ini" : `${sisa} hari lagi`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
