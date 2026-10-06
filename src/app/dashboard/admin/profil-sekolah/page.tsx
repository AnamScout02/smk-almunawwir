export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import StatTile from "@/components/admin/StatTile";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

const TRACER_LABEL: Record<string, string> = {
  BEKERJA: "Bekerja", KULIAH: "Melanjutkan Kuliah", WIRAUSAHA: "Wirausaha",
  BELUM_BEKERJA: "Belum Bekerja", LAINNYA: "Lainnya",
};
const KONDISI_LABEL: Record<string, string> = {
  BAIK: "Baik", RUSAK_RINGAN: "Rusak Ringan", RUSAK_BERAT: "Rusak Berat",
};

/** Profil Sekolah — satu halaman berisi seluruh angka yang biasa diminta asesor akreditasi
 * dan Dinas. Tidak ada data baru yang diinput di sini: semuanya dihitung ulang dari data yang
 * sudah ada (siswa, kelas, guru, inventaris, tracer alumni), supaya tidak pernah ada dua versi
 * angka yang berbeda antara dokumen ini dan sistem. */
export default async function ProfilSekolahPage() {
  await verifyTasAccess();

  const [majors, classes, students, teachers, assets, tracer, tahunAktif, settings] = await Promise.all([
    prisma.major.findMany({
      select: { id: true, code: true, name: true, akreditasi: true, bidangKeahlian: true, programKeahlian: true },
      orderBy: { name: "asc" },
    }),
    prisma.class.findMany({ select: { id: true, grade: true, majorId: true, _count: { select: { students: true } } } }),
    prisma.student.findMany({
      select: { gender: true, studentStatus: true, enrollYear: true, majorId: true, class: { select: { grade: true, majorId: true } }, bukuIndukData: true },
    }),
    prisma.teacher.findMany({
      where: { teacherStatus: { not: "KELUAR" } },
      select: {
        id: true, subject: true, position: true, user: { select: { name: true } },
        // Sumber UTAMA "guru mengampu mapel apa" adalah Penugasan Mengajar, BUKAN kolom
        // Teacher.subject: di sekolah ini kolom itu berisi "-" untuk seluruh 32 guru (tidak
        // pernah diisi lewat Buku Induk Guru), sedangkan Penugasan Mengajar punya 258 baris
        // yang memang dipakai untuk jadwal & jurnal. Kolom subject cuma jadi cadangan.
        teachingLoad: { select: { subject: { select: { name: true } } } },
      },
    }),
    prisma.asset.findMany({ select: { category: true, quantity: true, condition: true } }),
    prisma.alumniTracer.findMany({ select: { status: true } }),
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    getSettings(["logo.full_white", "school.structure", "nominatif.npsn", "nominatif.nss", "contact.address", "contact.email", "contact.phone"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);

  const ttdKepala = await ttdDariNama(principalName); // TTD pribadi Kepala Sekolah (src/lib/ttd.ts)
  const aktif = students.filter(s => s.studentStatus === "AKTIF");

  const perJurusan = majors.map(m => {
    const siswa = aktif.filter(s => (s.class?.majorId ?? s.majorId) === m.id);
    const perTingkat = (g: number) => {
      const list = siswa.filter(s => s.class?.grade === g);
      return { L: list.filter(s => s.gender === "L").length, P: list.filter(s => s.gender === "P").length, total: list.length };
    };
    return {
      ...m,
      rombel: { 10: classes.filter(c => c.majorId === m.id && c.grade === 10).length,
                11: classes.filter(c => c.majorId === m.id && c.grade === 11).length,
                12: classes.filter(c => c.majorId === m.id && c.grade === 12).length },
      x: perTingkat(10), xi: perTingkat(11), xii: perTingkat(12),
      total: siswa.length,
    };
  });

  // Lulusan per tahun — diambil dari tahun kelulusan di Buku Induk (bukan dari angkatan, karena
  // ada siswa yang pernah tinggal kelas sehingga lulusnya tidak sama dengan angkatan+3).
  //
  // SENGAJA menampilkan SEMUA tahun yang ada datanya, bukan "3 tahun terakhir" berdasarkan
  // kalender: versi lama menampilkan 2024/2025/2026 dan tahun berjalan selalu 0 (angkatan yang
  // baru lulus tanggal kelulusannya belum diinput), sehingga dokumen terlihat seperti sekolah
  // tidak meluluskan siapa pun tahun ini. Alumni yang tanggal lulusnya belum tercatat dihitung
  // terpisah di baris tersendiri supaya penjumlahannya tetap cocok dengan total alumni.
  const alumni = students.filter(s => s.studentStatus === "LULUS");
  const tahunLulus = new Map<string, number>();
  let lulusanTanpaTanggal = 0;
  for (const s of alumni) {
    const g = (s.bukuIndukData as Record<string, unknown> | null)?.["graduationDate"];
    const thn = typeof g === "string" ? g.slice(0, 4) : "";
    if (/^\d{4}$/.test(thn)) tahunLulus.set(thn, (tahunLulus.get(thn) ?? 0) + 1);
    else lulusanTanpaTanggal++;
  }
  const lulusanPerTahun = [...tahunLulus.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tahun, jumlah]) => ({ tahun, jumlah }));

  // Satu guru bisa mengampu beberapa mata pelajaran — dihitung per (mapel, guru) unik supaya
  // tidak terhitung berulang kali sebanyak kelas yang diampunya.
  const mapelGuru = new Map<string, Set<string>>();
  const guruTanpaMapel: string[] = [];
  for (const t of teachers) {
    const dariPenugasan = [...new Set(t.teachingLoad.map(a => a.subject.name.trim()).filter(Boolean))];
    const cadangan = t.subject?.trim() ?? "";
    const daftar = dariPenugasan.length > 0
      ? dariPenugasan
      : (cadangan && !/^[-–—.]+$/.test(cadangan) ? [cadangan] : []);
    if (daftar.length === 0) { guruTanpaMapel.push(t.user.name); continue; }
    for (const nama of daftar) {
      if (!mapelGuru.has(nama)) mapelGuru.set(nama, new Set());
      mapelGuru.get(nama)!.add(t.id);
    }
  }
  const guruPerMapel = [...mapelGuru.entries()]
    .map(([nama, set]) => [nama, set.size] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"));

  const sarana = [...assets.reduce((m, a) => {
    const k = a.category || "Lainnya";
    const cur = m.get(k) ?? { jumlah: 0, baik: 0, rusak: 0 };
    cur.jumlah += a.quantity;
    if (a.condition === "BAIK") cur.baik += a.quantity; else cur.rusak += a.quantity;
    m.set(k, cur);
    return m;
  }, new Map<string, { jumlah: number; baik: number; rusak: number }>())]
    .sort((a, b) => b[1].jumlah - a[1].jumlah);

  const tracerRekap = [...tracer.reduce((m, t) => m.set(t.status, (m.get(t.status) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);

  const totalL = aktif.filter(s => s.gender === "L").length;
  const totalP = aktif.filter(s => s.gender === "P").length;

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle text-xs print:text-[10px]";
  const td = "border border-gray-800 px-2 py-1 align-middle text-xs print:text-[10px]";
  const judul = "text-sm print:text-[11px] font-bold uppercase tracking-wide text-primary-900 mb-2 mt-6 print:mb-1.5 print:mt-4";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:min-h-0 print:bg-white">
      {/* MENDATAR: tabel kompetensi keahlian punya 13 kolom angka (rombel & siswa per tingkat,
          L/P/Jumlah) — tidak muat rapi di A4 potret. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } .lembar-profil { padding: 1.2cm; } }"}</style>

      <PageHeader icon={<Building2 size={22} />} title="Profil Sekolah"
        description="Rekap seluruh angka yang biasa diminta asesor akreditasi & Dinas — dihitung langsung dari data sistem" printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {/* Ringkasan layar (Pola tampilan v2, permintaan user 15 Sep 2026: "belum seragam, keluar layar di HP"). Dokumen cetak di bawahnya
          tetap persis seperti semula — semua penyesuaian layar memakai varian print: untuk mengembalikan nilai cetaknya. */}
      <div className="kisi-kartu kisi-kartu-4 mb-5 print:hidden">
        <StatTile value={aktif.length} label="Peserta didik aktif" ikon="siswa" color="blue" />
        <StatTile value={classes.length} label="Rombongan belajar" ikon="kelas" color="purple" />
        <StatTile value={teachers.length} label="Pendidik & tendik" ikon="guru" color="emerald" />
        <StatTile value={alumni.length} label="Alumni tercatat" ikon="prestasi" color="amber" />
      </div>

      <div className="print-doc lembar-profil bg-white panel p-4 sm:p-6 print:rounded-none print:border-0 print:shadow-none print:p-0">
        <PrintKop title="Profil Sekolah" subtitle={`Data Pokok — Tahun Pelajaran ${tahunAktif?.name ?? "—"}`} logoUrl={settings["logo.full_white"]} />

        {/* ── A. Identitas ─────────────────────────────────────────────── */}
        <p className={judul}>A. Identitas Sekolah</p>
        <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${td} w-[22%] font-semibold`}>Nama Sekolah</td><td className={td}>SMK Al Munawwir IIBS</td>
              <td className={`${td} w-[14%] font-semibold`}>NPSN</td><td className={td}>{settings["nominatif.npsn"] || "—"}</td>
            </tr>
            <tr>
              <td className={`${td} font-semibold`}>Alamat</td>
              <td className={td} colSpan={3}>{settings["contact.address"] || "—"}</td>
            </tr>
            <tr>
              <td className={`${td} font-semibold`}>Kepala Sekolah</td><td className={td}>{principalName || "—"}</td>
              <td className={`${td} font-semibold`}>NSS</td><td className={td}>{settings["nominatif.nss"] || "—"}</td>
            </tr>
            <tr>
              <td className={`${td} font-semibold`}>Telepon</td><td className={td}>{settings["contact.phone"] || "—"}</td>
              <td className={`${td} font-semibold`}>Email</td><td className={td}>{settings["contact.email"] || "—"}</td>
            </tr>
          </tbody>
        </table></div>

        {/* ── B. Peserta didik ─────────────────────────────────────────── */}
        <p className={judul}>B. Peserta Didik per Kompetensi Keahlian</p>
        <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th} rowSpan={2}>No</th>
              <th className={th} rowSpan={2}>Kompetensi Keahlian</th>
              <th className={th} rowSpan={2}>Akreditasi</th>
              <th className={th} colSpan={3}>Rombel</th>
              <th className={th} colSpan={3}>Kelas X</th>
              <th className={th} colSpan={3}>Kelas XI</th>
              <th className={th} colSpan={3}>Kelas XII</th>
              <th className={th} rowSpan={2}>Total</th>
            </tr>
            <tr>
              <th className={th}>X</th><th className={th}>XI</th><th className={th}>XII</th>
              <th className={th}>L</th><th className={th}>P</th><th className={th}>Jml</th>
              <th className={th}>L</th><th className={th}>P</th><th className={th}>Jml</th>
              <th className={th}>L</th><th className={th}>P</th><th className={th}>Jml</th>
            </tr>
          </thead>
          <tbody>
            {perJurusan.map((m, i) => (
              <tr key={m.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={td}>{m.name}</td>
                <td className={`${td} text-center`}>{m.akreditasi === "SUDAH" ? "Terakreditasi" : m.akreditasi === "BELUM" ? "Belum" : "—"}</td>
                <td className={`${td} text-center`}>{m.rombel[10]}</td>
                <td className={`${td} text-center`}>{m.rombel[11]}</td>
                <td className={`${td} text-center`}>{m.rombel[12]}</td>
                <td className={`${td} text-center`}>{m.x.L}</td><td className={`${td} text-center`}>{m.x.P}</td><td className={`${td} text-center font-semibold`}>{m.x.total}</td>
                <td className={`${td} text-center`}>{m.xi.L}</td><td className={`${td} text-center`}>{m.xi.P}</td><td className={`${td} text-center font-semibold`}>{m.xi.total}</td>
                <td className={`${td} text-center`}>{m.xii.L}</td><td className={`${td} text-center`}>{m.xii.P}</td><td className={`${td} text-center font-semibold`}>{m.xii.total}</td>
                <td className={`${td} text-center font-bold`}>{m.total}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={`${td} text-center`} colSpan={3}>JUMLAH</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.rombel[10], 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.rombel[11], 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.rombel[12], 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.x.L, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.x.P, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.x.total, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xi.L, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xi.P, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xi.total, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xii.L, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xii.P, 0)}</td>
              <td className={`${td} text-center`}>{perJurusan.reduce((a, m) => a + m.xii.total, 0)}</td>
              <td className={`${td} text-center`}>{aktif.length}</td>
            </tr>
          </tbody>
        </table></div>
        <p className="text-xs print:text-[9px] text-gray-500 mt-1">
          Total peserta didik aktif: <b>{aktif.length}</b> orang ({totalL} laki-laki, {totalP} perempuan)
          pada {classes.length} rombongan belajar.
        </p>

        {/* ── C. Pendidik & tenaga kependidikan ────────────────────────── */}
        <div style={{ breakInside: "avoid" }}>
          <p className={judul}>C. Pendidik &amp; Tenaga Kependidikan</p>
          <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
            <thead>
              <tr><th className={th}>No</th><th className={th}>Mata Pelajaran / Bidang</th><th className={th}>Jumlah</th></tr>
            </thead>
            <tbody>
              {guruPerMapel.length === 0 ? (
                <tr><td className={`${td} text-center`} colSpan={3}>Belum ada data guru.</td></tr>
              ) : guruPerMapel.map(([mapel, jml], i) => (
                <tr key={mapel}>
                  <td className={`${td} text-center w-[6%]`}>{i + 1}</td>
                  <td className={td}>{mapel}</td>
                  <td className={`${td} text-center w-[14%]`}>{jml}</td>
                </tr>
              ))}
              {guruTanpaMapel.length > 0 && (
                <tr>
                  <td className={`${td} text-center`}>—</td>
                  <td className={`${td} text-amber-700`}>Belum ada penugasan mengajar</td>
                  <td className={`${td} text-center text-amber-700`}>{guruTanpaMapel.length}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td className={`${td} text-center`} colSpan={2}>JUMLAH PENDIDIK &amp; TENAGA KEPENDIDIKAN</td>
                <td className={`${td} text-center`}>{teachers.length}</td>
              </tr>
            </tbody>
          </table></div>
          <p className="text-xs print:text-[9px] text-gray-500 mt-1">
            Sumber: menu Penugasan Mengajar. Satu guru yang mengampu beberapa mata pelajaran
            terhitung di tiap mata pelajarannya, sehingga jumlah baris di atas bisa lebih besar
            dari jumlah pendidik.
          </p>
        </div>

        {/* ── D. Sarana prasarana ──────────────────────────────────────── */}
        <div style={{ breakInside: "avoid" }}>
          <p className={judul}>D. Sarana &amp; Prasarana</p>
          <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>No</th><th className={th}>Kategori</th><th className={th}>Jumlah</th>
                <th className={th}>Kondisi Baik</th><th className={th}>Perlu Perbaikan</th>
              </tr>
            </thead>
            <tbody>
              {sarana.length === 0 ? (
                <tr><td className={`${td} text-center`} colSpan={5}>Belum ada data inventaris.</td></tr>
              ) : sarana.map(([kat, v], i) => (
                <tr key={kat}>
                  <td className={`${td} text-center w-[6%]`}>{i + 1}</td>
                  <td className={td}>{kat}</td>
                  <td className={`${td} text-center w-[14%]`}>{v.jumlah}</td>
                  <td className={`${td} text-center w-[16%]`}>{v.baik}</td>
                  <td className={`${td} text-center w-[18%]`}>{v.rusak}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="text-xs print:text-[9px] text-gray-500 mt-1">
            Sumber: menu Inventaris Barang. Kondisi &quot;perlu perbaikan&quot; mencakup {KONDISI_LABEL.RUSAK_RINGAN} dan {KONDISI_LABEL.RUSAK_BERAT}.
          </p>
        </div>

        {/* ── E. Lulusan & keterserapan ────────────────────────────────── */}
        <div style={{ breakInside: "avoid" }}>
          <p className={judul}>E. Lulusan &amp; Keterserapan Alumni</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2 [&>*]:min-w-0">
            <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
              <thead>
                <tr><th className={th}>Tahun Kelulusan</th><th className={th}>Jumlah Lulusan</th></tr>
              </thead>
              <tbody>
                {lulusanPerTahun.length === 0 ? (
                  <tr><td className={`${td} text-center`} colSpan={2}>Belum ada tahun kelulusan yang tercatat.</td></tr>
                ) : lulusanPerTahun.map(l => (
                  <tr key={l.tahun}>
                    <td className={`${td} text-center`}>{l.tahun}</td>
                    <td className={`${td} text-center font-semibold`}>{l.jumlah}</td>
                  </tr>
                ))}
                {lulusanTanpaTanggal > 0 && (
                  <tr>
                    <td className={`${td} text-center text-amber-700`}>Tahun lulus belum diisi</td>
                    <td className={`${td} text-center font-semibold text-amber-700`}>{lulusanTanpaTanggal}</td>
                  </tr>
                )}
                <tr className="font-bold">
                  <td className={`${td} text-center`}>Total Alumni Tercatat</td>
                  <td className={`${td} text-center`}>{alumni.length}</td>
                </tr>
              </tbody>
            </table></div>

            <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse">
              <thead>
                <tr><th className={th}>Status Alumni</th><th className={th}>Jumlah</th></tr>
              </thead>
              <tbody>
                {tracerRekap.length === 0 ? (
                  <tr><td className={`${td} text-center`} colSpan={2}>Belum ada data Tracer Study.</td></tr>
                ) : tracerRekap.map(([st, jml]) => (
                  <tr key={st}>
                    <td className={td}>{TRACER_LABEL[st] ?? st}</td>
                    <td className={`${td} text-center font-semibold`}>{jml}</td>
                  </tr>
                ))}
                {tracerRekap.length > 0 && (
                  <tr className="font-bold">
                    <td className={td}>Total Terlacak</td>
                    <td className={`${td} text-center`}>{tracer.length}</td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
          <p className="text-xs print:text-[9px] text-gray-500 mt-1">
            Sumber lulusan: tanggal kelulusan di Buku Induk.
            {lulusanTanpaTanggal > 0
              ? ` ${lulusanTanpaTanggal} alumni belum diisi tanggal lulusnya sehingga belum masuk ke tahun mana pun — bisa dilengkapi lewat Buku Induk atau ditelusuri di menu Pemeriksa Data.`
              : ""}
            {" "}Sumber keterserapan: menu Tracer Study Alumni — alumni yang belum disurvei tidak terhitung di tabel kanan.
          </p>
        </div>

        <div className="text-xs text-right pr-8 mt-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <GambarTtd src={ttdKepala} tinggi={48} />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
