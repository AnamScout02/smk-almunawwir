import React from "react";
import PitaPortal from "@/components/shared/PitaPortal";

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
//
// Tinggi di HP sengaja dijaga RINGKAS (temuan user 18 September 2026: "header kedua terlihat terlalu
// tinggi" di dashboard guru) — judul 18px, padding bawah 14px, keterangan dipangkas 2 baris. Halaman yang
// keterangannya panjang (salam + nama + tanggal) menyembunyikan bagian yang paling tidak penting di HP
// dengan `hidden sm:inline`, bukan dengan memperbesar header ini.
//
// Posisi menempel & padding atas bisa diatur pembungkus lewat variabel CSS (bawaan = dashboard):
//   --pageheader-top : jarak menempel dari atas. Bawaan di HP 3.5rem — persis setinggi bar atas mobile yang
//     `fixed`, supaya saat digulir header berhenti DI BAWAH bar itu (dulu peran ini dipegang padding 4.5rem).
//     Di layar lebar bawaannya 0. Portal (PortalShell) mengaturnya sendiri = tinggi kepala portal + bar tab.
// Di dalam PORTAL (Pusat Ujian, Perpustakaan) header ini TETAP NAVY seperti halaman lain dan pita menu tab portal
// dirender tepat DI BAWAHNYA (`PitaPortal`, keputusan user 21 September 2026 — membalik aturan "header terang di portal"
// 18 Sep). Di luar portal PitaPortal tidak merender apa-apa.
//   --pageheader-pt  : padding atas di HP (bawaan 1.25rem). DULU 4.5rem untuk memberi ruang bar atas mobile
//     yang fixed — ternyata `<main>` tiap portal SUDAH memberi `pt-14`, jadi 72px itu murni ruang kosong dan
//     membuat header terlihat terlalu tinggi di HP (diukur 18 Sep 2026: judul baru mulai 128px dari atas layar).
export default function PageHeader({ icon, title, description, printHidden }: PageHeaderProps) {
  return (
    <>
    <header
      className={`page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 -mx-6 lg:-mx-8 -mt-16 lg:-mt-8 mb-5 sm:mb-8 px-6 lg:px-8 pt-[var(--pageheader-pt,1.25rem)] lg:pt-5 pb-3.5 sm:pb-5 sticky top-[var(--pageheader-top,3.5rem)] lg:top-[var(--pageheader-top,0px)] z-30 ${printHidden ? "print:hidden" : ""}`}
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}
    >
      {/* Pattern overlay */}
      <div className="ph-pola absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      {/* Gold bottom border line */}
      <div className="ph-garis absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative flex items-center gap-3 sm:flex-1 min-w-0 card-fade-up">
        <div className="ph-ikon text-gold shrink-0">{icon}</div>
        <div className="min-w-0">
          <h1 className="ph-judul font-heading text-lg sm:text-xl font-bold text-white">{title}</h1>
          {description && <p className="ph-ket line-clamp-2 text-white/60 text-sm mt-0.5 sm:line-clamp-none">{description}</p>}
        </div>
      </div>
    </header>
    <PitaPortal />
    </>
  );
}
