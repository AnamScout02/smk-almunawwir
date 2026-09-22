"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Ruler, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { BarDaftar } from "@/components/shared/GrafikRingkas";
import { useToast } from "@/components/shared/ToastProvider";

interface Terakhir { tanggal: string; tinggiCm: number | null; beratKg: number | null; imt: number | null; statusGizi: string | null }
interface Siswa { id: string; nama: string; nis: string; jk: string | null; terakhir: Terakhir | null }
type Isian = { tinggiCm: string; beratKg: string; tensi: string; penglihatan: string; catatan: string };
const kosong: Isian = { tinggiCm: "", beratKg: "", tensi: "", penglihatan: "", catatan: "" };

function gizi(t: string, b: string) {
  const tc = Number(t), bk = Number(b);
  if (!tc || !bk || tc < 80 || bk < 15) return null;
  const imt = Math.round((bk / ((tc / 100) ** 2)) * 10) / 10;
  return { imt, status: imt < 17 ? "Sangat kurus" : imt < 18.5 ? "Kurus" : imt <= 25 ? "Normal" : imt <= 27 ? "Gemuk" : "Obesitas" };
}
const WARNA: Record<string, string> = { "Sangat kurus": "text-red-600", Kurus: "text-amber-700", Normal: "text-emerald-700", Gemuk: "text-amber-700", Obesitas: "text-red-600" };

/** PEMERIKSAAN KESEHATAN BERKALA (Kepala UKS, 17 Sep 2026) — TB/BB per kelas, IMT & status gizi otomatis. */
export default function PemeriksaanManager({ kembaliHref }: { kembaliHref: string }) {
  const toast = useToast();
  const [kelas, setKelas] = useState<{ id: string; name: string }[] | null>(null);
  const [rekap, setRekap] = useState<{ statusGizi: string | null; _count: { _all: number } }[]>([]);
  const [galat, setGalat] = useState("");
  const [classId, setClassId] = useState("");
  const [siswa, setSiswa] = useState<Siswa[] | null>(null);
  const [isian, setIsian] = useState<Record<string, Isian>>({});
  const [tanggal, setTanggal] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback((kid: string) => {
    fetch(`/api/uks/pemeriksaan${kid ? `?classId=${kid}` : ""}`, { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) { setGalat(d?.error ?? "Gagal memuat."); return; }
      setKelas(d.kelas); setRekap(d.rekap ?? []);
      if (kid) { setSiswa(d.siswa ?? []); setIsian({}); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(""); }, [muat]);
  const set = (id: string, k: keyof Isian, v: string) => setIsian(p => ({ ...p, [id]: { ...(p[id] ?? kosong), [k]: v } }));
  async function simpan() {
    const baris = Object.entries(isian).map(([studentId, x]) => ({ studentId, ...x }));
    setSibuk(true);
    const r = await fetch("/api/uks/pemeriksaan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tanggal: `${tanggal}T09:00:00+07:00`, baris }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(`${d.jumlah} hasil pemeriksaan tersimpan.`); muat(classId);
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Ruler size={22} />} title="Pemeriksaan Kesehatan" description="Tinggi & berat badan, IMT, dan status gizi siswa per kelas" />
      {galat ? <EmptyState icon={Ruler} title="Tidak tersedia" description={galat} /> : !kelas ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          <div className="baris-alat">
            <div className="alat-saring"><Select value={classId} onChange={v => { setClassId(v); setSiswa(null); muat(v); }} placeholder="Pilih kelas" options={kelas.map(k => ({ value: k.id, label: k.name }))} /></div>
            <div className="alat-saring"><DatePicker value={tanggal} onChange={setTanggal} /></div>
            <div className="alat-aksi">
              <Link href={kembaliHref} className="btn-modal-cancel btn-teks"><ArrowLeft /> UKS</Link>
              {siswa && <button type="button" disabled={sibuk || !Object.keys(isian).length} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan {Object.keys(isian).length || ""}</button>}
            </div>
          </div>
          {rekap.length > 0 && (
            <div className="panel p-5"><p className="label-kecil mb-3">Status gizi 12 bulan terakhir (seluruh sekolah)</p>
              <BarDaftar data={rekap.map(r => ({ kunci: r.statusGizi ?? "-", label: r.statusGizi ?? "Data tidak lengkap", nilai: r._count._all }))} satuan="pemeriksaan" /></div>
          )}
          {!classId ? <EmptyState icon={Ruler} title="Pilih kelas" description="Isian pemeriksaan tampil per kelas." />
            : !siswa ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            : (
              <div className="panel overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Siswa</th><th>TB (cm)</th><th>BB (kg)</th><th>IMT / gizi</th><th className="hidden lg:table-cell">Tensi</th><th className="hidden lg:table-cell">Penglihatan</th><th className="hidden md:table-cell">Terakhir</th></tr></thead>
                  <tbody>{siswa.map(s => {
                    const x = isian[s.id] ?? kosong;
                    const g = gizi(x.tinggiCm, x.beratKg);
                    return (
                      <tr key={s.id}>
                        <td className="min-w-[10rem]"><p className="font-semibold text-primary-900">{s.nama}</p><p className="text-xs text-gray-500">{s.jk ?? ""} · {s.nis}</p></td>
                        <td><input type="number" inputMode="decimal" aria-label={`Tinggi ${s.nama}`} className="input-field w-20" value={x.tinggiCm} onChange={e => set(s.id, "tinggiCm", e.target.value)} /></td>
                        <td><input type="number" inputMode="decimal" aria-label={`Berat ${s.nama}`} className="input-field w-20" value={x.beratKg} onChange={e => set(s.id, "beratKg", e.target.value)} /></td>
                        <td className="whitespace-nowrap text-sm">{g ? <><span className="angka">{g.imt}</span> <span className={`font-semibold ${WARNA[g.status]}`}>{g.status}</span></> : "—"}</td>
                        <td className="hidden lg:table-cell"><input aria-label={`Tensi ${s.nama}`} className="input-field w-24" placeholder="110/70" value={x.tensi} onChange={e => set(s.id, "tensi", e.target.value)} /></td>
                        <td className="hidden lg:table-cell"><input aria-label={`Penglihatan ${s.nama}`} className="input-field w-28" placeholder="normal" value={x.penglihatan} onChange={e => set(s.id, "penglihatan", e.target.value)} /></td>
                        <td className="hidden md:table-cell text-xs text-gray-600 whitespace-nowrap">{s.terakhir ? <>{new Date(s.terakhir.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} · {s.terakhir.tinggiCm ?? "-"} cm / {s.terakhir.beratKg ?? "-"} kg{s.terakhir.statusGizi ? <span className={`block font-semibold ${WARNA[s.terakhir.statusGizi] ?? ""}`}>{s.terakhir.statusGizi}</span> : null}</> : "—"}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                <p className="px-4 py-3 text-xs text-gray-500">Status gizi adalah perkiraan dari IMT (ambang Kemenkes untuk dewasa); untuk remaja, konfirmasikan dengan grafik IMT/U bila perlu rujukan.</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
