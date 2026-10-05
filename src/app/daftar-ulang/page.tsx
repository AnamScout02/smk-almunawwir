import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DaftarUlangForm from "@/components/sections/DaftarUlangForm";
import { ClipboardCheck } from "lucide-react";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Ulang SPMB — SMK Al Munawwir IIBS",
  description: "Konfirmasi daftar ulang & unggah bukti pembayaran untuk calon siswa yang sudah dinyatakan diterima.",
};

const TEKS = {
  id: {
    label: "SPMB", judul: "Daftar Ulang SPMB", awal: "Khusus calon siswa yang sudah dinyatakan", diterima: "DITERIMA",
    akhir: "Masukkan nama lengkap & nomor WA sesuai formulir pendaftaran untuk konfirmasi daftar ulang.",
  },
  en: {
    label: "Admissions", judul: "Re-registration", awal: "Only for applicants who have been", diterima: "ACCEPTED",
    akhir: "Enter your full name and WhatsApp number as written on the registration form to confirm your re-registration.",
  },
};

export default async function DaftarUlangPage() {
  const lang = await getLang();
  const c = TEKS[lang];
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-4 mb-4">
              <ClipboardCheck size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.judul}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">
              {c.awal} <span className="font-semibold text-gold">{c.diterima}</span>. {c.akhir}
            </p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-xl mx-auto">
            <DaftarUlangForm lang={lang} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
