import React from "react";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  printHidden?: boolean;
}

// SENGAJA tidak ada prop actions/tombol/dropdown di sini — header HANYA boleh berisi icon, judul,
// dan keterangan judul. Tombol/aksi/filter apapun ditaruh di baris terpisah DI BAWAH header ini,
// bukan di dalamnya. Aturan eksplisit dari user, sudah berulang kali dilanggar — jangan tambah
// prop actions lagi ke komponen ini.
//
// `printHidden` PENGGANTI pola lama `<div className="print:hidden"><PageHeader/></div>` — bungkus
// terpisah begitu TERBUKTI merusak sticky (root cause bug 2026-08-12): parent div yang HANYA berisi
// header sendirian tingginya persis sama dgn tinggi header, jadi sticky tidak punya "ruang gerak"
// di dalam parent-nya dan gagal total (header ikut scroll hilang, bukan nempel). Kalau butuh
// header tidak ikut tercetak, pakai prop ini — JANGAN bungkus lagi dgn div print:hidden terpisah.
export default function PageHeader({ icon, title, description, printHidden }: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 -mx-6 lg:-mx-8 -mt-16 lg:-mt-8 mb-8 px-6 lg:px-8 pt-[4.5rem] lg:pt-5 pb-5 sticky top-0 z-30 ${printHidden ? "print:hidden" : ""}`}
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}
    >
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      {/* Gold bottom border line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative flex items-center gap-3 sm:flex-1 min-w-0 card-fade-up">
        <div className="text-gold shrink-0">{icon}</div>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold text-white">{title}</h1>
          {description && <p className="text-white/60 text-sm mt-0.5">{description}</p>}
        </div>
      </div>
    </header>
  );
}
