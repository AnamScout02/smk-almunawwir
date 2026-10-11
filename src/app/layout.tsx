import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, Amiri } from "next/font/google";
import "./globals.css";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import Providers from "@/components/shared/Providers";
import ServiceWorkerRegister from "@/components/shared/ServiceWorkerRegister";
import InstallPwaPrompt from "@/components/shared/InstallPwaPrompt";
import PitaPerbaruiAplikasi from "@/components/shared/PitaPerbaruiAplikasi";
import TawaranPasskey from "@/components/shared/TawaranPasskey";
import GantiSandiWajib from "@/components/shared/GantiSandiWajib";
import PencatatPemakaian from "@/components/shared/PencatatPemakaian";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "SMK Al Munawwir IIBS",
    template: "%s | SMK Al Munawwir IIBS",
  },
  description:
    "SMK Al Munawwir International Islamic Boarding School — Mendidik Generasi Qurani Terampil Berwawasan Global. Singojuruh, Banyuwangi, Jawa Timur. NPSN 69896523.",
  keywords: [
    "SMK Al Munawwir",
    "IIBS",
    "Islamic Boarding School",
    "Sekolah Islam Banyuwangi",
    "SMK Islam",
    "Pesantren SMK",
    "NPSN 69896523",
  ],
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/ikon-aplikasi/any-192.png", sizes: "192x192", type: "image/png" },
      { url: "/ikon-aplikasi/any-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/ikon-aplikasi/apple-180.png", // dari Logo Lambang — lihat src/lib/ikon-aplikasi.ts
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Al Munawwir",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "SMK Al Munawwir IIBS",
    description:
      "International Islamic Boarding School — Mendidik Generasi Qurani Terampil",
    type: "website",
    locale: "id_ID",
    images: [{ url: "/images/logo-full.png" }],
  },
};

// Viewport/themeColor TERPISAH dari `metadata` di Next.js 16 (bukan lagi field di dalam
// `metadata.themeColor` spt versi lama) — lihat node_modules/next/dist/docs/.../generate-viewport.md,
// wajib dicek dulu per AGENTS.md krn versi Next.js ini beda dari asumsi training data.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Situs PUBLIK sengaja TETAP bisa diperbesar (tamu & orang tua sering perlu memperbesar teks).
  // Penguncian hanya berlaku di aplikasi/portal — lihat `viewport` di layout dashboard & portal.
  themeColor: "#0F1A45",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${inter.variable} ${amiri.variable}`}
    >
      <body className="min-h-dvh flex flex-col">
        <Providers>
          {children}
          <WhatsAppButton />
          <ServiceWorkerRegister />
          <InstallPwaPrompt />
          <PitaPerbaruiAplikasi />
          <TawaranPasskey />
          <GantiSandiWajib />
          <PencatatPemakaian />
        </Providers>
      </body>
    </html>
  );
}
