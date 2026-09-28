"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ListChecks, Loader2, Printer, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Alert from "@/components/admin/Alert";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { labelTipe } from "@/lib/soal";
import { LEVEL_KOGNITIF, kisiLengkap } from "@/lib/kisi-kisi";
import TombolKembali from "@/components/shared/TombolKembali";

export interface ButirKisiForm {
  id: string; nomor: number; tipe: string; skor: number; cuplikan: string;
  kd: string; materi: string; indikator: string; levelKognitif: string;
}

const OPSI_LEVEL = [{ value: "", label: "— belum diisi —" }, ...LEVEL_KOGNITIF];

/** Editor KISI-KISI satu ujian: KD, materi, indikator soal, level kognitif per butir. Disimpan lewat
 * /api/teacher/exams/[id]/kisi-kisi (hanya kolom kisi-kisi), jadi tetap bisa dilengkapi setelah ujian dikerjakan. */
export default function KisiKisiEditor({ examId, judul, mapel, kelas, bolehUbah, butir: awal }: {
  examId: string; judul: string; mapel: string; kelas: string[]; bolehUbah: boolean; butir: ButirKisiForm[];
}) {
  const toast = useToast();
  const [butir, setButir] = useState(awal);
  const [berubah, setBerubah] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const lengkap = useMemo(() => butir.filter(kisiLengkap).length, [butir]);

  function ubah(i: number, patch: Partial<ButirKisiForm>) {
    setButir(bs => bs.map((b, k) => (k === i ? { ...b, ...patch } : b)));
    setBerubah(true);
  }

  function salinDariAtas(i: number) {
    if (i === 0) return;
    const a = butir[i - 1];
    ubah(i, { kd: a.kd, materi: a.materi, indikator: a.indikator, levelKognitif: a.levelKognitif });
  }

  async function simpan() {
    setMenyimpan(true);
    const r = await fetch(`/api/teacher/exams/${examId}/kisi-kisi`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ butir: butir.map(({ id, kd, materi, indikator, levelKognitif }) => ({ id, kd, materi, indikator, levelKognitif })) }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpan(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal menyimpan kisi-kisi.");
    setBerubah(false);
    toast.success(`Kisi-kisi tersimpan · ${d.lengkap} dari ${d.total} butir lengkap.`);
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ListChecks size={22} />} title="Kisi-kisi Soal"
        description={`${judul} · ${mapel}${kelas.length ? ` · ${kelas.join(", ")}` : ""}`} />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TombolKembali href={"/pusat-ujian/administrasi"} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {berubah ? (
            <span className="text-xs font-semibold text-amber-700">Belum disimpan — simpan dulu sebelum mencetak</span>
          ) : (
            <Link href={`/pusat-ujian/${examId}/kisi-kisi/cetak`} className="btn-modal-cancel">
              <Printer size={16} /> Cetak Kisi-kisi
            </Link>
          )}
          {bolehUbah && (
            <button type="button" onClick={simpan} disabled={menyimpan || !berubah} className="btn-modal-save">
              {menyimpan ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
            </button>
          )}
        </div>
      </div>

      {butir.length === 0 ? (
        <EmptyState icon={ListChecks} title="Ujian ini belum punya soal" description="Susun soal lebih dulu, lalu kembali ke sini untuk mengisi kisi-kisi." />
      ) : (
        <div className="space-y-5">
          <Alert variant={lengkap === butir.length ? "success" : "info"} title={`${lengkap} dari ${butir.length} butir sudah lengkap`}>
            {bolehUbah
              ? "Isi KD, materi, indikator soal, dan level kognitif tiap butir. Tombol \u201cSalin atas\u201d menyalin isian dari butir di atasnya. Butir berurutan yang isinya sama digabung menjadi satu baris saat dicetak. Kolom ini tidak memengaruhi penilaian, jadi tetap bisa dilengkapi walau ujian sudah dikerjakan."
              : "Kisi-kisi hanya bisa diubah guru pembuat ujian atau Administrator/Wakil Kepala Kurikulum. Anda tetap bisa mencetaknya."}
          </Alert>

          <div className="page-card overflow-hidden">
            <div className="overflow-x-auto scrollbar-visible">
              <table className="data-table min-w-[1000px]">
                <thead>
                  <tr>
                    <th className="w-10 text-center">No</th><th className="w-[22%]">Soal</th><th className="w-24">KD</th>
                    <th className="w-[16%]">Materi</th><th>Indikator Soal</th><th className="w-52">Level Kognitif</th>
                    {bolehUbah && <th className="w-28 text-center">Isian</th>}
                  </tr>
                </thead>
                <tbody>
                  {butir.map((b, i) => (
                    <tr key={b.id} className={kisiLengkap(b) ? "" : "bg-amber-50/40"}>
                      <td className="text-center font-bold align-top">{b.nomor}</td>
                      <td className="align-top">
                        <p className="text-xs font-semibold text-primary-700">{labelTipe(b.tipe)} · {b.skor} poin</p>
                        <p className="text-xs text-gray-500 line-clamp-3">{b.cuplikan || "—"}</p>
                      </td>
                      {bolehUbah ? (
                        <>
                          <td className="align-top">
                            <input aria-label={`KD soal ${b.nomor}`} value={b.kd} onChange={e => ubah(i, { kd: e.target.value })} placeholder="3.1" className="input-field w-full py-1.5 text-xs" />
                          </td>
                          <td className="align-top">
                            <input aria-label={`Materi soal ${b.nomor}`} value={b.materi} onChange={e => ubah(i, { materi: e.target.value })} placeholder="Materi pokok" className="input-field w-full py-1.5 text-xs" />
                          </td>
                          <td className="align-top">
                            <textarea aria-label={`Indikator soal ${b.nomor}`} value={b.indikator} onChange={e => ubah(i, { indikator: e.target.value })} rows={2}
                              placeholder="Siswa dapat …" className="input-field w-full py-1.5 text-xs resize-y" />
                          </td>
                          <td className="align-top">
                            <Select value={b.levelKognitif} onChange={v => ubah(i, { levelKognitif: v })} options={OPSI_LEVEL} />
                          </td>
                          <td className="align-top text-center">
                            {/* Ikon panah-ke-garis dulu terbaca sebagai tombol UNDUH (temuan user
                                20 September 2026: "saya tidak paham fungsi tombol seperti icon
                                download"). Diganti ikon salin + teks, karena aksinya bukan aksi
                                umum yang bisa ditebak dari ikon saja. */}
                            {i > 0 && (
                              <button type="button" title="Salin KD, materi, indikator & level dari butir di atasnya"
                                aria-label="Salin isian dari butir di atasnya" onClick={() => salinDariAtas(i)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50">
                                <Copy size={13} /> <span className="hidden sm:inline">Salin atas</span>
                              </button>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="align-top text-xs">{b.kd || "—"}</td>
                          <td className="align-top text-xs">{b.materi || "—"}</td>
                          <td className="align-top text-xs">{b.indikator || "—"}</td>
                          <td className="align-top text-xs">{LEVEL_KOGNITIF.find(l => l.value === b.levelKognitif)?.label ?? "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
