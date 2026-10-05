export const dynamic = "force-dynamic";

import Image from "next/image";
import { CalendarDays, Trophy, Wallet, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/lang";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LABEL_JENIS, LABEL_TINGKAT, tglEvent, pendaftaranTerbuka, batasDaftar, rupiah } from "@/lib/event-label";

export const metadata = {
  title: "Lomba & Event — SMK Al Munawwir IIBS",
  description: "Lomba, seminar, dan event yang diselenggarakan atau diikuti SMK Al Munawwir IIBS.",
};

const TEKS = {
  id: {
    label: "Lomba & Event", judul: "Ikuti Kegiatannya", sub: "Event yang diselenggarakan sekolah dan lomba yang kami ikuti bersama siswa.",
    buka: "Pendaftaran Dibuka", lewat: "Sudah Ditutup", kosong: "Belum ada lomba atau event yang diumumkan.",
    terbuka: "Dibuka", tutup: "Ditutup", gratis: "Gratis", sampai: "Daftar sampai", umum: "Terbuka untuk umum", siswa: "Untuk siswa sekolah", locale: "id-ID",
  },
  en: {
    label: "Competitions & Events", judul: "Join Our Events", sub: "Events hosted by our school and competitions we join with our students.",
    buka: "Open for Registration", lewat: "Closed", kosong: "No competition or event has been announced yet.",
    terbuka: "Open", tutup: "Closed", gratis: "Free", sampai: "Register by", umum: "Open to public", siswa: "For our students", locale: "en-GB",
  },
};

/** Daftar Lomba & Event untuk pengunjung situs. Hanya event `aktif` + `tampilPublik`; event yang masih
 *  menerima pendaftaran di atas, sisanya (sudah tutup) di bawah sebagai arsip singkat. */
export default async function Page() {
  const lang = await getLang();
  const c = TEKS[lang];
  const daftar = await prisma.event.findMany({
    where: { aktif: true, tampilPublik: true },
    orderBy: [{ tutupDaftar: "asc" }, { createdAt: "desc" }],
    take: 120,
    select: { slug: true, judul: true, penyelenggara: true, milikSekolah: true, jenis: true, tingkat: true, deskripsi: true,
      berbayar: true, biaya: true, mulai: true, tutupDaftar: true, posterUrl: true, aktif: true },
  }).catch(() => []);
  const kini = new Date();
  const buka = daftar.filter(e => pendaftaranTerbuka(e, kini));
  const lewat = daftar.filter(e => !pendaftaranTerbuka(e, kini)).sort((a, b) => (batasDaftar(b.tutupDaftar)?.getTime() ?? 0) - (batasDaftar(a.tutupDaftar)?.getTime() ?? 0)).slice(0, 12);

  const Kartu = ({ e, redup }: { e: (typeof daftar)[number]; redup?: boolean }) => (
    <a href={`/lomba/${e.slug}`} className={`card-premium gerak-naik group flex flex-col overflow-hidden ${redup ? "opacity-70" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700">
        {e.posterUrl
          ? <Image src={e.posterUrl} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
          : <div className="flex h-full items-center justify-center text-white/30"><Trophy size={48} /></div>}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold ${redup ? "bg-white/90 text-gray-600" : "bg-gold text-primary-900"}`}>
          {redup ? c.tutup : c.terbuka}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-dark">
          {LABEL_JENIS[lang][e.jenis] ?? e.jenis} · {LABEL_TINGKAT[lang][e.tingkat] ?? e.tingkat}
        </p>
        <h3 className="font-heading text-lg font-bold leading-snug text-primary-900">{e.judul}</h3>
        <p className="line-clamp-2 text-sm text-gray-500">{e.deskripsi}</p>
        <div className="mt-auto space-y-1 pt-2 text-sm text-gray-600">
          <p className="flex items-center gap-2"><Building2 size={14} className="shrink-0 text-gray-400" /> {e.penyelenggara}</p>
          {e.tutupDaftar && <p className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-gray-400" /> {c.sampai} {tglEvent(e.tutupDaftar, c.locale)}</p>}
          <p className="flex items-center gap-2"><Wallet size={14} className="shrink-0 text-gray-400" /> {e.berbayar && e.biaya ? rupiah(e.biaya) : c.gratis} · {e.milikSekolah ? c.umum : c.siswa}</p>
        </div>
      </div>
    </a>
  );

  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700 pt-28 pb-16 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <div className="container-custom relative text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">{c.label}</span>
            <h1 className="font-heading mt-2 mb-4 text-4xl font-bold md:text-5xl">{c.judul}</h1>
            <p className="mx-auto max-w-2xl text-lg text-white/70">{c.sub}</p>
          </div>
        </section>

        <section className="container-custom py-12">
          {daftar.length === 0 ? (
            <p className="py-12 text-center text-gray-500">{c.kosong}</p>
          ) : (
            <>
              {buka.length > 0 && (
                <>
                  <h2 className="font-heading mb-5 text-xl font-bold text-primary-900">{c.buka}</h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{buka.map(e => <Kartu key={e.slug} e={e} />)}</div>
                </>
              )}
              {lewat.length > 0 && (
                <>
                  <h2 className={`font-heading mb-5 text-xl font-bold text-primary-900 ${buka.length ? "mt-14" : ""}`}>{c.lewat}</h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{lewat.map(e => <Kartu key={e.slug} e={e} redup />)}</div>
                </>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
