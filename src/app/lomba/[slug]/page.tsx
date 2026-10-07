export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Building2, Wallet, FileDown, Phone, ExternalLink, CheckCircle2, Gift, ListChecks, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/lang";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TombolBagikan from "@/components/shared/TombolBagikan";
import FormDaftarEvent from "@/components/sections/FormDaftarEvent";
import { sesiOpsional } from "@/lib/event-server";
import { bolehEvent } from "@/lib/event-guard";
import { LABEL_JENIS, LABEL_TINGKAT, STATUS_DAFTAR_INFO, tglEvent, pendaftaranTerbuka, rupiah } from "@/lib/event-label";

const TEKS = {
  id: {
    kembali: "Semua Lomba & Event", penyelenggara: "Penyelenggara", waktu: "Pelaksanaan", batas: "Batas pendaftaran", biaya: "Biaya",
    gratis: "Gratis", syarat: "Syarat Peserta", fasilitas: "Fasilitas & Hadiah", panduan: "Unduh Panduan", kontak: "Narahubung",
    daftar: "Pendaftaran", tutup: "Pendaftaran sudah ditutup.", luar: "Pendaftaran dilakukan di situs penyelenggara.",
    keLuar: "Daftar di Situs Penyelenggara", masuk: "Lomba ini didaftarkan lewat sekolah. Masuk dengan akun siswa untuk mendaftar.",
    tombolMasuk: "Masuk sebagai Siswa", sudah: "Kamu sudah terdaftar", jurusan: "Event ini khusus jurusan tertentu dan jurusanmu tidak termasuk.",
    pengelola: "Kamu masuk sebagai pengelola — kelola pendaftar di dashboard.", kelola: "Buka Pengelola", bagikan: "Bagikan",
    rekening: "Transfer ke", locale: "id-ID",
  },
  en: {
    kembali: "All Competitions & Events", penyelenggara: "Organizer", waktu: "Schedule", batas: "Registration deadline", biaya: "Fee",
    gratis: "Free", syarat: "Requirements", fasilitas: "Benefits & Prizes", panduan: "Download Guidelines", kontak: "Contact person",
    daftar: "Registration", tutup: "Registration is closed.", luar: "Registration is handled on the organizer's website.",
    keLuar: "Register on Organizer's Site", masuk: "Students register for this competition through the school. Sign in with a student account.",
    tombolMasuk: "Student Sign In", sudah: "You are registered", jurusan: "This event is limited to certain programs and yours is not included.",
    pengelola: "You are signed in as a manager — manage registrations in the dashboard.", kelola: "Open Manager", bagikan: "Share",
    rekening: "Transfer to", locale: "en-GB",
  },
};

async function muatEvent(slug: string) {
  return prisma.event.findUnique({ where: { slug } }).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await muatEvent(slug);
  if (!e || !e.aktif || !e.tampilPublik) return { title: "Lomba & Event — SMK Al Munawwir IIBS" };
  return {
    title: `${e.judul} — SMK Al Munawwir IIBS`,
    description: e.deskripsi.slice(0, 160),
    openGraph: { title: e.judul, description: e.deskripsi.slice(0, 160), images: e.posterUrl ? [e.posterUrl] : undefined },
  };
}

const baris = (t: string | null) => (t ?? "").split("\n").map(s => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);

/** Detail event + pendaftaran. Siapa boleh mendaftar ditentukan SERVER (src/app/api/event/[slug]/daftar);
 *  halaman ini hanya memilih apa yang ditampilkan: formulir, tautan penyelenggara, ajakan masuk, atau status. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const c = TEKS[lang];
  const [e, sesi] = await Promise.all([muatEvent(slug), sesiOpsional()]);
  if (!e || !e.aktif) notFound();

  const siswa = sesi?.role === "STUDENT"
    ? await prisma.student.findUnique({ where: { userId: sesi.userId }, select: { id: true, majorId: true } }).catch(() => null)
    : null;
  const pengelola = sesi && sesi.role !== "STUDENT" ? await bolehEvent(sesi) : false;
  if (!e.tampilPublik && !siswa && !pengelola) notFound();

  const milik = siswa
    ? await prisma.pendaftaranEvent.findUnique({ where: { eventId_studentId: { eventId: e.id, studentId: siswa.id } }, select: { status: true, juara: true, catatanPanitia: true } }).catch(() => null)
    : null;
  const terbuka = pendaftaranTerbuka(e);
  const jurusanCocok = !siswa || !e.jurusanIds.length || (!!siswa.majorId && e.jurusanIds.includes(siswa.majorId));
  const syarat = baris(e.syarat);
  const fasilitas = baris(e.fasilitas);
  const rentang = e.mulai
    ? (e.selesai && +e.selesai !== +e.mulai ? `${tglEvent(e.mulai, c.locale, false)} – ${tglEvent(e.selesai, c.locale)}` : tglEvent(e.mulai, c.locale))
    : null;

  let daftar: ReactNode;
  if (milik) {
    const st = STATUS_DAFTAR_INFO[milik.status] ?? STATUS_DAFTAR_INFO.DIAJUKAN;
    daftar = (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 size={18} /> {c.sudah}</p>
        <p className="mt-2"><span className={`status-badge ${st.gaya}`}>{st.label}{milik.juara ? ` · ${milik.juara}` : ""}</span></p>
        {milik.catatanPanitia && <p className="mt-2 text-sm text-emerald-700">{milik.catatanPanitia}</p>}
      </div>
    );
  } else if (e.tautanLuar) {
    daftar = (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{terbuka ? c.luar : c.tutup}</p>
        {terbuka && <a href={e.tautanLuar} target="_blank" rel="noopener noreferrer" className="btn-gold inline-flex items-center gap-2 px-6 py-3"><ExternalLink size={16} /> {c.keLuar}</a>}
      </div>
    );
  } else if (!terbuka) {
    daftar = <p className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">{c.tutup}</p>;
  } else if (pengelola) {
    daftar = (
      <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-700">
        <p>{c.pengelola}</p>
        <a href={sesi?.role === "TEACHER" ? "/dashboard/teacher/event" : "/dashboard/admin/event"} className="font-semibold underline">{c.kelola}</a>
      </div>
    );
  } else if (!siswa && !e.milikSekolah) {
    daftar = (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
        <p>{c.masuk}</p>
        <a href="/login" className="btn-gold inline-flex items-center gap-2 px-6 py-3">{c.tombolMasuk}</a>
      </div>
    );
  } else if (!jurusanCocok) {
    daftar = <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">{c.jurusan}</p>;
  } else {
    daftar = <FormDaftarEvent slug={e.slug} lang={lang} siswa={!!siswa} namaAwal={siswa ? sesi?.name ?? "" : ""}
      perluBukti={e.berbayar && (e.biaya ?? 0) > 0} />;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700 pt-28 pb-14 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <div className="container-custom relative">
            <a href="/lomba" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"><ArrowLeft size={16} /> {c.kembali}</a>
            <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-gold">
              {LABEL_JENIS[lang][e.jenis] ?? e.jenis} · {LABEL_TINGKAT[lang][e.tingkat] ?? e.tingkat}
            </p>
            <h1 className="font-heading mt-2 max-w-3xl text-3xl font-bold md:text-5xl">{e.judul}</h1>
            <p className="mt-3 flex items-center gap-2 text-white/70"><Building2 size={16} /> {e.penyelenggara}</p>
          </div>
        </section>

        <section className="container-custom grid grid-cols-1 gap-10 py-12 lg:grid-cols-12">
          <div className="min-w-0 space-y-8 lg:col-span-7">
            <div className="whitespace-pre-line leading-relaxed text-gray-700">{e.deskripsi}</div>

            {syarat.length > 0 && (
              <div>
                <h2 className="font-heading mb-3 flex items-center gap-2 text-xl font-bold text-primary-900"><ListChecks size={20} className="text-gold" /> {c.syarat}</h2>
                <ul className="space-y-2">{syarat.map((s, i) => <li key={i} className="flex gap-3 text-gray-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{s}</li>)}</ul>
              </div>
            )}
            {fasilitas.length > 0 && (
              <div>
                <h2 className="font-heading mb-3 flex items-center gap-2 text-xl font-bold text-primary-900"><Gift size={20} className="text-gold" /> {c.fasilitas}</h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{fasilitas.map((s, i) => <li key={i} className="rounded-xl border border-gray-100 bg-cream px-4 py-3 text-sm text-gray-700">{s}</li>)}</ul>
              </div>
            )}

            <div id="daftar" className="scroll-mt-28">
              <h2 className="font-heading mb-4 text-xl font-bold text-primary-900">{c.daftar}</h2>
              {daftar}
            </div>
          </div>

          <aside className="min-w-0 space-y-5 lg:col-span-5">
            {e.posterUrl && (
              <div className="relative overflow-hidden rounded-3xl bg-gray-100 shadow-lg">
                <Image src={e.posterUrl} alt={e.judul} width={800} height={1100} sizes="(max-width: 1024px) 100vw, 40vw" className="h-auto w-full" priority />
              </div>
            )}
            <div className="card-premium space-y-4 p-6 text-sm">
              {rentang && info(<CalendarDays size={16} />, c.waktu, rentang)}
              {e.tutupDaftar && info(<Clock size={16} />, c.batas, `${tglEvent(e.tutupDaftar, c.locale)}, 23.59 WIB`)}
              {info(<Wallet size={16} />, c.biaya, e.berbayar && e.biaya ? `${rupiah(e.biaya)}${e.biayaCatatan ? ` (${e.biayaCatatan})` : ""}` : c.gratis)}
              {e.berbayar && e.rekening && <p className="rounded-xl bg-cream px-4 py-3 text-gray-700">{c.rekening}: <span className="font-semibold">{e.rekening}</span></p>}
              {e.kontak && info(<Phone size={16} />, c.kontak, e.kontak)}
              <div className="flex flex-wrap gap-2 pt-1">
                {e.panduanUrl && <a href={e.panduanUrl} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"><FileDown size={16} /> {c.panduan}</a>}
                {e.tampilPublik && <TombolBagikan judul={e.judul} teks={e.deskripsi.slice(0, 120)} label={c.bagikan} />}
              </div>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** Fungsi biasa (bukan komponen yang menerima elemen ikon sebagai prop) — CLAUDE.md #35. */
function info(ikon: ReactNode, label: string, isi: string) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-gold-dark">{ikon}</span>
      <div><p className="text-xs uppercase tracking-wider text-gray-400">{label}</p><p className="font-medium text-primary-900">{isi}</p></div>
    </div>
  );
}
