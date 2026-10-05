export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import path from "path";
import { stat } from "fs/promises";
import { headers } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Smartphone, Monitor, ShieldCheck, Download } from "lucide-react";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { getLang } from "@/lib/lang";
import PasangAplikasiPanel from "@/components/sections/PasangAplikasiPanel";
import { BERKAS_APK, BERKAS_WINDOWS, HALAMAN_APLIKASI, NAMA_APLIKASI, VERSI_APLIKASI, VERSI_WINDOWS, lewatAplikasi } from "@/lib/aplikasi-ujian";

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
    labKepala: "Komputer Lab (Windows)", labSub: "Untuk ujian CBT di komputer sekolah — seperti Exambrowser saat ANBK/TKA.",
    winJudul: "MyAlwis Ujian untuk Windows", winIsi: "Browser ujian layar penuh: hanya membuka situs sekolah, tangkapan layar diblokir saat mengerjakan, dan keluar saat ujian wajib PIN pengawas.",
    winLangkah: ["Unduh lalu ekstrak zip-nya, mis. ke C:\\MyAlwisUjian.", "Jalankan MyAlwisUjian.exe (buat pintasan di Desktop).", "Keluar: Ctrl+Shift+Q — saat ujian berlangsung diminta PIN pengawas."],
    winUnduh: "Unduh untuk Windows", winSyarat: "Windows 10/11 64-bit",
    sebJudul: "Safe Exam Browser", sebIsi: "Kunci tingkat sistem (Alt-Tab, tombol Windows, aplikasi lain ditutup). Petugas mengunduh berkas .seb dari Pusat Ujian → Pengaturan Ujian, lalu membukanya di komputer lab.",
    sebUnduh: "Situs Safe Exam Browser", belum: "Berkas belum tersedia.",
  },
  en: {
    label: "Official School App", judul: NAMA_APLIKASI,
    isi: "One app for students, teachers, and parents — schedules, grades, attendance, announcements, library, and exams. The screen locks automatically during an exam.",
    labKepala: "Lab Computers (Windows)", labSub: "For CBT exams on school computers — like the Exambrowser used for ANBK/TKA.",
    winJudul: "MyAlwis Ujian for Windows", winIsi: "Full-screen exam browser: opens the school site only, blocks screenshots while answering, and exiting during an exam requires the proctor's PIN.",
    winLangkah: ["Download and extract the zip, e.g. to C:\\MyAlwisUjian.", "Run MyAlwisUjian.exe (create a Desktop shortcut).", "Exit: Ctrl+Shift+Q — during an exam the proctor's PIN is required."],
    winUnduh: "Download for Windows", winSyarat: "Windows 10/11 64-bit",
    sebJudul: "Safe Exam Browser", sebIsi: "System-level lock (Alt-Tab, Windows key, other apps closed). Staff download the .seb file from Exam Center → Exam Settings and open it on the lab computer.",
    sebUnduh: "Safe Exam Browser site", belum: "File not available yet.",
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
  const zip = await stat(path.join(process.cwd(), "public", "uploads", "unduh", "myalwis-ujian-windows.zip")).catch(() => null);
  const ukuranZip = zip ? `${Math.round(zip.size / 1024 / 1024)} MB` : null;
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

            <div className="mt-14">
              <h2 className="font-heading text-2xl font-bold text-primary-900">{c.labKepala}</h2>
              <p className="mt-1 text-gray-500">{c.labSub}</p>
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="card-premium flex flex-col p-6">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-900 text-white"><Monitor size={22} /></span>
                  <h3 className="font-heading text-lg font-bold text-primary-900">{c.winJudul}</h3>
                  <p className="mt-2 text-sm text-gray-600">{c.winIsi}</p>
                  <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-600">{c.winLangkah.map(l => <li key={l}>{l}</li>)}</ol>
                  <div className="mt-auto pt-5">
                    {ukuranZip ? (
                      <a href={BERKAS_WINDOWS} className="btn-primary"><Download size={16} /> {c.winUnduh}</a>
                    ) : <p className="text-sm text-gray-400">{c.belum}</p>}
                    <p className="mt-2 text-xs text-gray-400">{c.winSyarat}{ukuranZip ? ` · ${ukuranZip} · v${VERSI_WINDOWS}` : ""}</p>
                  </div>
                </div>
                <div className="card-premium flex flex-col p-6">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"><ShieldCheck size={22} /></span>
                  <h3 className="font-heading text-lg font-bold text-primary-900">{c.sebJudul}</h3>
                  <p className="mt-2 text-sm text-gray-600">{c.sebIsi}</p>
                  <div className="mt-auto pt-5">
                    <a href="https://safeexambrowser.org/download_en.html" target="_blank" rel="noopener noreferrer" className="btn-primary">{c.sebUnduh}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
