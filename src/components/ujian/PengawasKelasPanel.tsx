"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save, Search, UserCheck } from "lucide-react";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import PrintButton from "@/components/shared/PrintButton";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

export interface BarisKelas {
  examId: string; judul: string; mapel: string; terbit: boolean; classId: string; kelas: string;
  mulai: string; selesai: string; jamKhusus: boolean;
  otomatis: { id: string; nama: string } | null; pengganti: { id: string; nama: string } | null;
}
type Isian = { tanggal: string; mulai: string; selesai: string; teacherId: string };

const kunci = (b: { examId: string; classId: string }) => `${b.examId}|${b.classId}`;
/** ISO → tanggal & jam WIB (server & basis data UTC). */
const wib = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString();
const keIso = (tanggal: string, jam: string) => new Date(`${tanggal}T${jam}:00+07:00`).toISOString();
const labelTanggal = (t: string) => new Date(`${t}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** JADWAL & PENGAWAS KEGIATAN PER KELAS (21 September 2026) — satu baris satu ujian × kelas. Pengawas bawaan guru
 * pengampu mapel itu di kelas itu; jam per kelas bisa diatur di sini (disimpan ke jam per kelas ujiannya). */
export default function PengawasKelasPanel({ kegiatanId, baris, guru, onTersimpan }: {
  kegiatanId: string; baris: BarisKelas[]; guru: { id: string; nama: string }[]; onTersimpan: () => void;
}) {
  const toast = useToast();
  const awal = useMemo(() => Object.fromEntries(baris.map(b => [kunci(b), {
    tanggal: wib(b.mulai).slice(0, 10), mulai: wib(b.mulai).slice(11, 16), selesai: wib(b.selesai).slice(11, 16), teacherId: b.pengganti?.id ?? "",
  }])) as Record<string, Isian>, [baris]);
  const [isi, setIsi] = useState<Record<string, Isian>>(awal);
  useEffect(() => { queueMicrotask(() => setIsi(awal)); }, [awal]);
  const [cari, setCari] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const ubah = (k: string, patch: Partial<Isian>) => setIsi(p => ({ ...p, [k]: { ...p[k], ...patch } }));
  const namaGuru = useMemo(() => new Map(guru.map(g => [g.id, g.nama])), [guru]);
  const pengawasDari = (b: BarisKelas) => { const t = isi[kunci(b)]?.teacherId; return t ? { id: t, nama: namaGuru.get(t) ?? "—" } : b.otomatis; };

  // Bentrok dihitung dari isian yang SEDANG diubah — langsung terlihat sebelum disimpan.
  const bentrok = useMemo(() => {
    const hasil = new Set<string>();
    const perGuru = new Map<string, { k: string; a: string; z: string }[]>();
    for (const b of baris) {
      const x = isi[kunci(b)]; const p = pengawasDari(b);
      if (!x || !p) continue;
      perGuru.set(p.id, [...(perGuru.get(p.id) ?? []), { k: kunci(b), a: `${x.tanggal}T${x.mulai}`, z: `${x.tanggal}T${x.selesai}` }]);
    }
    for (const d of perGuru.values()) for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) {
      if (d[i].a < d[j].z && d[j].a < d[i].z) { hasil.add(d[i].k); hasil.add(d[j].k); }
    }
    return hasil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baris, isi, namaGuru]);

  const beban = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of baris) { const p = pengawasDari(b); if (p) m.set(p.id, (m.get(p.id) ?? 0) + 1); }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baris, isi, namaGuru]);

  const daftarTanggal = useMemo(() => [...new Set(Object.values(isi).map(x => x.tanggal))].sort(), [isi]);
  const q = cari.trim().toLowerCase();
  const tampil = baris
    .filter(b => !tanggal || isi[kunci(b)]?.tanggal === tanggal)
    .filter(b => !q || `${b.kelas} ${b.mapel} ${b.judul} ${pengawasDari(b)?.nama ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const x = isi[kunci(a)], y = isi[kunci(b)];
      return `${x?.tanggal}${x?.mulai}`.localeCompare(`${y?.tanggal}${y?.mulai}`) || a.kelas.localeCompare(b.kelas, "id", { numeric: true });
    });
  const perTanggal = new Map<string, BarisKelas[]>();
  for (const b of tampil) { const t = isi[kunci(b)]?.tanggal ?? ""; perTanggal.set(t, [...(perTanggal.get(t) ?? []), b]); }

  async function simpan(kabari: boolean) {
    for (const b of baris) {
      const x = isi[kunci(b)];
      if (!x?.tanggal || !x.mulai || !x.selesai) return toast.error(`Jam ${b.kelas} — ${b.mapel} belum lengkap.`);
      if (x.mulai >= x.selesai) return toast.error(`Jam mulai ${b.kelas} — ${b.mapel} harus sebelum jam selesai.`);
    }
    setSibuk(true);
    const perKelas = baris.map(b => {
      const x = isi[kunci(b)];
      return { examId: b.examId, classId: b.classId, teacherId: x.teacherId, mulai: keIso(x.tanggal, x.mulai), selesai: keIso(x.tanggal, x.selesai) };
    });
    const r = await fetch("/api/ujian/pengawas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kegiatanId, perKelas, kabari }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal menyimpan.");
    toast.success(kabari ? "Tersimpan & pengawas diberi tahu." : `Tersimpan${d?.jamDiubah ? ` — jam ${d.jamDiubah} ujian diperbarui` : ""}.`);
    onTersimpan();
  }

  if (!baris.length) {
    return <EmptyState icon={UserCheck} title="Belum ada ujian di kegiatan ini"
      description="Jadwal pengawas per kelas tersusun sendiri dari ujian yang memilih kegiatan ini — tiap kelas peserta menjadi satu baris." />;
  }
  return (
    <>
      <div className="baris-alat mb-5 print:hidden">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari kelas, mapel, atau guru..." className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <Select value={tanggal} onChange={setTanggal} placeholder="Semua tanggal"
            options={[{ value: "", label: "Semua tanggal" }, ...daftarTanggal.map(t => ({ value: t, label: labelTanggal(t) }))]} />
        </div>
        <div className="alat-aksi">
          <PrintButton />
          <button type="button" disabled={sibuk} onClick={() => simpan(false)} className="btn-modal-cancel">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
          <button type="button" disabled={sibuk} onClick={() => simpan(true)} className="btn-modal-save btn-teks"><UserCheck /> Simpan & Kabari</button>
        </div>
      </div>

      {bentrok.size > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2 print:hidden">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{bentrok.size} jadwal bentrok — guru yang sama mengawas dua kelas pada jam yang bertumpuk. Geser jamnya atau pilih pengawas pengganti.</span>
        </div>
      )}

      <div className="print-doc bg-white space-y-4">
        {[...perTanggal.entries()].map(([t, daftar]) => (
          <div key={t} className="panel overflow-x-auto">
            <p className="px-4 pt-3 pb-2 font-heading font-bold text-sm text-primary-900">{labelTanggal(t)}</p>
            <table className="data-table">
              <thead>
                <tr><th className="w-40">Jam</th><th>Kelas</th><th>Mata pelajaran</th><th className="min-w-[14rem]">Pengawas</th><th className="print:hidden w-36">Tanggal</th></tr>
              </thead>
              <tbody>
                {daftar.map(b => {
                  const k = kunci(b); const x = isi[k]; const p = pengawasDari(b);
                  return (
                    <tr key={k} className={bentrok.has(k) ? "bg-red-50/60" : undefined}>
                      <td className="whitespace-nowrap">
                        <span className="hidden print:inline angka">{x?.mulai} – {x?.selesai}</span>
                        <span className="flex items-center gap-1 print:hidden">
                          <TimePicker value={x?.mulai ?? ""} onChange={v => ubah(k, { mulai: v })} aria-label={`Jam mulai ${b.kelas} ${b.mapel}`} className="w-[5.5rem]" ringkas />
                          <span className="text-gray-400">–</span>
                          <TimePicker value={x?.selesai ?? ""} onChange={v => ubah(k, { selesai: v })} aria-label={`Jam selesai ${b.kelas} ${b.mapel}`} className="w-[5.5rem]" ringkas />
                        </span>
                      </td>
                      <td className="font-semibold text-gray-800 whitespace-nowrap">{b.kelas}</td>
                      <td>
                        <p className="text-gray-800">{b.mapel}</p>
                        <p className="text-xs text-gray-400">
                          {b.judul}{!b.terbit && <span className="ml-1.5 rounded-full border border-gray-200 bg-gray-50 px-1.5 text-gray-500 print:hidden">Belum terbit</span>}
                        </p>
                      </td>
                      <td>
                        <span className="hidden print:inline">{p?.nama ?? "—"}</span>
                        <div className="print:hidden">
                          <Select value={x?.teacherId ?? ""} onChange={v => ubah(k, { teacherId: v })}
                            options={[
                              { value: "", label: `Guru mapel — ${b.otomatis?.nama ?? "belum ada"}` },
                              ...guru.filter(g => g.id !== b.otomatis?.id).map(g => ({ value: g.id, label: `${g.nama}${beban.get(g.id) ? ` (${beban.get(g.id)})` : ""}` })),
                            ]} />
                          {bentrok.has(k) && <p className="mt-1 text-xs font-semibold text-red-600">Bentrok dengan jadwal lain guru ini</p>}
                          {x?.teacherId && <p className="mt-1 text-xs text-amber-700">Pengganti (guru mapel: {b.otomatis?.nama ?? "—"})</p>}
                        </div>
                      </td>
                      <td className="print:hidden"><DatePicker value={x?.tanggal ?? ""} onChange={v => v && ubah(k, { tanggal: v })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        {tampil.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada jadwal yang cocok dengan pencarian.</p>}
      </div>
      <p className="mt-3 text-xs text-gray-500 print:hidden">
        Pengawas bawaan = guru pengampu mapel itu di kelas itu (Penugasan Mengajar). Jam yang diubah di sini sama dengan jam per kelas di
        penyusun ujian — siswa hanya bisa masuk pada jam kelasnya. Angka di kurung = jumlah tugas mengawas guru itu.
      </p>
    </>
  );
}
