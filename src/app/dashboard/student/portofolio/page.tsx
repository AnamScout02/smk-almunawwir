export const dynamic = "force-dynamic";

import Link from "next/link";
import { Award, Briefcase, Printer, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { portofolioSiswa } from "@/lib/portofolio-siswa";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";

export const metadata = { title: "Portofolio Saya" };

const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** E-PORTOFOLIO SISWA — prestasi, ekstrakurikuler, PKL, dan capaian nilai; bisa dicetak sebagai CV. */
export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const siswa = await prisma.student.findFirst({ where: { userId: session.userId }, select: { id: true } });
  const p = siswa ? await portofolioSiswa(siswa.id) : null;
  if (!p) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><EmptyState icon={Trophy} title="Data tidak ditemukan" description="Data siswa belum lengkap — hubungi TU." /></div>;
  const rataTerakhir = p.rapor[0]?.rata ?? null;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Trophy size={22} />} title="Portofolio Saya" description="Rangkuman prestasi, ekstrakurikuler, PKL, dan capaian belajar — bisa dicetak untuk melamar kerja atau kuliah" />
      <div className="alat-aksi justify-end mb-5">
        <Link href="/dashboard/student/portofolio/cetak" className="btn-modal-cancel"><Printer size={15} /> Cetak Portofolio</Link>
      </div>
      <div className="kisi-kartu kisi-kartu-4 mb-6">
        <StatTile ikon="prestasi" color="amber" value={p.prestasi.length} label="Prestasi tercatat" />
        <StatTile ikon="daftar-centang" color="purple" value={p.ekstra.length} label="Ekstrakurikuler diikuti" />
        <StatTile ikon="pkl" color="blue" value={p.pkl ? 1 : 0} label={p.pkl ? p.pkl.company : "Belum ada PKL"} />
        <StatTile ikon="tren" color="emerald" value={rataTerakhir != null ? Math.round(rataTerakhir * 10) / 10 : "—"} label={p.rapor[0] ? `Rata-rata ${p.rapor[0].semester}` : "Rapor belum disahkan"} />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
        <div className="panel p-5">
          <p className="label-kecil mb-3">Prestasi</p>
          {p.prestasi.length === 0 ? <p className="text-sm text-gray-500">Belum ada prestasi tercatat. Laporkan prestasimu ke wali kelas atau Kesiswaan agar masuk portofolio.</p> : (
            <ul className="space-y-2 text-sm">
              {p.prestasi.map(x => (
                <li key={x.id} className="flex items-start gap-2">
                  <Award size={15} className="mt-0.5 shrink-0 text-gold" />
                  <span><strong>{x.jenis}</strong>{x.catatan ? ` — ${x.catatan}` : ""}<span className="block text-xs text-gray-500">{tgl(x.tanggal)}{x.bersertifikat ? " · piagam tersedia" : ""}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-6">
          <div className="panel p-5">
            <p className="label-kecil mb-3">Ekstrakurikuler</p>
            {p.ekstra.length === 0 ? <p className="text-sm text-gray-500">Belum terdaftar di ekstrakurikuler.</p> : (
              <ul className="space-y-1 text-sm text-gray-700">
                {p.ekstra.map(e => <li key={e.nama}>{e.nama}{e.peran ? ` · ${e.peran}` : ""}{e.predikat ? ` — predikat ${e.predikat} (${e.semester})` : ""}</li>)}
              </ul>
            )}
          </div>
          <div className="panel p-5">
            <p className="label-kecil mb-3">Praktik Kerja Lapangan</p>
            {!p.pkl ? <p className="text-sm text-gray-500">Belum ada data PKL.</p> : (
              <p className="flex items-start gap-2 text-sm text-gray-700"><Briefcase size={15} className="mt-0.5 shrink-0 text-primary-700" />
                <span><strong>{p.pkl.company}</strong> — {p.pkl.position}<span className="block text-xs text-gray-500">{tgl(p.pkl.startDate)} – {tgl(p.pkl.endDate)}{p.pkl.nilaiIndustriRata != null ? ` · nilai industri ${p.pkl.nilaiIndustriRata}` : ""}</span></span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
