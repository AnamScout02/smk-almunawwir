"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, DoorOpen, FlaskConical, Hammer, Loader2, QrCode, Wrench } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import Panel, { PanelKosong } from "@/components/shared/Panel";
import { STATUS_RUSAK, rentang, tgl } from "@/components/sarpras/sarpras-umum";

interface Ringkasan {
  lab: boolean; tanggal: string;
  aset: { jenis: number; unit: number; baik: number; rusakRingan: number; rusakBerat: number };
  kerusakan: { id: string; judul: string | null; lokasi: string | null; description: string; prioritas: string; status: string; reportDate: string; reportedBy: string | null; asset: { name: string; location: string | null } | null }[];
  menunggu: number; dipinjam: number; terlambatKembali: number;
  perawatan: { id: string; judul: string; berikutnya: string; lokasi: string | null; asset: { name: string } | null }[];
  opname: { id: string; judul: string; item: number } | null;
  pakaiHariIni: { id: string; jenis: string; ruang: string | null; peminjamNama: string; keperluan: string; mulai: string; selesai: string; asset: { name: string } | null }[];
  jadwalLab: { ruang: string | null; jam: string; kelas: string; mapel: string; guru: string }[];
}

/** Ringkasan Sarpras/Lab untuk Dashboard Sarpras & Dashboard Kepala Lab (satu komponen, `base` = awalan tautan). */
export default function RingkasanSarpras({ lingkupLab, base, inventarisHref }: { lingkupLab: boolean; base: string; inventarisHref: string }) {
  const [d, setD] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    fetch(`/api/sarpras/ringkasan${lingkupLab ? "?lingkup=LAB" : ""}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else setD(x);
    }).catch(() => setGalat("Gagal memuat."));
  }, [lingkupLab]);
  if (galat) return <p className="py-8 text-center text-sm text-gray-500">{galat}</p>;
  if (!d) return <div className="flex justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>;
  const hariIni = d.tanggal;
  const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <div className="kisi-kartu kisi-kartu-4">
        <StatTile ikon="aset" color="primary" value={d.aset.jenis} label={`Jenis barang · ${d.aset.unit} unit`} href={inventarisHref} />
        <StatTile ikon="rusak" color={d.kerusakan.length ? "red" : "emerald"} value={d.aset.rusakRingan + d.aset.rusakBerat} label={`Barang rusak (${d.aset.rusakBerat} berat)`} href={inventarisHref} sorot={d.aset.rusakBerat > 0} />
        <StatTile ikon="menunggu" color={d.menunggu ? "amber" : "blue"} value={d.menunggu} label="Permohonan pinjam menunggu" href={`${base}/peminjaman`} sorot={d.menunggu > 0} />
        <StatTile ikon="perawatan" color={d.perawatan.some(p => tglWib(p.berikutnya) <= hariIni) ? "amber" : "emerald"} value={d.perawatan.filter(p => tglWib(p.berikutnya) <= hariIni).length} label="Perawatan jatuh tempo" href={`${base}/perawatan`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`${base}/peminjaman`} className="btn-modal-cancel"><CalendarClock /> Peminjaman</Link>
        <Link href={`${base}/perawatan`} className="btn-modal-cancel"><Wrench /> Perawatan</Link>
        <Link href={`${base}/stok-opname`} className="btn-modal-cancel"><ClipboardList /> Stok Opname{d.opname ? " (berjalan)" : ""}</Link>
        <Link href={`${base}/label-aset`} className="btn-modal-cancel"><QrCode /> Label QR</Link>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        <div className="space-y-6 xl:col-span-7 min-w-0">
          <Panel judul="Kerusakan belum selesai" ikon={<Hammer />} tautan={{ label: "Kelola", href: inventarisHref }} isi={false}>
            {d.kerusakan.length === 0 ? <PanelKosong ikon={<Hammer />} teks="Tidak ada laporan kerusakan terbuka." /> : (
              <ul className="divide-y divide-gray-50">
                {d.kerusakan.map(k => (
                  <li key={k.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-primary-900">{k.asset?.name ?? k.judul}</p>
                      {k.prioritas === "TINGGI" && <span className="status-badge bg-red-50 text-red-600 border-red-200">Mendesak</span>}
                      <span className={`status-badge ${STATUS_RUSAK[k.status]?.kelas}`}>{STATUS_RUSAK[k.status]?.label}</span>
                      <span className="ml-auto text-xs text-gray-500">{tgl(k.reportDate)}</span>
                    </div>
                    <p className="text-xs text-gray-600">{[k.lokasi ?? k.asset?.location, k.description, k.reportedBy].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {d.lab && (
            <Panel judul="Jadwal pemakaian lab hari ini" ikon={<FlaskConical />} isi={false}>
              {d.jadwalLab.length === 0 ? <PanelKosong ikon={<FlaskConical />} teks="Tidak ada jadwal pelajaran di ruang lab hari ini (kolom Ruang di jadwal berisi kata Lab)." /> : (
                <ul className="divide-y divide-gray-50">
                  {d.jadwalLab.map((j, i) => <li key={i} className="px-5 py-2.5 text-sm"><span className="angka font-semibold text-primary-900">{j.jam}</span> · {j.ruang} · {j.kelas} — {j.mapel} <span className="text-xs text-gray-500">({j.guru})</span></li>)}
                </ul>
              )}
            </Panel>
          )}
        </div>
        <div className="space-y-6 xl:col-span-5 min-w-0">
          <Panel judul="Dipakai hari ini" ikon={<DoorOpen />} tautan={{ label: "Semua", href: `${base}/peminjaman` }} keterangan={d.terlambatKembali ? `${d.terlambatKembali} belum dikembalikan tepat waktu` : undefined} isi={false}>
            {d.pakaiHariIni.length === 0 ? <PanelKosong ikon={<DoorOpen />} teks="Tidak ada peminjaman/pemesanan hari ini." /> : (
              <ul className="divide-y divide-gray-50">
                {d.pakaiHariIni.map(p => <li key={p.id} className="px-5 py-2.5 text-sm"><p className="font-semibold text-primary-900">{p.jenis === "RUANG" ? p.ruang : p.asset?.name}</p><p className="text-xs text-gray-600">{rentang(p.mulai, p.selesai)} · {p.peminjamNama} — {p.keperluan}</p></li>)}
              </ul>
            )}
          </Panel>
          <Panel judul="Perawatan 7 hari ke depan" ikon={<Wrench />} tautan={{ label: "Jadwal", href: `${base}/perawatan` }} isi={false}>
            {d.perawatan.length === 0 ? <PanelKosong ikon={<Wrench />} teks="Tidak ada perawatan terjadwal dalam sepekan." /> : (
              <ul className="divide-y divide-gray-50">
                {d.perawatan.map(p => {
                  const lewat = tglWib(p.berikutnya) < hariIni;
                  return <li key={p.id} className="px-5 py-2.5 text-sm"><p className="font-semibold text-primary-900">{p.judul}</p><p className={`text-xs ${lewat ? "text-red-600" : "text-gray-600"}`}>{tgl(p.berikutnya)}{lewat ? " · terlewat" : ""} · {p.asset?.name ?? p.lokasi ?? ""}</p></li>;
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
