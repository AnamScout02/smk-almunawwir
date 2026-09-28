"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, CalendarClock, Loader2, Printer, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface Anggota { memberId: string; studentId: string; nama: string; nis: string; kelas: string; peran: string | null; bersertifikat: boolean; predikat: string; keterangan: string }
interface Data { ekskul: { id: string; name: string }[]; ekskulId: string; semester: string; semesterPilihan: string[]; predikat: Record<string, string>; anggota: Anggota[] }

/** NILAI EKSTRAKURIKULER (pembina/koordinator, 17 Sep 2026) — predikat per semester, otomatis tampil di rapor siswa. */
export default function NilaiEkstraManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [isian, setIsian] = useState<Record<string, { predikat: string; keterangan: string }>>({});
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback((ekskulId?: string, semester?: string) => {
    const q = new URLSearchParams();
    if (ekskulId) q.set("ekskulId", ekskulId);
    if (semester) q.set("semester", semester);
    fetch(`/api/teacher/ekstrakurikuler-nilai?${q}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) { setGalat(x?.error ?? "Gagal memuat."); return; }
      setD(x);
      setIsian(Object.fromEntries(x.anggota.map((a: Anggota) => [a.studentId, { predikat: a.predikat, keterangan: a.keterangan }])));
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  async function simpan() {
    if (!d) return;
    setSibuk(true);
    const baris = Object.entries(isian).filter(([, v]) => v.predikat).map(([studentId, v]) => ({ studentId, ...v }));
    const r = await fetch("/api/teacher/ekstrakurikuler-nilai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ekskulId: d.ekskulId, semester: d.semester, baris }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success(`${x.jumlah} nilai tersimpan — tampil di rapor siswa.`);
    muat(d.ekskulId, d.semester);
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Award size={22} />} title="Nilai Ekstrakurikuler" description="Predikat per semester untuk anggota — ikut tercetak di rapor siswa" />
      {galat ? <EmptyState icon={Award} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-saring"><Select value={d.ekskulId} onChange={v => muat(v, d.semester)} options={d.ekskul.map(e => ({ value: e.id, label: e.name }))} /></div>
            <div className="alat-saring"><Select value={d.semester} onChange={v => muat(d.ekskulId, v)} options={d.semesterPilihan.map(s => ({ value: s, label: s }))} /></div>
            <div className="alat-aksi">
              <Link href="/dashboard/teacher/ekstrakurikuler/agenda" className="btn-modal-cancel btn-teks"><CalendarClock /> Jadwal & Lomba</Link>
              <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan Nilai</button>
            </div>
          </div>
          {d.anggota.length === 0 ? <EmptyState icon={Award} title="Belum ada anggota" description="Tambahkan anggota di menu Ekstrakurikuler." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">#</th><th>Anggota</th><th>Predikat</th><th>Keterangan</th><th className="text-right">Sertifikat</th></tr></thead>
                <tbody>{d.anggota.map((a, i) => (
                  <tr key={a.memberId}>
                    <td className="angka text-gray-500">{i + 1}</td>
                    <td className="min-w-[10rem]"><p className="font-semibold text-primary-900">{a.nama}</p><p className="text-xs text-gray-500">{a.kelas}{a.peran ? ` · ${a.peran}` : ""}</p></td>
                    <td className="min-w-[10rem]"><Select value={isian[a.studentId]?.predikat ?? ""} onChange={v => setIsian(p => ({ ...p, [a.studentId]: { ...p[a.studentId], predikat: v } }))} placeholder="Belum dinilai"
                      options={[{ value: "", label: "Belum dinilai" }, ...Object.entries(d.predikat).map(([value, label]) => ({ value, label: `${value} — ${label}` }))]} /></td>
                    <td><input aria-label={`Keterangan ${a.nama}`} className="input-field min-w-[12rem]" maxLength={300} value={isian[a.studentId]?.keterangan ?? ""} onChange={e => setIsian(p => ({ ...p, [a.studentId]: { ...p[a.studentId], keterangan: e.target.value } }))} placeholder="mis. aktif, juara 2 lomba …" /></td>
                    <td className="text-right"><Link href={`/dashboard/teacher/ekstrakurikuler/sertifikat/${a.memberId}`} className="btn-modal-cancel px-2.5 text-xs"><Printer /> {a.bersertifikat ? "Cetak" : "Terbitkan"}</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
