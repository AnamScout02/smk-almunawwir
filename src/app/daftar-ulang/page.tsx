import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DaftarUlangForm from "@/components/sections/DaftarUlangForm";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Ulang PPDB — SMK Al Munawwir IIBS",
  description: "Konfirmasi daftar ulang & unggah bukti pembayaran untuk calon siswa yang sudah dinyatakan diterima.",
};

export default function DaftarUlangPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">SPMB</span>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-4 mb-4">
              <ClipboardCheck size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">Daftar Ulang PPDB</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">
              Khusus calon siswa yang sudah dinyatakan <span className="font-semibold text-gold">DITERIMA</span>.
              Masukkan nama lengkap & nomor WA sesuai formulir pendaftaran untuk konfirmasi daftar ulang.
            </p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-xl mx-auto">
            <DaftarUlangForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
