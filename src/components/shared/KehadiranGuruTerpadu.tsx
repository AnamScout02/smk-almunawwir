"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, ShieldAlert, UserCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

type Jenis = "HADIR_TAPI_ALPHA_DI_KELAS" | "TIDAK_HADIR_TAPI_ADA_JURNAL" | "PIKET_ALPHA_TAPI_ADA_JURNAL" | "ALPHA_SEHARIAN_TANPA_CATATAN_TU" | "BLOK_BELUM_DICATAT_PIKET";
interface Blok { kelas: string; mapel: string; jam: string; status: string; adaTugas: boolean | null; catatan: string | null }
interface Baris {
  userId: string; nama: string; nip: string | null; tanggal: string;
  harian: { status: string; jamMasuk: string | null; jamPulang: string | null; keterangan: string | null } | null;
  blok: Blok[]; blokSeharusnya: number;
  piket: { status: string; catatan: string | null } | null;
  jurnal: number; temuan: Jenis[];
}
interface Balasan { dari: string; sampai: string; tingkat: number[]; keterangan: Record<Jenis, { judul: string; jelas: string; berat: string }>; baris: Baris[] }

const WARNA_STATUS: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TERLAMBAT: "bg-amber-50 text-amber-700 border-amber-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  DINAS_LUAR: "bg-purple-50 text-purple-700 border-purple-200",
  CUTI: "bg-cyan-50 text-cyan-700 border-cyan-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const WARNA_BERAT: Record<string, string> = {
  tinggi: "bg-red-50 text-red-600 border-red-200",
  sedang: "bg-amber-50 text-amber-700 border-amber-200",
  rendah: "bg-gray-50 text-gray-500 border-gray-200",
};

function Pil({ teks, kelas }: { teks: string; kelas: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${kelas}`}>{teks}</span>;
}

/** Layar rekonsiliasi kehadiran guru: presensi harian TU · catatan guru piket per jam · jurnal guru
 * · kehadiran petugas piket, disandingkan per orang per tanggal. Tidak mengubah data apa pun —
 * perbaikan tetap lewat halaman pemilik masing-masing lapisan. */
export default function KehadiranGuruTerpadu({ bukuPiketHref, dariAwal, sampaiAwal }: {
  bukuPiketHref: string;
  /** Tanggal bawaan dihitung di SERVER (WIB) — server berjalan UTC, dan menghitungnya saat render
   *  klien membuat lint menolak `Date.now()` di badan komponen. */
  dariAwal: string;
  sampaiAwal: string;
}) {
  const [sampai, setSampai] = useState(sampaiAwal);
  const [dari, setDari] = useState(dariAwal);
  const [saring, setSaring] = useState("temuan");
  const [data, setData] = useState<Balasan | null>(null);
  const [muat, setMuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [tingkat, setTingkat] = useState<number[]>([]);
  const [simpanSibuk, setSimpanSibuk] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState("");

  const muatData = useCallback(async () => {
    // setState ditunda satu microtask supaya tidak dipanggil serentak di dalam efek
    // (aturan react-hooks/set-state-in-effect) — pola yang sama dipakai PusatNotifikasiPortal.
    queueMicrotask(() => { setMuat(true); setGalat(""); });
    try {
      const r = await fetch(`/api/kedisiplinan/kehadiran-terpadu?dari=${dari}&sampai=${sampai}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Gagal memuat");
      setData(d as Balasan); setTingkat((d as Balasan).tingkat);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setMuat(false);
    }
  }, [dari, sampai]);

  useEffect(() => { muatData(); }, [muatData]);

  const semua = useMemo(() => data?.baris ?? [], [data]);
  const tersaring = useMemo(() => {
    if (saring === "semua") return semua;
    if (saring === "temuan") return semua.filter(b => b.temuan.some(t => t !== "BLOK_BELUM_DICATAT_PIKET"));
    return semua.filter(b => b.temuan.includes(saring as Jenis));
  }, [semua, saring]);
  const hal = usePaginasi(tersaring, 50, `${dari}|${sampai}|${saring}`);

  const hitung = (j: Jenis) => semua.filter(b => b.temuan.includes(j)).length;

  async function simpanTingkat() {
    setSimpanSibuk(true); setPesanSimpan("");
    const r = await fetch("/api/kedisiplinan/kehadiran-terpadu", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tingkat }),
    }).catch(() => null);
    setSimpanSibuk(false);
    if (r?.ok) { setPesanSimpan("Tersimpan."); setData(p => (p ? { ...p, tingkat } : p)); await muatData(); }
    else setPesanSimpan((await r?.json().catch(() => null))?.error ?? "Gagal menyimpan.");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCheck size={22} />} title="Kehadiran Guru Terpadu"
        description="Presensi harian TU, catatan guru piket per jam pelajaran, jurnal mengajar, dan kehadiran petugas piket disandingkan dalam satu tabel." />

      <div className="baris-alat mb-5 items-end">
        <div className="alat-saring">
          <label className="label-field">Dari tanggal</label>
          <DatePicker value={dari} onChange={setDari} />
        </div>
        <div className="alat-saring">
          <label className="label-field">Sampai tanggal</label>
          <DatePicker value={sampai} onChange={setSampai} />
        </div>
        <div className="alat-saring">
          <label className="label-field">Tampilkan</label>
          <Select value={saring} onChange={setSaring} options={[
            { value: "temuan", label: "Hanya yang perlu diperiksa" },
            { value: "semua", label: "Semua baris" },
            { value: "HADIR_TAPI_ALPHA_DI_KELAS", label: "Hadir tapi jam kosong" },
            { value: "ALPHA_SEHARIAN_TANPA_CATATAN_TU", label: "Alpha seharian, TU kosong" },
            { value: "TIDAK_HADIR_TAPI_ADA_JURNAL", label: "Tidak hadir tapi ada jurnal" },
            { value: "PIKET_ALPHA_TAPI_ADA_JURNAL", label: "Piket & jurnal bertolak belakang" },
            { value: "BLOK_BELUM_DICATAT_PIKET", label: "Jam belum dicatat piket" },
          ]} />
        </div>
        <div className="alat-aksi">
          <Link href={bukuPiketHref} className="btn-modal-cancel btn-teks"><ArrowLeft size={16} /> Buku Piket</Link>
        </div>
      </div>

      {galat && <p className="error-msg mb-5">{galat}</p>}

      {muat ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : !data ? null : (
        <>
          <div className="kisi-kartu kisi-kartu-4 mb-5">
            <StatTile value={hitung("HADIR_TAPI_ALPHA_DI_KELAS")} label="Hadir tapi jam kosong" ikon="peringatan" color="red" sorot={hitung("HADIR_TAPI_ALPHA_DI_KELAS") > 0} />
            <StatTile value={hitung("ALPHA_SEHARIAN_TANPA_CATATAN_TU")} label="Alpha seharian, TU kosong" ikon="peringatan" color="amber" />
            <StatTile value={hitung("TIDAK_HADIR_TAPI_ADA_JURNAL") + hitung("PIKET_ALPHA_TAPI_ADA_JURNAL")} label="Catatan bertolak belakang" ikon="dokumen" color="purple" />
            <StatTile value={hitung("BLOK_BELUM_DICATAT_PIKET")} label="Jam belum dicatat piket" ikon="jam" color="gray" />
          </div>

          <p className="text-xs text-gray-400 mb-4 flex items-start gap-1.5">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            Halaman ini hanya membaca &amp; membandingkan — tidak mengubah data. Perbaikan tetap lewat pemiliknya:
            presensi harian di Presensi Pegawai (TU), catatan per jam di Buku Piket, jurnal oleh guru yang bersangkutan.
          </p>

          <div className="panel p-4 mb-5">
            <p className="label-kecil mb-2">Tingkat kelas yang dipantau guru piket</p>
            <div className="flex flex-wrap items-center gap-4">
              {[10, 11, 12].map(t => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-600 sentuh">
                  <input type="checkbox" checked={tingkat.includes(t)}
                    onChange={e => setTingkat(p => (e.target.checked ? [...p, t] : p.filter(x => x !== t)).sort((a, b) => a - b))}
                    className="h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500" />
                  Kelas {t === 10 ? "X" : t === 11 ? "XI" : "XII"}
                </label>
              ))}
              <button type="button" disabled={simpanSibuk || tingkat.length === 0} onClick={simpanTingkat} className="btn-modal-save sm:ml-auto">
                {simpanSibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan cakupan
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Menentukan jam pelajaran mana yang muncul di Buku Piket dan ikut dihitung ke skor kedisiplinan.
              Kelas XII biasanya dimatikan selama sedang PKL, lalu dinyalakan lagi saat kembali ke sekolah.
              {pesanSimpan && <span className="ml-1 font-medium text-emerald-600">{pesanSimpan}</span>}
            </p>
          </div>

          {tersaring.length === 0 ? (
            <EmptyState icon={UserCheck} title="Tidak ada yang perlu diperiksa"
              description="Pada rentang tanggal ini semua lapisan catatan saling cocok." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No</th><th>Nama</th><th>Tanggal</th><th>Presensi TU</th>
                      <th>Jam pelajaran (catatan piket)</th><th>Jurnal</th><th>Temuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hal.potongan.map((b, i) => (
                      <tr key={`${b.userId}|${b.tanggal}`}>
                        <td className="angka">{hal.awal + i}</td>
                        <td>
                          <span className="font-medium text-gray-700">{b.nama}</span>
                          {b.nip && <span className="block text-xs text-gray-400 angka">{b.nip}</span>}
                        </td>
                        <td className="angka whitespace-nowrap">{b.tanggal}</td>
                        <td>
                          {b.harian ? (
                            <>
                              <Pil teks={b.harian.status.replace("_", " ")} kelas={WARNA_STATUS[b.harian.status] ?? WARNA_STATUS.HADIR} />
                              {b.harian.jamMasuk && <span className="block text-xs text-gray-400 angka mt-1">masuk {b.harian.jamMasuk}{b.harian.jamPulang ? ` · pulang ${b.harian.jamPulang}` : ""}</span>}
                            </>
                          ) : <span className="text-xs text-gray-300">belum dicatat</span>}
                        </td>
                        <td>
                          {b.blok.length === 0 ? (
                            <span className="text-xs text-gray-300">{b.blokSeharusnya > 0 ? `${b.blokSeharusnya} jam belum dicatat` : "—"}</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {b.blok.map((k, n) => (
                                <span key={n} className="text-xs text-gray-500">
                                  <Pil teks={k.status} kelas={WARNA_STATUS[k.status] ?? WARNA_STATUS.HADIR} />{" "}
                                  {k.kelas} · {k.mapel} · <span className="angka">{k.jam}</span>
                                  {k.adaTugas ? " · ada tugas" : ""}
                                </span>
                              ))}
                              {b.blokSeharusnya > b.blok.length && (
                                <span className="text-xs text-gray-400">{b.blokSeharusnya - b.blok.length} jam belum dicatat piket</span>
                              )}
                            </div>
                          )}
                          {b.piket && <span className="block text-xs text-gray-400 mt-1">petugas piket: {b.piket.status}</span>}
                        </td>
                        <td className="angka">{b.jurnal || "—"}</td>
                        <td>
                          {b.temuan.length === 0 ? <span className="text-xs text-gray-300">cocok</span> : (
                            <div className="flex flex-col gap-1">
                              {b.temuan.map(t => (
                                <span key={t} title={data.keterangan[t]?.jelas}>
                                  <Pil teks={data.keterangan[t]?.judul ?? t} kelas={WARNA_BERAT[data.keterangan[t]?.berat ?? "rendah"]} />
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="baris" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
