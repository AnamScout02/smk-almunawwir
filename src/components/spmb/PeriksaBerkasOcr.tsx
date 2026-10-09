"use client";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Loader2, ScanText } from "lucide-react";
import { namaTerbaca, type HasilBaca } from "@/lib/ocr-berkas";
import { NAMA_JENIS, type JenisDokumen } from "@/lib/kenali-dokumen";
import type { Lang } from "@/lib/lang";

/** `salah` = berkas terbaca sebagai jenis LAIN dari yang diminta kotaknya ("foto" = potret orang, bukan dokumen). */
export type KeadaanOcr = { keadaan: "baca" | "siap" | "gagal" | "lewat"; hasil?: HasilBaca | null; salah?: JenisDokumen | "foto" | null };
type Isian = { fullName: string; nik: string; nisn: string; birthDate: string };

const T = {
  id: {
    baca: "Membaca isi berkas untuk memeriksa ketikan Anda…",
    bacaJenis: "Memeriksa berkas…",
    lewat: "Berkas PDF tidak diperiksa otomatis — panitia tetap memeriksanya.",
    gagal: "Isi berkas belum bisa dibaca otomatis. Tidak masalah — panitia tetap memeriksanya.",
    kosong: "Tulisan pada foto kurang jelas untuk dibaca otomatis. Tidak masalah — panitia tetap memeriksanya.",
    judul: "Pemeriksaan otomatis",
    ket: "Pembacaan otomatis bisa keliru — periksa sebelum menekan Pakai.",
    namaCocok: "Nama ditemukan di berkas.", namaBeda: (n: string) => `Nama "${n}" tidak ditemukan di berkas — periksa ejaannya.`,
    nikCocok: "NIK cocok dengan yang terbaca di berkas.",
    nikBeda: (n: string) => `NIK ${n} tidak ditemukan di berkas. Yang terbaca:`,
    nikKosong: "Terbaca NIK di berkas:",
    nisnCocok: "NISN cocok dengan berkas.", nisnBeda: (n: string) => `NISN ${n} tidak ditemukan di berkas. Yang terbaca:`, nisnKosong: "Terbaca NISN:",
    tglCocok: "Tanggal lahir ditemukan di berkas.", tglBeda: "Tanggal lahir yang Anda isi tidak ditemukan. Tanggal yang terbaca:",
    pakai: "Pakai",
    salahJudul: "Periksa: berkas ini tampaknya salah kotak",
    salah: (terbaca: string, kotak: string) => `Berkas ini terbaca sebagai ${terbaca}, sedangkan kotak ini untuk ${kotak}. Tekan ✕ pada berkas di atas lalu unggah yang benar.`,
    salahKet: "Pengenalan otomatis bisa keliru — abaikan bila berkas Anda sudah benar.",
  },
  en: {
    baca: "Reading the document to check what you typed…",
    bacaJenis: "Checking the file…",
    lewat: "PDF files are not checked automatically — the committee still reviews them.",
    gagal: "The document couldn't be read automatically. That's fine — the committee still reviews it.",
    kosong: "The text in the photo isn't clear enough to read automatically. That's fine — the committee still reviews it.",
    judul: "Automatic check",
    ket: "Automatic reading can be wrong — check before pressing Use.",
    namaCocok: "Name found in the document.", namaBeda: (n: string) => `Name "${n}" was not found in the document — check the spelling.`,
    nikCocok: "NIK matches the document.",
    nikBeda: (n: string) => `NIK ${n} was not found in the document. Read:`,
    nikKosong: "NIK read from the document:",
    nisnCocok: "NISN matches the document.", nisnBeda: (n: string) => `NISN ${n} was not found in the document. Read:`, nisnKosong: "NISN read:",
    tglCocok: "Date of birth found in the document.", tglBeda: "The date of birth you entered was not found. Dates read:",
    pakai: "Use",
    salahJudul: "Check: this file seems to be in the wrong box",
    salah: (terbaca: string, kotak: string) => `This file reads as ${terbaca}, but this box is for ${kotak}. Press ✕ on the file above and upload the right one.`,
    salahKet: "Automatic recognition can be wrong — ignore this if your file is correct.",
  },
};

function tampilTgl(iso: string, lang: Lang) {
  return new Date(iso + "T00:00:00").toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" });
}

/** Hasil pembacaan KK / ijazah dibandingkan dengan isian formulir. Tidak pernah mengubah isian
 *  sendiri — hanya lewat tombol "Pakai" (lihat src/lib/ocr-berkas.ts). */
export default function PeriksaBerkasOcr({ jenis, label, ocr, isian, pakai, lang }: {
  jenis: "kk" | "ijazah" | "ktp_wali"; label: string; ocr?: KeadaanOcr; isian: Isian;
  pakai: (kunci: "nik" | "nisn" | "birthDate", nilai: string) => void; lang: Lang;
}) {
  const t = T[lang];
  if (!ocr) return null;
  if (ocr.keadaan === "baca") return (
    <p className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" /> {jenis === "ktp_wali" ? t.bacaJenis : t.baca}</p>
  );
  // Salah kotak: ketikan TIDAK dibandingkan dengan berkas itu — hasilnya hanya akan membingungkan.
  if (ocr.salah) return (
    <div role="alert" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="flex items-start gap-2 font-semibold"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {t.salahJudul}</p>
      <p className="mt-1 pl-6">{t.salah(NAMA_JENIS[lang][ocr.salah], label)}</p>
      <p className="mt-1 pl-6 text-xs text-amber-700">{t.salahKet}</p>
    </div>
  );
  // KTP wali hanya diperiksa jenisnya: nama & NIK di sana milik orang tua, bukan calon.
  if (jenis === "ktp_wali") return null;
  if (ocr.keadaan === "lewat") return <p className="mt-2 text-xs text-gray-400">{t.lewat}</p>;
  const h = ocr.hasil;
  if (ocr.keadaan === "gagal" || !h) return <p className="mt-2 text-xs text-gray-400">{t.gagal}</p>;

  const baris: ReactNode[] = [];
  const Ok = ({ teks }: { teks: string }) => (
    <li className="flex items-start gap-2 text-emerald-700"><CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {teks}</li>
  );
  const Beda = ({ teks, pilihan, kunci, label }: { teks: string; pilihan?: string[]; kunci?: "nik" | "nisn" | "birthDate"; label?: (v: string) => string }) => (
    <li className="text-amber-700">
      <span className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {teks}</span>
      {pilihan && kunci && (
        <span className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
          {pilihan.slice(0, 6).map(v => (
            <button key={v} type="button" onClick={() => pakai(kunci, v)}
              className="angka rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100">
              {label ? label(v) : v} · {t.pakai}
            </button>
          ))}
        </span>
      )}
    </li>
  );

  if (isian.fullName.trim()) {
    baris.push(namaTerbaca(isian.fullName, h)
      ? <Ok key="nama" teks={t.namaCocok} /> : <Beda key="nama" teks={t.namaBeda(isian.fullName.trim())} />);
  }
  if (jenis === "kk" && h.nik.length) {
    baris.push(!isian.nik ? <Beda key="nik" teks={t.nikKosong} pilihan={h.nik} kunci="nik" />
      : h.nik.includes(isian.nik) ? <Ok key="nik" teks={t.nikCocok} />
      : <Beda key="nik" teks={t.nikBeda(isian.nik)} pilihan={h.nik} kunci="nik" />);
  }
  if (jenis === "ijazah" && h.nisn.length) {
    baris.push(!isian.nisn ? <Beda key="nisn" teks={t.nisnKosong} pilihan={h.nisn} kunci="nisn" />
      : h.nisn.includes(isian.nisn) ? <Ok key="nisn" teks={t.nisnCocok} />
      : <Beda key="nisn" teks={t.nisnBeda(isian.nisn)} pilihan={h.nisn} kunci="nisn" />);
  }
  if (h.tanggal.length && isian.birthDate) {
    baris.push(h.tanggal.includes(isian.birthDate) ? <Ok key="tgl" teks={t.tglCocok} />
      : <Beda key="tgl" teks={t.tglBeda} pilihan={h.tanggal} kunci="birthDate" label={v => tampilTgl(v, lang)} />);
  }

  if (!baris.length) return <p className="mt-2 text-xs text-gray-400">{t.kosong}</p>;
  return (
    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary-900"><ScanText size={14} /> {t.judul}</p>
      <ul className="space-y-1.5 text-xs">{baris}</ul>
      <p className="mt-2 text-xs text-gray-400">{t.ket}</p>
    </div>
  );
}
