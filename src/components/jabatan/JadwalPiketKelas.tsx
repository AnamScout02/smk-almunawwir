"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Printer, Save, Shuffle, SprayCan } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Siswa { id: string; nis: string; nama: string; hari: string }
const LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

/** JADWAL PIKET KELAS (17 Sep 2026) — wali kelas membagi siswa ke hari piket; siswa melihat gilirannya di dashboard. */
/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function JadwalPiketKelas() {
  const toast = useToast();
  const [kelas, setKelas] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [hari, setHari] = useState<string[]>([]);
  const [siswa, setSiswa] = useState<Siswa[] | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback((id?: string) => {
    setSiswa(null);
    fetch(`/api/teacher/piket-kelas${id ? `?classId=${id}` : ""}`, { cache: "no-store" }).then(r => r.json()).then(d => {
      setKelas(d.kelas ?? []); setClassId(d.classId ?? ""); setHari(d.hari ?? []); setSiswa(d.siswa ?? []);
    }).catch(() => setSiswa([]));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  function bagiRata() {
    if (!siswa) return;
    setSiswa(siswa.map((s, i) => ({ ...s, hari: hari[i % hari.length] })));
  }

  async function simpan() {
    if (!siswa) return;
    setMenyimpan(true);
    const r = await fetch("/api/teacher/piket-kelas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, jadwal: Object.fromEntries(siswa.map(s => [s.id, s.hari])) }),
    }).catch(() => null);
    setMenyimpan(false);
    if (!r?.ok) { toast.error("Jadwal piket gagal disimpan."); return; }
    toast.success("Jadwal piket kelas tersimpan.");
  }

  const namaKelas = kelas.find(k => k.id === classId)?.name ?? "";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<SprayCan size={22} />} title="Jadwal Piket Kelas" description="Bagi siswa ke hari piket — siswa melihat gilirannya di dashboard" printHidden />
      {kelas.length === 0 && siswa ? (
        <EmptyState icon={SprayCan} title="Bukan wali kelas" description="Halaman ini untuk wali kelas." />
      ) : (
        <>
          <div className="baris-alat mb-5 print:hidden">
            {kelas.length > 1 && <div className="alat-saring"><Select value={classId} onChange={id => muat(id)} options={kelas.map(k => ({ value: k.id, label: k.name }))} /></div>}
            <div className="alat-aksi">
              <button type="button" onClick={bagiRata} disabled={!siswa?.length} className="btn-modal-cancel btn-teks"><Shuffle size={15} /> Bagi Rata Otomatis</button>
              <button type="button" onClick={() => window.print()} className="btn-modal-cancel"><Printer size={15} /> Cetak</button>
              <button type="button" onClick={simpan} disabled={menyimpan || !siswa} className="btn-modal-save">
                {menyimpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
              </button>
            </div>
          </div>
          {!siswa ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
            <>
              <div className="print-doc bg-white grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-3 print:p-6">
                <h2 className="col-span-full hidden text-center font-bold print:block">Jadwal Piket Kelas {namaKelas}</h2>
                {hari.map(h => (
                  <div key={h} className="panel p-3 print:rounded-none print:border print:border-gray-400 print:shadow-none">
                    <p className="font-heading font-bold text-primary-900">{LABEL[h]} <span className="text-xs font-normal text-gray-500">({siswa.filter(s => s.hari === h).length})</span></p>
                    <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-gray-700">
                      {siswa.filter(s => s.hari === h).map(s => <li key={s.id}>{s.nama}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
              <div className="panel mt-6 overflow-hidden print:hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th className="w-10">#</th><th>Nama siswa</th><th className="w-48">Hari piket</th></tr></thead>
                    <tbody>
                      {siswa.map((s, i) => (
                        <tr key={s.id}>
                          <td className="text-xs text-gray-400">{i + 1}</td>
                          <td className="font-medium text-primary-900">{s.nama}</td>
                          <td><Select value={s.hari} placeholder="Belum dijadwalkan" options={hari.map(h => ({ value: h, label: LABEL[h] }))}
                            onChange={v => setSiswa(list => list?.map(x => (x.id === s.id ? { ...x, hari: v } : x)) ?? null)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
