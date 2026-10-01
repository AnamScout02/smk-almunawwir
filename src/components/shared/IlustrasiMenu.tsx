/** ILUSTRASI MENU (18 September 2026) — percobaan bertahap menggantikan ikon garis dengan gambar
 * berlapis ala aplikasi bank (contoh yang dikirim user: BRImo). Digambar sendiri sebagai SVG
 * sederhana: bentuk putih dengan beberapa tingkat transparansi di atas chip berwarna yang sudah ada,
 * sehingga terasa berdimensi tanpa perlu berkas gambar & tanpa id gradien yang bisa bentrok.
 *
 * Dipakai lebih dulu untuk MENU UTAMA saja (keputusan user: "buatkan bertahap menu utama dulu,
 * kalau tepat kita gaskan semua menu"). Menu yang belum punya ilustrasi tetap memakai ikon lucide —
 * jadi aman bila sebagian saja yang dibuat. Menambah menu: gambar di `ILUSTRASI`, lalu petakan
 * alamatnya di `PETA_ILUSTRASI`. */

type Props = { className?: string };
const S = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className ?? "h-full w-full"} aria-hidden>{children}</svg>
);

/** SATU GAYA UNTUK SEMUA (keputusan user 18 September 2026: "samakan seperti 18 untuk semuanya").
 * Ilustrasi digambar sebagai bidang PUTIH berlapis di atas chip gradasi yang sama dengan menu lain,
 * jadi menu berilustrasi dan menu berikon garis terlihat satu keluarga. Percobaan ubin pastel +
 * objek berwarna dibatalkan: gambarnya terasa dipaksakan dan banyak menu kebagian gambar sama. */
const W = "rgba(255,255,255,0.97)";   // bidang utama (kertas/badan)
const B = "rgba(255,255,255,0.72)";   // bidang sekunder
const G = "rgba(255,255,255,0.45)";   // bidang paling belakang
const N = "rgba(15,26,69,0.45)";      // DETAIL GELAP di atas bidang putih
const N2 = "rgba(15,26,69,0.26)";     // detail gelap yang lebih tipis

export const ILUSTRASI: Record<string, (p: Props) => React.ReactElement> = {
  /* Buku terbuka + pensil — materi & tugas */
  materi: p => <S {...p}><path d="M6 12h13a4 4 0 014 4v22a6 6 0 00-6-4H6z" fill={W} /><path d="M42 12H29a4 4 0 00-4 4v22a6 6 0 016-4h11z" fill={B} /><path d="M10 19h9M10 25h9" stroke={N2} strokeWidth="2" strokeLinecap="round" /><path d="M33 6l7 7-13 13-8 2 2-8z" fill={G} /><path d="M33 6l7 7-3 3-7-7z" fill={N} /></S>,
  /* Lembar soal + lencana centang */
  ujian: p => <S {...p}><rect x="9" y="5" width="25" height="33" rx="4" fill={W} /><rect x="14" y="13" width="15" height="3" rx="1.5" fill={N} /><rect x="14" y="20" width="10" height="3" rx="1.5" fill={N2} /><rect x="14" y="27" width="13" height="3" rx="1.5" fill={N2} /><circle cx="34" cy="35" r="10" fill={B} /><path d="M29.6 35l3.2 3.2 6.2-6.4" stroke={N} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Rapor + medali */
  rapor: p => <S {...p}><path d="M9 5h16l10 10v28H9z" fill={W} /><path d="M25 5l10 10H25z" fill={N2} /><rect x="14" y="22" width="12" height="2.6" rx="1.3" fill={N} /><rect x="14" y="28" width="8" height="2.6" rx="1.3" fill={N2} /><path d="M30 34l-2 9 6-3 6 3-2-9z" fill={B} /><circle cx="34" cy="31" r="8" fill={G} /><path d="M34 27l1.4 2.9 3.2.5-2.3 2.2.5 3.2-2.8-1.5-2.8 1.5.5-3.2-2.3-2.2 3.2-.5z" fill={W} /></S>,
  /* Kode QR di kartu */
  qr: p => <S {...p}><rect x="5" y="7" width="38" height="34" rx="6" fill={W} /><rect x="10" y="12" width="10" height="10" rx="2.5" fill={N} /><rect x="12.6" y="14.6" width="4.8" height="4.8" rx="1" fill={W} /><rect x="28" y="12" width="10" height="10" rx="2.5" fill={N} /><rect x="30.6" y="14.6" width="4.8" height="4.8" rx="1" fill={W} /><rect x="10" y="26" width="10" height="10" rx="2.5" fill={N} /><rect x="27" y="26" width="5" height="5" rx="1.2" fill={N2} /><rect x="33" y="32" width="5" height="5" rx="1.2" fill={N2} /><rect x="27" y="32" width="4" height="4" rx="1" fill={N2} /></S>,
  /* Papan jalan + centang */
  absensi: p => <S {...p}><rect x="8" y="7" width="31" height="36" rx="5" fill={W} /><rect x="16" y="3" width="15" height="8" rx="3" fill={B} /><path d="M14 23l4.5 4.5L27 19" stroke={N} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><rect x="14" y="32" width="18" height="3" rx="1.5" fill={N2} /><rect x="14" y="38" width="11" height="3" rx="1.5" fill={N2} /></S>,
  /* Buku jurnal + pena */
  jurnal: p => <S {...p}><rect x="7" y="5" width="26" height="38" rx="4" fill={W} /><rect x="7" y="5" width="7" height="38" rx="3.5" fill={N2} /><rect x="18" y="14" width="11" height="2.6" rx="1.3" fill={N} /><rect x="18" y="21" width="8" height="2.6" rx="1.3" fill={N2} /><path d="M40 13l5 5-14 14-7 2 2-7z" fill={B} /><path d="M40 13l5 5-2.4 2.4-5-5z" fill={G} /></S>,
  /* Kalender + jam */
  jadwal: p => <S {...p}><rect x="5" y="9" width="37" height="34" rx="6" fill={W} /><rect x="5" y="9" width="37" height="10" rx="5" fill={N} /><rect x="13" y="4" width="4.5" height="9" rx="2.2" fill={B} /><rect x="29" y="4" width="4.5" height="9" rx="2.2" fill={B} /><rect x="11" y="24" width="6" height="6" rx="1.6" fill={N2} /><rect x="21" y="24" width="6" height="6" rx="1.6" fill={N2} /><circle cx="33" cy="34" r="9" fill={B} /><path d="M33 29.5V34l3.2 2" stroke={N} strokeWidth="2.8" strokeLinecap="round" /></S>,
  /* Dua siswa */
  siswa: p => <S {...p}><circle cx="18" cy="15" r="7.5" fill={W} /><path d="M5 42c0-7 5.8-11.5 13-11.5S31 35 31 42z" fill={W} /><path d="M13 42v-8l5 3 5-3v8z" fill={N2} /><circle cx="35" cy="19" r="6" fill={B} /><path d="M26 42c0-5.4 4-9 9-9s9 3.6 9 9z" fill={B} /></S>,
  /* Topi wisuda */
  wisuda: p => <S {...p}><path d="M24 6l21 9-21 9-21-9z" fill={W} /><path d="M12 22v9c0 4.4 5.6 7.5 12 7.5S36 35.4 36 31v-9l-12 5z" fill={B} /><path d="M45 15v11" stroke={G} strokeWidth="3" strokeLinecap="round" /><circle cx="45" cy="29" r="3.2" fill={G} /></S>,
  /* Gedung sekolah */
  kelas: p => <S {...p}><path d="M24 4l20 10v4H4v-4z" fill={B} /><rect x="8" y="20" width="32" height="23" rx="3" fill={W} /><rect x="13" y="25" width="8" height="8" rx="1.8" fill={N} /><rect x="27" y="25" width="8" height="8" rx="1.8" fill={N} /><rect x="19" y="36" width="10" height="7" rx="1.8" fill={N2} /></S>,
  /* Rak buku */
  perpustakaan: p => <S {...p}><rect x="8" y="9" width="8" height="30" rx="2.5" fill={W} /><rect x="18" y="13" width="8" height="26" rx="2.5" fill={B} /><rect x="28" y="7" width="9" height="32" rx="2.5" fill={W} transform="rotate(7 32 23)" /><rect x="6" y="39" width="36" height="5" rx="2.5" fill={N} /><path d="M11 9v11l2.5-2.5L16 20V9z" fill={N2} /></S>,
  /* Amplop + segel */
  surat: p => <S {...p}><rect x="4" y="11" width="40" height="27" rx="5" fill={W} /><path d="M5 14l19 12.5L43 14" stroke={N} strokeWidth="2.6" strokeLinecap="round" fill="none" /><path d="M4 36l14-11 6 4 6-4 14 11z" fill={N2} /><circle cx="38" cy="13" r="6" fill={B} /></S>,
  /* Megafon */
  pengumuman: p => <S {...p}><path d="M7 19h7l16-10v30l-16-10H7a4 4 0 01-4-4v-2a4 4 0 014-4z" fill={W} /><rect x="13" y="29" width="7" height="13" rx="2.5" fill={N2} /><path d="M35 15c3.4 2.4 5.6 5.3 5.6 9s-2.2 6.6-5.6 9" stroke={B} strokeWidth="3.4" strokeLinecap="round" /><path d="M40 9c5 3.6 7 8 7 15" stroke={G} strokeWidth="2.6" strokeLinecap="round" /></S>,
  /* Kartu identitas */
  kartu: p => <S {...p}><rect x="4" y="10" width="40" height="30" rx="6" fill={W} /><rect x="4" y="10" width="40" height="8" rx="5" fill={N} /><circle cx="16" cy="27" r="6" fill={N2} /><path d="M8 38c0-4.4 3.6-7.4 8-7.4s8 3 8 7.4z" fill={N2} /><rect x="28" y="23" width="12" height="3.2" rx="1.6" fill={N2} /><rect x="28" y="30" width="9" height="3.2" rx="1.6" fill={N2} /><rect x="20" y="2" width="8" height="10" rx="2" fill={B} /></S>,
  /* Perisai + bintang */
  poin: p => <S {...p}><path d="M24 3l16 6.5v12.5c0 9.6-6.8 17.4-16 21.5C14.8 39.4 8 31.6 8 22V9.5z" fill={W} /><path d="M24 3v40c9.2-4.1 16-11.9 16-21.5V9.5z" fill={B} /><path d="M24 14l2.8 5.8 6.4 1-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-1z" fill={N} /></S>,
  /* Koper PKL */
  pkl: p => <S {...p}><rect x="4" y="14" width="40" height="26" rx="5" fill={W} /><path d="M16 14v-3.5A4.5 4.5 0 0120.5 6h7a4.5 4.5 0 014.5 4.5V14" stroke={B} strokeWidth="3.4" strokeLinecap="round" fill="none" /><rect x="4" y="23" width="40" height="4.5" fill={N2} /><rect x="20" y="20" width="8" height="10" rx="2.4" fill={N} /></S>,
  /* Formulir pendaftaran + tombol tambah */
  daftar: p => <S {...p}><rect x="7" y="4" width="27" height="36" rx="4" fill={W} /><circle cx="20.5" cy="15" r="6" fill={N2} /><path d="M12.5 27c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill={N2} /><rect x="13" y="32" width="15" height="2.8" rx="1.4" fill={N2} /><circle cx="37" cy="34" r="10" fill={B} /><path d="M37 29v10M32 34h10" stroke={N} strokeWidth="3.2" strokeLinecap="round" /></S>,
  /* Lembar nilai berkisi + pensil — Form Nilai Rapor (guru mapel → wali kelas) */
  formNilai: p => <S {...p}><rect x="5" y="6" width="30" height="36" rx="3.5" fill={W} /><rect x="5" y="6" width="30" height="8" rx="3.5" fill={N} /><path d="M5 22h30M5 30h30M15 14v28M25 14v28" stroke={N2} strokeWidth="1.8" /><path d="M31 38l12-12 4 4-12 12-5.5 1.5z" fill={B} /><path d="M41 28l4 4" stroke={G} strokeWidth="2.4" strokeLinecap="round" /></S>,
  /* Papan tulis + guru */
  guru: p => <S {...p}><rect x="4" y="5" width="40" height="24" rx="4" fill={W} /><path d="M10 13h16M10 20h11" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><path d="M29 21l8-6" stroke={N2} strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="34" r="6.5" fill={B} /><path d="M21 46c0-5.2 4.9-9 11-9s11 3.8 11 9z" fill={B} /></S>,
  /* ── Stok gambar cadangan: dipakai otomatis bila gambar pilihan sudah terpakai menu lain di
        halaman yang sama, supaya tidak ada dua ubin bergambar sama (user 18 Sep 2026) ── */
  kunci: p => <S {...p}><circle cx="18" cy="24" r="11" fill={W} /><circle cx="18" cy="24" r="4.4" fill={N} /><path d="M27 24h17v6h-4v-4h-4v5h-5v-7z" fill={B} /></S>,
  bintang: p => <S {...p}><path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7 12.8 39.6l2.1-12.5-9.1-8.9 12.6-1.8z" fill={W} /><path d="M24 12.5l3.2 6.6 7.2 1-5.2 5.1 1.2 7.2L24 29z" fill={N2} /></S>,
  hati: p => <S {...p}><path d="M24 42S5 30 5 17.5A9.5 9.5 0 0124 12a9.5 9.5 0 0119 5.5C43 30 24 42 24 42z" fill={W} /><path d="M24 42S5 30 5 17.5A9.5 9.5 0 0114.5 8c3.6 0 6.9 2 8.5 5.2z" fill={B} /></S>,
  api: p => <S {...p}><path d="M24 4c8 8 12 13 12 21a12 12 0 01-24 0c0-5 3-9 6-13 1 3 3 5 5 6 2-4 1-9 1-14z" fill={W} /><path d="M24 24c3 3 5 5 5 8a5 5 0 01-10 0c0-3 2-5 5-8z" fill={N} /></S>,
  tetes: p => <S {...p}><path d="M24 4c8 10 13 16 13 23a13 13 0 01-26 0c0-7 5-13 13-23z" fill={W} /><path d="M18 27c0 4 2.6 7 6 7.6" stroke={N} strokeWidth="3" strokeLinecap="round" /></S>,
  petir: p => <S {...p}><path d="M27 4L11 27h10l-4 17 18-25H24z" fill={W} /></S>,
  awan: p => <S {...p}><path d="M14 36a9 9 0 01-1-17.9A12 12 0 0136 20a8 8 0 01-1 16z" fill={W} /><path d="M18 36h16" stroke={N2} strokeWidth="2.6" strokeLinecap="round" /></S>,
  kompas: p => <S {...p}><circle cx="24" cy="24" r="18" fill={W} /><path d="M31 17l-5 12-12 5 5-12z" fill={N} /><circle cx="24" cy="24" r="2.4" fill={W} /></S>,
  target: p => <S {...p}><circle cx="24" cy="24" r="18" fill={W} /><circle cx="24" cy="24" r="11" fill={N2} /><circle cx="24" cy="24" r="4.5" fill={N} /></S>,
  gunting: p => <S {...p}><path d="M14 8l20 26M34 8L14 34" stroke={W} strokeWidth="3.4" strokeLinecap="round" /><circle cx="12" cy="38" r="5.5" fill={W} /><circle cx="36" cy="38" r="5.5" fill={B} /></S>,
  klip: p => <S {...p}><path d="M33 20v14a9 9 0 01-18 0V15a6 6 0 0112 0v18a3 3 0 01-6 0V20" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" /></S>,
  kalkulator: p => <S {...p}><rect x="9" y="4" width="30" height="40" rx="5" fill={W} /><rect x="14" y="9" width="20" height="8" rx="2" fill={N} /><circle cx="17" cy="24" r="2.6" fill={N2} /><circle cx="24" cy="24" r="2.6" fill={N2} /><circle cx="31" cy="24" r="2.6" fill={N2} /><circle cx="17" cy="32" r="2.6" fill={N2} /><circle cx="24" cy="32" r="2.6" fill={N2} /><rect x="28.4" y="29.4" width="5.2" height="9" rx="2.6" fill={B} /></S>,
  mikrofon: p => <S {...p}><rect x="18" y="5" width="12" height="22" rx="6" fill={W} /><path d="M12 22a12 12 0 0024 0" stroke={B} strokeWidth="3.4" strokeLinecap="round" fill="none" /><path d="M24 34v8M18 42h12" stroke={W} strokeWidth="3.4" strokeLinecap="round" /></S>,
  headset: p => <S {...p}><path d="M10 28v-4a14 14 0 0128 0v4" stroke={W} strokeWidth="4" fill="none" /><rect x="5" y="26" width="9" height="14" rx="4" fill={W} /><rect x="34" y="26" width="9" height="14" rx="4" fill={B} /></S>,
  tas: p => <S {...p}><path d="M9 16h30l3 26H6z" fill={W} /><path d="M17 16v-4a7 7 0 0114 0v4" stroke={B} strokeWidth="3.4" fill="none" /><rect x="19" y="24" width="10" height="4" rx="2" fill={N} /></S>,
  jamTangan: p => <S {...p}><rect x="17" y="2" width="14" height="10" rx="3" fill={B} /><rect x="17" y="36" width="14" height="10" rx="3" fill={B} /><circle cx="24" cy="24" r="13" fill={W} /><path d="M24 17v7l5 3" stroke={N} strokeWidth="2.8" strokeLinecap="round" /></S>,
  lampu: p => <S {...p}><path d="M24 5a13 13 0 00-8 23v4h16v-4a13 13 0 00-8-23z" fill={W} /><rect x="18" y="35" width="12" height="4" rx="2" fill={N} /><rect x="20" y="41" width="8" height="3" rx="1.5" fill={N2} /></S>,
  tanaman: p => <S {...p}><path d="M24 40V22" stroke={N} strokeWidth="3" strokeLinecap="round" /><path d="M24 24c-8 0-12-5-12-12 8 0 12 4 12 12z" fill={W} /><path d="M24 28c8 0 12-5 12-12-8 0-12 4-12 12z" fill={B} /><path d="M14 40h20l-2 5H16z" fill={N2} /></S>,
  gelas: p => <S {...p}><path d="M13 8h22l-3 30a4 4 0 01-4 4h-8a4 4 0 01-4-4z" fill={W} /><path d="M14 20h20" stroke={N2} strokeWidth="2.6" /></S>,
  palu: p => <S {...p}><rect x="6" y="30" width="28" height="7" rx="3" transform="rotate(-35 6 30)" fill={W} /><rect x="24" y="6" width="18" height="10" rx="4" transform="rotate(35 24 6)" fill={B} /><rect x="8" y="40" width="26" height="5" rx="2.5" fill={N} /></S>,
  timbangan: p => <S {...p}><path d="M24 8v32M12 40h24" stroke={W} strokeWidth="3.4" strokeLinecap="round" /><path d="M8 18h32" stroke={B} strokeWidth="3" strokeLinecap="round" /><path d="M4 30a8 8 0 008 0l-4-12z" fill={W} /><path d="M36 30a8 8 0 008 0l-4-12z" fill={W} /></S>,
  papanNama: p => <S {...p}><rect x="5" y="12" width="38" height="24" rx="4" fill={W} /><rect x="11" y="19" width="14" height="3.4" rx="1.7" fill={N} /><rect x="11" y="26" width="9" height="3.4" rx="1.7" fill={N2} /><rect x="30" y="18" width="8" height="12" rx="2" fill={B} /></S>,
  sertifikat: p => <S {...p}><rect x="6" y="8" width="36" height="24" rx="4" fill={W} /><path d="M12 16h16M12 22h10" stroke={N2} strokeWidth="2.4" strokeLinecap="round" /><circle cx="33" cy="30" r="7" fill={B} /><path d="M29 36l-1 8 5-2.5 5 2.5-1-8z" fill={N2} /></S>,
  sidikJari: p => <S {...p}><path d="M24 6c8 0 14 6 14 14v6M10 20c0-8 6-14 14-14" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" /><path d="M17 22a7 7 0 0114 0v10M24 22v16M31 30v6" stroke={W} strokeWidth="3" strokeLinecap="round" fill="none" /><path d="M10 26v6" stroke={B} strokeWidth="3" strokeLinecap="round" /></S>,
  cctv: p => <S {...p}><rect x="6" y="12" width="26" height="12" rx="4" transform="rotate(-12 6 12)" fill={W} /><path d="M30 14l10-4v12l-10-4z" fill={B} /><path d="M16 26l4 16" stroke={N} strokeWidth="3" strokeLinecap="round" /></S>,
  proyektor: p => <S {...p}><rect x="6" y="16" width="36" height="18" rx="5" fill={W} /><circle cx="18" cy="25" r="6" fill={N} /><circle cx="33" cy="21" r="2.4" fill={N2} /><path d="M12 34v6M36 34v6" stroke={B} strokeWidth="3" strokeLinecap="round" /></S>,
  bendera: p => <S {...p}><path d="M12 5v38" stroke={W} strokeWidth="3.6" strokeLinecap="round" /><path d="M14 8h24l-5 7 5 7H14z" fill={W} /><path d="M14 8h12l-5 7 5 7H14z" fill={N2} /></S>,
  payung: p => <S {...p}><path d="M4 24a20 20 0 0140 0z" fill={W} /><path d="M24 24v14a5 5 0 0010 0" stroke={B} strokeWidth="3.4" strokeLinecap="round" fill="none" /><path d="M14 24c0-8 4-14 10-14s10 6 10 14" stroke={N2} strokeWidth="2.6" fill="none" /></S>,
  roket: p => <S {...p}><path d="M24 4c7 6 10 13 10 22l-4 6H18l-4-6c0-9 3-16 10-22z" fill={W} /><circle cx="24" cy="18" r="4.4" fill={N} /><path d="M18 32l-6 8 8-2M30 32l6 8-8-2" fill={B} /></S>,
  pin: p => <S {...p}><path d="M24 4a13 13 0 0113 13c0 10-13 27-13 27S11 27 11 17A13 13 0 0124 4z" fill={W} /><circle cx="24" cy="17" r="5" fill={N} /></S>,
  plakat: p => <S {...p}><rect x="8" y="6" width="32" height="26" rx="4" fill={W} /><path d="M14 14h20M14 21h14" stroke={N2} strokeWidth="2.6" strokeLinecap="round" /><path d="M18 32l-2 10 8-4 8 4-2-10z" fill={B} /></S>,
  gembokBuka: p => <S {...p}><rect x="10" y="20" width="28" height="22" rx="5" fill={W} /><path d="M17 20v-5a7 7 0 0113-3.5" stroke={B} strokeWidth="3.6" strokeLinecap="round" fill="none" /><circle cx="24" cy="31" r="3.4" fill={N} /></S>,
  kirim: p => <S {...p}><rect x="4" y="12" width="30" height="22" rx="4" fill={W} /><path d="M5 15l14 10 14-10" stroke={N2} strokeWidth="2.4" fill="none" /><path d="M32 30h12m0 0l-4-4m4 4l-4 4" stroke={B} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></S>,
  agenda: p => <S {...p}><rect x="8" y="6" width="32" height="36" rx="4" fill={W} /><rect x="8" y="6" width="32" height="8" rx="4" fill={N} /><path d="M15 22h18M15 29h18M15 36h11" stroke={N2} strokeWidth="2.4" strokeLinecap="round" /></S>,
  panah: p => <S {...p}><path d="M6 32l12-12 8 8 16-16" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M32 12h10v10" stroke={B} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></S>,
  alarm: p => <S {...p}><circle cx="24" cy="26" r="15" fill={W} /><path d="M24 18v8l5 4" stroke={N} strokeWidth="3" strokeLinecap="round" /><path d="M8 10l6-5M40 10l-6-5" stroke={B} strokeWidth="3.4" strokeLinecap="round" /></S>,
  kotakArsip: p => <S {...p}><rect x="6" y="14" width="36" height="26" rx="4" fill={W} /><rect x="4" y="8" width="40" height="8" rx="3" fill={B} /><rect x="18" y="22" width="12" height="4" rx="2" fill={N} /></S>,
  pita: p => <S {...p}><circle cx="24" cy="18" r="11" fill={W} /><circle cx="24" cy="18" r="5" fill={N} /><path d="M17 27l-4 15 11-6 11 6-4-15" fill={B} /></S>,
  medis: p => <S {...p}><rect x="5" y="14" width="38" height="24" rx="5" fill={W} /><path d="M18 14v-3a4 4 0 014-4h4a4 4 0 014 4v3" stroke={B} strokeWidth="3" fill="none" /><path d="M24 20v12M18 26h12" stroke={N} strokeWidth="3.4" strokeLinecap="round" /></S>,
  sepeda: p => <S {...p}><circle cx="12" cy="32" r="9" fill={W} /><circle cx="36" cy="32" r="9" fill={B} /><path d="M12 32l8-14h10l6 14M20 18h8" stroke={N} strokeWidth="2.8" strokeLinecap="round" fill="none" /></S>,
  bus: p => <S {...p}><rect x="7" y="8" width="34" height="26" rx="5" fill={W} /><rect x="11" y="13" width="26" height="9" rx="2" fill={N} /><circle cx="15" cy="36" r="4" fill={B} /><circle cx="33" cy="36" r="4" fill={B} /></S>,
  rumah: p => <S {...p}><path d="M24 5l19 15v22H5V20z" fill={W} /><rect x="19" y="27" width="10" height="15" rx="2" fill={N} /><rect x="11" y="24" width="6" height="6" rx="1.5" fill={N2} /></S>,
  jembatan: p => <S {...p}><path d="M4 32c8 0 8-14 20-14s12 14 20 14" stroke={W} strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M4 38h40M12 32v6M24 24v14M36 32v6" stroke={B} strokeWidth="3" strokeLinecap="round" /></S>,
  teropong: p => <S {...p}><rect x="6" y="18" width="14" height="24" rx="6" fill={W} /><rect x="28" y="18" width="14" height="24" rx="6" fill={B} /><path d="M20 26h8" stroke={N} strokeWidth="3" /><path d="M10 18l4-12h4l-2 12M38 18l-4-12h-4l2 12" fill={N2} /></S>,
  kuas: p => <S {...p}><path d="M34 6l8 8-16 16-8-8z" fill={W} /><path d="M18 22l8 8-4 8a8 8 0 01-12-4z" fill={B} /><path d="M6 42c4 0 6-2 6-6" stroke={N} strokeWidth="2.6" strokeLinecap="round" /></S>,
  palet: p => <S {...p}><path d="M24 6c11 0 18 7 18 15 0 6-6 7-9 9-2 1-3 3-2 5 1 3-1 6-6 6C13 41 6 33 6 23 6 13 13 6 24 6z" fill={W} /><circle cx="17" cy="18" r="3" fill={N} /><circle cx="27" cy="15" r="3" fill={N2} /><circle cx="33" cy="23" r="3" fill={N} /></S>,
  /* ── Pemecah kelompok besar supaya antar-menu tidak bergambar sama (18 Sep 2026) ── */
  monitoring: p => <S {...p}><circle cx="24" cy="24" r="17" fill={W} /><path d="M24 24l10-8" stroke={N} strokeWidth="3" strokeLinecap="round" /><circle cx="24" cy="24" r="3" fill={N} /><path d="M24 7v4M41 24h-4M24 41v-4M7 24h4" stroke={N2} strokeWidth="2.6" strokeLinecap="round" /></S>,
  donat: p => <S {...p}><circle cx="24" cy="24" r="17" fill={B} /><path d="M24 7a17 17 0 0116.2 11.8L24 24z" fill={W} /><path d="M24 24l16.2-5.2A17 17 0 0131 39.6z" fill={N2} /><circle cx="24" cy="24" r="7.5" fill={N} /></S>,
  konseling: p => <S {...p}><path d="M8 9h32a4 4 0 014 4v15a4 4 0 01-4 4H23l-9 7v-7H8a4 4 0 01-4-4V13a4 4 0 014-4z" fill={W} /><path d="M24 15c2-2.6 6-2 6 1.4 0 2.8-3.6 4.8-6 6.6-2.4-1.8-6-3.8-6-6.6 0-3.4 4-4 6-1.4z" fill={N} /></S>,
  telepon: p => <S {...p}><path d="M12 6h8l4 9-5 3c2 4 5 7 9 9l3-5 9 4v8c0 2-2 4-4 4C20 38 10 28 8 12c0-2 2-4 4-6z" fill={W} /><circle cx="36" cy="12" r="6" fill={B} /><path d="M33 12h6M36 9v6" stroke={N} strokeWidth="2.2" strokeLinecap="round" /></S>,
  kotaksaran: p => <S {...p}><rect x="6" y="18" width="36" height="22" rx="5" fill={W} /><path d="M17 18V9h14v9" stroke={B} strokeWidth="3" fill="none" /><rect x="20" y="24" width="8" height="3" rx="1.5" fill={N} /><path d="M24 12v-6M20 8l4-4 4 4" stroke={N2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></S>,
  rpp: p => <S {...p}><rect x="9" y="4" width="24" height="36" rx="4" fill={W} /><path d="M14 13h14M14 20h10" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><path d="M38 18l6 6-14 14-8 2 2-8z" fill={B} /><path d="M38 18l6 6-2.6 2.6-6-6z" fill={N} /></S>,
  mapel: p => <S {...p}><rect x="8" y="7" width="32" height="34" rx="4" fill={W} /><rect x="8" y="7" width="8" height="34" rx="3" fill={N2} /><path d="M22 18h12M22 25h12M22 32h8" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><circle cx="36" cy="12" r="4" fill={B} /></S>,
  penugasan: p => <S {...p}><rect x="6" y="9" width="26" height="32" rx="4" fill={W} /><path d="M11 18h16M11 25h12" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><circle cx="37" cy="17" r="6" fill={B} /><path d="M28 41c0-5 4-8.5 9-8.5s9 3.5 9 8.5z" fill={B} /></S>,
  tatatertib: p => <S {...p}><rect x="9" y="5" width="30" height="38" rx="4" fill={W} /><path d="M15 15h18M15 22h18M15 29h12" stroke={N2} strokeWidth="2.4" strokeLinecap="round" /><circle cx="33" cy="33" r="8" fill={B} /><path d="M33 29v5M33 37.5v.5" stroke={N} strokeWidth="3" strokeLinecap="round" /></S>,
  rambu: p => <S {...p}><path d="M24 4l20 36H4z" fill={W} /><path d="M24 18v10M24 33v.5" stroke={N} strokeWidth="3.4" strokeLinecap="round" /></S>,
  kalenderCentang: p => <S {...p}><rect x="5" y="9" width="37" height="34" rx="6" fill={W} /><rect x="5" y="9" width="37" height="9" rx="5" fill={N2} /><rect x="13" y="4" width="4.5" height="9" rx="2.2" fill={B} /><rect x="29" y="4" width="4.5" height="9" rx="2.2" fill={B} /><path d="M16 30l5 5 11-11" stroke={N} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" /></S>,
  jamPasir: p => <S {...p}><path d="M13 5h22M13 43h22" stroke={W} strokeWidth="4" strokeLinecap="round" /><path d="M16 5c0 8 8 11 8 19s-8 11-8 19h16c0-8-8-11-8-19s8-11 8-19z" fill={W} /><path d="M20 12h8c0 4-4 6-4 6s-4-2-4-6z" fill={N} /><path d="M24 30s4 2 4 6h-8c0-4 4-6 4-6z" fill={N2} /></S>,
  dompet: p => <S {...p}><rect x="5" y="11" width="38" height="26" rx="5" fill={W} /><path d="M5 18h38" stroke={N2} strokeWidth="2.4" /><rect x="30" y="21" width="13" height="9" rx="4" fill={B} /><circle cx="36.5" cy="25.5" r="2.4" fill={N} /></S>,
  /* ── Tambahan supaya SEMUA menu bergambar dengan gaya yang sama (18 Sep 2026) ── */
  dashboard: p => <S {...p}><rect x="5" y="7" width="38" height="34" rx="5" fill={W} /><rect x="10" y="24" width="6" height="11" rx="2" fill={N} /><rect x="20" y="18" width="6" height="17" rx="2" fill={N} /><rect x="30" y="13" width="6" height="22" rx="2" fill={N} /><rect x="5" y="7" width="38" height="7" rx="4" fill={B} /></S>,
  dokumen: p => <S {...p}><path d="M10 4h16l10 10v30H10z" fill={W} /><path d="M26 4l10 10H26z" fill={G} /><path d="M15 21h16M15 28h16M15 35h11" stroke={N} strokeWidth="2.4" strokeLinecap="round" /></S>,
  tabel: p => <S {...p}><rect x="4" y="8" width="40" height="32" rx="5" fill={W} /><rect x="4" y="8" width="40" height="9" rx="4" fill={B} /><path d="M18 17v23M31 17v23M4 28h40" stroke={N} strokeWidth="1.8" /></S>,
  uang: p => <S {...p}><rect x="4" y="12" width="40" height="24" rx="5" fill={W} /><circle cx="24" cy="24" r="7" fill={N} /><path d="M24 20v8M21.5 22.5h5M21.5 26h5" stroke={W} strokeWidth="2" strokeLinecap="round" /><rect x="8" y="16" width="4" height="16" rx="2" fill={G} /><rect x="36" y="16" width="4" height="16" rx="2" fill={G} /></S>,
  aset: p => <S {...p}><path d="M24 5l17 8v22l-17 8-17-8V13z" fill={W} /><path d="M24 5l17 8-17 8-17-8z" fill={B} /><rect x="20" y="24" width="8" height="8" rx="2" fill={N} /></S>,
  alat: p => <S {...p}><path d="M30 6a10 10 0 00-9 14L7 34l5 5 14-14a10 10 0 1014-19l-6 6-4-4 6-6a10 10 0 00-6-1z" fill={W} /><circle cx="14" cy="36" r="2.6" fill={N} /></S>,
  kesehatan: p => <S {...p}><path d="M24 42S6 30 6 18A9 9 0 0124 13 9 9 0 0142 18c0 12-18 24-18 24z" fill={W} /><path d="M24 19v10M19 24h10" stroke={N} strokeWidth="3.6" strokeLinecap="round" /></S>,
  bel: p => <S {...p}><path d="M24 5a11 11 0 0111 11v10l4 6H9l4-6V16A11 11 0 0124 5z" fill={W} /><path d="M19 36a5 5 0 0010 0z" fill={B} /></S>,
  kamera: p => <S {...p}><rect x="4" y="13" width="40" height="26" rx="5" fill={W} /><path d="M17 13l3-5h8l3 5z" fill={B} /><circle cx="24" cy="26" r="8.5" fill={N} /><circle cx="24" cy="26" r="4" fill={W} /></S>,
  keamanan: p => <S {...p}><rect x="10" y="20" width="28" height="22" rx="5" fill={W} /><path d="M17 20v-5a7 7 0 0114 0v5" stroke={B} strokeWidth="3.6" strokeLinecap="round" fill="none" /><circle cx="24" cy="30" r="3.2" fill={N} /><rect x="22.6" y="31" width="2.8" height="6" rx="1.4" fill={N} /></S>,
  pengaturan: p => <S {...p}><path d="M24 7l3.4 4.6 5.6-1.2 1 5.7 5.2 2.4-2.8 5 2.8 5-5.2 2.4-1 5.7-5.6-1.2L24 41l-3.4-4.6-5.6 1.2-1-5.7-5.2-2.4 2.8-5-2.8-5 5.2-2.4 1-5.7 5.6 1.2z" fill={W} /><circle cx="24" cy="24" r="6.5" fill={N} /></S>,
  unduh: p => <S {...p}><rect x="9" y="5" width="22" height="28" rx="4" fill={W} /><path d="M14 13h12M14 19h9" stroke={N} strokeWidth="2.2" strokeLinecap="round" /><circle cx="34" cy="33" r="10" fill={B} /><path d="M34 28v9M30 33.5l4 4 4-4" stroke={N} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></S>,
  unggah: p => <S {...p}><rect x="9" y="5" width="22" height="28" rx="4" fill={W} /><path d="M14 13h12M14 19h9" stroke={N} strokeWidth="2.2" strokeLinecap="round" /><circle cx="34" cy="33" r="10" fill={B} /><path d="M34 38v-9M30 33.5l4-4 4 4" stroke={N} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></S>,
  pesan: p => <S {...p}><path d="M8 8h32a4 4 0 014 4v17a4 4 0 01-4 4H22l-9 7v-7H8a4 4 0 01-4-4V12a4 4 0 014-4z" fill={W} /><path d="M15 17h18M15 24h12" stroke={N} strokeWidth="2.8" strokeLinecap="round" /></S>,
  jam: p => <S {...p}><circle cx="24" cy="25" r="18" fill={W} /><circle cx="24" cy="25" r="13.5" fill={G} /><path d="M24 16v9.5l6 4" stroke={N} strokeWidth="3" strokeLinecap="round" /><rect x="20" y="3" width="8" height="5" rx="2" fill={B} /></S>,
  prestasi: p => <S {...p}><path d="M14 6h20v10a10 10 0 01-20 0z" fill={W} /><path d="M14 9H8v3a8 8 0 006 7.7M34 9h6v3a8 8 0 01-6 7.7" stroke={B} strokeWidth="2.6" fill="none" /><rect x="21" y="26" width="6" height="8" fill={B} /><path d="M14 42c0-4 4.5-7 10-7s10 3 10 7z" fill={W} /></S>,
  /* Layar TV di kaki penyangga + siaran — Papan & TV */
  papanTv: p => <S {...p}><rect x="5" y="8" width="38" height="25" rx="4" fill={W} /><rect x="10" y="13" width="17" height="3" rx="1.5" fill={N} /><rect x="10" y="19" width="12" height="3" rx="1.5" fill={N2} /><path d="M19 33h10l3 8H16z" fill={B} /><path d="M13 41h22" stroke={G} strokeWidth="3" strokeLinecap="round" /></S>,
  /* Kotak perangkat + antena & gelombang — Perangkat Jaringan (AP/router) */
  perangkatJaringan: p => <S {...p}><rect x="6" y="26" width="36" height="13" rx="4" fill={W} /><circle cx="14" cy="32.5" r="2.4" fill={N} /><circle cx="21" cy="32.5" r="2.4" fill={N2} /><path d="M33 26V16" stroke={N} strokeWidth="2.6" strokeLinecap="round" /><path d="M27 14a9 9 0 0112 0" stroke={B} strokeWidth="3" strokeLinecap="round" fill="none" /><path d="M23 9a16 16 0 0120 0" stroke={G} strokeWidth="3" strokeLinecap="round" fill="none" /></S>,
  /* Perisai + gelombang sinyal — Mode Ujian Jaringan (pembatasan saat ujian) */
  jaringanUjian: p => <S {...p}><path d="M24 4l16 6v14c0 10-7 17-16 20-9-3-16-10-16-20V10z" fill={W} /><path d="M17 23a10 10 0 0114 0" stroke={N} strokeWidth="3" strokeLinecap="round" fill="none" /><path d="M21 29a4.5 4.5 0 016 0" stroke={N2} strokeWidth="3" strokeLinecap="round" fill="none" /><circle cx="24" cy="34" r="2.2" fill={N} /></S>,
  jaringan: p => <S {...p}><circle cx="24" cy="10" r="6" fill={W} /><circle cx="10" cy="36" r="6" fill={B} /><circle cx="38" cy="36" r="6" fill={B} /><path d="M24 16v8M24 24l-11 8M24 24l11 8" stroke={G} strokeWidth="2.8" strokeLinecap="round" /></S>,
  printer: p => <S {...p}><rect x="12" y="5" width="24" height="12" rx="2.5" fill={G} /><rect x="6" y="17" width="36" height="16" rx="4" fill={W} /><circle cx="36" cy="23" r="2.2" fill={N} /><rect x="12" y="29" width="24" height="14" rx="2.5" fill={B} /></S>,
  lab: p => <S {...p}><path d="M20 5h8v13l9 17a5 5 0 01-4.4 7.5H15.4A5 5 0 0111 35l9-17z" fill={W} /><path d="M14.6 31h18.8l3.4 6.2A3 3 0 0134 41H14a3 3 0 01-2.6-4.4z" fill={N} /><rect x="18" y="3" width="12" height="4" rx="2" fill={B} /></S>,
  gedung: p => <S {...p}><rect x="7" y="8" width="20" height="34" rx="3" fill={W} /><rect x="27" y="18" width="14" height="24" rx="3" fill={B} /><rect x="12" y="14" width="5" height="5" rx="1.2" fill={N} /><rect x="19" y="14" width="5" height="5" rx="1.2" fill={N} /><rect x="12" y="23" width="5" height="5" rx="1.2" fill={N} /><rect x="31" y="24" width="6" height="5" rx="1.2" fill={G} /></S>,
  arsip: p => <S {...p}><rect x="5" y="9" width="38" height="10" rx="3" fill={W} /><rect x="8" y="19" width="32" height="22" rx="4" fill={B} /><rect x="18" y="25" width="12" height="4" rx="2" fill={W} /></S>,
  kotak: p => <S {...p}><path d="M6 15l18-8 18 8-18 8z" fill={B} /><path d="M6 15v18l18 8V23z" fill={W} /><path d="M42 15v18l-18 8V23z" fill={G} /></S>,
  mutasi: p => <S {...p}><rect x="5" y="9" width="17" height="30" rx="4" fill={W} /><rect x="26" y="9" width="17" height="30" rx="4" fill={B} /><path d="M20 20h10m0 0l-3.5-3.5M30 20l-3.5 3.5" stroke={N} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M28 30H18m0 0l3.5-3.5M18 30l3.5 3.5" stroke={G} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></S>,
  tangga: p => <S {...p}><rect x="6" y="30" width="10" height="12" rx="2" fill={G} /><rect x="19" y="21" width="10" height="21" rx="2" fill={B} /><rect x="32" y="11" width="10" height="31" rx="2" fill={W} /><path d="M11 26l11-9 11-9" stroke={W} strokeWidth="2.4" strokeLinecap="round" fill="none" /></S>,
  pintu: p => <S {...p}><rect x="10" y="5" width="24" height="38" rx="4" fill={W} /><circle cx="28" cy="25" r="2.6" fill={N} /><rect x="36" y="20" width="6" height="12" rx="3" fill={B} /></S>,
  bola: p => <S {...p}><circle cx="24" cy="24" r="18" fill={W} /><path d="M24 12l6 4.5-2.3 7h-7.4l-2.3-7z" fill={N} /><path d="M24 6v6M8 20l6 3M40 20l-6 3M14 40l4-6M34 40l-4-6" stroke={B} strokeWidth="2.4" strokeLinecap="round" /></S>,
  suara: p => <S {...p}><rect x="8" y="16" width="32" height="26" rx="4" fill={W} /><path d="M18 16V9a6 6 0 0112 0v7" stroke={B} strokeWidth="3" fill="none" /><rect x="20" y="24" width="8" height="10" rx="2" fill={N} /></S>,
  peta: p => <S {...p}><path d="M6 12l12-5 12 5 12-5v29l-12 5-12-5-12 5z" fill={W} /><path d="M18 7v29M30 12v29" stroke={N} strokeWidth="2" /><circle cx="24" cy="20" r="4" fill={N} /></S>,
  stempel: p => <S {...p}><path d="M18 6h12v9l5 8H13l5-8z" fill={W} /><rect x="8" y="25" width="32" height="8" rx="3" fill={B} /><rect x="12" y="35" width="24" height="6" rx="3" fill={G} /></S>,
  pesawat: p => <S {...p}><path d="M44 6L6 22l14 5 3 13 6-9 11 6z" fill={W} /><path d="M20 27l24-21-17 25z" fill={B} /></S>,
  catatan: p => <S {...p}><rect x="8" y="6" width="32" height="36" rx="4" fill={W} /><path d="M15 16h18M15 24h18M15 32h11" stroke={N} strokeWidth="2.4" strokeLinecap="round" /><rect x="8" y="6" width="5" height="36" fill={B} /></S>,
  rapat: p => <S {...p}><circle cx="14" cy="14" r="5" fill={W} /><circle cx="34" cy="14" r="5" fill={B} /><circle cx="24" cy="12" r="6" fill={W} /><rect x="6" y="24" width="36" height="8" rx="4" fill={G} /><rect x="14" y="32" width="20" height="9" rx="3" fill={W} /></S>,
  kaca: p => <S {...p}><circle cx="21" cy="21" r="13" fill={W} /><circle cx="21" cy="21" r="8" fill={N} /><rect x="30" y="30" width="14" height="6" rx="3" transform="rotate(45 30 30)" fill={B} /></S>,
  monitor: p => <S {...p}><rect x="4" y="8" width="40" height="26" rx="4" fill={W} /><rect x="9" y="13" width="30" height="16" rx="2" fill={N} /><rect x="18" y="36" width="12" height="4" rx="2" fill={B} /><rect x="14" y="40" width="20" height="3" rx="1.5" fill={G} /></S>,
  server: p => <S {...p}><rect x="8" y="6" width="32" height="11" rx="3" fill={W} /><rect x="8" y="19" width="32" height="11" rx="3" fill={B} /><rect x="8" y="32" width="32" height="11" rx="3" fill={G} /><circle cx="14" cy="11.5" r="2" fill={N} /><circle cx="14" cy="24.5" r="2" fill={N} /></S>,
  globe: p => <S {...p}><circle cx="24" cy="24" r="18" fill={W} /><path d="M6 24h36M24 6c5 6 5 30 0 36M24 6c-5 6-5 30 0 36" stroke={N} strokeWidth="2.2" fill="none" /></S>,
  gambar: p => <S {...p}><rect x="5" y="9" width="38" height="30" rx="4" fill={W} /><circle cx="16" cy="19" r="4" fill={G} /><path d="M8 35l10-11 7 7 6-5 9 9z" fill={N} /></S>,
  koran: p => <S {...p}><rect x="5" y="9" width="34" height="30" rx="3" fill={W} /><rect x="39" y="15" width="5" height="24" rx="2" fill={B} /><rect x="10" y="14" width="12" height="9" rx="2" fill={N} /><path d="M25 15h9M25 20h9M10 28h24M10 33h18" stroke={N} strokeWidth="2" strokeLinecap="round" /></S>,
  tanya: p => <S {...p}><circle cx="24" cy="24" r="18" fill={W} /><path d="M19 19a5 5 0 119 3c-1.6 1.4-3 2.4-3 4.5" stroke={N} strokeWidth="3.2" strokeLinecap="round" fill="none" /><circle cx="24" cy="33" r="2.4" fill={N} /></S>,
  profil: p => <S {...p}><circle cx="24" cy="17" r="8" fill={W} /><path d="M8 42c0-8 7-13 16-13s16 5 16 13z" fill={B} /></S>,
  /* ===== Gambar khusus per fitur (18 September 2026) — dibuat supaya tidak ada dua FITUR BERBEDA
     yang memakai gambar sama. Fitur yang sama di beberapa portal memang sengaja tetap sama. ===== */
  /* Panah berputar + tumpukan basis data — sinkron Dapodik */
  sinkron: p => <S {...p}><ellipse cx="24" cy="12" rx="13" ry="5" fill={W} /><path d="M11 12v9c0 2.8 5.8 5 13 5s13-2.2 13-5v-9" fill={B} /><path d="M11 21v8c0 2.8 5.8 5 13 5s13-2.2 13-5v-8" fill={G} /><path d="M13 40a11 11 0 0018 3" stroke={N} strokeWidth="3" strokeLinecap="round" fill="none" /><path d="M31 37v6.5h-6.5" stroke={N} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></S>,
  /* Lembar tahun + panah maju — tahun ajaran */
  tahun: p => <S {...p}><rect x="6" y="8" width="30" height="33" rx="5" fill={W} /><rect x="6" y="8" width="30" height="9" rx="4.5" fill={N} /><rect x="11" y="23" width="18" height="3.4" rx="1.7" fill={N2} /><rect x="11" y="30" width="12" height="3.4" rx="1.7" fill={N2} /><circle cx="37" cy="33" r="9" fill={B} /><path d="M33 33h8M37.5 29.5L41 33l-3.5 3.5" stroke={N} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></S>,
  /* Kisi jadwal + kaca pembesar — pemeriksa jadwal */
  periksaJadwal: p => <S {...p}><rect x="4" y="7" width="31" height="30" rx="4" fill={W} /><path d="M4 15h31M14 7v30M24.5 7v30" stroke={N2} strokeWidth="2" /><circle cx="33" cy="32" r="9" fill={B} /><circle cx="33" cy="32" r="4.6" fill={W} /><path d="M39.5 38.5L44 43" stroke={N} strokeWidth="3.4" strokeLinecap="round" /></S>,
  /* Berkas + lencana centang — verifikasi perubahan data */
  verifikasi: p => <S {...p}><path d="M8 4h16l9 9v20H8z" fill={W} /><path d="M24 4l9 9h-9z" fill={N2} /><rect x="13" y="18" width="13" height="2.8" rx="1.4" fill={N2} /><rect x="13" y="24" width="9" height="2.8" rx="1.4" fill={N2} /><circle cx="34" cy="34" r="10" fill={B} /><path d="M29.6 34l3.2 3.2 6.2-6.4" stroke={N} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Tiga lembar bertumpuk + busur tahun — prota, promes, pekan efektif */
  prota: p => <S {...p}><rect x="6" y="14" width="24" height="29" rx="3.5" fill={G} /><rect x="10" y="10" width="24" height="29" rx="3.5" fill={B} /><rect x="14" y="6" width="24" height="29" rx="3.5" fill={W} /><rect x="19" y="14" width="14" height="2.8" rx="1.4" fill={N} /><rect x="19" y="21" width="10" height="2.8" rx="1.4" fill={N2} /><rect x="19" y="27" width="12" height="2.8" rx="1.4" fill={N2} /></S>,
  /* Papan jalan + buku terbuka — absensi & jurnal kelas */
  absensiJurnal: p => <S {...p}><rect x="4" y="5" width="24" height="29" rx="4" fill={W} /><rect x="10" y="2" width="12" height="6.5" rx="2.6" fill={B} /><path d="M9 18l3.6 3.6L20 14" stroke={N} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 30h11a3 3 0 013 3v11a4.5 4.5 0 00-4.5-3H20z" fill={B} /><path d="M46 30H35a3 3 0 00-3 3v11a4.5 4.5 0 014.5-3H46z" fill={G} /></S>,
  /* Kisi angka — DKN (daftar kumpulan nilai) */
  dkn: p => <S {...p}><rect x="4" y="7" width="40" height="34" rx="4" fill={W} /><rect x="4" y="7" width="40" height="8" rx="4" fill={N} /><path d="M17 15v26M30 15v26M4 24h40M4 33h40" stroke={N2} strokeWidth="2" /><rect x="7.5" y="18" width="6" height="3" rx="1.5" fill={N2} /><rect x="20.5" y="27" width="6" height="3" rx="1.5" fill={N2} /><rect x="33.5" y="36" width="6" height="3" rx="1.5" fill={N2} /></S>,
  /* Buku rapor berpindah tangan — penerimaan rapor */
  serahRapor: p => <S {...p}><rect x="9" y="4" width="26" height="22" rx="3.5" fill={W} /><rect x="14" y="11" width="14" height="2.8" rx="1.4" fill={N} /><rect x="14" y="17" width="9" height="2.8" rx="1.4" fill={N2} /><path d="M6 31c3-2 6-2 9 0l5 3h9a3 3 0 010 6H18c-4 0-6-1-9-3z" fill={B} /><path d="M38 27c3 0 5 2 5 5s-2 5-5 5h-6v-10z" fill={G} /></S>,
  /* Kisi angka + pena — input nilai kelas */
  nilai: p => <S {...p}><rect x="5" y="6" width="27" height="33" rx="4" fill={W} /><rect x="10" y="13" width="9" height="3" rx="1.5" fill={N} /><rect x="23" y="13" width="5" height="3" rx="1.5" fill={N2} /><rect x="10" y="21" width="9" height="3" rx="1.5" fill={N2} /><rect x="23" y="21" width="5" height="3" rx="1.5" fill={N2} /><rect x="10" y="29" width="9" height="3" rx="1.5" fill={N2} /><path d="M41 13l5 5-14 14-7 2 2-7z" fill={B} /><path d="M41 13l5 5-2.4 2.4-5-5z" fill={N} /></S>,
  /* Orang + kode QR kecil — presensi mandiri */
  presensiMandiri: p => <S {...p}><circle cx="18" cy="13" r="7.5" fill={W} /><path d="M5 40c0-7.4 5.8-12 13-12s13 4.6 13 12z" fill={W} /><rect x="27" y="25" width="18" height="18" rx="4" fill={B} /><rect x="30.5" y="28.5" width="5" height="5" rx="1.4" fill={N} /><rect x="36.5" y="28.5" width="5" height="5" rx="1.4" fill={N} /><rect x="30.5" y="34.5" width="5" height="5" rx="1.4" fill={N} /><rect x="37.5" y="35.5" width="3" height="3" rx="0.8" fill={N2} /></S>,
  /* Surat + siluet orang tua — panggilan orang tua */
  panggilanOrtu: p => <S {...p}><rect x="4" y="9" width="28" height="21" rx="4" fill={W} /><path d="M5 12l13 9 13-9" stroke={N} strokeWidth="2.4" strokeLinecap="round" fill="none" /><circle cx="34" cy="21" r="6" fill={B} /><path d="M24 43c0-6 4.5-10 10-10s10 4 10 10z" fill={B} /></S>,
  /* Kalender + jam janji — janji konseling / janji temu */
  janji: p => <S {...p}><rect x="4" y="9" width="30" height="30" rx="5" fill={W} /><rect x="4" y="9" width="30" height="8" rx="4" fill={N} /><rect x="10" y="4" width="4" height="8" rx="2" fill={B} /><rect x="24" y="4" width="4" height="8" rx="2" fill={B} /><rect x="9" y="22" width="5.5" height="5.5" rx="1.5" fill={N2} /><rect x="17" y="22" width="5.5" height="5.5" rx="1.5" fill={N2} /><circle cx="35" cy="33" r="10" fill={B} /><path d="M35 27.5V33l3.6 2.4" stroke={N} strokeWidth="3" strokeLinecap="round" /></S>,
  /* Berkas + panah bercabang — rujukan konseling */
  rujukan: p => <S {...p}><path d="M5 4h15l8 8v19H5z" fill={W} /><path d="M20 4l8 8h-8z" fill={N2} /><rect x="10" y="17" width="12" height="2.6" rx="1.3" fill={N2} /><path d="M25 38h7a4 4 0 004-4v-6" stroke={B} strokeWidth="3.4" strokeLinecap="round" fill="none" /><path d="M32 24.5l4 4 4-4" stroke={B} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="19" cy="38" r="5" fill={N} /></S>,
  /* Papan kanban tiga lajur — papan tugas */
  papanTugas: p => <S {...p}><rect x="4" y="7" width="40" height="34" rx="4" fill={W} /><rect x="8" y="13" width="9" height="13" rx="2" fill={N} /><rect x="8" y="29" width="9" height="7" rx="2" fill={N2} /><rect x="19.5" y="13" width="9" height="8" rx="2" fill={N2} /><rect x="19.5" y="24" width="9" height="12" rx="2" fill={N} /><rect x="31" y="13" width="9" height="10" rx="2" fill={N2} /></S>,
  /* Kartu pegawai + jam — presensi pegawai */
  presensiPegawai: p => <S {...p}><rect x="4" y="8" width="30" height="24" rx="4" fill={W} /><circle cx="14" cy="17" r="4.6" fill={N2} /><path d="M7.5 28c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" fill={N2} /><rect x="23" y="14" width="8" height="2.8" rx="1.4" fill={N2} /><rect x="23" y="20" width="6" height="2.8" rx="1.4" fill={N2} /><circle cx="35" cy="33" r="10" fill={B} /><path d="M35 27.5V33l3.6 2.4" stroke={N} strokeWidth="3" strokeLinecap="round" /></S>,
  /* Kartu keluar dari pencetak — cetak kartu tanda */
  kartuCetak: p => <S {...p}><rect x="6" y="20" width="36" height="16" rx="4" fill={B} /><circle cx="36" cy="28" r="2.4" fill={N} /><rect x="12" y="4" width="24" height="18" rx="3" fill={W} /><circle cx="19" cy="11" r="3.4" fill={N2} /><rect x="25" y="9" width="8" height="2.6" rx="1.3" fill={N2} /><rect x="25" y="14" width="6" height="2.6" rx="1.3" fill={N2} /><rect x="12" y="33" width="24" height="12" rx="3" fill={W} /><rect x="17" y="38" width="14" height="2.6" rx="1.3" fill={N2} /></S>,
  /* Map + segel pita — arsip SK & dokumen kepegawaian */
  arsipSk: p => <S {...p}><path d="M4 11a4 4 0 014-4h10l4 5h14a4 4 0 014 4v20a4 4 0 01-4 4H8a4 4 0 01-4-4z" fill={W} /><rect x="10" y="20" width="16" height="2.8" rx="1.4" fill={N2} /><circle cx="36" cy="33" r="8" fill={B} /><path d="M32 39l-1 8 5-2.6 5 2.6-1-8z" fill={G} /><circle cx="36" cy="33" r="3.4" fill={N} /></S>,
  /* Sapu + pengki — piket kebersihan kelas */
  piketKelas: p => <S {...p}><path d="M30 4l4 4-15 15-4-4z" fill={W} /><path d="M15 19l4 4-3 3a9 9 0 01-4-4z" fill={B} /><path d="M12 22l-8 14c4 4 10 5 14 3l-2-13z" fill={W} /><path d="M6 33l10 4" stroke={N2} strokeWidth="2" strokeLinecap="round" /><path d="M28 34h16l-3 10H31z" fill={B} /></S>,
  /* Koper + formulir — pendaftaran PKL */
  pklDaftar: p => <S {...p}><rect x="4" y="16" width="27" height="20" rx="4" fill={W} /><path d="M12 16v-2.6A3.4 3.4 0 0115.4 10h4.2A3.4 3.4 0 0123 13.4V16" stroke={B} strokeWidth="3" strokeLinecap="round" fill="none" /><rect x="4" y="23" width="27" height="3.6" fill={N2} /><circle cx="36" cy="33" r="10" fill={B} /><path d="M36 28v10M31 33h10" stroke={N} strokeWidth="3.2" strokeLinecap="round" /></S>,
  /* Pabrik — mitra industri */
  industri: p => <S {...p}><path d="M4 24l12-7v7l12-7v7l12-7v24H4z" fill={W} /><rect x="9" y="30" width="6" height="8" rx="1.5" fill={N2} /><rect x="21" y="30" width="6" height="8" rx="1.5" fill={N2} /><rect x="33" y="30" width="6" height="8" rx="1.5" fill={N2} /><rect x="35" y="4" width="6" height="12" rx="2" fill={B} /></S>,
  /* Papan pengumuman + koper — lowongan kerja BKK */
  lowongan: p => <S {...p}><rect x="4" y="6" width="40" height="27" rx="4" fill={W} /><rect x="10" y="12" width="15" height="3" rx="1.5" fill={N} /><rect x="10" y="19" width="20" height="3" rx="1.5" fill={N2} /><path d="M22 41v-3" stroke={N2} strokeWidth="2.4" strokeLinecap="round" /><rect x="26" y="24" width="18" height="14" rx="3.5" fill={B} /><path d="M31 24v-2.6a3 3 0 013-3h3a3 3 0 013 3V24" stroke={G} strokeWidth="2.8" fill="none" /><rect x="26" y="29" width="18" height="3" fill={N2} /></S>,
  /* Amplop + tanda tambah — permintaan surat */
  permintaanSurat: p => <S {...p}><rect x="4" y="10" width="32" height="23" rx="4" fill={W} /><path d="M5 13l15 10 15-10" stroke={N} strokeWidth="2.4" strokeLinecap="round" fill="none" /><circle cx="36" cy="33" r="10" fill={B} /><path d="M36 28v10M31 33h10" stroke={N} strokeWidth="3.2" strokeLinecap="round" /></S>,
  /* Amplop + panah bercabang — disposisi surat masuk */
  disposisi: p => <S {...p}><rect x="4" y="8" width="30" height="21" rx="4" fill={W} /><path d="M5 11l14 9 14-9" stroke={N} strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M19 33v4a4 4 0 004 4h5M19 33v4a4 4 0 01-4 4h-5" stroke={B} strokeWidth="3.2" strokeLinecap="round" fill="none" /><circle cx="19" cy="31" r="3.4" fill={N} /><circle cx="30" cy="41" r="4" fill={G} /><circle cx="8" cy="41" r="4" fill={G} /></S>,
  /* Lembar hasil + centang besar — cek kelulusan */
  kelulusan: p => <S {...p}><rect x="7" y="5" width="27" height="34" rx="4" fill={W} /><rect x="12" y="12" width="16" height="3" rx="1.5" fill={N} /><rect x="12" y="19" width="11" height="3" rx="1.5" fill={N2} /><path d="M24 6l14 6-14 6-14-6z" fill={B} /><circle cx="35" cy="33" r="10" fill={B} /><path d="M30.5 33l3.2 3.2 6.2-6.4" stroke={N} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Orang berdiri di samping lembar ujian — jadwal pengawas ujian */
  pengawasUjian: p => <S {...p}><rect x="18" y="5" width="26" height="33" rx="4" fill={W} /><rect x="23" y="13" width="15" height="3" rx="1.5" fill={N} /><rect x="23" y="20" width="10" height="3" rx="1.5" fill={N2} /><rect x="23" y="27" width="13" height="3" rx="1.5" fill={N2} /><circle cx="11" cy="15" r="6.5" fill={B} /><path d="M2 43c0-6.4 4-10.5 9-10.5s9 4.1 9 10.5z" fill={B} /></S>,
  /* Gulungan ijazah berpita — penyerahan ijazah */
  ijazah: p => <S {...p}><rect x="6" y="10" width="32" height="24" rx="3" fill={W} /><rect x="12" y="17" width="18" height="2.8" rx="1.4" fill={N2} /><rect x="12" y="23" width="12" height="2.8" rx="1.4" fill={N2} /><rect x="4" y="8" width="5" height="28" rx="2.5" fill={B} /><rect x="35" y="8" width="5" height="28" rx="2.5" fill={B} /><circle cx="36" cy="35" r="7" fill={G} /><path d="M32.5 40l-1.5 7 5-2.5 5 2.5-1.5-7z" fill={W} /></S>,
  /* Kunci pas + balon percakapan — layanan sarpras */
  layananSarpras: p => <S {...p}><path d="M30 5a11 11 0 00-9.6 16.4L5 36.8 11.2 43l15.4-15.4A11 11 0 1030 5z" fill={W} /><circle cx="31" cy="16" r="4.4" fill={N} /><path d="M26 26h16a3 3 0 013 3v8a3 3 0 01-3 3h-6l-5 5v-5h-5a3 3 0 01-3-3v-8a3 3 0 013-3z" fill={B} /><path d="M30 31h8M30 36h5" stroke={N} strokeWidth="2.2" strokeLinecap="round" /></S>,
  /* Daftar centang + tanda tambah — usulan alat & bahan */
  usulan: p => <S {...p}><rect x="5" y="5" width="28" height="34" rx="4" fill={W} /><path d="M10 14l2.6 2.6L17 12" stroke={N} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 24l2.6 2.6L17 22" stroke={N2} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><rect x="20" y="13" width="9" height="2.6" rx="1.3" fill={N2} /><rect x="20" y="23" width="9" height="2.6" rx="1.3" fill={N2} /><circle cx="36" cy="34" r="10" fill={B} /><path d="M36 29v10M31 34h10" stroke={N} strokeWidth="3.2" strokeLinecap="round" /></S>,
  /* Tablet menampilkan buku — perpustakaan digital */
  perpusDigital: p => <S {...p}><rect x="8" y="3" width="32" height="42" rx="5" fill={W} /><rect x="12" y="9" width="11" height="24" rx="2" fill={N2} /><rect x="25" y="9" width="11" height="24" rx="2" fill={N} /><rect x="19" y="38" width="10" height="3" rx="1.5" fill={N2} /></S>,
  /* Satu buku + pembatas — buku saya */
  bukuSaya: p => <S {...p}><path d="M10 5h24a4 4 0 014 4v34a5 5 0 00-5-4H10z" fill={W} /><path d="M10 5a4 4 0 00-4 4v30a4 4 0 004 4z" fill={N2} /><path d="M24 5h9v18l-4.5-4-4.5 4z" fill={B} /></S>,
  /* Podium 1-2-3 — papan peringkat */
  peringkat: p => <S {...p}><rect x="18" y="12" width="12" height="31" rx="2.5" fill={W} /><rect x="4" y="22" width="12" height="21" rx="2.5" fill={B} /><rect x="32" y="27" width="12" height="16" rx="2.5" fill={G} /><path d="M24 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill={W} /></S>,
  /* Ponsel + lencana lonceng — notifikasi push */
  notifPush: p => <S {...p}><rect x="10" y="3" width="28" height="42" rx="5" fill={W} /><rect x="15" y="10" width="18" height="3" rx="1.5" fill={N2} /><rect x="15" y="17" width="12" height="3" rx="1.5" fill={N2} /><rect x="19" y="38" width="10" height="3" rx="1.5" fill={N2} /><circle cx="36" cy="12" r="10" fill={B} /><path d="M36 6.5a4.4 4.4 0 014.4 4.4c0 3.4 1.2 4.4 1.2 4.4H30.4s1.2-1 1.2-4.4A4.4 4.4 0 0136 6.5z" fill={N} /><circle cx="36" cy="17.8" r="1.8" fill={N} /></S>,
  /* Bidang lebar + titik geser — banner / hero */
  banner: p => <S {...p}><rect x="3" y="11" width="42" height="22" rx="4" fill={W} /><circle cx="14" cy="20" r="3.6" fill={G} /><path d="M6 29l9-9 6 6 5-4 8 7z" fill={N} /><circle cx="18" cy="39" r="2.4" fill={B} /><circle cx="26" cy="39" r="2.4" fill={G} /><circle cx="34" cy="39" r="2.4" fill={G} /></S>,
  /* Dua orang dewasa + anak — akun orang tua */
  ortu: p => <S {...p}><circle cx="13" cy="12" r="6.5" fill={W} /><path d="M3 36c0-6.4 4.5-10.5 10-10.5S23 29.6 23 36z" fill={W} /><circle cx="33" cy="13" r="6" fill={B} /><path d="M24 36c0-6 4-9.6 9-9.6s9 3.6 9 9.6z" fill={B} /><circle cx="23" cy="32" r="4.6" fill={G} /><path d="M16 46c0-4.2 3-7 7-7s7 2.8 7 7z" fill={G} /></S>,
  /* Kartu pengguna bertumpuk — akun pengguna */
  akunPengguna: p => <S {...p}><rect x="5" y="12" width="38" height="13" rx="4" fill={B} /><circle cx="13" cy="18.5" r="3.6" fill={W} /><rect x="21" y="17" width="16" height="3" rx="1.5" fill={W} /><rect x="5" y="29" width="38" height="13" rx="4" fill={W} /><circle cx="13" cy="35.5" r="3.6" fill={N} /><rect x="21" y="34" width="16" height="3" rx="1.5" fill={N2} /><rect x="9" y="5" width="30" height="5" rx="2.5" fill={G} /></S>,
  /* Formulir dengan kotak foto — biodata */
  biodata: p => <S {...p}><rect x="6" y="4" width="36" height="40" rx="5" fill={W} /><rect x="11" y="10" width="13" height="15" rx="2.5" fill={N} /><circle cx="17.5" cy="15.5" r="3" fill={W} /><path d="M12.5 24c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6z" fill={W} /><rect x="27" y="11" width="10" height="3" rx="1.5" fill={N2} /><rect x="27" y="18" width="10" height="3" rx="1.5" fill={N2} /><rect x="11" y="30" width="26" height="3" rx="1.5" fill={N2} /><rect x="11" y="36" width="18" height="3" rx="1.5" fill={N2} /></S>,
  /* Telapak tangan menopang kotak — peminjaman */
  peminjaman: p => <S {...p}><rect x="12" y="6" width="24" height="18" rx="3" fill={W} /><path d="M12 13h24" stroke={N2} strokeWidth="2.4" /><rect x="21" y="6" width="6" height="18" fill={N2} /><path d="M6 30c2.4-2 5-2 7.4 0l4.6 3.4h9.6a3.2 3.2 0 010 6.4H16" fill="none" stroke={B} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M28 33.4h8a3.2 3.2 0 010 6.4h-8" fill="none" stroke={G} strokeWidth="3.4" strokeLinecap="round" /></S>,
  /* Kamera + lembar berita — liputan kegiatan */
  liputan: p => <S {...p}><rect x="4" y="14" width="28" height="20" rx="4" fill={W} /><path d="M12 14l2.6-4h8l2.6 4z" fill={W} /><circle cx="18" cy="24" r="6" fill={N} /><circle cx="18" cy="24" r="2.6" fill={W} /><rect x="30" y="20" width="14" height="20" rx="3" fill={B} /><path d="M33.5 26h7M33.5 31h7M33.5 36h4" stroke={N} strokeWidth="2" strokeLinecap="round" /></S>,
  /* Kisi tanggal berpenanda H/I/S — rekap absensi siswa */
  rekapAbsensi: p => <S {...p}><rect x="4" y="7" width="40" height="34" rx="4" fill={W} /><rect x="4" y="7" width="40" height="8" rx="4" fill={N} /><rect x="9" y="19" width="6" height="6" rx="1.6" fill={N2} /><rect x="18" y="19" width="6" height="6" rx="1.6" fill={B} /><rect x="27" y="19" width="6" height="6" rx="1.6" fill={N2} /><rect x="36" y="19" width="4" height="6" rx="1.6" fill={G} /><rect x="9" y="29" width="6" height="6" rx="1.6" fill={B} /><rect x="18" y="29" width="6" height="6" rx="1.6" fill={N2} /><rect x="27" y="29" width="6" height="6" rx="1.6" fill={G} /><rect x="36" y="29" width="4" height="6" rx="1.6" fill={N2} /></S>,
  /* Buku + kepala orang — buku induk guru */
  bukuGuru: p => <S {...p}><path d="M8 5h22a4 4 0 014 4v30a5 5 0 00-5-4H8z" fill={W} /><path d="M8 5a4 4 0 00-4 4v30a4 4 0 004 4z" fill={N2} /><circle cx="34" cy="26" r="7" fill={B} /><path d="M23 44c0-6.4 5-10.5 11-10.5S45 37.6 45 44z" fill={B} /></S>,
  /* Kartu bertab abjad — buku klapper */
  klapper: p => <S {...p}><rect x="5" y="8" width="32" height="33" rx="4" fill={W} /><rect x="11" y="16" width="16" height="2.8" rx="1.4" fill={N2} /><rect x="11" y="23" width="12" height="2.8" rx="1.4" fill={N2} /><rect x="11" y="30" width="14" height="2.8" rx="1.4" fill={N2} /><rect x="35" y="11" width="8" height="6" rx="2.5" fill={B} /><rect x="35" y="21" width="8" height="6" rx="2.5" fill={G} /><rect x="35" y="31" width="8" height="6" rx="2.5" fill={B} /></S>,
  /* Lembar rencana + sasaran — program kerja */
  programKerja: p => <S {...p}><rect x="5" y="4" width="26" height="35" rx="4" fill={W} /><path d="M10 14l2.4 2.4L16.4 12" stroke={N} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><rect x="19" y="13" width="8" height="2.6" rx="1.3" fill={N2} /><path d="M10 24l2.4 2.4 4-4.4" stroke={N2} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><rect x="19" y="23" width="8" height="2.6" rx="1.3" fill={N2} /><circle cx="35" cy="33" r="11" fill={B} /><circle cx="35" cy="33" r="6.5" fill={W} /><circle cx="35" cy="33" r="2.6" fill={N} /></S>,
  /* Formulir berpindah jadi buku — SPMB ke Buku Induk */
  konversi: p => <S {...p}><rect x="3" y="6" width="18" height="24" rx="3" fill={W} /><rect x="7" y="12" width="10" height="2.4" rx="1.2" fill={N2} /><rect x="7" y="18" width="7" height="2.4" rx="1.2" fill={N2} /><path d="M27 18h13" stroke={N} strokeWidth="3.2" strokeLinecap="round" /><path d="M36 13.5L40.5 18 36 22.5" stroke={N} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M20 30h20a3 3 0 013 3v11a4.5 4.5 0 00-4.5-3H20z" fill={B} /><path d="M20 30a3 3 0 00-3 3v11a3 3 0 003 3z" fill={G} /></S>,
  /* Map berkas + orang — rekam penanganan BK */
  rekamBk: p => <S {...p}><path d="M4 12a4 4 0 014-4h9l4 5h15a4 4 0 014 4v19a4 4 0 01-4 4H8a4 4 0 01-4-4z" fill={W} /><circle cx="24" cy="25" r="6" fill={N2} /><path d="M15 38c0-5 4-8.4 9-8.4s9 3.4 9 8.4z" fill={N2} /></S>,
  /* Piagam bertumpuk + panah naik — portofolio PKB */
  pkb: p => <S {...p}><rect x="4" y="12" width="26" height="20" rx="3" fill={G} /><rect x="7" y="17" width="26" height="20" rx="3" fill={B} /><rect x="10" y="22" width="26" height="20" rx="3" fill={W} /><rect x="15" y="28" width="13" height="2.8" rx="1.4" fill={N2} /><rect x="15" y="34" width="9" height="2.8" rx="1.4" fill={N2} /><path d="M32 16v-9h-6M32 7l-9 9" stroke={N} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></S>,
  /* Tumpukan basis data + roda gigi — master data */
  masterData: p => <S {...p}><ellipse cx="21" cy="11" rx="15" ry="5.5" fill={W} /><path d="M6 11v9c0 3 6.7 5.5 15 5.5s15-2.5 15-5.5v-9" fill={B} /><path d="M6 20v9c0 3 6.7 5.5 15 5.5s15-2.5 15-5.5v-9" fill={G} /><circle cx="36" cy="36" r="8" fill={W} /><circle cx="36" cy="36" r="3.2" fill={N} /><path d="M36 25.5v4M36 42.5v4M25.5 36h4M42.5 36h4" stroke={W} strokeWidth="3" strokeLinecap="round" /></S>,
  /* Dua lembar catatan bertindih + centang pembanding — kehadiran guru terpadu */
  kehadiranTerpadu: p => <S {...p}><rect x="4" y="8" width="22" height="28" rx="3.5" fill={G} /><rect x="10" y="4" width="22" height="28" rx="3.5" fill={B} /><rect x="15" y="11" width="12" height="2.6" rx="1.3" fill={N2} /><rect x="15" y="17" width="8" height="2.6" rx="1.3" fill={N2} /><circle cx="33" cy="33" r="11" fill={W} /><path d="M27.8 33l3.4 3.4 6.6-6.8" stroke={N} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Kartu grafik + bintang penghargaan — dashboard jabatan */
  dsbKepsek: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M35 3l3 6.2 6.8 1-5 4.8 1.2 6.8L35 18.6 28.9 21.8l1.2-6.8-5-4.8 6.8-1z" fill={B} /></S>,
  /* Kartu grafik + buku pelajaran — dashboard jabatan */
  dsbKurikulum: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M26 5h9a3 3 0 013 3v13a4 4 0 00-4-2h-8z" fill={B} /><path d="M46 5h-9a3 3 0 00-3 3v13a4 4 0 014-2h8z" fill={G} /></S>,
  /* Kartu grafik + dua kepala siswa — dashboard jabatan */
  dsbKesiswaan: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><circle cx="33" cy="9" r="5" fill={B} /><path d="M25 22c0-4.4 3.6-7.4 8-7.4s8 3 8 7.4z" fill={B} /><circle cx="43" cy="12" r="4" fill={G} /></S>,
  /* Kartu grafik + kunci pas — dashboard jabatan */
  dsbSarpras: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M44 5a7.5 7.5 0 00-10 9.9L26 22.8l3.4 3.4 7.9-7.9A7.5 7.5 0 0044 5z" fill={B} /><circle cx="41.5" cy="10" r="2.6" fill={N} /></S>,
  /* Kartu grafik + perisai centang — dashboard jabatan */
  dsbMutu: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M36 3l10 4v7.5c0 5.8-4.2 10.6-10 13-5.8-2.4-10-7.2-10-13V7z" fill={B} /><path d="M31.5 13.5l3.2 3.2 6-6.2" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Kartu grafik + piala — dashboard jabatan */
  dsbKaprogli: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M29 4h13v6a6.5 6.5 0 01-13 0z" fill={B} /><path d="M29 6h-3.5a4 4 0 004 4M42 6h3.5a4 4 0 01-4 4" stroke={G} strokeWidth="2.4" fill="none" strokeLinecap="round" /><rect x="33" y="16" width="5" height="5" rx="1.4" fill={G} /><rect x="29" y="20" width="13" height="3.4" rx="1.7" fill={B} /></S>,
  /* Kartu grafik + hati pendampingan — dashboard jabatan */
  dsbBk: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M36 22c-11-6.4-11-12.4-7.6-15.4 2.6-2.3 6-1.3 7.6 1.4 1.6-2.7 5-3.7 7.6-1.4C47 9.6 47 15.6 36 22z" fill={B} /></S>,
  /* Kartu grafik + koper kerja — dashboard jabatan */
  dsbBkk: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><rect x="25" y="9" width="20" height="14" rx="3.5" fill={B} /><path d="M31 9V6.6A2.6 2.6 0 0133.6 4h3.8A2.6 2.6 0 0140 6.6V9" stroke={G} strokeWidth="2.6" fill="none" strokeLinecap="round" /><rect x="25" y="14" width="20" height="3" fill={N2} /></S>,
  /* Kartu grafik + tumpukan basis data — dashboard jabatan */
  dsbOperator: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><ellipse cx="36" cy="7" rx="9" ry="3.4" fill={B} /><path d="M27 7v6c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4V7" fill={B} /><path d="M27 13v6c0 1.9 4 3.4 9 3.4s9-1.5 9-3.4v-6" fill={G} /></S>,
  /* Kartu grafik + palang kesehatan — dashboard jabatan */
  dsbUks: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><rect x="25" y="5" width="20" height="18" rx="4" fill={B} /><path d="M35 9.5v9M30.5 14h9" stroke={W} strokeWidth="3.4" strokeLinecap="round" /></S>,
  /* Kartu grafik + labu percobaan — dashboard jabatan */
  dsbLab: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M33 4h6v7l7 11a2.6 2.6 0 01-2.2 4H28.2A2.6 2.6 0 0126 22l7-11z" fill={B} /><path d="M30 18h12" stroke={N} strokeWidth="2.4" strokeLinecap="round" /></S>,
  /* Kartu grafik + megafon — dashboard jabatan */
  dsbHumas: p => <S {...p}><rect x="3" y="12" width="30" height="31" rx="4" fill={W} /><rect x="8" y="30" width="4.5" height="8" rx="1.6" fill={N2} /><rect x="15" y="25" width="4.5" height="13" rx="1.6" fill={N2} /><rect x="22" y="20" width="4.5" height="18" rx="1.6" fill={N} /><path d="M26 11h4l12-6v17l-12-6h-4a2.6 2.6 0 01-2.6-2.6v-.8A2.6 2.6 0 0126 11z" fill={B} /><path d="M45 9c2 1.6 3.2 3.4 3.2 6" stroke={G} strokeWidth="2.4" strokeLinecap="round" /></S>,
  /* Map dokumen bertumpuk + lencana centang — kelengkapan perangkat ajar */
  kelengkapan: p => <S {...p}><rect x="4" y="10" width="24" height="32" rx="3.5" fill={G} /><rect x="9" y="5" width="24" height="32" rx="3.5" fill={W} /><path d="M13.5 13l2 2 3.5-3.6" stroke={N} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><rect x="21" y="12.5" width="8" height="2.4" rx="1.2" fill={N2} /><path d="M13.5 21l2 2 3.5-3.6" stroke={N} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /><rect x="21" y="20.5" width="8" height="2.4" rx="1.2" fill={N2} /><rect x="13.5" y="28" width="15" height="2.4" rx="1.2" fill={N2} /><circle cx="36" cy="34" r="9" fill={B} /><path d="M32 34l2.8 2.8 5.2-5.4" stroke={N} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></S>,
  /* Papan tulis + guru */
};

/** Alamat menu → nama ilustrasi. Menu di luar daftar ini tetap memakai ikon lucide biasa. */
export const PETA_ILUSTRASI: Record<string, keyof typeof ILUSTRASI> = {
  // Sarana — layar & jaringan (24 September 2026). WAJIB didaftarkan tegas: aturan kata kunci akan
  // menyamakan "Papan & TV", "Perangkat Jaringan", "Jaringan Sekolah", dan "Mode Ujian Jaringan"
  // menjadi gambar yang sama karena sama-sama mengandung kata "jaringan".
  "/dashboard/admin/papan-tv": "papanTv",
  "/dashboard/teacher/papan-tv": "papanTv",
  "/dashboard/admin/perangkat-jaringan": "perangkatJaringan",
  "/dashboard/teacher/perangkat-jaringan": "perangkatJaringan",
  "/dashboard/admin/jaringan-ujian": "jaringanUjian",
  /* Halaman gabungan Jaringan & Layar (27 September 2026) — satu menu, jadi satu gambar. Rute lama di atas
     tetap terdaftar karena masih hidup sebagai pengalihan. */
  "/dashboard/admin/jaringan": "jaringan",
  "/dashboard/teacher/jaringan": "jaringan",
  "/dashboard/admin/cctv": "cctv",
  "/dashboard/teacher/cctv": "cctv",
  // Siswa
  "/dashboard/student/materials": "materi",
  "/ujian-online": "ujian",
  "/dashboard/student/rapor": "rapor",
  "/dashboard/teacher/form-nilai-rapor": "formNilai",
  "/dashboard/admin/form-nilai-rapor": "formNilai",
  "/dashboard/student/poin-saya": "poin",
  "/dashboard/student/pkl": "pkl",
  "/dashboard/student/pengumuman": "pengumuman",
  // Guru
  "/dashboard/teacher/journal": "jurnal",
  "/dashboard/teacher/attendance": "absensi",
  "/dashboard/teacher/schedule": "jadwal",
  "/dashboard/teacher/students": "siswa",
  "/dashboard/teacher/materials": "materi",
  "/dashboard/teacher/pengumuman": "pengumuman",
  "/dashboard/teacher/pkl": "pkl",
  // Admin & TU
  "/dashboard/admin/students": "siswa",
  "/dashboard/admin/classes": "kelas",
  "/dashboard/admin/teachers": "guru",
  "/dashboard/admin/admissions": "daftar",
  "/dashboard/admin/persuratan": "surat",
  "/dashboard/admin/schedules": "jadwal",
  "/dashboard/admin/pengumuman": "pengumuman",
  // Orang tua
  "/dashboard/parent/rapor": "rapor",
  "/dashboard/parent/pengumuman": "pengumuman",

  /* ===== Pemetaan tegas per fitur (18 September 2026, permintaan user: "jangan ada yang sama").
     Aturan kata kunci di bawah terlalu longgar untuk membedakan menu serumpun, jadi setiap fitur
     yang sempat kembar didaftarkan di sini. Fitur SAMA di beberapa portal memang sengaja memakai
     gambar yang sama — yang dilarang adalah dua fitur BERBEDA bergambar sama. ===== */
  // Data siswa, guru & struktur
  "/dashboard/admin/majors": "wisuda",
  "/dashboard/admin/jabatan": "papanNama",
  "/dashboard/admin/dapodik": "sinkron",
  "/dashboard/teacher/dapodik": "sinkron",
  "/dashboard/admin/tahun-ajaran": "tahun",
  "/dashboard/admin/kalender-pendidikan": "agenda",
  "/dashboard/admin/parents": "ortu",
  "/dashboard/admin/users": "akunPengguna",
  "/dashboard/student/izin-keluar": "gembokBuka",
  // Fitur SAMA di empat portal → gambar WAJIB sama (CLAUDE.md #57).
  "/dashboard/student/kegiatan-tidak-ikut": "payung",
  "/dashboard/teacher/kegiatan-tidak-ikut": "payung",
  "/dashboard/admin/kegiatan-tidak-ikut": "payung",
  "/dashboard/parent/kegiatan-tidak-ikut": "payung",
  "/dashboard/student/biodata": "biodata",
  // Fitur SAMA di portal lain → gambar WAJIB sama (CLAUDE.md #57).
  "/dashboard/teacher/biodata": "biodata",
  "/dashboard/admin/biodata": "biodata",
  // Kurikulum & pembelajaran
  "/dashboard/admin/pemeriksa-jadwal": "periksaJadwal",
  "/dashboard/admin/supervisi": "teropong",
  "/dashboard/teacher/supervisi": "teropong",
  "/dashboard/admin/verifikasi-data": "verifikasi",
  "/dashboard/admin/pemeriksa-data": "kaca",
  "/dashboard/teacher/peringatan-dini": "alarm",
  "/dashboard/admin/peringatan-dini": "alarm",
  "/dashboard/teacher/rencana-ajar": "prota",
  "/dashboard/admin/absensi-jurnal": "absensiJurnal",
  "/dashboard/admin/dkn": "dkn",
  "/dashboard/teacher/dkn": "dkn",
  "/dashboard/admin/rapor-siswa": "serahRapor",
  "/dashboard/teacher/rapor-kelas": "nilai",
  "/dashboard/admin/rapor-kelas": "nilai", // fitur sama di portal admin (#57)
  "/dashboard/student/portofolio": "sertifikat",
  "/dashboard/admin/cek-kelulusan": "kelulusan",
  "/dashboard/teacher/pengawas-ujian": "pengawasUjian",
  // Kehadiran
  "/dashboard/admin/absen-mandiri": "presensiMandiri",
  "/dashboard/teacher/absen-mandiri": "presensiMandiri",
  "/dashboard/student/absen-mandiri": "presensiMandiri",
  "/dashboard/admin/absensi-siswa/qr-mandiri": "proyektor",
  "/dashboard/teacher/absensi-qr": "proyektor",
  "/dashboard/admin/absensi-siswa/scan": "qr",
  "/dashboard/admin/kegiatan": "bendera",
  "/dashboard/teacher/kegiatan": "bendera",
  "/dashboard/admin/presensi-pegawai": "presensiPegawai",
  "/dashboard/admin/kehadiran-guru": "kehadiranTerpadu",
  "/dashboard/teacher/wakasek/penjamin-mutu/kehadiran-guru": "kehadiranTerpadu",
  "/dashboard/admin/kartu-tanda": "kartuCetak",
  // Kesiswaan & BK
  "/dashboard/admin/papan-kesiswaan": "plakat",
  "/dashboard/admin/poin-siswa": "poin",  // label aslinya "Poin Siswa (Tata Tertib)" → tanpa baris ini tertangkap aturan "tata tertib"
  "/dashboard/admin/kpi-indikator": "target",
  "/dashboard/admin/panggilan-ortu": "panggilanOrtu",
  "/dashboard/teacher/kontak-ortu": "telepon",
  "/dashboard/admin/konseling": "janji",
  "/dashboard/parent/konseling": "janji",
  "/dashboard/teacher/kunjungan-rumah": "rumah",
  "/dashboard/teacher/konseling": "rujukan",
  "/dashboard/admin/tugas": "papanTugas",
  "/dashboard/teacher/tugas": "papanTugas",
  "/dashboard/teacher/izin-siswa": "medis",
  "/dashboard/parent/izin": "medis",
  "/dashboard/admin/cuti": "kalenderCentang",
  "/dashboard/teacher/piket-kelas": "piketKelas",
  "/dashboard/admin/kedisiplinan-guru": "rambu",
  "/dashboard/admin/kedisiplinan-leaderboard": "prestasi",
  "/dashboard/teacher/kedisiplinan-leaderboard": "prestasi",
  "/dashboard/teacher/kinerja": "monitoring",
  "/dashboard/admin/performa-server": "server",
  // Kepegawaian & arsip
  "/dashboard/admin/arsip-sk": "arsipSk",
  "/dashboard/teacher/arsip-sk": "arsipSk",
  "/dashboard/admin/arsip": "arsip",
  // PKL, alumni & BKK
  "/dashboard/admin/pkl-pendaftaran": "pklDaftar",
  "/dashboard/admin/industry-partners": "industri",
  "/dashboard/admin/lowongan": "lowongan",
  "/dashboard/admin/tracer-study": "peta",
  // Persuratan
  "/dashboard/admin/permintaan-surat": "permintaanSurat",
  "/dashboard/student/permintaan-surat": "permintaanSurat",
  "/dashboard/parent/permintaan-surat": "permintaanSurat",
  "/dashboard/admin/disposisi": "disposisi",
  "/dashboard/admin/ekspedisi": "pesawat",
  "/dashboard/admin/ijazah-serah": "ijazah",
  "/dashboard/admin/legalisir": "stempel",
  // Sarana, lab & perpustakaan
  "/dashboard/admin/layanan-sarpras": "layananSarpras",
  "/dashboard/teacher/layanan-sarpras": "layananSarpras",
  "/dashboard/admin/usulan-alat": "usulan",
  "/dashboard/teacher/lab/usulan-alat": "usulan",
  "/dashboard/teacher/lab/peminjaman": "peminjaman",
  "/perpustakaan": "perpusDigital",
  "/pusat-perpustakaan": "perpustakaan",
  "/dashboard/admin/buku-saya": "bukuSaya",
  "/dashboard/teacher/buku-saya": "bukuSaya",
  "/dashboard/student/buku-saya": "bukuSaya",
  "/dashboard/admin/perpustakaan-peringkat": "peringkat",
  "/dashboard/teacher/perpustakaan-peringkat": "peringkat",
  "/dashboard/student/perpustakaan-peringkat": "peringkat",
  // Website & informasi
  "/dashboard/admin/notifikasi": "notifPush",
  "/dashboard/admin/banners": "banner",
  "/dashboard/admin/liputan": "liputan",
  "/dashboard/teacher/liputan": "liputan",
  "/dashboard/admin/news": "koran",
  "/dashboard/admin/messages": "pesan",
  "/dashboard/admin/absensi-siswa": "rekapAbsensi",
  "/dashboard/teacher/absensi-siswa": "rekapAbsensi",
  "/dashboard/parent/absensi": "rekapAbsensi",
  "/dashboard/teacher/lab/inventaris": "kotak",
  "/dashboard/admin/inventaris": "aset",
  "/dashboard/admin/buku-induk/guru": "bukuGuru",
  "/dashboard/admin/buku-klapper": "klapper",
  "/dashboard/admin/program-kerja": "programKerja",
  "/dashboard/admin/spmb-konversi": "konversi",
  "/dashboard/admin/rekam-bk": "rekamBk",
  "/dashboard/admin/pkb": "pkb",
  "/dashboard/teacher/pkb": "pkb",
  "/dashboard/admin/master-data": "masterData",
  "/dashboard/admin/profile": "profil",
  "/dashboard/parent/poin": "poin",
  // Dashboard jabatan — sekeluarga (kartu grafik) tetapi tiap jabatan punya penanda sendiri.
  // Alamat portal GURU & portal ADMIN dipetakan ke gambar yang SAMA karena isinya memang satu fitur.
  "/dashboard/teacher/kepala-sekolah": "dsbKepsek",
  "/dashboard/admin/dashboard-jabatan/kepala-sekolah": "dsbKepsek",
  "/dashboard/teacher/wakasek/kurikulum": "dsbKurikulum",
  "/dashboard/admin/dashboard-jabatan/kurikulum": "dsbKurikulum",
  "/dashboard/teacher/wakasek/kesiswaan": "dsbKesiswaan",
  "/dashboard/admin/dashboard-jabatan/kesiswaan": "dsbKesiswaan",
  "/dashboard/teacher/wakasek/sarpras": "dsbSarpras",
  "/dashboard/admin/dashboard-jabatan/sarpras": "dsbSarpras",
  "/dashboard/teacher/wakasek/penjamin-mutu": "dsbMutu",
  "/dashboard/admin/dashboard-jabatan/penjamin-mutu": "dsbMutu",
  "/dashboard/teacher/wakasek/kaprogli": "dsbKaprogli",
  "/dashboard/admin/dashboard-jabatan/kaprogli": "dsbKaprogli",
  "/dashboard/teacher/bk": "dsbBk",
  "/dashboard/admin/dashboard-jabatan/bk": "dsbBk",
  "/dashboard/teacher/bkk": "dsbBkk",
  "/dashboard/admin/dashboard-jabatan/bkk": "dsbBkk",
  "/dashboard/teacher/operator": "dsbOperator",
  "/dashboard/admin/dashboard-jabatan/operator": "dsbOperator",
  "/dashboard/teacher/uks": "dsbUks",
  "/dashboard/admin/dashboard-jabatan/uks": "dsbUks",
  "/dashboard/teacher/lab": "dsbLab",
  "/dashboard/admin/dashboard-jabatan/lab": "dsbLab",
  "/dashboard/teacher/humas": "dsbHumas",
  "/dashboard/admin/dashboard-jabatan/humas": "dsbHumas",
  // Halaman pengawasan yang kini ada di DUA portal (guru & superadmin) — alamat keduanya menunjuk
  // gambar yang sama karena memang satu fitur (19 September 2026).
  "/dashboard/teacher/piket": "jamTangan",
  "/dashboard/admin/buku-piket": "jamTangan",
  "/dashboard/admin/jadwal-piket": "jam",
  "/dashboard/admin/izin-siswa": "medis",
  "/dashboard/admin/piket-kelas": "piketKelas",
  "/dashboard/admin/kunjungan-rumah": "rumah",
  "/dashboard/teacher/kesehatan-siswa": "kesehatan",
  "/dashboard/admin/kesehatan-siswa": "kesehatan",
  "/dashboard/admin/kontak-ortu": "telepon",
  "/dashboard/teacher/kinerja-pimpinan": "bintang",
  "/dashboard/admin/kinerja-pimpinan": "bintang",
  "/dashboard/teacher/kepala-sekolah/rapor": "kunci",
  "/dashboard/admin/pengesahan-rapor": "kunci",
  "/dashboard/teacher/wakasek/kaprogli/ukk": "palu",
  "/dashboard/admin/rekap-ukk": "palu",
  "/dashboard/teacher/kepala-sekolah/mitra": "klip",
  "/dashboard/admin/mitra-mou": "klip",
  "/dashboard/teacher/branding": "palet",
  "/dashboard/admin/branding": "palet",
  "/dashboard/admin/kelengkapan-perangkat": "kelengkapan",
  "/dashboard/teacher/kelengkapan-perangkat": "kelengkapan",
  // Umum
  "/kartu-identitas": "kartu",
};

/** Kata kunci nama menu → ilustrasi. Dipakai bila alamatnya belum dipetakan khusus, sehingga SEMUA
 * menu bergambar dengan gaya yang sama (keputusan user 18 September 2026). Urutan penting: aturan
 * yang lebih khusus ditaruh lebih dulu supaya menu serumpun tidak kebagian gambar yang sama. */
const KATA_KUNCI: [RegExp, keyof typeof ILUSTRASI][] = [
  [/^dashboard (kepala|operator|penjamin|kaprogli)/i, "monitoring"],
  [/^dashboard (bk|kesiswaan|uks)/i, "konseling"],
  [/^dashboard (sarpras|laboratorium)/i, "alat"],
  [/^dashboard (humas|bkk|branding)/i, "globe"],
  [/^dashboard|dasbor/i, "dashboard"],
  [/kinerja|performa/i, "monitoring"],
  [/analisis|donat|komposisi/i, "donat"],
  [/kotak aspirasi|aspirasi|saran/i, "kotaksaran"],
  [/kontak orang tua|panggilan orang tua|nomor|telepon|whatsapp/i, "telepon"],
  [/konseling|rekam bk|bimbingan|kunjungan rumah|janji temu/i, "konseling"],
  [/rpp|modul ajar|perangkat ajar|prota|promes/i, "rpp"],
  [/mata pelajaran|mapel|kurikulum/i, "mapel"],
  [/penugasan|beban mengajar|pembagian mengajar/i, "penugasan"],
  [/tata tertib|aturan/i, "tatatertib"],
  [/kedisiplinan|pelanggaran|sanksi/i, "rambu"],
  [/cuti|izin|libur/i, "kalenderCentang"],
  [/jam kerja|keterlambatan|jam pelajaran/i, "jamPasir"],
  [/tagihan|pembayaran|spp|dompet|keuangan/i, "dompet"],
  [/ijazah|penyerahan|skhun/i, "stempel"],
  [/portofolio|pkb/i, "prestasi"],
  [/program kerja|rencana kerja|kerja tahunan/i, "catatan"],
  [/panggilan orang tua|orang tua/i, "pesan"],
  [/buku induk|klapper/i, "catatan"],
  [/buku mutasi|mutasi/i, "mutasi"],
  [/kenaikan kelas/i, "tangga"],
  [/buku tamu|tamu/i, "pintu"],
  [/ekspedisi|pengiriman/i, "pesawat"],
  [/disposisi/i, "pesawat"],
  [/legalisir|stempel|pengesahan/i, "stempel"],
  [/arsip/i, "arsip"],
  [/notulen|rapat/i, "rapat"],
  [/supervisi|pemeriksa|verifikasi|pkg/i, "kaca"],
  [/cbt|ujian online|pusat ujian/i, "monitor"],
  [/ujian|soal|kuis|kelulusan/i, "ujian"],
  [/rapor|nilai|dkn|legger/i, "rapor"],
  [/jurnal/i, "jurnal"],
  [/kalender|agenda|tahun ajaran/i, "jadwal"],
  [/jam pelajaran|jam kerja|piket/i, "jam"],
  [/jadwal/i, "jadwal"],
  [/scan|pindai|barcode|qr/i, "qr"],
  [/absen|presensi|kehadiran/i, "absensi"],
  [/pengumuman|banner|hero/i, "pengumuman"],
  [/berita|liputan|pers/i, "koran"],
  [/galeri|foto|dokumentasi/i, "gambar"],
  [/website|profil sekolah|konten halaman|publik/i, "globe"],
  [/surat|persuratan/i, "surat"],
  [/perpus|katalog|buku saya|literasi|bacaan/i, "perpustakaan"],
  [/kartu|identitas/i, "kartu"],
  [/poin|tata tertib|kedisiplinan|pelanggaran/i, "poin"],
  [/peringatan dini|risiko/i, "kaca"],
  [/pkl|prakerin|industri|magang/i, "pkl"],
  [/alumni|tracer|lowongan|bkk|karier/i, "peta"],
  [/prestasi|lomba|peringkat|juara/i, "prestasi"],
  [/osis|pemilihan|voting/i, "suara"],
  [/ekstrakurikuler|ekstra|pramuka/i, "bola"],
  [/uks|kesehatan|gizi|obat/i, "kesehatan"],
  [/lab|praktik|bengkel/i, "lab"],
  [/inventaris|aset|barang|stok|opname/i, "aset"],
  [/sarpras|sarana|perawatan|kerusakan|perbaikan/i, "alat"],
  [/ruang|denah|fasilitas|gedung/i, "gedung"],
  [/keuangan|tagihan|biaya|bantuan & beasiswa|beasiswa|dana|bos/i, "uang"],
  [/laporan|statistik|rekap|analisis|kinerja|monitoring|performa/i, "dashboard"],
  [/jaringan|hotspot|wifi|internet/i, "jaringan"],
  [/server|master data|cadangan|backup|basis data/i, "server"],
  [/log |aktivitas|riwayat/i, "tabel"],
  [/cetak|print|nominatif/i, "printer"],
  [/impor|unggah|upload/i, "unggah"],
  [/ekspor|unduh|template/i, "unduh"],
  [/pesan|chat|kontak|aspirasi|konseling|rekam bk|kunjungan rumah|janji/i, "pesan"],
  [/survei|angket|kuesioner/i, "dokumen"],
  [/bel sekolah|notifikasi|pengingat/i, "bel"],
  [/keamanan|sesi|sandi|2fa|hak akses/i, "keamanan"],
  [/pengaturan|setelan|sistem|dapodik|integrasi|jabatan/i, "pengaturan"],
  [/akun|pengguna|orang tua|profil saya|biodata/i, "profil"],
  [/bantuan|panduan|tanya|faq/i, "tanya"],
  [/spmb|pendaftaran|pendaftar|ppdb|daftar ulang/i, "daftar"],
  [/guru|pegawai|gtk|kepegawaian|sk |cuti/i, "guru"],
  [/siswa|peserta didik/i, "siswa"],
  [/jurusan|kompetensi keahlian|program keahlian/i, "wisuda"],
  [/kelas|rombel/i, "kelas"],
  [/mapel|mata pelajaran|kurikulum|rpp|prota|promes|modul|penugasan|materi|tugas|pembelajaran/i, "materi"],
  [/kotak|paket/i, "kotak"],
];

/** NAMA ilustrasi untuk satu menu: pemetaan alamat dulu, lalu tebakan dari nama menu, terakhir dokumen. */
export function ilustrasiUntuk(href: string, label = ""): keyof typeof ILUSTRASI {
  const langsung = PETA_ILUSTRASI[href];
  if (langsung && ILUSTRASI[langsung]) return langsung;
  for (const [pola, nama] of KATA_KUNCI) if (pola.test(label) || pola.test(href)) return nama;
  return "dokumen";
}

/** Penggambar ilustrasi — fungsinya DIPANGGIL (bukan dirender sebagai komponen dinamis) supaya
 * tidak membuat komponen baru tiap render. */
export function GambarIlustrasi({ nama, className }: { nama: keyof typeof ILUSTRASI; className?: string }) {
  return ILUSTRASI[nama]({ className });
}

/** WARNA UBIN TETAP PER MENU (18 September 2026) — dihitung dari alamat menu, bukan dari urutan
 * tampil, supaya satu fitur memakai warna yang SAMA di kisi "Menu Cepat" dashboard maupun di halaman
 * "Semua Menu" (temuan user: warna fitur berbeda di dua tempat).
 *
 * Catatan: pengganti gambar acak "supaya tidak ada yang kembar" DIBATALKAN — akibatnya Jurusan dapat
 * gambar awan dan Kalender Pendidikan dapat kompas. Ikon wajib sesuai fiturnya; menu yang memang
 * sejenis boleh memakai gambar sama dan dibedakan lewat warna ubin ini. */
export function warnaMenu(href: string, jumlah: number) {
  let n = 0;
  for (let i = 0; i < href.length; i++) n = (n * 31 + href.charCodeAt(i)) % 100000;
  return n % jumlah;
}
