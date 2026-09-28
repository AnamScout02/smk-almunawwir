"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FileCheck2, Handshake, Loader2, Newspaper, UserCheck , Briefcase} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Panel, { PanelKosong } from "@/components/shared/Panel";
import { BarDaftar } from "@/components/shared/GrafikRingkas";
import { useToast } from "@/components/shared/ToastProvider";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Ringkasan {
  mitra: { total: number; mouAktif: number; tanpaMou: number; segeraBerakhir: { id: string; nama: string; sampai: string; kontak: string | null; telepon: string | null }[]; kedaluwarsa: { id: string; nama: string; sampai: string }[]; daftar: { id: string; nama: string; bidang: string | null; kuota: number | null; terisi: number }[] };
  pkl: { berjalan: number; selesai: number; tanpaPembimbing: number; belumDinilaiIndustri: number; belumDimonitor: number; jurnalMacet: { studentId: string; nama: string; kelas: string; perusahaan: string; pembimbing: string; terakhir: string | null }[]; perPerusahaan: { nama: string; jumlah: number }[] };
  pendaftaran: number; monitoringBulanIni: number; tracer: { status: string; jumlah: number }[];
}
const TRACER: Record<string, string> = { BEKERJA: "Bekerja", KULIAH: "Kuliah", WIRAUSAHA: "Wirausaha", BELUM_BEKERJA: "Belum bekerja", LAINNYA: "Lainnya" };
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

/** DASHBOARD WAKIL KEPALA HUMAS (17 Sep 2026). */
/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function DashboardHumas({ basePath = BASE_GURU }: { basePath?: string }) {
  const toast = useToast();
  const [d, setD] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  const [draf, setDraf] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/teacher/humas/ringkasan", { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else setD(x);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  async function buatDraf(partnerId: string) {
    setDraf(partnerId);
    const r = await fetch("/api/teacher/humas/draf-berita", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerId }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setDraf(null);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal membuat draf."); return; }
    toast.success("Draf berita dikirim ke Tim Branding (belum terbit).");
  }

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><EmptyState icon={Handshake} title="Tidak tersedia" description={galat} /></div>;
  if (!d) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const perhatianMou = d.mitra.segeraBerakhir.length + d.mitra.kedaluwarsa.length;
  /* BARIS PINTASAN (27 September 2026, pola Dashboard Kurikulum). Kartu angka di bawah memang bisa diklik,
     tetapi pintasan tetap dipasang supaya susunannya sama dengan dashboard jabatan lain. */
  const pintasan = [
    { href: tautanJabatan(basePath, "humas/industry-partners"), label: "Mitra Industri", ikon: Building2 },
    { href: tautanJabatan(basePath, "humas/pkl-pendaftaran"), label: "Pendaftaran PKL", ikon: Briefcase },
    { href: tautanJabatan(basePath, "humas/tracer-study"), label: "Tracer Study", ikon: UserCheck },
    { href: tautanJabatan(basePath, "branding/liputan"), label: "Liputan Media", ikon: Newspaper },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Handshake size={22} />} title="Dashboard Humas" description="Kemitraan industri, PKL, dan keterserapan lulusan" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile ikon="kelas" color="primary" value={d.mitra.total} label={`Mitra industri · ${d.mitra.mouAktif} MoU aktif`} href={tautanJabatan(basePath, "humas/industry-partners")} />
          <StatTile ikon="peringatan" color={perhatianMou ? "amber" : "emerald"} value={perhatianMou} label="MoU berakhir ≤60 hari / kedaluwarsa" sorot={perhatianMou > 0} href={tautanJabatan(basePath, "humas/industry-partners")} />
          <StatTile ikon="pkl" color="blue" value={d.pkl.berjalan} label={`Siswa sedang PKL · ${d.pkl.selesai} selesai`} />
          <StatTile ikon="menunggu" color={d.pendaftaran ? "amber" : "emerald"} value={d.pendaftaran} label="Pendaftaran PKL menunggu" href={tautanJabatan(basePath, "humas/pkl-pendaftaran")} sorot={d.pendaftaran > 0} />
        </div>

                <BarisPintasan items={pintasan} />
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile ikon="jurnal" color={d.pkl.jurnalMacet.length ? "red" : "emerald"} value={d.pkl.jurnalMacet.length} label="Jurnal PKL berhenti ≥3 hari" />
          <StatTile ikon="daftar-centang" color={d.pkl.belumDinilaiIndustri ? "amber" : "emerald"} value={d.pkl.belumDinilaiIndustri} label="Belum dinilai industri (≤14 hari berakhir)" />
          <StatTile ikon="kunjungan" color="purple" value={d.monitoringBulanIni} label={`Monitoring 30 hari · ${d.pkl.belumDimonitor} belum dimonitor`} />
          <StatTile ikon="guru" color={d.pkl.tanpaPembimbing ? "red" : "emerald"} value={d.pkl.tanpaPembimbing} label="PKL tanpa guru pembimbing" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={tautanJabatan(basePath, "humas/pkl-pendaftaran")} className="btn-modal-cancel"><FileCheck2 /> Pendaftaran PKL</Link>
          <Link href={tautanJabatan(basePath, "humas/industry-partners")} className="btn-modal-cancel"><Building2 /> Mitra Industri</Link>
          <Link href={tautanJabatan(basePath, "humas/tracer-study")} className="btn-modal-cancel"><UserCheck /> Tracer Study</Link>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
          <div className="kolom-dashboard space-y-6 xl:col-span-7 min-w-0">
            <Panel judul="MoU perlu diperpanjang" ikon={<Handshake />} isi={false}>
              {perhatianMou === 0 ? <PanelKosong ikon={<Handshake />} teks="Tidak ada MoU yang berakhir dalam 60 hari." /> : (
                <ul className="divide-y divide-gray-50">
                  {[...d.mitra.kedaluwarsa.map(m => ({ ...m, lewat: true, kontak: null as string | null, telepon: null as string | null })), ...d.mitra.segeraBerakhir.map(m => ({ ...m, lewat: false }))].map(m => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                      <span className="font-semibold text-primary-900">{m.nama}</span>
                      <span className={`status-badge ${m.lewat ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{m.lewat ? "Kedaluwarsa" : "Berakhir"} {tgl(m.sampai)}</span>
                      {m.telepon && <a href={`https://wa.me/${m.telepon.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-medium text-primary-700 hover:underline">Hubungi {m.kontak ?? ""}</a>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel judul="Jurnal PKL berhenti" ikon={<FileCheck2 />} keterangan="Tidak ada jurnal 3 hari terakhir — ingatkan siswa & pembimbing" isi={false}>
              {d.pkl.jurnalMacet.length === 0 ? <PanelKosong ikon={<FileCheck2 />} teks="Semua siswa PKL rutin mengisi jurnal." /> : (
                <ul className="divide-y divide-gray-50">
                  {d.pkl.jurnalMacet.map(j => (
                    <li key={j.studentId} className="px-5 py-2.5 text-sm"><p className="font-semibold text-primary-900">{j.nama} <span className="text-xs font-normal text-gray-500">· {j.kelas}</span></p><p className="text-xs text-gray-600">{j.perusahaan} · pembimbing {j.pembimbing} · jurnal terakhir {j.terakhir ? tgl(j.terakhir) : "belum ada"}</p></li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <div className="kolom-dashboard space-y-6 xl:col-span-5 min-w-0">
            <Panel judul="Siswa PKL per perusahaan" ikon={<Building2 />}>
              {d.pkl.perPerusahaan.length === 0 ? <PanelKosong ikon={<Building2 />} teks="Belum ada siswa yang sedang PKL." /> : <BarDaftar data={d.pkl.perPerusahaan.map(p => ({ kunci: p.nama, label: p.nama, nilai: p.jumlah }))} satuan="siswa" />}
            </Panel>
            <Panel judul="Kabar kerja sama → berita" ikon={<Newspaper />} keterangan="Buat draf berita untuk Tim Branding" isi={false}>
              {d.mitra.daftar.length === 0 ? <PanelKosong ikon={<Newspaper />} teks="Belum ada mitra industri." /> : (
                <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto">
                  {d.mitra.daftar.map(m => (
                    <li key={m.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                      <div className="min-w-0 flex-1"><p className="truncate font-medium text-primary-900">{m.nama}</p><p className="text-xs text-gray-500">{m.bidang ?? "—"}{m.kuota ? ` · ${m.terisi}/${m.kuota} kuota` : ""}</p></div>
                      <button type="button" disabled={draf === m.id} onClick={() => buatDraf(m.id)} className="btn-modal-cancel shrink-0 px-2.5 text-xs">{draf === m.id ? <Loader2 className="animate-spin" /> : <Newspaper />} Draf</button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel judul="Tracer study alumni" ikon={<UserCheck />} tautan={{ label: "Rinci", href: tautanJabatan(basePath, "humas/tracer-study") }}>
              {d.tracer.length === 0 ? <PanelKosong ikon={<UserCheck />} teks="Belum ada data tracer study." /> : <BarDaftar data={d.tracer.map(t => ({ kunci: t.status, label: TRACER[t.status] ?? t.status, nilai: t.jumlah }))} satuan="alumni" />}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
