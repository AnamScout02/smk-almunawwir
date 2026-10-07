export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TahapanCalon from "@/components/spmb/TahapanCalon";
import { getLang } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Tahapan Pendaftaran SPMB — SMK Al Munawwir IIBS",
  description: "Pantau tahapan pendaftaran calon siswa: verifikasi berkas, ukuran seragam, asesmen, cek kesehatan, sampai MPLS.",
  robots: { index: false },
};

const TEKS = {
  id: { label: "SPMB", judul: "Tahapan Pendaftaran", ket: "Pantau setiap tahap pendaftaran sampai resmi mengikuti MPLS." },
  en: { label: "Admissions", judul: "Registration Progress", ket: "Track each registration step until you officially join the orientation (MPLS)." },
};

/** Halaman tahapan calon siswa (6 Oktober 2026) — tanpa akun; kunci = nomor pendaftaran + tanda. */
export default async function Page({ searchParams }: { searchParams: Promise<{ nomor?: string; t?: string }> }) {
  const { nomor = "", t = "" } = await searchParams;
  const lang = await getLang();
  const c = TEKS[lang];
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700 pt-28 pb-16 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <div className="container-custom relative text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">{c.label}</span>
            <div className="mx-auto mt-4 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <ListChecks size={28} className="text-gold" />
            </div>
            <h1 className="font-heading mb-3 text-4xl font-bold md:text-5xl">{c.judul}</h1>
            <p className="mx-auto max-w-xl text-lg text-white/70">{c.ket}</p>
          </div>
        </section>
        <section className="section-padding bg-cream">
          <div className="container-custom mx-auto max-w-3xl">
            <TahapanCalon lang={lang} nomorAwal={nomor.toUpperCase()} tandaAwal={t} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
