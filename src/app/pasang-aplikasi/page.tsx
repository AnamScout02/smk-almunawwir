export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import path from "path";
import { stat } from "fs/promises";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Smartphone } from "lucide-react";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { getLang } from "@/lib/lang";
import PasangAplikasiPanel from "@/components/sections/PasangAplikasiPanel";
import { BERKAS_APK, HALAMAN_APLIKASI, NAMA_APLIKASI, VERSI_APLIKASI, lewatAplikasi } from "@/lib/aplikasi-ujian";

const TAUTAN = `${ALAMAT_APLIKASI}${HALAMAN_APLIKASI}`;

// Pratinjau tautan saat dibagikan ke WhatsApp: URL gambar HARUS absolut ke alamat HTTPS (metadataBase situs
// masih alamat HTTP, yang tidak bisa dijangkau server pratinjau WhatsApp).
export const metadata: Metadata = {
  title: `Pasang ${NAMA_APLIKASI} — SMK Al Munawwir IIBS`,
  description: `${NAMA_APLIKASI}: satu aplikasi untuk siswa, guru, dan orang tua — portal, ujian, perpustakaan, dan pengumuman sekolah.`,
  openGraph: {
    title: `${NAMA_APLIKASI} — SMK Al Munawwir IIBS`,
    description: "Portal siswa, guru, dan orang tua langsung dari layar utama HP atau laptop.",
    url: TAUTAN,
    type: "website",
    images: [{ url: `${ALAMAT_APLIKASI}/ikon-aplikasi/any-512.png`, width: 512, height: 512, alt: "Logo SMK Al Munawwir IIBS" }],
  },
};

const TEKS = {
  id: {
    label: "Aplikasi Resmi Sekolah", judul: NAMA_APLIKASI,
    isi: "Satu aplikasi untuk siswa, guru, dan orang tua — jadwal, nilai, absensi, pengumuman, perpustakaan, dan ujian. Saat ujian berlangsung, layarnya terkunci otomatis.",
  },
  en: {
    label: "Official School App", judul: NAMA_APLIKASI,
    isi: "One app for students, teachers, and parents — schedules, grades, attendance, announcements, library, and exams. The screen locks automatically during an exam.",
  },
};

/** SATU halaman aplikasi (23 September 2026 — permintaan user: /aplikasi & /pasang-aplikasi "kok double jadinya").
 * Isinya: unduh APK Android, pasang versi browser (PWA) untuk iPhone/laptop, petunjuk per perangkat, tautan & QR
 * untuk dibagikan ke grup WhatsApp. `/aplikasi` dan `/aplikasi-ujian` sekarang mengalihkan ke sini. */
export default async function PasangAplikasiPage() {
  const h = await headers();
  const lewatHttps = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim() === "https";
  const diAplikasi = lewatAplikasi(h.get("user-agent"));
  const lang = await getLang();
  const c = TEKS[lang];
  const [qr, berkas] = await Promise.all([
    generateQrDataUrl(TAUTAN).catch(() => null),
    stat(path.join(process.cwd(), "public", BERKAS_APK)).catch(() => null),
  ]);
  const apk = berkas
    ? { href: BERKAS_APK, ukuran: `${(berkas.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`, versi: VERSI_APLIKASI }
    : null;

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
              <Smartphone size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.judul}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{c.isi}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-4xl mx-auto">
            <PasangAplikasiPanel tautan={TAUTAN} alamatAman={ALAMAT_APLIKASI} lewatHttps={lewatHttps} qr={qr}
              lang={lang} apk={apk} diAplikasi={diAplikasi} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
