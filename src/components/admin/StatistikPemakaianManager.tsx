"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import { grupMenuSiswa } from "@/components/student/StudentSidebar";
import { grupMenuGuru } from "@/components/teacher/TeacherSidebar";
import { grupMenuOrtu } from "@/components/parent/ParentSidebar";
import { menuGroups as GRUP_ADMIN } from "@/components/admin/AdminSidebar";
import { menuGroupsTas as GRUP_TAS } from "@/components/admin/TasSidebar";

interface Data { hari: number; sejak: string | null; jabatan: string[]; peran: { peran: string; akun: number; aktif: number }[]; baris: { peran: string; jalur: string; dibuka: number; orang: number }[] }
type Grup = { label: string | null; items: { href: string; label: string }[] };
const NAMA: Record<string, string> = { TEACHER: "Guru", STUDENT: "Siswa", PARENT: "Orang tua", TAS: "Staf", ADMIN: "Admin" };
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** STATISTIK PEMAKAIAN — menu mana yang dibuka dan mana yang tidak, per peran. Daftar menu diambil dari sumber menu yang
 *  sama dengan sidebar (untuk guru: semua jabatan dianggap ada, supaya menu jabatan ikut terdaftar). Hitungan dimulai
 *  sejak fitur ini terpasang — "belum pernah dibuka" berarti sejak tanggal itu. */
export default function StatistikPemakaianManager() {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [peran, setPeran] = useState("TEACHER");
  const [hari, setHari] = useState("30");
  useEffect(() => {
    setD(null);
    fetch(`/api/admin/pemakaian?hari=${hari}`, { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat("Gagal memuat."); else setD(j); }).catch(() => setGalat("Gagal memuat."));
  }, [hari]);

  const menu = useMemo(() => {
    const semua = (g: Grup[]) => g.flatMap(x => x.items.map(i => ({ href: i.href, label: i.label, grup: x.label ?? "Utama" })));
    const guru = grupMenuGuru({ jabatanNames: d?.jabatan ?? [], hasHomeroom: true, hasTeaching: true, hasInternshipBimbingan: true, isGuruPiketOnDutyToday: true, panitiaSpmb: true }) as unknown as Grup[];
    return {
      TEACHER: semua(guru), STUDENT: semua(grupMenuSiswa({ isKelasAdmin: true, kelasXII: true }) as unknown as Grup[]), PARENT: semua(grupMenuOrtu() as unknown as Grup[]),
      ADMIN: semua(GRUP_ADMIN as unknown as Grup[]), TAS: semua(GRUP_TAS as unknown as Grup[]),
    } as Record<string, { href: string; label: string; grup: string }[]>;
  }, [d?.jabatan]);

  const judul = <PageHeader icon={<BarChart3 size={22} />} title="Statistik Pemakaian" description="Menu mana yang dibuka dan mana yang tidak pernah, per peran" />;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<div className="flex min-h-[40vh] items-center justify-center text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></div>;
  const milik = d.baris.filter(b => b.peran === peran);
  // Satu menu = jalurnya sendiri dan halaman di bawahnya; jalur dicocokkan ke href menu TERPANJANG yang menjadi awalannya.
  const daftar = [...new Map((menu[peran] ?? []).map(m => [m.href, m])).values()];
  const hitung = new Map<string, { dibuka: number; orang: number }>();
  const lain: typeof milik = [];
  for (const b of milik) {
    const cocok = daftar.filter(m => b.jalur === m.href || b.jalur.startsWith(`${m.href}/`)).sort((x, y) => y.href.length - x.href.length)[0];
    if (!cocok) { lain.push(b); continue; }
    const x = hitung.get(cocok.href) ?? { dibuka: 0, orang: 0 };
    x.dibuka += b.dibuka; x.orang = Math.max(x.orang, b.orang); hitung.set(cocok.href, x);
  }
  const dipakai = daftar.filter(m => hitung.has(m.href)).map(m => ({ ...m, ...hitung.get(m.href)! })).sort((a, b) => b.dibuka - a.dibuka);
  const belum = daftar.filter(m => !hitung.has(m.href) && !/^\/dashboard\/(admin|teacher|student|parent)$/.test(m.href));
  const p = d.peran.find(x => x.peran === peran), maks = Math.max(1, ...dipakai.map(x => x.dibuka));
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={p?.aktif ?? 0} label={`${NAMA[peran]} yang membuka portal`} ikon="hadir" color="emerald" />
          <StatTile value={p?.akun ?? 0} label={`Akun ${NAMA[peran]?.toLowerCase()} terdaftar`} ikon="akun" color="primary" />
          <StatTile value={dipakai.length} label="Menu yang dibuka" ikon="centang" color="blue" />
          <StatTile value={belum.length} label="Menu belum pernah dibuka" ikon="waspada" color="amber" sorot={belum.length > 0} />
        </div>
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {["TEACHER", "STUDENT", "PARENT", "TAS", "ADMIN"].map(k => <button key={k} type="button" onClick={() => setPeran(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${peran === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{NAMA[k]}</button>)}
          </div>
          <div className="alat-saring w-44"><Select value={hari} onChange={setHari} options={[{ value: "7", label: "7 hari terakhir" }, { value: "30", label: "30 hari terakhir" }, { value: "90", label: "90 hari terakhir" }]} /></div>
        </div>
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {d.sejak ? <>Pencatatan dimulai <b>{tgl(d.sejak)}</b>. &ldquo;Belum pernah dibuka&rdquo; berarti sejak tanggal itu — menu yang jarang dipakai (mis. hanya menjelang rapor) wajar muncul di sana.</> : <>Belum ada catatan. Pencatatan dimulai begitu pengguna membuka portal setelah fitur ini terpasang.</>}
          {" "}Untuk guru dan staf, sebagian menu hanya dimiliki pemegang jabatan tertentu.
        </p>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <section className="panel overflow-hidden xl:col-span-7">
            <div className="panel-kepala"><p className="panel-judul">Menu yang dipakai</p></div>
            {dipakai.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada menu yang tercatat dibuka.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Menu</th><th className="text-right">Dibuka</th><th className="text-right">Orang</th></tr></thead>
                  <tbody>{dipakai.map((m, i) => (
                    <tr key={m.href}>
                      <td className="angka text-gray-400">{i + 1}</td>
                      <td><span className="font-medium text-primary-900">{m.label}</span><span className="block text-xs text-gray-400">{m.grup}</span>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((m.dibuka / maks) * 100)}%` }} /></div></td>
                      <td className="angka text-right">{m.dibuka.toLocaleString("id-ID")}</td><td className="angka text-right">{m.orang}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel p-5 xl:col-span-5">
            <p className="panel-judul">Belum pernah dibuka <span className="angka ml-1 text-xs font-normal text-gray-400">{belum.length}</span></p>
            {belum.length === 0 ? <p className="mt-2 text-sm text-gray-400">Semua menu sudah pernah dibuka.</p> : (
              <ul className="mt-2 space-y-1 text-sm">{belum.map(m => <li key={m.href}><span className="text-primary-900">{m.label}</span><span className="text-xs text-gray-400"> · {m.grup}</span></li>)}</ul>
            )}
            {lain.length > 0 && <p className="mt-3 text-xs text-gray-500">{lain.length} halaman lain dibuka lewat tautan di luar menu (mis. halaman cetak atau rincian).</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
