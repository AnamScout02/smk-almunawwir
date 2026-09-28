"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Clock, GraduationCap, Loader2, Lock, NotebookPen, Target, UserX } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Ringkasan {
  semester: string; schoolAvg: number | null; persenTuntas: number | null;
  progres: { id: string; kelas: string; wali: string | null; siswa: number; mapel: number; lengkap: number; sebagian: number; status: "TERBUKA" | "DIKUNCI" | "DISAHKAN" }[];
  guruBelumMenilai: { nama: string; kelas: string[] }[];
  ketuntasan: { mapel: string; dinilai: number; tuntas: number; belumTuntas: number; persenTuntas: number; rata: number; kkm: string }[];
  bebanJp: { nama: string; mengajar: number; ekuivalensi: number; rincian: string[]; total: number }[];
  syaratJp: number;
  formRapor: {
    wajib: number; dikirim: number; draf: number;
    perKelas: { id: string; kelas: string; wali: string | null; wajib: number; dikirim: number; draf: number; dikembalikan: number; belum: number; status: "TERBUKA" | "DIKUNCI" | "DISAHKAN" }[];
    guruBelum: { nama: string; kelas: string[] }[];
  };
  missingJournal: { teacherName: string; className: string; subject: string }[];
  classesWithoutSchedule: { id: string; name: string; grade: number }[];
  totalAssignments: number;
}

const STATUS = {
  TERBUKA: { label: "Terbuka", kelas: "bg-amber-50 text-amber-700 border-amber-200", ikon: Clock },
  DIKUNCI: { label: "Dikunci", kelas: "bg-blue-50 text-blue-700 border-blue-200", ikon: Lock },
  DISAHKAN: { label: "Disahkan", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", ikon: CheckCircle2 },
};
type Tab = "penilaian" | "form" | "ketuntasan" | "jp" | "jurnal";

/** DASHBOARD KURIKULUM (diperkaya 17 Sep 2026). */
/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function WakasekKurikulumDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("penilaian");

  useEffect(() => {
    fetch("/api/teacher/wakasek/kurikulum/summary", { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok || !d) setError(d?.error || "Gagal memuat data"); else setData(d); })
      .catch(() => setError("Gagal memuat data"));
  }, []);

  if (!data && !error) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error}</div>;

  const dikunci = data.progres.filter(p => p.status !== "TERBUKA").length;
  const kurangJp = data.bebanJp.filter(g => g.total < data.syaratJp);
  const pintasan = [
    { href: tautanJabatan(basePath, "wakasek/kurikulum/jadwal"), label: "Jadwal Pelajaran", ikon: CalendarClock },
    { href: tautanJabatan(basePath, "wakasek/kurikulum/penugasan"), label: "Penugasan Mengajar", ikon: ClipboardList },
    { href: tautanJabatan(basePath, "wakasek/kurikulum/mapel"), label: "Mapel & KKM", ikon: Target },
    { href: "/pusat-ujian", label: "Ujian & Remedial (CBT)", ikon: NotebookPen },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<GraduationCap size={22} />} title="Dashboard Kurikulum"
        description={`Penilaian, ketuntasan KKM, beban mengajar, dan jurnal — Semester ${data.semester}`} />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile ikon="tren" color="primary" value={data.schoolAvg ?? "—"} label="Rata-rata nilai sekolah" sublabel={data.persenTuntas === null ? undefined : `${data.persenTuntas}% nilai tuntas KKM`} />
          <StatTile ikon="kelas" color={dikunci < data.progres.length ? "amber" : "emerald"} value={`${dikunci}/${data.progres.length}`} label="Kelas nilai rapornya dikunci/disahkan" />
          <StatTile ikon="guru" color={data.guruBelumMenilai.length ? "red" : "emerald"} value={data.guruBelumMenilai.length} label="Guru belum menilai sebagian kelasnya" />
          <StatTile ikon="jam" color={kurangJp.length ? "amber" : "blue"} value={kurangJp.length} label={`Guru di bawah ${data.syaratJp} JP/minggu`} />
          <StatTile ikon="daftar-centang" color={data.formRapor.dikirim >= data.formRapor.wajib ? "emerald" : "amber"}
            value={`${data.formRapor.dikirim}/${data.formRapor.wajib}`} label="Form nilai rapor terkirim"
            sublabel={data.formRapor.draf ? `${data.formRapor.draf} masih draf` : undefined} />
        </div>

        <BarisPintasan items={pintasan} />

        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {([["penilaian", "Progres penilaian"], ["form", `Form nilai rapor (${data.formRapor.dikirim}/${data.formRapor.wajib})`], ["ketuntasan", "Ketuntasan KKM"], ["jp", "Beban 24 JP"], ["jurnal", `Jurnal & jadwal (${data.missingJournal.length})`]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
        </div>

        {tab === "penilaian" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
            <div className="panel overflow-hidden xl:col-span-8">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Kelas</th><th>Wali kelas</th><th className="text-right">Mapel lengkap</th><th>Kemajuan</th><th>Status rapor</th></tr></thead>
                  <tbody>
                    {data.progres.map(p => {
                      const st = STATUS[p.status];
                      const persen = p.mapel ? Math.round((p.lengkap / p.mapel) * 100) : 0;
                      return (
                        <tr key={p.id}>
                          <td className="font-medium text-primary-900 whitespace-nowrap">{p.kelas}</td>
                          <td className="text-xs text-gray-600">{p.wali ?? "—"}</td>
                          <td className="text-right tabular-nums">{p.lengkap}/{p.mapel}<span className="block text-xs text-gray-400">{p.sebagian - p.lengkap} sebagian</span></td>
                          <td className="min-w-[8rem]">
                            <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${persen >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${persen}%` }} /></span>
                          </td>
                          <td><span className={`status-badge ${st.kelas}`}><st.ikon size={12} /> {st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel p-5 xl:col-span-4">
              <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3 flex items-center gap-2"><UserX size={15} className="text-red-600" /> Belum mengisi nilai semester ini</h3>
              {data.guruBelumMenilai.length === 0 ? <p className="py-6 text-center text-sm text-emerald-600">Semua guru sudah mulai menilai.</p> : (
                <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto">
                  {data.guruBelumMenilai.map(g => (
                    <li key={g.nama} className="text-sm">
                      <p className="font-semibold text-primary-900">{g.nama} <span className="text-xs font-normal text-gray-500">· {g.kelas.length} kelas-mapel</span></p>
                      <p className="text-xs text-gray-500">{g.kelas.slice(0, 4).join(" · ")}{g.kelas.length > 4 ? ` · +${g.kelas.length - 4}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "form" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
            <div className="panel overflow-hidden xl:col-span-8">
              <p className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
                Satu form per kelas &times; mata pelajaran. Guru mengisi lalu <b>mengirim</b>; wali kelas memeriksa, mengunci, dan Kepala Sekolah mengesahkan.
                Form yang dikembalikan wali kelas dihitung sebagai draf.
              </p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Kelas</th><th>Wali kelas</th><th className="text-right">Terkirim</th><th className="text-right">Draf</th><th className="text-right">Belum diisi</th><th>Kemajuan</th><th>Status rapor</th></tr></thead>
                  <tbody>
                    {data.formRapor.perKelas.map(k => {
                      const st = STATUS[k.status];
                      const persen = k.wajib ? Math.round((k.dikirim / k.wajib) * 100) : 0;
                      return (
                        <tr key={k.id}>
                          <td className="font-medium text-primary-900 whitespace-nowrap">{k.kelas}</td>
                          <td className="text-xs text-gray-600">{k.wali ?? "\u2014"}</td>
                          <td className="text-right tabular-nums font-semibold text-emerald-700">{k.dikirim}/{k.wajib}</td>
                          <td className="text-right tabular-nums">{k.draf || "\u2014"}{k.dikembalikan > 0 && <span className="block text-xs text-red-600">{k.dikembalikan} dikembalikan</span>}</td>
                          <td className="text-right tabular-nums">{k.belum || "\u2014"}</td>
                          <td className="min-w-[8rem]">
                            <span className="block h-1.5 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${persen >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${persen}%` }} /></span>
                          </td>
                          <td><span className={`status-badge ${st.kelas}`}><st.ikon size={12} /> {st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel p-5 xl:col-span-4">
              <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3 flex items-center gap-2"><UserX size={15} className="text-amber-600" /> Belum mengirim form nilai rapor</h3>
              {data.formRapor.guruBelum.length === 0 ? <p className="py-6 text-center text-sm text-emerald-600">Semua form sudah dikirim.</p> : (
                <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto">
                  {data.formRapor.guruBelum.map(g => (
                    <li key={g.nama} className="text-sm">
                      <p className="font-semibold text-primary-900">{g.nama} <span className="text-xs font-normal text-gray-500">&middot; {g.kelas.length} kelas-mapel</span></p>
                      <p className="text-xs text-gray-500">{g.kelas.slice(0, 4).join(" \u00b7 ")}{g.kelas.length > 4 ? ` \u00b7 +${g.kelas.length - 4}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "ketuntasan" && (
          <div className="panel overflow-hidden">
            <p className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">Diurutkan dari mapel dengan ketuntasan terendah. Siswa di bawah KKM bisa diberi ujian remedial lewat Pusat Ujian.</p>
            {data.ketuntasan.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada nilai semester ini.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Mata pelajaran</th><th className="text-right">KKM</th><th className="text-right">Dinilai</th><th className="text-right">Belum tuntas</th><th className="text-right">Rata-rata</th><th>Ketuntasan</th></tr></thead>
                  <tbody>
                    {data.ketuntasan.map(k => (
                      <tr key={k.mapel}>
                        <td className="font-medium text-primary-900">{k.mapel}</td>
                        <td className="text-right tabular-nums">{k.kkm}</td>
                        <td className="text-right tabular-nums">{k.dinilai}</td>
                        <td className={`text-right tabular-nums ${k.belumTuntas ? "font-semibold text-red-600" : ""}`}>{k.belumTuntas}</td>
                        <td className="text-right tabular-nums">{k.rata}</td>
                        <td className="min-w-[9rem]">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${k.persenTuntas >= 75 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${k.persenTuntas}%` }} /></span>
                            <span className="w-10 text-right text-xs tabular-nums text-gray-600">{k.persenTuntas}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "jp" && (
          <div className="panel overflow-hidden">
            <p className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
              Jam mengajar dari Penugasan Mengajar (jam/minggu per mapel) ditambah ekuivalensi tugas tambahan (Permendikbud 15/2018). Syarat minimal {data.syaratJp} JP/minggu.
            </p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Guru</th><th className="text-right">Mengajar</th><th className="text-right">Ekuivalensi</th><th className="text-right">Total</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {data.bebanJp.map(g => (
                    <tr key={g.nama}>
                      <td className="font-medium text-primary-900">{g.nama}</td>
                      <td className="text-right tabular-nums">{g.mengajar}</td>
                      <td className="text-right tabular-nums">{g.ekuivalensi}</td>
                      <td className={`text-right font-bold tabular-nums ${g.total < data.syaratJp ? "text-red-600" : "text-emerald-700"}`}>{g.total}</td>
                      <td className="text-xs text-gray-500">{g.rincian.join(" · ") || "—"}{g.total < data.syaratJp ? <span className="block font-semibold text-red-600">Kurang {data.syaratJp - g.total} JP</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "jurnal" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
            <div className="panel p-5">
              <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /> Belum isi jurnal 7 hari terakhir</h3>
              {data.missingJournal.length === 0 ? <p className="py-6 text-center text-sm text-emerald-600">Semua penugasan punya jurnal minggu ini.</p> : (
                <ul className="max-h-96 divide-y divide-gray-50 overflow-y-auto">
                  {data.missingJournal.map((m, i) => (
                    <li key={i} className="py-2 text-sm"><p className="font-semibold text-primary-900">{m.teacherName}</p><p className="text-xs text-gray-500">{m.className} · {m.subject}</p></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel p-5">
              <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3">Kelas tanpa jadwal</h3>
              {data.classesWithoutSchedule.length === 0 ? <p className="py-6 text-center text-sm text-emerald-600">Semua kelas sudah berjadwal.</p> : (
                <div className="flex flex-wrap gap-2">
                  {data.classesWithoutSchedule.map(c => <span key={c.id} className="status-badge bg-red-50 text-red-600 border-red-200">{c.name}</span>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
