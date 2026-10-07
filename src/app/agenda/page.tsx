export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/lang";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata = {
  title: "Agenda Sekolah — SMK Al Munawwir IIBS",
  description: "Kalender pendidikan dan agenda kegiatan SMK Al Munawwir IIBS.",
};

/** Agenda sekolah untuk pengunjung situs.
 *
 * Inilah tujuan centang "Tampil di website" pada Kalender Pendidikan. Sebelum halaman ini ada,
 * kolom `SchoolEvent.tampilPublik` ditulis tapi TIDAK PERNAH dibaca satu pun halaman publik —
 * jadi centangnya tidak berpengaruh apa-apa (temuan user 13 September 2026: "saya cek di website
 * muncul di bagian apa?"). Teks antarmuka mengikuti bahasa situs (cookie `lang`); judul & keterangan agenda
 * tetap seperti yang diketik di Kalender Pendidikan. */

const JENIS: Record<string, { kelas: string; titik: string }> = {
  KBM:      { kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", titik: "#10b981" },
  LIBUR:    { kelas: "bg-red-50 text-red-600 border-red-200",             titik: "#ef4444" },
  UJIAN:    { kelas: "bg-amber-50 text-amber-700 border-amber-200",       titik: "#f59e0b" },
  KEGIATAN: { kelas: "bg-blue-50 text-blue-700 border-blue-200",          titik: "#3b82f6" },
  RAPAT:    { kelas: "bg-purple-50 text-purple-700 border-purple-200",    titik: "#a855f7" },
  PPDB:     { kelas: "bg-gold/15 text-gold-dark border-gold/30",          titik: "#E8A020" },
  LAINNYA:  { kelas: "bg-gray-50 text-gray-600 border-gray-200",          titik: "#9ca3af" },
};

const TEKS = {
  id: {
    label: "Kalender Pendidikan", judul: "Agenda Sekolah", tahun: (n: string) => `Tahun Pelajaran ${n}`,
    kosong: "Belum ada agenda yang dipublikasikan.", akanDatang: "Akan Datang", sudahLewat: "Sudah Berlangsung",
    kembali: "Kembali ke Beranda", locale: "id-ID",
    jenis: { KBM: "KBM", LIBUR: "Libur", UJIAN: "Ujian", KEGIATAN: "Kegiatan", RAPAT: "Rapat", PPDB: "SPMB", LAINNYA: "Lainnya" } as Record<string, string>,
  },
  en: {
    label: "Academic Calendar", judul: "School Agenda", tahun: (n: string) => `Academic Year ${n}`,
    kosong: "No agenda has been published yet.", akanDatang: "Upcoming", sudahLewat: "Past Events",
    kembali: "Back to Home", locale: "en-GB",
    jenis: { KBM: "Classes", LIBUR: "Holiday", UJIAN: "Exam", KEGIATAN: "Activity", RAPAT: "Meeting", PPDB: "Admissions", LAINNYA: "Other" } as Record<string, string>,
  },
};

const tanggal = (d: Date, locale: string, opsi: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleDateString(locale, { ...opsi, timeZone: "UTC" });

function rentang(mulai: Date, selesai: Date, locale: string) {
  const panjang = (d: Date) => tanggal(d, locale, { day: "numeric", month: "long", year: "numeric" });
  const sama = new Date(mulai).toDateString() === new Date(selesai).toDateString();
  return sama ? panjang(mulai) : `${tanggal(mulai, locale, { day: "numeric", month: "short" })} – ${panjang(selesai)}`;
}

export default async function Page() {
  const lang = await getLang();
  const c = TEKS[lang];
  const [tahun, agenda] = await Promise.all([
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { id: true, name: true } }).catch(() => null),
    prisma.schoolEvent.findMany({
      where: { tampilPublik: true },
      orderBy: { tanggalMulai: "asc" },
      select: {
        id: true, judul: true, jenis: true, keterangan: true,
        tanggalMulai: true, tanggalSelesai: true, academicYearId: true,
      },
    }).catch(() => []),
  ]);

  // Hanya agenda tahun ajaran aktif (atau yang belum ditautkan ke tahun mana pun).
  const tampil = agenda.filter(a => !tahun || !a.academicYearId || a.academicYearId === tahun.id);

  // Batas "sudah lewat" memakai tanggal SELESAI, bukan mulai — kegiatan berhari-hari yang sedang
  // berjalan tetap dihitung akan datang sampai hari terakhirnya.
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const akanDatang = tampil.filter(a => new Date(a.tanggalSelesai) >= hariIni);
  const sudahLewat = tampil.filter(a => new Date(a.tanggalSelesai) < hariIni).reverse();

  const perBulan = (daftar: typeof tampil) => {
    const peta = new Map<string, typeof tampil>();
    for (const a of daftar) {
      const k = tanggal(a.tanggalMulai, c.locale, { month: "long", year: "numeric" });
      const ada = peta.get(k);
      if (ada) ada.push(a); else peta.set(k, [a]);
    }
    return [...peta.entries()];
  };

  const Daftar = ({ daftar }: { daftar: typeof tampil }) => (
    <div className="space-y-8">
      {perBulan(daftar).map(([bulan, items]) => (
        <div key={bulan}>
          <h3 className="font-heading font-bold text-primary-900 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gold" /> {bulan}
          </h3>
          <div className="space-y-2">
            {items.map(a => {
              const j = JENIS[a.jenis] ?? JENIS.LAINNYA;
              return (
                <div key={a.id} className="card-premium p-4 flex flex-wrap items-start gap-3">
                  <span className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: j.titik }} />
                  <div className="flex-1 min-w-[12rem]">
                    <p className="font-semibold text-primary-900">{a.judul}</p>
                    {a.keterangan ? <p className="text-sm text-gray-500 mt-0.5">{a.keterangan}</p> : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-primary-700">{rentang(a.tanggalMulai, a.tanggalSelesai, c.locale)}</p>
                    <span className={`badge border mt-1 inline-block ${j.kelas}`}>{c.jenis[a.jenis] ?? c.jenis.LAINNYA}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  // Navbar & Footer diimpor per halaman (pola yang dipakai semua halaman publik lain di app ini,
  // bukan lewat layout bersama). Tanpa ini halaman agenda berdiri telanjang tanpa menu situs.
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
      {/* Header disamakan dengan halaman publik lain (Berita, Galeri, dst): pt-28 memberi ruang untuk navbar yang menempel. */}
      <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="container-custom text-center relative">
          <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.judul}</h1>
          <p className="text-white/70 text-lg">
            {tahun?.name ? c.tahun(tahun.name) : "SMK Al Munawwir IIBS"}
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-12">
        {tampil.length === 0 ? (
          <p className="text-center text-gray-500 py-12">{c.kosong}</p>
        ) : (
          <>
            {akanDatang.length > 0 && (
              <>
                <h2 className="font-heading font-bold text-xl text-primary-900 mb-5">{c.akanDatang}</h2>
                <Daftar daftar={akanDatang} />
              </>
            )}
            {sudahLewat.length > 0 && (
              <>
                <h2 className="font-heading font-bold text-xl text-primary-900 mt-12 mb-5">{c.sudahLewat}</h2>
                <div className="opacity-70"><Daftar daftar={sudahLewat} /></div>
              </>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 transition">
            <ArrowLeft size={16} /> {c.kembali}
          </Link>
        </div>
      </section>
      </main>
      <Footer />
    </>
  );
}
