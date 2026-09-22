export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Smartphone } from "lucide-react";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { getLang } from "@/lib/lang";
import PasangAplikasiPanel from "@/components/sections/PasangAplikasiPanel";

const TAUTAN = `${ALAMAT_APLIKASI}/pasang-aplikasi`;

// Pratinjau tautan saat dibagikan ke WhatsApp: URL gambar HARUS absolut ke alamat HTTPS (metadataBase situs
// masih alamat HTTP, yang tidak bisa dijangkau server pratinjau WhatsApp).
export const metadata: Metadata = {
  title: "Pasang Aplikasi — SMK Al Munawwir IIBS",
  description: "Pasang aplikasi SMK Al Munawwir IIBS di HP, laptop, atau komputer — tanpa Play Store, cukup dari browser.",
  openGraph: {
    title: "Pasang Aplikasi SMK Al Munawwir IIBS",
    description: "Portal guru, siswa, dan orang tua langsung dari layar utama HP atau laptop.",
    url: TAUTAN,
    type: "website",
    images: [{ url: `${ALAMAT_APLIKASI}/ikon-aplikasi/any-512.png`, width: 512, height: 512, alt: "Logo SMK Al Munawwir IIBS" }],
  },
};

const TEKS = {
  id: { label: "Aplikasi Sekolah", judul: "Pasang Aplikasi", isi: "Buka portal guru, siswa, dan orang tua langsung dari layar utama HP atau laptop — tanpa Play Store." },
  en: { label: "School App", judul: "Install the App", isi: "Open the teacher, student, and parent portals right from your phone or laptop home screen — no Play Store needed." },
};

/** Halaman yang dibagikan ke grup WhatsApp warga sekolah: tombol pasang (Chrome/Edge), petunjuk per
 * perangkat (Android, iPhone/iPad, laptop), tautan untuk diteruskan, dan QR untuk poster. Aplikasi ini PWA —
 * tidak ada berkas APK yang bisa dikirim; yang dibagikan adalah tautan ini. */
export default async function PasangAplikasiPage() {
  const h = await headers();
  const lewatHttps = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim() === "https";
  const qr = await generateQrDataUrl(TAUTAN).catch(() => null);
  const lang = await getLang();
  const c = TEKS[lang];

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
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
            <PasangAplikasiPanel tautan={TAUTAN} alamatAman={ALAMAT_APLIKASI} lewatHttps={lewatHttps} qr={qr} lang={lang} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
