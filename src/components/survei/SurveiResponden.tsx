"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardPen, EyeOff, Loader2, Send } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

interface Ringkas { id: string; judul: string; deskripsi: string | null; jenis: string; anonim: boolean; selesai: string | null; pembuatNama: string; jumlahPertanyaan: number; sudahDiisi: boolean }
interface Pertanyaan { id: string; teks: string; tipe: string; opsi: string[]; kelompok: string | null; wajib: boolean; maksPilih: number }
interface Isi { survei: Ringkas; pertanyaan: Pertanyaan[]; teman: { id: string; nama: string }[]; sudahDiisi: boolean }
type Nilai = string | string[] | number;

/** PENGISIAN SURVEI (semua peran, 17 Sep 2026). Jawaban survei anonim tidak dikaitkan ke akun. */
export default function SurveiResponden({ kelolaHref }: { kelolaHref?: string }) {
  const toast = useToast();
  const [daftar, setDaftar] = useState<Ringkas[] | null>(null);
  const [isi, setIsi] = useState<Isi | null>(null);
  const [jawab, setJawab] = useState<Record<string, Nilai>>({});
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/survei", { cache: "no-store" }).then(r => r.json()).then(d => setDaftar(d.daftar ?? [])).catch(() => setDaftar([]));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function buka(id: string) {
    const r = await fetch(`/api/survei/${id}`, { cache: "no-store" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Survei tidak tersedia."); muat(); return; }
    setJawab({}); setIsi(d);
  }
  async function kirim() {
    if (!isi) return;
    const kosong = isi.pertanyaan.find(p => p.wajib && !(p.tipe === "TEMAN" && isi.teman.length === 0) && (jawab[p.id] === undefined || (Array.isArray(jawab[p.id]) && !(jawab[p.id] as string[]).length) || jawab[p.id] === ""));
    if (kosong) { toast.error(`Pertanyaan nomor ${isi.pertanyaan.indexOf(kosong) + 1} belum dijawab.`); document.getElementById(`tanya-${kosong.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setSibuk(true);
    const r = await fetch(`/api/survei/${isi.survei.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jawaban: jawab }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal mengirim."); return; }
    toast.success("Terima kasih, jawaban terkirim.");
    setIsi(null); muat();
  }
  const set = (id: string, v: Nilai) => setJawab(p => ({ ...p, [id]: v }));
  const toggle = (id: string, v: string, maks = 99) => setJawab(p => {
    const a = (p[id] as string[] | undefined) ?? [];
    return { ...p, [id]: a.includes(v) ? a.filter(x => x !== v) : a.length >= maks ? a : [...a, v] };
  });

  const belum = (daftar ?? []).filter(d => !d.sudahDiisi);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardPen size={22} />} title="Survei & Angket" description={daftar ? (belum.length ? `${belum.length} survei menunggu diisi` : "Semua survei sudah diisi") : "Survei dari sekolah untuk Anda"} />
      {kelolaHref && <div className="alat-aksi justify-end mb-5"><Link href={kelolaHref} className="btn-modal-cancel"><ClipboardPen /> Buat & Kelola Survei</Link></div>}
      {!daftar ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : daftar.length === 0 ? <EmptyState icon={ClipboardPen} title="Tidak ada survei" description="Survei yang ditujukan kepada Anda akan tampil di sini." />
        : (
          <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
            {daftar.map(d => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary-900">{d.judul}</p>
                  <p className="text-xs text-gray-500">{d.jumlahPertanyaan} pertanyaan · {d.pembuatNama}{d.selesai ? ` · sampai ${new Date(d.selesai).toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}` : ""}{d.anonim ? " · tanpa nama" : ""}</p>
                </div>
                {d.sudahDiisi
                  ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={13} className="mr-1 inline" />Sudah diisi</span>
                  : <button type="button" onClick={() => buka(d.id)} className="btn-modal-save btn-teks px-3 text-xs"><ClipboardPen /> Isi Sekarang</button>}
              </li>
            ))}
          </ul></div>
        )}

      <Modal open={!!isi} onClose={() => !sibuk && setIsi(null)} title={isi?.survei.judul ?? ""} description={isi?.survei.anonim ? "Jawaban tidak dikaitkan dengan nama Anda" : undefined} size="xl" scrollBody
        footer={<><button type="button" onClick={() => setIsi(null)} disabled={sibuk} className="btn-modal-cancel">Nanti</button><button type="button" onClick={kirim} disabled={sibuk || !isi || isi.sudahDiisi} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim Jawaban</button></>}>
        {isi && (
          <div className="space-y-5">
            {isi.survei.deskripsi && <p className="whitespace-pre-line text-sm text-gray-600">{isi.survei.deskripsi}</p>}
            {isi.survei.anonim && <p className="flex items-center gap-1.5 text-xs text-gray-500"><EyeOff size={13} /> Survei tanpa nama.</p>}
            {isi.survei.jenis === "AKPD" && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">Jawab jujur sesuai keadaanmu. Jawaban hanya dibaca Guru BK untuk membantumu.</p>}
            {isi.survei.jenis === "SOSIOMETRI" && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">Pilih teman sekelas sesuai pertanyaan. Pilihanmu rahasia — hanya dibaca Guru BK dan wali kelas.</p>}
            {isi.pertanyaan.map((p, i) => (
              <fieldset key={p.id} id={`tanya-${p.id}`} className="scroll-mt-24 rounded-xl border border-gray-100 p-4">
                <legend className="px-1 text-sm font-semibold text-primary-900">{i + 1}. {p.teks}{p.wajib && <span className="text-red-500"> *</span>}</legend>
                {p.tipe === "PILIHAN" && (
                  <div className={`mt-2 ${p.opsi.length <= 2 ? "flex gap-2" : "space-y-1.5"}`}>
                    {p.opsi.map(o => (
                      <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${jawab[p.id] === o ? "border-primary-700 bg-primary-50 text-primary-900" : "border-gray-200 text-gray-700"}`}>
                        <input type="radio" name={p.id} checked={jawab[p.id] === o} onChange={() => set(p.id, o)} className="h-4 w-4" />{o}
                      </label>
                    ))}
                  </div>
                )}
                {p.tipe === "CENTANG" && (
                  <div className="mt-2 space-y-1.5">
                    {p.opsi.map(o => (
                      <label key={o} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={((jawab[p.id] as string[]) ?? []).includes(o)} onChange={() => toggle(p.id, o)} className="h-4 w-4 rounded border-gray-300" />{o}
                      </label>
                    ))}
                  </div>
                )}
                {p.tipe === "SKALA" && (
                  <div className="mt-2">
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${p.opsi.length || 5}, minmax(0, 1fr))` }}>
                      {Array.from({ length: p.opsi.length || 5 }, (_, n) => n + 1).map(n => (
                        <button key={n} type="button" aria-pressed={jawab[p.id] === n} onClick={() => set(p.id, n)}
                          className={`rounded-lg border py-2 text-sm font-semibold ${jawab[p.id] === n ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{n}</button>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-xs text-gray-500"><span>{p.opsi[0] ?? "Sangat kurang"}</span><span className="text-right">{p.opsi[p.opsi.length - 1] ?? "Sangat baik"}</span></div>
                  </div>
                )}
                {p.tipe === "TEKS" && (
                  <textarea aria-label={p.teks} rows={3} maxLength={1000} className="input-field mt-2" value={(jawab[p.id] as string) ?? ""} onChange={e => set(p.id, e.target.value)} />
                )}
                {p.tipe === "TEMAN" && (
                  isi.teman.length === 0 ? <p className="mt-2 text-xs text-gray-500">Pertanyaan ini khusus siswa dalam kelas — lewati.</p> : (
                    <div className="mt-2">
                      <p className="mb-2 text-xs text-gray-500">Pilih maksimal {p.maksPilih} teman ({((jawab[p.id] as string[]) ?? []).length} dipilih)</p>
                      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                        {isi.teman.map(t => {
                          const on = ((jawab[p.id] as string[]) ?? []).includes(t.id);
                          return <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(p.id, t.id, p.maksPilih)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{t.nama}</button>;
                        })}
                      </div>
                    </div>
                  )
                )}
              </fieldset>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
