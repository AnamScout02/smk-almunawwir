import type { Viewport } from "next";

/** TAMPILAN APLIKASI DIKUNCI (18 September 2026, permintaan user): di dalam portal, halaman tidak
 * bisa diperbesar/diperkecil dengan cubitan dua jari maupun ketuk ganda, supaya tata letaknya tidak
 * bergeser saat dipakai bergantian di HP sekolah. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
