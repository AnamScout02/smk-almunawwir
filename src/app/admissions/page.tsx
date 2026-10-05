import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdmissionsTabSection from "@/components/sections/AdmissionsTabSection";
import GaleriPromosi from "@/components/spmb/GaleriPromosi";
import PosterSpmb from "@/components/spmb/PosterSpmb";
import TanyaJawabSpmb from "@/components/spmb/TanyaJawabSpmb";
import HitungMundurSpmb from "@/components/spmb/HitungMundurSpmb";
import ParallaxSpmb from "@/components/spmb/ParallaxSpmb";
import StatCounter from "@/components/sections/StatCounter";
import TeksGerak from "@/components/gerak/TeksGerak";
import KuisJurusanSpmb from "@/components/spmb/KuisJurusanSpmb";
import JejakKunjung from "@/components/spmb/JejakKunjung";
import { susunKuis } from "@/lib/kuis-jurusan";
import { peringkatPerujuk, pendaftarSejak } from "@/lib/spmb-statistik";
import { samarkanNama, LABEL_JENIS } from "@/lib/spmb-perujuk";
import type { Metadata } from "next";
import { themeGradient } from "@/lib/color";
import { transisiJurusan } from "@/lib/nama-transisi";
import StoryGaleri from "@/components/gerak/StoryGaleri";
import DeretLogo from "@/components/gerak/DeretLogo";
import BandingGambar from "@/components/gerak/BandingGambar";
import TombolBagikan from "@/components/shared/TombolBagikan";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { bacaKontenSpmb, cocokJurusan, gayaTema, idYoutube, tema, KUNCI_KONTEN_SPMB } from "@/lib/spmb-konten";
import { CheckCircle2, FileDown, MessageCircle, CalendarClock, CalendarCheck, Sparkles, HelpCircle, Wallet, Megaphone, Receipt, Route, Users2, ArrowRight, GraduationCap, MessagesSquare } from "lucide-react";

export const dynamic = "force-dynamic";

// Judul & keterangan saat tautan dibagikan (WA/IG); gambarnya dari opengraph-image.tsx di folder ini.
export const metadata: Metadata = {
  title: "SPMB — Penerimaan Murid Baru",
  description: "Daftar online SMK Al Munawwir IIBS: jadwal gelombang, sisa kursi per jurusan, syarat, beasiswa, dan formulir pendaftaran.",
  openGraph: {
    title: "SPMB SMK Al Munawwir IIBS — Pendaftaran Online",
    description: "Lihat gelombang yang dibuka, sisa kursi per jurusan, dan daftar langsung dari HP.",
    type: "website", locale: "id_ID",
  },
};

/** HALAMAN SPMB PUBLIK — tampilannya SENGAJA berbeda dari halaman lain (permintaan user
 *  1 Oktober 2026: "di web ketika pilih spmb, tampilannya juga berbeda lebih keren"): satu
 *  lembar bertema gelap dengan poster, gelombang, galeri, dan formulir di dalamnya.
 *  SELURUH isinya dari portal /pusat-spmb — tidak ada alur/syarat/beasiswa yang tertulis mati
 *  di berkas ini lagi (dulu panitia tidak bisa mengubah satu kata pun tanpa deploy). */

const TEKS = {
  id: {
    daftar: "Daftar Sekarang", status: "Cek Status", poster: "Lihat Poster", brosur: "Unduh Brosur",
    wa: "Tanya Panitia", gelombang: "Gelombang Pendaftaran", dibuka: "Dibuka", ditutup: "Ditutup",
    berjalan: "Sedang dibuka", terjadwal: "Akan dibuka", selesai: "Sudah ditutup",
    biaya: "Biaya pendaftaran", gratis: "Gratis", kuota: "Kuota", sisa: "tersisa",
    alur: "Alur Pendaftaran", syarat: "Persyaratan", beasiswa: "Program Beasiswa",
    galeri: "Galeri Promosi", tanya: "Tanya Jawab", video: "Video Profil",
    tutupSemua: "Pendaftaran sedang tutup", tutupKet: "Pantau halaman ini — gelombang berikutnya akan tampil di sini.",
    pengumuman: "Pengumuman hasil", biayaKet: "Biaya",
    jadwal: "Jadwal Penting", menyusul: "Menyusul",
    rincian: "Rincian Biaya", total: "Total", jalurJudul: "Jalur Pendaftaran",
    grup: "Gabung Grup WhatsApp Pendaftar",
    mundurTutup: "Pendaftaran ditutup dalam", mundurBuka: "Pendaftaran dibuka dalam",
    satuan: ["Hari", "Jam", "Menit", "Detik"],
    angkaSiswa: "Siswa aktif", angkaAlumni: "Alumni", angkaJurusan: "Konsentrasi keahlian", angkaKursi: "Kursi tersedia",
    jurusanLabel: "Konsentrasi Keahlian", jurusanJudul: "Pilih jalan masa depanmu",
    kursi: "kursi", dari: "dari", pelajari: "Pelajari", kuotaKet: "Sisa kursi",
    waSingkat: "Tanya WA",
    terbaru: (n: number) => `${n} calon murid mendaftar dalam 7 hari terakhir`,
    duta: "Duta SPMB", dutaKet: "Siswa, guru, dan sahabat sekolah yang paling banyak mengajak calon murid.", ajak: "pendaftar",
    locale: "id-ID",
  },
  en: {
    daftar: "Register Now", status: "Check Status", poster: "View Poster", brosur: "Download Brochure",
    wa: "Ask the Committee", gelombang: "Registration Waves", dibuka: "Opens", ditutup: "Closes",
    berjalan: "Open now", terjadwal: "Upcoming", selesai: "Closed",
    biaya: "Registration fee", gratis: "Free", kuota: "Quota", sisa: "left",
    alur: "Registration Steps", syarat: "Requirements", beasiswa: "Scholarships",
    galeri: "Gallery", tanya: "FAQ", video: "Profile Video",
    tutupSemua: "Registration is currently closed", tutupKet: "Keep an eye on this page — the next wave will appear here.",
    pengumuman: "Results announced", biayaKet: "Fees",
    jadwal: "Key Dates", menyusul: "To be announced",
    rincian: "Fee Breakdown", total: "Total", jalurJudul: "Admission Tracks",
    grup: "Join the Applicants' WhatsApp Group",
    mundurTutup: "Registration closes in", mundurBuka: "Registration opens in",
    satuan: ["Days", "Hours", "Min", "Sec"],
    angkaSiswa: "Active students", angkaAlumni: "Alumni", angkaJurusan: "Study programs", angkaKursi: "Seats available",
    jurusanLabel: "Study Programs", jurusanJudul: "Choose your future path",
    kursi: "seats", dari: "of", pelajari: "Explore", kuotaKet: "Seats left",
    waSingkat: "Ask on WA",
    terbaru: (n: number) => `${n} students registered in the last 7 days`,
    duta: "SPMB Ambassadors", dutaKet: "Students, teachers, and friends of the school who referred the most applicants.", ajak: "applicants",
    locale: "en-US",
  },
} as const;

export default async function AdmissionsPage() {
  const lang = await getLang();
  const t = TEKS[lang];

  const [s, gelombang, siswaAktif, alumni, jurusan, terbaru, duta] = await Promise.all([
    getSettings([...KUNCI_KONTEN_SPMB, "school.name"]),
    prisma.gelombangSpmb.findMany({
      where: { aktif: true },
      orderBy: { urutan: "asc" },
      include: { kuota: true, _count: { select: { pendaftar: true } } },
    }).catch(() => []),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.student.count({ where: { studentStatus: "LULUS" } }).catch(() => 0),
    prisma.major.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, tagline: true, description: true, themeColor: true, logoUrl: true,
        skills: true, career: true, features: true,
        gallery: { orderBy: { order: "asc" }, take: 1, select: { imageUrl: true } } },
    }).catch(() => []),
    pendaftarSejak(7),
    peringkatPerujuk(10),
  ]);
  const soalKuis = susunKuis(jurusan);

  const k = bacaKontenSpmb(s);
  // Story = galeri promosi yang sudah diunggah panitia (satu galeri satu lingkaran).
  const story = [
    ...(k.fotoPromosi.length ? [{ judul: k.judulGaleri || t.galeri, foto: k.fotoPromosi }] : []),
    ...k.galeriLain.map(g => ({ judul: g.judul || t.galeri, foto: g.foto })),
  ];
  const w = tema(k.tema);
  const idVideo = idYoutube(k.video);
  const kini = Date.now();
  const dibuka = gelombang.find(g => g.buka.getTime() <= kini && g.tutup.getTime() >= kini) ?? null;
  const berikutnya = dibuka ? null
    : [...gelombang].filter(g => g.buka.getTime() > kini).sort((a, b) => a.buka.getTime() - b.buka.getTime())[0] ?? null;

  // Kuota per jurusan dari gelombang yang SEDANG dibuka (atau berikutnya bila semua tutup).
  // Pendaftar dihitung dengan aturan yang SAMA dengan pemeriksa kuota POST /api/admissions —
  // status ditolak tidak memakan kursi, dan label jurusan dicocokkan lewat cocokJurusan (#102).
  const acuan = dibuka ?? berikutnya;
  const pendaftarAcuan = acuan
    ? await prisma.admission.findMany({
        where: { gelombangId: acuan.id, status: { notIn: ["DITOLAK", "REJECTED"] } },
        select: { chosenMajor: true },
      }).catch(() => [])
    : [];
  const kuotaJurusan = new Map(jurusan.map(m => {
    const kuota = acuan?.kuota.find(x => x.majorId === m.id)?.kuota ?? 0;
    const terisi = pendaftarAcuan.filter(a => cocokJurusan(a.chosenMajor, m)).length;
    return [m.id, kuota ? { kuota, sisa: Math.max(0, kuota - terisi) } : null] as const;
  }));
  const kursiTotal = [...kuotaJurusan.values()].reduce((a, x) => a + (x?.sisa ?? 0), 0);

  // WIB, bukan jam server (UTC): gelombang dibuka 00.00 WIB tersimpan 17.00 UTC HARI SEBELUMNYA (CLAUDE.md #42).
  const tgl = (d: Date) => d.toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <>
      <Navbar />
      {/* Pembungkus tema: variabel warnanya dipetakan ke bagian terang halaman & Footer oleh
          blok `.tema-spmb` di globals.css. */}
      <div className="tema-spmb" style={gayaTema(k.tema)}>
      <main className="min-h-dvh bg-cream">
        {/* Pemberitahuan panitia — hanya tampil bila diisi di portal. */}
        {k.catatan && (
          <div className="spmb-kilau bg-gold/15 pt-20">
            <div className="container-custom flex items-start gap-3 py-3.5">
              <Megaphone size={18} className="mt-0.5 shrink-0 text-gold-dark" />
              <p className="text-sm font-medium leading-relaxed text-primary-900">{k.catatan}</p>
            </div>
          </div>
        )}

        {/* ====== Lembar bertema: pembuka + poster + gelombang ====== */}
        <section className={`tekstur-noise relative overflow-hidden bg-gradient-to-br ${w.latar} ${w.teks}`}>
          <div className="latar-aurora" aria-hidden />
          <ParallaxSpmb />
          <JejakKunjung />
          {/* Motif & cahaya bergerak lebih lambat dari isi saat digulir (parallax, layar lebar saja).
              Lapisan motif diperpanjang ke bawah supaya tidak tampak tepi saat bergeser. */}
          <div data-parallax="0.3" className="pointer-events-none absolute inset-x-0 top-0 -bottom-[40vh] opacity-[0.07]"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px",
              ...(w.polaInvert ? { filter: "invert(1)" } : {}) }} />
          <div data-parallax="0.5" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, currentColor 0%, transparent 70%)" }} />

          <div className={`container-custom relative pb-14 ${k.catatan ? "pt-12" : "pt-28"}`}>
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${w.kaca} ${w.aksen}`}>
                  <Sparkles size={13} /> SPMB {k.tahun}
                </span>
                <h1 className="gerak-judul-awal font-heading mt-4 text-4xl font-bold leading-tight text-balance md:text-5xl"><TeksGerak teks={k.judul} /></h1>
                {k.subjudul && <p className={`mt-2 text-lg font-medium ${w.aksen}`}>{k.subjudul}</p>}
                {k.deskripsi && <p className={`mt-4 max-w-xl text-base leading-relaxed ${w.lembut}`}>{k.deskripsi}</p>}

                <div className="mt-7 flex flex-wrap gap-3">
                  {/* Saat tutup, "Daftar Sekarang" tidak ditampilkan dan Cek Status naik jadi tombol utama. */}
                  {dibuka && (
                    <a href="#formulir" className={`spmb-kilau sentuh inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:brightness-110 ${w.aksenBg} ${w.aksenTeks}`}>
                      {t.daftar}
                    </a>
                  )}
                  <a href="#cek-status" className={dibuka
                    ? `sentuh inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold ${w.teks} transition ${w.kacaHover} ${w.kaca}`
                    : `sentuh inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:brightness-110 ${w.aksenBg} ${w.aksenTeks}`}>
                    {t.status}
                  </a>
                  {k.brosur && (
                    <a href={k.brosur} target="_blank" rel="noopener"
                      className={`sentuh inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold ${w.teks} transition ${w.kacaHover} ${w.kaca}`}>
                      <FileDown size={16} /> {t.brosur}
                    </a>
                  )}
                  <TombolBagikan judul={`SPMB ${k.tahun} — ${s["school.name"] || "SMK Al Munawwir IIBS"}`} label={lang === "id" ? "Bagikan" : "Share"}
                    className={`sentuh inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold ${w.teks} transition ${w.kacaHover} ${w.kaca}`} />
                </div>

                {dibuka ? (
                  <div className={`mt-7 inline-flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-5 py-3.5 text-sm ${w.kaca}`}>
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" /> {dibuka.nama}
                    </span>
                    <span className={w.lembut}>{t.ditutup} <span className={`font-semibold ${w.teks}`}>{tgl(dibuka.tutup)}</span></span>
                    <span className={w.lembut}>{t.biayaKet}: <span className={`font-semibold ${w.teks}`}>{dibuka.biayaDaftar ? "Rp " + dibuka.biayaDaftar.toLocaleString("id-ID") : t.gratis}</span></span>
                  </div>
                ) : (
                  <div className={`mt-7 inline-flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-sm ${w.kaca}`}>
                    <CalendarClock size={16} className="shrink-0" />
                    <span><span className="font-semibold">{t.tutupSemua}.</span> <span className={w.lembut}>{t.tutupKet}</span></span>
                  </div>
                )}

                {(dibuka || berikutnya) && (
                  <HitungMundurSpmb
                    target={(dibuka ? dibuka.tutup : berikutnya!.buka).toISOString()}
                    judul={`${dibuka ? t.mundurTutup : t.mundurBuka}${dibuka ? "" : ` — ${berikutnya!.nama}`}`}
                    satuan={[...t.satuan] as [string, string, string, string]}
                    kelasKotak={w.kaca} kelasLabel={w.aksen} />
                )}

                {terbaru > 0 && (
                  <p className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${w.kaca}`}>
                    <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="angka font-semibold">{t.terbaru(terbaru)}</span>
                  </p>
                )}
              </div>

              {/* Poster — satu tampil diam, dua atau lebih berganti sendiri. */}
              {k.posters.length > 0 && (
                <div className="lg:col-span-5">
                  <PosterSpmb posters={k.posters} alt={`Poster SPMB ${k.tahun}`} cincin={w.cincin} rasioTetap={k.posterRasio} isi={k.posterIsi} />
                  <a href={k.posters[0]} target="_blank" rel="noopener"
                    className={`mt-3 block text-center text-xs font-semibold ${w.samar} underline transition`}>
                    {t.poster}
                  </a>
                </div>
              )}
            </div>

            {/* Pita angka — HANYA angka dari data sungguhan (bukan nilai bawaan pengaturan). */}
            <div className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { n: siswaAktif, l: t.angkaSiswa },
                { n: alumni, l: t.angkaAlumni },
                { n: jurusan.length, l: t.angkaJurusan },
                ...(kursiTotal ? [{ n: kursiTotal, l: t.angkaKursi }] : []),
              ].filter(x => x.n > 0).map((x, i) => (
                <div key={x.l} style={{ ["--tunda" as string]: `${i * 100}ms` }}
                  className={`gerak-naik sorot-kursor rounded-2xl border px-5 py-4 ${w.kaca}`}>
                  <p className={`angka font-heading text-3xl font-bold md:text-4xl ${w.aksen}`}><StatCounter target={x.n} suffix="" /></p>
                  <p className={`mt-1 text-sm ${w.lembut}`}>{x.l}</p>
                </div>
              ))}
            </div>

            {/* Story — galeri promosi sebagai lingkaran cerita (diketuk → layar penuh). */}
            {story.length > 0 && <div className="mt-10"><StoryGaleri story={story} /></div>}

            {/* Gelombang */}
            {gelombang.length > 0 && (
              <div className="mt-14">
                <h2 className={`font-heading text-sm font-semibold uppercase tracking-widest ${w.aksen}`}>{t.gelombang}</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {gelombang.map((g, i) => {
                    const mulai = g.buka.getTime(), akhir = g.tutup.getTime();
                    const keadaan = akhir < kini ? "selesai" : mulai > kini ? "terjadwal" : "berjalan";
                    const totalKuota = g.kuota.reduce((a, x) => a + x.kuota, 0);
                    const sisa = totalKuota ? Math.max(0, totalKuota - g._count.pendaftar) : null;
                    return (
                      <div key={g.id} style={{ animationDelay: `${i * 90}ms` }}
                        className={`spmb-muncul spmb-kartu sorot-kursor rounded-2xl border p-5 ${w.kaca} ${keadaan === "berjalan" ? `spmb-denyut ring-2 ${w.cincin}` : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-heading min-w-0 font-semibold">{g.nama}</p>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${
                            keadaan === "berjalan" ? `${w.aksenBg} ${w.aksenTeks}` : `${w.kacaIsi} ${w.lembut}`}`}>
                            {keadaan === "berjalan" ? t.berjalan : keadaan === "terjadwal" ? t.terjadwal : t.selesai}
                          </span>
                        </div>
                        {g.catatan && <p className={`mt-1 text-xs ${w.samar}`}>{g.catatan}</p>}
                        <dl className="mt-4 space-y-1.5 text-sm">
                          <div className="flex justify-between gap-3"><dt className={w.samar}>{t.dibuka}</dt><dd className="angka font-medium">{tgl(g.buka)}</dd></div>
                          <div className="flex justify-between gap-3"><dt className={w.samar}>{t.ditutup}</dt><dd className="angka font-medium">{tgl(g.tutup)}</dd></div>
                          <div className="flex justify-between gap-3"><dt className={w.samar}>{t.biaya}</dt>
                            <dd className="angka font-medium">{g.biayaDaftar ? "Rp " + g.biayaDaftar.toLocaleString("id-ID") : t.gratis}</dd></div>
                          {sisa !== null && (
                            <div className="flex justify-between gap-3"><dt className={w.samar}>{t.kuota}</dt>
                              <dd className="angka font-medium"><StatCounter target={sisa} suffix="" /> / {totalKuota} {t.sisa}</dd></div>
                          )}
                        </dl>
                        {sisa !== null && totalKuota > 0 && (
                          <div className={`gerak-batang mt-3 h-1.5 overflow-hidden rounded-full ${w.kacaIsi}`}
                            style={{ ["--tunda" as string]: `${300 + i * 120}ms` }}>
                            <span className={`block h-full rounded-full ${w.aksenBg}`} style={{ width: `${(sisa / totalKuota) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Jadwal penting */}
            {k.jadwal.length > 0 && (
              <div className="mt-14">
                <h2 className={`font-heading text-sm font-semibold uppercase tracking-widest ${w.aksen}`}>{t.jadwal}</h2>
                <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {k.jadwal.map((a, i) => (
                    <li key={i} style={{ animationDelay: `${i * 70}ms` }}
                      className={`spmb-muncul flex items-center gap-3 rounded-2xl border px-4 py-3 ${w.kaca}`}>
                      <span className={`angka flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${w.aksenBg} ${w.aksenTeks}`}>{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{a.label}</span>
                        <span className={`angka block text-sm ${w.lembut}`}>
                          {a.tanggal ? tgl(new Date(a.tanggal + "T00:00:00+07:00")) : t.menyusul}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Jalur pendaftaran */}
            {k.jalur.length > 0 && (
              <div className="mt-14">
                <h2 className={`font-heading flex items-center gap-2 text-sm font-semibold uppercase tracking-widest ${w.aksen}`}>
                  <Route size={14} /> {t.jalurJudul}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {k.jalur.map((j, i) => (
                    <div key={j.kode} style={{ animationDelay: `${i * 70}ms` }}
                      className={`spmb-muncul spmb-kartu rounded-2xl border p-4 ${w.kaca}`}>
                      <p className="font-heading text-sm font-semibold">{j.nama}</p>
                      {j.keterangan && <p className={`mt-1 text-sm leading-relaxed ${w.lembut}`}>{j.keterangan}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Galeri promosi */}
            {k.fotoPromosi.length > 0 && (
              <div className="mt-14">
                <h2 className={`font-heading mb-4 text-sm font-semibold uppercase tracking-widest ${w.aksen}`}>{k.judulGaleri || t.galeri}</h2>
                <GaleriPromosi foto={k.fotoPromosi} rasio={k.fotoRasio} isi={k.fotoIsi} />
              </div>
            )}

            {/* Galeri tambahan — masing-masing berjudul & berbentuk sendiri (diatur di Pusat SPMB). */}
            {k.galeriLain.map((g, gi) => (
              <div key={gi} className="mt-14">
                <h2 className={`font-heading mb-4 text-sm font-semibold uppercase tracking-widest ${w.aksen}`}>{g.judul || t.galeri}</h2>
                <GaleriPromosi foto={g.foto} rasio={g.rasio} isi={g.isi} />
              </div>
            ))}
          </div>
        </section>


        {/* ====== Etalase jurusan + sisa kursi ====== */}
        {jurusan.length > 0 && (
          <section className="section-padding bg-cream">
            <div className="container-custom">
              <div className="text-center">
                <span className="text-sm font-semibold uppercase tracking-widest text-gold-dark">{t.jurusanLabel}</span>
                <h2 className="gerak-judul font-heading mt-2 text-3xl font-bold text-navy md:text-4xl"><TeksGerak teks={t.jurusanJudul} /></h2>
              </div>
              <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {jurusan.map((m, i) => {
                  const kq = kuotaJurusan.get(m.id);
                  const foto = m.gallery[0]?.imageUrl;
                  return (
                    <a key={m.id} href={`/programs/${m.code.toLowerCase()}`}
                      style={{ ["--tunda" as string]: `${(i % 3) * 110}ms` }}
                      className="gerak-naik sorot-kursor group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="gerak-ungkap kilau relative h-40"
                        style={{ background: m.themeColor ? themeGradient(m.themeColor) : undefined, ["--tunda" as string]: `${(i % 3) * 110 + 150}ms`, viewTransitionName: transisiJurusan(m.code) }}>
                        {foto ? (
                          <Image src={foto} alt={m.name} fill sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover transition duration-700 group-hover:scale-105" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-700 to-primary-900 text-white/90"
                            style={m.themeColor ? { background: themeGradient(m.themeColor) } : undefined}>
                            {m.logoUrl
                              ? <Image src={m.logoUrl} alt="" width={72} height={72} className="h-[72px] w-[72px] object-contain" />
                              : <GraduationCap size={44} />}
                          </span>
                        )}
                        <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold tracking-wide text-white">{m.code}</span>
                      </div>
                      <div className="p-5">
                        <h3 className="font-heading text-base font-semibold leading-snug text-navy">{m.name}</h3>
                        {(m.tagline || m.description) && (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">{m.tagline || m.description}</p>
                        )}
                        {kq && (
                          <div className="mt-4">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">{t.kuotaKet}</span>
                              <span className="angka font-semibold text-navy">
                                <StatCounter target={kq.sisa} suffix="" /> {t.dari} {kq.kuota} {t.kursi}
                              </span>
                            </div>
                            <div className="gerak-batang mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"
                              style={{ ["--tunda" as string]: `${400 + (i % 3) * 120}ms` }}>
                              <span className={`block h-full rounded-full ${kq.sisa / kq.kuota < 0.25 ? "bg-red-500" : "bg-emerald-500"}`}
                                style={{ width: `${(kq.sisa / kq.kuota) * 100}%` }} />
                            </div>
                          </div>
                        )}
                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 transition-all group-hover:gap-2.5">
                          {t.pelajari} <ArrowRight size={15} />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>

              {soalKuis.length >= 2 && (
                <div className="mt-12">
                  <KuisJurusanSpmb lang={lang} soal={soalKuis} formTerbuka={!!dibuka}
                    jurusan={jurusan.map(m => ({ code: m.code, name: m.name, tagline: m.tagline, career: m.career, themeColor: m.themeColor }))} />
                </div>
              )}

              {/* Duta SPMB — peringkat perujuk. Nama DISAMARKAN (spmb-perujuk.ts samarkanNama): halaman
                  ini terbuka untuk umum. Hanya tampil bila sudah ada pendaftar lewat kode referral. */}
              {duta.length > 0 && (
                <div className="mt-12">
                  <h3 className="font-heading text-center text-2xl font-bold text-navy">{t.duta}</h3>
                  <p className="mt-1 text-center text-sm text-gray-500">{t.dutaKet}</p>
                  <ol className="mx-auto mt-6 max-w-2xl space-y-2">
                    {duta.map((d, i) => (
                      <li key={d.id} style={{ ["--tunda" as string]: `${i * 70}ms` }}
                        className="gerak-naik flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
                        <span className={`angka font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0 ? "bg-gold text-primary-900" : i < 3 ? "bg-primary-900 text-gold" : "bg-gray-100 text-gray-500"}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy">{samarkanNama(d.nama)}</span>
                          <span className="block text-xs text-gray-400">{LABEL_JENIS[d.jenis] ?? d.jenis}</span>
                        </span>
                        <span className="angka text-sm font-bold text-primary-700">{d.jumlah} <span className="font-normal text-gray-400">{t.ajak}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ====== Alur — garis waktu: garisnya tergambar saat digulir, nomor langkah menyala bergiliran.
             HP: satu kolom dengan garis di kiri. Layar lebar: zig-zag kiri-kanan dengan garis di tengah. */}
        {k.alur.length > 0 && (
          <section className="section-padding bg-white">
            <div className="container-custom max-w-5xl">
              <h2 className="gerak-judul font-heading text-center text-3xl font-bold text-navy md:text-4xl"><TeksGerak teks={t.alur} /></h2>
              <ol className="gerak-alur relative mt-12">
                <span aria-hidden className="garis-alur absolute bottom-6 left-5 top-6 w-0.5 bg-gradient-to-b from-gold via-gold/70 to-primary-700 lg:left-1/2 lg:-translate-x-1/2" />
                {k.alur.map((l, i) => {
                  const kanan = i % 2 === 1;
                  return (
                    <li key={i} className="relative pb-8 pl-16 last:pb-0 lg:grid lg:grid-cols-2 lg:gap-16 lg:pl-0">
                      <span style={{ ["--i" as string]: i }}
                        className="titik-alur angka font-heading absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary-900 text-sm font-bold text-gold ring-4 ring-white lg:left-1/2 lg:-translate-x-1/2">
                        {i + 1}
                      </span>
                      <div style={{ ["--tunda" as string]: `${i * 120}ms` }}
                        className={`gerak-naik spmb-kartu overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ${kanan ? "lg:col-start-2" : "lg:col-start-1"}`}>
                        {/* Gambar OPSIONAL — langkah tanpa gambar tetap rapi sejajar dengan yang bergambar. */}
                        {l.gambar && (
                          <div className="relative h-36 w-full">
                            <Image src={l.gambar} alt={l.judul} fill className="object-cover" />
                          </div>
                        )}
                        <div className={`p-5 ${kanan ? "" : "lg:text-right"}`}>
                          <h3 className="font-heading text-base font-semibold text-navy">{l.judul}</h3>
                          {l.isi && <p className="mt-2 text-sm leading-relaxed text-gray-500">{l.isi}</p>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}

        <DeretLogo logo={k.logoMitra} judul={k.judulLogo || (lang === "id" ? "Mitra Industri & Kampus Alumni" : "Industry Partners & Alumni Universities")} gelap />

        {/* ====== Sebelum & sesudah (karya siswa, renovasi) — diatur di Pusat SPMB → Poster & Promosi ====== */}
        {k.sebelumSesudah.length > 0 && (
          <section className="tekstur-noise section-padding relative overflow-hidden bg-primary-900">
            <div className="container-custom relative">
              <h2 className="gerak-judul font-heading text-center text-3xl font-bold text-white md:text-4xl">
                <TeksGerak teks={lang === "id" ? "Lihat Perubahannya" : "See the Difference"} />
              </h2>
              <p className="mt-2 text-center text-sm text-white/60">{lang === "id" ? "Geser garis di tengah foto untuk membandingkan." : "Drag the line across the photo to compare."}</p>
              <div className={`mt-10 grid grid-cols-1 gap-8 ${k.sebelumSesudah.length > 1 ? "lg:grid-cols-2" : "mx-auto max-w-3xl"}`}>
                {k.sebelumSesudah.map((b, i) => (
                  <figure key={i} className="gerak-naik" style={{ ["--tunda" as string]: `${(i % 2) * 120}ms` }}>
                    <BandingGambar sebelum={b.sebelum} sesudah={b.sesudah} labelA={b.labelA} labelB={b.labelB} judul={b.judul} />
                    {(b.judul || b.ket) && (
                      <figcaption className="mt-3">
                        {b.judul && <p className="font-heading text-base font-semibold text-white">{b.judul}</p>}
                        {b.ket && <p className="mt-1 text-sm text-white/60">{b.ket}</p>}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====== Syarat + Beasiswa + Formulir ====== */}
        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              <div className="min-w-0">
                {k.syarat.length > 0 && (
                  <>
                    <h2 className="font-heading mb-6 text-2xl font-bold text-navy">{t.syarat}</h2>
                    <ul className="mb-8 space-y-3">
                      {k.syarat.map(r => (
                        <li key={r} className="flex items-start gap-3 text-sm text-gray-600">
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary-700" /> {r}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {k.beasiswa.length > 0 && (
                  <div className={`relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br p-6 ${w.teks} ${w.latar}`}>
                    <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
                      style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px",
                        ...(w.polaInvert ? { filter: "invert(1)" } : {}) }} />
                    <div className="relative">
                      <h3 className={`font-heading mb-4 text-lg font-bold ${w.aksen}`}>{t.beasiswa}</h3>
                      <ul className="space-y-3">
                        {k.beasiswa.map((b, i) => (
                          <li key={i}>
                            <p className="text-sm font-semibold">{b.judul}</p>
                            {b.isi && <p className={`text-sm ${w.lembut}`}>{b.isi}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {k.rincianBiaya.length > 0 && (
                  <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                      <Receipt size={15} className="text-primary-700" />
                      <p className="font-heading text-sm font-semibold text-navy">{t.rincian}</p>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full">
                      <tbody>
                        {k.rincianBiaya.map((b, i) => (
                          <tr key={i} className="border-b border-gray-50 last:border-0">
                            <td className="px-5 py-2.5 text-sm text-gray-600">{b.nama}</td>
                            <td className="angka px-5 py-2.5 text-right text-sm font-medium text-navy">Rp {b.jumlah.toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                        <tr className="bg-cream">
                          <th scope="row" className="px-5 py-2.5 text-left text-sm font-semibold text-navy">{t.total}</th>
                          <td className="angka px-5 py-2.5 text-right text-sm font-bold text-navy">
                            Rp {k.rincianBiaya.reduce((a, b) => a + b.jumlah, 0).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {(k.biaya || k.pengumumanTanggal || k.kontakWa || k.tautanGrup) && (
                  <div className="mt-6 space-y-3">
                    {k.pengumumanTanggal && (
                      <p className="flex items-start gap-2 text-sm text-gray-600">
                        <CalendarCheck size={16} className="mt-0.5 shrink-0 text-primary-700" />
                        {t.pengumuman}: <span className="font-semibold text-navy">{tgl(new Date(k.pengumumanTanggal + "T00:00:00+07:00"))}</span>
                      </p>
                    )}
                    {k.biaya && (
                      <p className="flex items-start gap-2 text-sm text-gray-600">
                        <Wallet size={16} className="mt-0.5 shrink-0 text-primary-700" /> {k.biaya}
                      </p>
                    )}
                    {k.kontakWa && (
                      <a href={`https://wa.me/${k.kontakWa}`} target="_blank" rel="noopener" className="btn-modal-cancel">
                        <MessageCircle size={16} /> {t.wa} — {k.kontakNama}
                      </a>
                    )}
                    {k.tautanGrup && (
                      <a href={k.tautanGrup} target="_blank" rel="noopener" className="btn-modal-cancel">
                        <Users2 size={16} /> {t.grup}
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="relative min-w-0 scroll-mt-24" id="formulir">
                {/* Sasaran gulir tombol "Cek Status" — tabnya dipilih AdmissionsTabSection dari hash. */}
                <span id="cek-status" className="absolute -top-24" aria-hidden />
                <AdmissionsTabSection lang={lang}
                  tutup={dibuka ? null : { berikutnya: berikutnya ? { nama: berikutnya.nama, buka: tgl(berikutnya.buka) } : null }} />
              </div>
            </div>
          </div>
        </section>

        {/* ====== Video ====== */}
        {idVideo && (
          <section className="section-padding bg-white">
            <div className="container-custom max-w-3xl">
              <h2 className="font-heading mb-6 text-center text-2xl font-bold text-navy">{t.video}</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-gray-100">
                <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${idVideo}`}
                  title={t.video} allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
              </div>
            </div>
          </section>
        )}

        {/* ====== Tanya jawab ====== */}
        {k.tanyaJawab.length > 0 && (
          <section className="section-padding bg-cream">
            <div className="container-custom max-w-3xl">
              <h2 className="font-heading mb-6 flex items-center justify-center gap-2 text-center text-2xl font-bold text-navy">
                <HelpCircle size={22} className="text-primary-700" /> {t.tanya}
              </h2>
              <TanyaJawabSpmb items={k.tanyaJawab} />
            </div>
          </section>
        )}
      </main>
      <Footer />

      {/* Bilah daftar menempel di HP — selalu terlihat saat digulir (mayoritas calon membuka dari HP
          lewat tautan WA). Tombol WA melayang situs disembunyikan di sini (WhatsAppButton) supaya tidak
          bertumpuk. Ruang setinggi bilah disisakan di bawah Footer supaya isi terakhir tidak tertutup. */}
      <div aria-hidden className="h-[calc(4.75rem+env(safe-area-inset-bottom))] bg-primary-900 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-primary-900/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden print:hidden">
        <div className="mx-auto flex max-w-md gap-2.5">
          <a href={dibuka ? "#formulir" : "#cek-status"}
            className={`spmb-kilau sentuh flex flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm font-bold ${w.aksenBg} ${w.aksenTeks}`}>
            {dibuka ? t.daftar : t.status}
          </a>
          {k.kontakWa && (
            <a href={`https://wa.me/${k.kontakWa}`} target="_blank" rel="noopener"
              className="sentuh flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white">
              <MessagesSquare size={16} /> {t.waSingkat}
            </a>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
