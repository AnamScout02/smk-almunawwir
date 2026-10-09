export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/lang";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatistikPkl from "@/components/sections/StatistikPkl";
import FormulirMitra from "@/components/sections/FormulirMitra";

export const metadata = {
  title: "Mitra Industri — SMK Al Munawwir IIBS",
  description: "Dunia usaha dan dunia industri tempat siswa SMK Al Munawwir IIBS menjalani Praktik Kerja Lapangan, dan cara menjadi mitra.",
};

const TEKS = {
  id: { label: "Mitra Industri", judul: "Tempat Siswa Kami Belajar Bekerja", sub: "Dunia usaha dan industri yang menerima siswa kami untuk Praktik Kerja Lapangan (PKL).",
    daftar: "Mitra kami", kosong: "Daftar mitra akan tampil di sini setelah dilengkapi sekolah.", ajak: "Jadi Mitra PKL",
    ajakSub: "Punya usaha atau instansi dan bersedia menerima siswa PKL? Isi formulir ini — tim Humas kami akan menghubungi Anda.",
    untung: ["Siswa dibekali sebelum berangkat dan didampingi guru pembimbing", "Presensi dan jurnal siswa bisa Anda paraf dari HP tanpa membuat akun", "Lama PKL 3 atau 6 bulan, jadwalnya dibicarakan bersama"] },
  en: { label: "Industry Partners", judul: "Where Our Students Learn to Work", sub: "Businesses and industries that host our students for their internship (PKL).",
    daftar: "Our partners", kosong: "The partner list will appear here once completed by the school.", ajak: "Become an Internship Partner",
    ajakSub: "Run a business or institution and willing to host our interns? Fill in this form — our partnership team will contact you.",
    untung: ["Students are briefed before departure and assisted by a supervising teacher", "Sign off attendance and journals from your phone, no account needed", "Internships run 3 or 6 months, scheduled together with you"] },
};

/** HALAMAN MITRA INDUSTRI (9 Okt 2026) — hanya DUDI aktif yang dicentang "tampil di web" (nama, bidang, kecamatan, logo).
 *  Tanpa alamat lengkap, narahubung, maupun jumlah siswa per DUDI. Formulir di bawahnya = usulan, bukan pendaftaran otomatis. */
export default async function Page() {
  const lang = await getLang();
  const c = TEKS[lang];
  const mitra = await prisma.industryPartner.findMany({
    where: { aktif: true, tampilPublik: true }, orderBy: { name: "asc" }, take: 300,
    select: { id: true, name: true, industryField: true, kecamatan: true, kabupaten: true, logoUrl: true },
  }).catch(() => []);
  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-900 to-primary-700 pt-28 pb-16 text-white">
          <div className="container-custom relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{c.label}</p>
            <h1 className="mt-2 font-heading text-3xl font-bold md:text-4xl">{c.judul}</h1>
            <p className="mt-3 max-w-2xl text-white/75">{c.sub}</p>
          </div>
        </section>
        <StatistikPkl lang={lang} />
        <section className="bg-cream py-14">
          <div className="container-custom">
            <h2 className="font-heading text-2xl font-bold text-primary-900">{c.daftar}</h2>
            {mitra.length === 0 ? <p className="mt-4 text-sm text-gray-500">{c.kosong}</p> : (
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mitra.map(m => (
                  <li key={m.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.logoUrl ? <img src={m.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-heading text-lg font-bold text-primary-700">{m.name.replace(/^(PT|CV|UD)\.?\s+/i, "").charAt(0).toUpperCase()}</span>}
                    <div className="min-w-0"><p className="truncate font-semibold text-primary-900">{m.name}</p><p className="truncate text-sm text-gray-500">{[m.industryField, m.kecamatan ?? m.kabupaten].filter(Boolean).join(" · ") || "—"}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="bg-white py-14" id="jadi-mitra">
          <div className="container-custom grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-5">
              <h2 className="font-heading text-2xl font-bold text-primary-900">{c.ajak}</h2>
              <p className="mt-3 text-gray-600">{c.ajakSub}</p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">{c.untung.map(u => <li key={u} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{u}</li>)}</ul>
            </div>
            <div className="min-w-0 lg:col-span-7"><FormulirMitra lang={lang} /></div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
