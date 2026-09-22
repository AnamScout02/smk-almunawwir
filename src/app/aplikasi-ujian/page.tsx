export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import path from "path";
import { stat } from "fs/promises";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Download, ShieldCheck } from "lucide-react";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { getLang } from "@/lib/lang";
import { BERKAS_APK, HALAMAN_APLIKASI, VERSI_APLIKASI } from "@/lib/aplikasi-ujian";

const TAUTAN = `${ALAMAT_APLIKASI}${HALAMAN_APLIKASI}`;

export const metadata: Metadata = {
  title: "Aplikasi Ujian — SMK Al Munawwir IIBS",
  description: "Aplikasi ujian Android SMK Al Munawwir IIBS: layar terkunci selama ujian, tangkapan layar diblokir.",
  openGraph: { title: "Aplikasi Ujian SMK Al Munawwir IIBS", description: "Unduh aplikasi ujian untuk HP Android.", url: TAUTAN, type: "website" },
};

const TEKS = {
  id: {
    label: "Ujian Berbasis Komputer", judul: "Aplikasi Ujian Android",
    isi: "Kerjakan ujian dari HP dengan layar terkunci — tombol Home & aplikasi lain tidak bisa dibuka, tangkapan layar diblokir.",
    unduh: "Unduh Aplikasi (APK)", belum: "Berkas aplikasi sedang disiapkan — coba lagi nanti.", versi: "Versi",
    pindai: "Buka halaman ini dari HP: pindai kode QR", langkahJudul: "Cara memasang",
    langkah: [
      "Tekan tombol Unduh di HP Android, lalu buka berkas yang terunduh.",
      "Bila diminta, izinkan \"Instal dari sumber ini / Sumber tidak dikenal\" untuk browser Anda, lalu tekan Instal.",
      "Buka aplikasi \"Ujian SMK Al-Munawwir\", masuk dengan akun siswa seperti biasa.",
      "Saat aplikasi meminta menyematkan layar (Pin / Sematkan aplikasi), tekan Mengerti / Ya — inilah yang mengunci layar selama ujian.",
      "Masukkan token dari pengawas dan kerjakan ujian seperti biasa.",
    ],
    catatanJudul: "Perlu diketahui",
    catatan: [
      "Keluar aplikasi saat sedang mengerjakan membutuhkan PIN dari pengawas.",
      "Tangkapan layar & rekaman layar diblokir di dalam aplikasi.",
      "iPhone tidak memakai aplikasi ini — kerjakan lewat browser seperti biasa. Komputer lab memakai Safe Exam Browser.",
    ],
  },
  en: {
    label: "Computer-Based Test", judul: "Android Exam App",
    isi: "Take exams on your phone with a locked screen — Home and other apps are blocked, screenshots are disabled.",
    unduh: "Download App (APK)", belum: "The app file is being prepared — please try again later.", versi: "Version",
    pindai: "Open this page on your phone: scan the QR code", langkahJudul: "How to install",
    langkah: [
      "Tap Download on your Android phone, then open the downloaded file.",
      "If asked, allow \"Install from this source / Unknown sources\" for your browser, then tap Install.",
      "Open \"Ujian SMK Al-Munawwir\" and sign in with your student account.",
      "When the app asks to pin the screen, tap Got it / Yes — this locks the screen during the exam.",
      "Enter the token from your proctor and take the exam as usual.",
    ],
    catatanJudul: "Good to know",
    catatan: [
      "Leaving the app while taking an exam requires a PIN from the proctor.",
      "Screenshots and screen recording are blocked inside the app.",
      "iPhones don't use this app — use the browser as usual. Lab computers use Safe Exam Browser.",
    ],
  },
};

/** Halaman unduh Aplikasi Ujian Android (dibagikan ke grup kelas / dipindai dari poster). */
export default async function AplikasiUjianPage() {
  const lang = await getLang();
  const c = TEKS[lang];
  const [qr, berkas] = await Promise.all([
    generateQrDataUrl(TAUTAN).catch(() => null),
    stat(path.join(process.cwd(), "public", BERKAS_APK)).catch(() => null),
  ]);
  const ukuran = berkas ? `${(berkas.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-4 mb-4">
              <ShieldCheck size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.judul}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{c.isi}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="panel p-6 md:col-span-3 space-y-6 min-w-0">
              {ukuran ? (
                <a href={BERKAS_APK} download className="btn-modal-save w-full sm:w-auto">
                  <Download size={16} /> {c.unduh} · {ukuran}
                </a>
              ) : <p className="error-msg">{c.belum}</p>}
              <p className="text-xs text-gray-500">{c.versi} {VERSI_APLIKASI} · Android 7.0+</p>
              <div>
                <h2 className="font-heading font-bold text-primary-900 mb-2">{c.langkahJudul}</h2>
                <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">{c.langkah.map(l => <li key={l}>{l}</li>)}</ol>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="font-heading font-bold text-amber-900 mb-2 text-sm">{c.catatanJudul}</h2>
                <ul className="space-y-1.5 text-sm text-amber-800 list-disc pl-5">{c.catatan.map(l => <li key={l}>{l}</li>)}</ul>
              </div>
            </div>
            <div className="panel p-6 md:col-span-2 text-center min-w-0">
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR halaman Aplikasi Ujian" className="w-48 h-48 mx-auto" />
              )}
              <p className="text-sm text-gray-600 mt-3">{c.pindai}</p>
              <p className="text-xs text-gray-400 mt-1 break-all">{TAUTAN}</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
