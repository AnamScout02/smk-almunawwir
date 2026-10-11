"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, NotebookPen, Save, Sparkles } from "lucide-react";
import { kirimAtauAntre } from "@/lib/antrean-kirim";
import { useToast } from "@/components/shared/ToastProvider";

interface Kartu {
  scheduleId: string; classId: string; kelas: string; mapel: string; mulai: string; selesai: string; jp: number; jamKe: string | null;
  urutan: number; keadaan: "LEWAT" | "BERLANGSUNG" | "NANTI"; jurnalId: string | null; materi: string | null; kehadiranKosong: number;
  saran: { teks: string; asal: "RENCANA" | "LANJUTAN" } | null; tertinggal: number | null;
}

/** JURNAL SEKALI KETUK (src/lib/jurnal-cepat.ts) — kartu jam pelajaran hari ini di dashboard guru & di atas halaman Jurnal.
 *  Materi sudah terisi dari Prota/Promes; guru menekan Simpan atau mengubahnya dulu. Kehadiran siswa TIDAK diisi sendiri:
 *  "Semua siswa hadir" harus dicentang guru, selain itu dilengkapi di halaman Jurnal. Tidak tampil bila hari ini tanpa jadwal. */
export default function JurnalCepat({ hrefJurnal = "/dashboard/teacher/journal", saatTersimpan, className = "" }: { hrefJurnal?: string; saatTersimpan?: () => void; className?: string }) {
  const toast = useToast();
  const [d, setD] = useState<{ tanggal: string; libur: string | null; kartu: Kartu[] } | null>(null);
  const [materi, setMateri] = useState<Record<string, string>>({});
  const [hadir, setHadir] = useState<Record<string, boolean>>({});
  const [kirim, setKirim] = useState("");

  const muat = useCallback(() => {
    fetch("/api/teacher/jurnal-cepat", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(x => {
      if (!x?.kartu) return;
      setD(x);
      setMateri(m => { const n = { ...m }; for (const k of x.kartu as Kartu[]) if (n[k.scheduleId] === undefined) n[k.scheduleId] = k.materi ?? k.saran?.teks ?? ""; return n; });
    }).catch(() => {});
  }, []);
  useEffect(() => { muat(); const t = setInterval(muat, 5 * 60_000); return () => clearInterval(t); }, [muat]);

  async function simpan(k: Kartu) {
    const teks = (materi[k.scheduleId] ?? "").trim();
    if (!teks) { toast.warning("Tulis dulu materi yang diajarkan."); return; }
    setKirim(k.scheduleId);
    const { antre, res } = await kirimAtauAntre({
      kunci: `jurnal-cepat|${k.scheduleId}|${d?.tanggal}`, url: "/api/teacher/jurnal-cepat", label: `Jurnal ${k.kelas} ${k.mulai}`,
      isi: { scheduleId: k.scheduleId, tanggal: d?.tanggal, materi: teks, semuaHadir: !!hadir[k.scheduleId] },
    });
    setKirim("");
    if (antre) { toast.info("Sinyal terputus — jurnal disimpan di perangkat ini dan dikirim sendiri saat tersambung."); return; }
    if (!res?.ok) { const j = await res?.json().catch(() => null); toast.error(j?.error ?? "Jurnal gagal disimpan."); return; }
    toast.success(`Jurnal ${k.kelas} tersimpan.`);
    muat(); saatTersimpan?.();
  }

  if (!d || d.libur || d.kartu.length === 0) return null;
  const belum = d.kartu.filter(k => !k.jurnalId && k.keadaan !== "NANTI").length;
  return (
    <section className={`panel ${className}`}>
      <div className="panel-kepala">
        <h2 className="panel-judul"><span className="panel-ikon"><NotebookPen size={16} /></span>Jurnal Hari Ini</h2>
        <span className={`status-badge ${belum ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{belum ? `${belum} belum diisi` : "Semua terisi"}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {d.kartu.map(k => {
          const tautan = `${hrefJurnal}?kelas=${k.classId}&mapel=${encodeURIComponent(k.mapel)}&tanggal=${d.tanggal}${k.urutan > 1 ? `&urutan=${k.urutan}` : ""}`;
          return (
            <div key={k.scheduleId} className={`p-4 sm:p-5 ${k.keadaan === "BERLANGSUNG" ? "bg-primary-50/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="min-w-0 font-semibold text-primary-900">{k.kelas} · {k.mapel}</p>
                <span className="angka text-xs text-gray-500">{k.jamKe ? `jam ke-${k.jamKe} · ` : ""}{k.mulai}–{k.selesai} · {k.jp} JP</span>
                {k.keadaan === "BERLANGSUNG" && <span className="status-badge bg-blue-50 text-blue-700 border-blue-200">Sedang berlangsung</span>}
                {k.keadaan === "NANTI" && <span className="status-badge bg-gray-50 text-gray-500 border-gray-200">Belum mulai</span>}
              </div>
              {k.jurnalId ? (
                <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                  <p className="flex min-w-0 flex-1 items-start gap-1.5 text-gray-600"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span className="min-w-0">{k.materi}</span></p>
                  <Link href={tautan} className="text-xs font-semibold text-primary-700 hover:text-primary-900">
                    {k.kehadiranKosong ? `Lengkapi kehadiran ${k.kehadiranKosong} siswa` : "Buka jurnal"}
                  </Link>
                </div>
              ) : k.keadaan === "NANTI" ? (
                k.saran && <p className="mt-2 text-sm text-gray-500">Rencana: {k.saran.teks}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor={`m-${k.scheduleId}`} className="label-field flex items-center gap-1.5">
                      Materi yang diajarkan
                      {k.saran && <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-400"><Sparkles size={12} />{k.saran.asal === "RENCANA" ? "dari Prota/Promes" : "materi pertemuan lalu"}</span>}
                    </label>
                    <textarea id={`m-${k.scheduleId}`} rows={2} maxLength={1000} className="input-field" value={materi[k.scheduleId] ?? ""}
                      onChange={e => setMateri(m => ({ ...m, [k.scheduleId]: e.target.value }))} placeholder="Tulis materi pertemuan ini" />
                    {!!k.tertinggal && <p className="mt-1 text-xs text-amber-600">Menurut Prota/Promes, kelas ini tertinggal {k.tertinggal} materi.</p>}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {k.urutan > 1 ? <p className="min-w-0 flex-1 text-sm text-gray-500">Materi ke-{k.urutan} hari ini — kehadiran mengikuti jam pertama.</p> : (
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={!!hadir[k.scheduleId]} onChange={e => setHadir(h => ({ ...h, [k.scheduleId]: e.target.checked }))} />
                        Semua siswa hadir
                      </label>
                    )}
                    <Link href={tautan} className="btn-modal-cancel">Isi lengkap</Link>
                    <button type="button" onClick={() => simpan(k)} disabled={kirim === k.scheduleId} className="btn-modal-save">
                      {kirim === k.scheduleId ? <Loader2 className="animate-spin" /> : <Save />} Simpan Jurnal
                    </button>
                  </div>
                  {!hadir[k.scheduleId] && k.urutan === 1 && <p className="text-xs text-gray-400">Tanpa centang, kehadiran & nilai siswa dibiarkan kosong untuk dilengkapi lewat &ldquo;Isi lengkap&rdquo;.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
