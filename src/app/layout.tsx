import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Amiri } from "next/font/google";
import "./globals.css";
import WhatsAppButton from "@/components/shared/WhatsAppButton";

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
    default: "SMK Al-Munawwir IIBS",
    template: "%s | SMK Al-Munawwir IIBS",
  },
  description:
    "SMK Al-Munawwir International Islamic Boarding School — Mendidik Generasi Qurani Terampil Berwawasan Global. Singojuruh, Banyuwangi, Jawa Timur. NPSN 69896523.",
  keywords: [
    "SMK Al-Munawwir",
    "IIBS",
    "Islamic Boarding School",
    "Sekolah Islam Banyuwangi",
    "SMK Islam",
    "Pesantren SMK",
    "NPSN 69896523",
  ],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "SMK Al-Munawwir IIBS",
    description:
      "International Islamic Boarding School — Mendidik Generasi Qurani Terampil",
    type: "website",
    locale: "id_ID",
    images: [{ url: "/images/logo-emblem.png" }],
  },
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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
