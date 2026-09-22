"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, FileSignature, FileText, IdCard, LayoutGrid, ListChecks, Loader2, Printer, Search, ShieldBan, UserCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Alert from "@/components/admin/Alert";

interface Kegiatan { id: string; nama: string; singkatan: string; aktif: boolean; tingkat: number[]; tahunAjaran: string | null }
interface Kelas { classId: string; className: string; grade: number }
interface Ujian {
  id: string; title: string; subject: string; startTime: string; endTime: string; isPublished: boolean;
  class: { name: string }; kelasNama?: string[]; kegiatan: { id: string; nama: string; singkatan: string } | null;
  _count: { attempts: number };
}

const tgl = (d: string) => new Date(d).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** ADMINISTRASI UJIAN — berkas yang dulu diketik ulang tiap semester (kartu peserta, daftar hadir,
 * berita acara), kini dicetak langsung dari data sistem. Di arsip Drive TU tercatat ±291 berkas
 * kartu, 196 daftar hadir, dan 83 berita acara. */
export default function AdministrasiUjianManager({ basePath }: { basePath: string }) {
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [ujian, setUjian] = useState<Ujian[]>([]);
  const [muat, setMuat] = useState(true);
  const [kegiatanId, setKegiatanId] = useState("");
  const [kelasId, setKelasId] = useState("");
  const [cari, setCari] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/teacher/kegiatan-ujian").then(r => r.json()).catch(() => ({})),
      fetch("/api/teacher/journal-classes").then(r => r.json()).catch(() => []),
      fetch("/api/teacher/exams").then(r => r.json()).catch(() => []),
    ]).then(([k, c, e]) => {
      const daftar: Kegiatan[] = Array.isArray(k?.daftar) ? k.daftar : [];
      setKegiatan(daftar);
      const aktif = daftar.find(x => x.aktif);
      if (aktif) setKegiatanId(aktif.id);
      const unik = new Map<string, Kelas>();
      for (const x of Array.isArray(c) ? c : []) if (!unik.has(x.classId)) unik.set(x.classId, { classId: x.classId, className: x.className, grade: x.grade });
      setKelas([...unik.values()].sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, "id", { numeric: true })));
      setUjian(Array.isArray(e) ? e : []);
    }).finally(() => setMuat(false));
  }, []);

  const kelasPilihan = kelas.find(k => k.classId === kelasId);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return ujian.filter(u =>
      (!kegiatanId || u.kegiatan?.id === kegiatanId) &&
      (!kelasPilihan || (u.kelasNama?.length ? u.kelasNama : [u.class.name]).includes(kelasPilihan.className)) &&
      (!q || u.title.toLowerCase().includes(q) || u.subject.toLowerCase().includes(q)))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [ujian, kegiatanId, kelasPilihan, cari]);

  const qsKelas = kelasId ? `?kelas=${kelasId}` : "";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title="Administrasi Ujian"
        description="Cetak kartu peserta, denah ruang, kisi-kisi, daftar hadir, dan berita acara langsung dari data ujian" />

      <div className="alat-aksi justify-end mb-5">
        <Link href={`${basePath}/administrasi/pengawas`} className="btn-modal-cancel btn-teks whitespace-nowrap">
          <UserCheck size={16} /> Pembagian Pengawas
        </Link>
        <Link href={`${basePath}/administrasi/ruang`} className="btn-modal-cancel btn-teks whitespace-nowrap">
          <LayoutGrid size={16} /> Denah Ruang Ujian
        </Link>
        <Link href={`${basePath}/administrasi/ditahan`} className="btn-modal-cancel btn-teks whitespace-nowrap">
          <ShieldBan size={16} /> Peserta Ditahan
        </Link>
      </div>

      {muat ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div> : (
        <div className="space-y-5">
          <div className="page-card p-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="label-field">Kegiatan ujian</label>
              <Select value={kegiatanId} onChange={setKegiatanId} placeholder="Semua kegiatan"
                options={[{ value: "", label: "Semua kegiatan" }, ...kegiatan.map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama}${k.tahunAjaran ? ` ${k.tahunAjaran}` : ""}` }))]} />
            </div>
            <div>
              <label className="label-field">Kelas</label>
              <Select value={kelasId} onChange={setKelasId} placeholder="Semua kelas"
                options={[{ value: "", label: "Semua kelas" }, ...kelas.map(k => ({ value: k.classId, label: k.className }))]} />
            </div>
            {kelasId ? (
              <Link href={`${basePath}/administrasi/kartu?kelas=${kelasId}${kegiatanId ? `&kegiatan=${kegiatanId}` : ""}`}
                className="btn-modal-cancel whitespace-nowrap">
                <IdCard size={16} /> Cetak Kartu Peserta
              </Link>
            ) : (
              <span className="text-xs text-gray-400 md:max-w-[12rem]">Pilih kelas untuk mencetak kartu peserta.</span>
            )}
          </div>

          <Alert variant="info" title="Satu kartu untuk seluruh kegiatan">
            Kartu peserta berlaku untuk semua ujian dalam satu kegiatan (mis. STS). Daftar hadir dan berita acara dicetak per ujian; ujian yang diikuti beberapa kelas dicetak satu halaman per kelas — pilih kelas di atas untuk mencetak kelas itu saja.
          </Alert>

          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-primary-700" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Kisi-kisi, Daftar Hadir & Berita Acara per Ujian</h2>
              </div>
              <span className="text-xs text-gray-400">{tampil.length} ujian</span>
            </div>
            <div className="px-5 pt-4">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari judul atau mata pelajaran..." className="input-field pl-10" />
              </div>
            </div>
            {tampil.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Tidak ada ujian" description="Tidak ada ujian yang cocok dengan kegiatan dan kelas yang dipilih." />
            ) : (
              <div className="overflow-x-auto scrollbar-visible p-5">
                <table className="data-table">
                  <thead><tr><th>Ujian</th><th>Kelas</th><th>Jadwal</th><th className="text-center">Hadir</th><th className="text-right">Cetak</th></tr></thead>
                  <tbody>
                    {tampil.map(u => (
                      <tr key={u.id}>
                        <td>
                          <p className="font-semibold text-gray-800">{u.title}</p>
                          <p className="text-xs text-gray-400">{u.kegiatan ? `${u.kegiatan.singkatan} · ` : ""}{u.subject}</p>
                        </td>
                        <td className="text-sm text-gray-600">{(u.kelasNama?.length ? u.kelasNama : [u.class.name]).join(", ")}</td>
                        <td className="text-xs text-gray-500 whitespace-nowrap">{tgl(u.startTime)}</td>
                        <td className="text-center tabular-nums">{u._count.attempts}</td>
                        <td>
                          <div className="alat-aksi justify-end">
                            <Link href={`${basePath}/${u.id}/kisi-kisi`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-primary-700 hover:bg-primary-50 whitespace-nowrap">
                              <ListChecks size={13} /> Kisi-kisi
                            </Link>
                            {/* Kartu Soal — satu butir satu halaman, dilampirkan bersama kisi-kisi
                                ke kurikulum (permintaan user 21 September 2026). */}
                            <Link href={`${basePath}/${u.id}/kartu-soal`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-primary-700 hover:bg-primary-50 whitespace-nowrap">
                              <FileText size={13} /> Kartu Soal
                            </Link>
                            <Link href={`${basePath}/${u.id}/daftar-hadir${qsKelas}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-primary-700 hover:bg-primary-50 whitespace-nowrap">
                              <ClipboardList size={13} /> Daftar Hadir
                            </Link>
                            <Link href={`${basePath}/${u.id}/berita-acara${qsKelas}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-primary-700 hover:bg-primary-50 whitespace-nowrap">
                              <FileSignature size={13} /> Berita Acara
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
