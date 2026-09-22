"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ClipboardPen, Loader2, Search } from "lucide-react";
import StatusForm from "@/components/rapor/StatusForm";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import FormNilaiRaporEditor from "@/components/rapor/FormNilaiRaporEditor";

interface Baris {
  classId: string; kelas: string; grade: number; jumlahSiswa: number; mapel: string; kelompok: string; guru: string;
  milikSaya: boolean; waliSaya: boolean; status: string; dikirimAt: string | null; diubahAt: string | null; dikembalikan: boolean; katrol: boolean; diubahWali?: boolean;
}

const tgl = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** FORM NILAI RAPOR (22 September 2026) — padanan digital lembar penilaian yang disebar wali kelas ke guru mapel (makro rapor
 * sekolah). Daftar kelas × mapel yang diampu + status; membuka satu form menampilkan lembar isian (FormNilaiRaporEditor).
 * Dipakai portal guru & admin (`basePath`). */
export default function FormNilaiRaporManager({ basePath }: { basePath: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const buka = sp.get("classId") && sp.get("subject") && sp.get("semester")
    ? { classId: sp.get("classId")!, subject: sp.get("subject")!, semester: sp.get("semester")! } : null;
  const [data, setData] = useState<{ semester: string; semesters: string[]; baris: Baris[] } | null>(null);
  const [semester, setSemester] = useState(sp.get("semester") ?? "");
  const [cari, setCari] = useState("");
  // Akordeon per kelas (permintaan user 22 Sep 2026): satu kelas terbuka; kelas terakhir dibuka diingat lewat ?kelas= saat kembali dari lembar isian.
  const [kelasTerbuka, setKelasTerbuka] = useState<string | null>(sp.get("kelas"));
  const [muat, setMuat] = useState(true);

  const ambil = useCallback((sem: string) => {
    setMuat(true);
    fetch(`/api/rapor/form${sem ? `?semester=${encodeURIComponent(sem)}` : ""}`, { cache: "no-store" })
      .then(r => r.json()).then(d => { if (!d.error) { setData(d); setSemester(d.semester); } })
      .catch(() => {}).finally(() => setMuat(false));
  }, []);
  useEffect(() => { if (!buka) queueMicrotask(() => ambil(semester)); }, [buka?.classId, buka?.subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const grup = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const peta = new Map<string, Baris[]>();
    for (const b of data?.baris ?? []) {
      if (q && ![b.kelas, b.mapel, b.guru].some(x => x.toLowerCase().includes(q))) continue;
      const k = b.classId;
      peta.set(k, [...(peta.get(k) ?? []), b]);
    }
    return [...peta.values()];
  }, [data, cari]);

  if (buka) {
    return <FormNilaiRaporEditor {...buka} kembali={() => router.push(`${basePath}?${new URLSearchParams({ semester: buka.semester, kelas: buka.classId }).toString()}`)} basePath={basePath} />;
  }

  const bukaForm = (b: Baris) => router.push(`${basePath}?classId=${b.classId}&subject=${encodeURIComponent(b.mapel)}&semester=${encodeURIComponent(semester)}`);
  const ringkas = (xs: Baris[]) => `${xs.filter(x => x.status === "DIKIRIM").length}/${xs.length} mapel terkirim`;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardPen size={22} />} title="Form Nilai Rapor"
        description="Lembar penilaian guru mapel untuk rapor — TP, Lingkup Materi, STS & SAS; setelah dikirim, rapor wali kelas terisi otomatis" />

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari kelas, mapel, atau guru..." className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <Select value={semester} onChange={v => { setSemester(v); ambil(v); }} options={(data?.semesters ?? []).map(s => ({ value: s, label: s }))} placeholder="Semester" />
        </div>
      </div>

      {muat && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : !grup.length ? (
        <EmptyState icon={ClipboardPen} title="Belum ada kelas & mapel" description="Form muncul untuk mapel yang tercatat di Penugasan Mengajar Anda." />
      ) : (
        <div className={`space-y-5 ${muat ? "opacity-60" : ""}`}>
          {grup.map(xs => (
            <GroupedSection key={xs[0].classId} title={xs[0].kelas} subtitle={`${xs[0].jumlahSiswa} siswa · ${ringkas(xs)}${xs[0].waliSaya ? " · kelas wali Anda" : ""}`} count={xs.length} icon={ClipboardPen}
              terbuka={grup.length === 1 || !!cari.trim() || kelasTerbuka === xs[0].classId}
              onBukaTutup={() => setKelasTerbuka(k => (k === xs[0].classId ? null : xs[0].classId))}>
              <div className="divide-y divide-gray-50">
                {xs.map(b => (
                  <button key={b.mapel} type="button" onClick={() => bukaForm(b)}
                    className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-5 py-3 text-left hover:bg-gray-50 transition">
                    <span className="min-w-0 flex-1 basis-full sm:basis-0">
                      <span className="block font-semibold text-primary-900 text-sm">{b.mapel}</span>
                      <span className="block text-xs text-gray-500">{b.guru}{b.kelompok === "DINIYAH" ? " · Diniyah" : b.kelompok === "KEJURUAN" ? " · Kejuruan" : " · Umum"}{b.katrol ? " · dikatrol" : ""}{b.diubahAt ? ` · diubah ${tgl(b.diubahAt)}` : ""}{b.diubahWali ? " · dibetulkan wali kelas" : ""}</span>
                    </span>
                    <StatusForm status={b.status} dikembalikan={b.dikembalikan} />
                    <span className="ml-auto text-xs font-semibold text-primary-700 inline-flex items-center gap-0.5">{b.milikSaya && b.status !== "DIKIRIM" ? "Isi" : !b.milikSaya && b.waliSaya && b.status === "DIKIRIM" ? "Periksa" : "Lihat"} <ChevronRight size={14} /></span>
                  </button>
                ))}
              </div>
            </GroupedSection>
          ))}
        </div>
      )}
    </div>
  );
}
