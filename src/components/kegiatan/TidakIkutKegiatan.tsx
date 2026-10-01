"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarX2, ChevronDown, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Bolos { kegiatanId: string; judul: string; jenis: string; tanggal: string }
interface Baris { userId: string; nama: string; kelas: string; jumlah: number; rincian: Bolos[] }
interface Data { cakupan: "SAYA" | "ANAK" | "WALI" | "SEMUA"; daftar: Baris[] }

const JENIS: Record<string, string> = { RAPAT: "Rapat", KEGIATAN: "Kegiatan", UPACARA: "Upacara", PELATIHAN: "Pelatihan" };
const tgl = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const RENTANG = [
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "3 bulan terakhir" },
  { value: "120", label: "4 bulan terakhir" },
  { value: "365", label: "1 tahun terakhir" },
];

/** KETIDAKHADIRAN KEGIATAN — dihitung, bukan disimpan (lihat src/lib/kegiatan-tidak-hadir.ts).
 *  Cakupannya ditentukan SERVER menurut peran: siswa melihat dirinya sendiri, orang tua melihat
 *  anaknya, wali kelas melihat kelas walinya, Kesiswaan/BK & Admin melihat semua. */
export default function TidakIkutKegiatan() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [hari, setHari] = useState("120");
  const [cari, setCari] = useState("");
  const [buka, setBuka] = useState<string | null>(null);

  const muat = useCallback((h: string) => {
    setMemuat(true);
    fetch(`/api/kegiatan/ketidakhadiran?hari=${h}`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: Data & { error?: string }) => { if (d.error) setGalat(d.error); else { setData(d); setGalat(""); } })
      .catch(() => setGalat("Gagal memuat. Periksa sambungan lalu muat ulang halaman."))
      .finally(() => setMemuat(false));
  }, []);
  useEffect(() => { muat(hari); }, [muat, hari]);

  const q = cari.toLowerCase();
  const daftar = (data?.daftar ?? []).filter(b => !q || `${b.nama} ${b.kelas}`.toLowerCase().includes(q));
  const hal = usePaginasi(daftar, 50, `${hari}|${cari}`);
  const sendiri = data?.cakupan === "SAYA";
  const totalHari = (data?.daftar ?? []).reduce((a, b) => a + b.jumlah, 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarX2 size={22} />} title={sendiri ? "Kegiatan yang Tidak Saya Ikuti" : "Tidak Ikut Kegiatan"}
        description="Dihitung dari kegiatan yang HARINYA SUDAH LEWAT: terdaftar sebagai peserta, tetapi tidak ada catatan hadir" />

      <div className="space-y-6">
        {!memuat && !galat && (
          <div className="kisi-kartu kisi-kartu-2">
            <StatTile ikon="siswa" color={daftar.length ? "amber" : "emerald"} value={data?.daftar.length ?? 0}
              label={sendiri ? "Kegiatan terlewat" : "Orang pernah tidak ikut"} />
            <StatTile ikon="kalender" color={totalHari ? "red" : "emerald"} value={totalHari} label="Total hari terlewat" sorot={totalHari > 0} />
          </div>
        )}

        {/* Urutan baku baris alat: cari → saringan → tab → aksi (DESIGN_SYSTEM §4.1). Menaruh
            saringan lebih dulu membuat dropdown menempel di kiri dan kotak cari melar aneh di
            layar lebar (temuan user 1 Oktober 2026). */}
        <div className="baris-alat">
          {!sendiri && (data?.daftar.length ?? 0) > 0 && (
            <div className="alat-cari">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau kelas…" className="input-field pl-10" />
            </div>
          )}
          <div className="alat-saring">
            <Select value={hari} onChange={setHari} options={RENTANG} />
          </div>
        </div>

        {galat && <p className="py-10 text-center text-sm text-gray-400">{galat}</p>}
        {memuat ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        ) : !galat && daftar.length === 0 ? (
          <EmptyState icon={CalendarX2} title="Tidak ada yang terlewat"
            description={sendiri ? "Semua kegiatan yang ditujukan untukmu sudah terhadiri." : "Semua peserta hadir di kegiatan yang sudah lewat."} />
        ) : !galat && (
          <>
            <div className="space-y-3">
              {hal.potongan.map(b => (
                <div key={b.userId} className="panel overflow-hidden">
                  <button type="button" onClick={() => setBuka(buka === b.userId ? null : b.userId)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-primary-50/30">
                    <div className="min-w-0">
                      <p className="font-semibold text-primary-900">{sendiri ? "Riwayat ketidakhadiran" : b.nama}</p>
                      {!sendiri && <p className="text-xs text-gray-500">{b.kelas || "Guru & Staf"}</p>}
                    </div>
                    <span className="angka shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {b.jumlah} hari
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${buka === b.userId ? "rotate-180" : ""}`} />
                  </button>
                  {(buka === b.userId || sendiri) && (
                    <div className="overflow-x-auto border-t border-gray-50">
                      <table className="data-table">
                        <thead><tr><th className="w-10">No</th><th>Kegiatan</th><th>Jenis</th><th>Tanggal</th></tr></thead>
                        <tbody>
                          {b.rincian.map((r, i) => (
                            <tr key={`${r.kegiatanId}-${r.tanggal}`}>
                              <td className="angka text-gray-500">{i + 1}</td>
                              <td className="font-medium text-primary-900">{r.judul}</td>
                              <td className="text-xs text-gray-600">{JENIS[r.jenis] ?? r.jenis}</td>
                              <td className="whitespace-nowrap text-xs text-gray-600">{tgl(r.tanggal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Paginasi hal={hal} satuan={sendiri ? "catatan" : "orang"} />
          </>
        )}
      </div>
    </div>
  );
}
