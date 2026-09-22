# Daftar Pekerjaan Tertunda — SMK Al-Munawwir IIBS

Diperbarui 17 September 2026.

---

## 🟠 Antrean pengembangan fitur per jabatan (disetujui user 17 September 2026 — "gas")

**Keputusan user:** semua usulan dikerjakan; **Bendahara tidak dibangun** (termasuk denda perpustakaan → tagihan); tanpa layanan
berbayar dulu (asisten AI & gateway WhatsApp **masih dipertimbangkan user** — WA memakai tombol kirim manual); **presensi pegawai &
guru pengganti TIDAK perlu**; tanda tangan dokumen = QR keaslian milik situs; data kesehatan UKS hanya Kepala UKS, Guru BK, wali kelas
siswa itu, dan orang tua; lowongan BKK hanya untuk siswa XII & alumni yang login; pemilihan OSIS online dibuat; Business Center &
Program Bahasa belum punya perencanaan (belum dibuatkan fitur). Patokan aturan (bisa diubah): izin ortu disetujui wali kelas, sakit
>2 hari wajib surat, pengajuan maks H+1 & 14 hari; SP1/SP2/SP3/khusus di 25/50/75/100 poin (draf surat); nilai remedial maks KKM;
ekuivalensi 24 JP (wakasek 12, kaprogli & wali kelas 2); penilaian PKL industri lewat tautan 30 hari.

Status build: 16 (tidak terpasang, digabung ke 17) · **17 LIVE** (pita menu Pusat Ujian, alamat/IP Dapodik bisa diubah) ·
**18 LIVE** (kunci Dapodik terenkripsi, pelindung luberan, KKM per mapel, rapor KKM+predikat+deskripsi+kehadiran per semester) ·
**19 LIVE** (akses Operator Sekolah & Cocokkan manual Dapodik, Dashboard Operator, Buku Induk Guru & kalender absensi di portal
guru, wali kelas baca-saja Buku Induk, "Tahun Angkatan", Buku Mutasi grafik Juli–Juni) · **20** (kunci nilai wali kelas → pengesahan
+ Sahkan Semua, impor nilai Excel, izin/sakit online ortu, rekap harian kelas) · **21 LIVE** (antrean "Perlu tindakan", Dashboard
Kepala Sekolah & Kurikulum baru, CBT susulan/remedial + simpan ke bank + tanda kualitas soal, panggilan orang tua otomatis) ·
**22 LIVE** (menu guru sesuai tugas, dashboard guru per peran, catatan wali → rapor, piket kelas, kunjungan rumah, piket harian +
izin keluar, pemilihan OSIS, janji konseling, kotak aspirasi) · **23 LIVE** (pengumuman bertarget + konfirmasi baca, kontak orang
tua, tautan piket sesuai hak, Sarpras & Lab: lapor kerusakan berfoto, peminjaman/pemesanan ruang, perawatan berkala, stok opname,
label QR aset, dashboard Kepala Lab) · **24 LIVE** (survei & angket + AKPD + sosiometri, presensi kegiatan QR, Humas & PKL: dashboard, penilaian pembimbing industri
lewat tautan, sertifikat PKL ber-QR, monitoring, lokasi jurnal, draf berita kerja sama, lowongan kerja BKK) ·
**25 LIVE** (papan kesiswaan: kehadiran hari ini, peta kerawanan, piagam prestasi ber-QR; data UKS untuk BK/wali/ortu; UKS:
pemeriksaan TB/BB & status gizi, kedaluwarsa obat, kabar ke orang tua, laporan bulanan; usulan buku & stok opname buku;
konversi SPMB → Buku Induk) · **26 LIVE** (ekstrakurikuler: nilai ke rapor, jadwal latihan & lomba, sertifikat ber-QR;
liputan kegiatan dari guru + gambar pratinjau berita & jumlah pembaca; usulan alat & bahan praktik; arsip SK & dokumen
kepegawaian; pusat bantuan) · **27 LIVE** (janji temu orang tua, ringkasan mingguan orang tua, QR keaslian surat, notifikasi
disposisi, masa berlaku e-arsip, pembagian pengawas ujian, supervisi akademik & PKG) · **28 LIVE** (bank soal bersama
antar guru per mapel, Prota/Promes & pekan efektif otomatis, e-portofolio & CV siswa ber-QR, pencarian cepat Ctrl+K) ·
**29** (presensi pegawai mandiri: pindai QR gerbang lewat HP & pindai kartu pegawai di stasiun — satu logika di
`src/lib/presensi-pegawai.ts`, tidak menimpa keputusan TU; kartu identitas digital `/kartu-identitas` untuk semua akun;
header portal tidak lagi dobel — PageHeader otomatis terang di dalam PortalShell; dashboard Kesiswaan diperkaya)
· **30 (antre)** nama di layar umum: "M. Rizky Maulana" → "Rizky M." (`src/lib/nama-panggilan.ts`).

Permintaan user 18 September 2026: daftar antrean besar di bawah DITUNDA — kerjakan dulu temuan harian (tampilan &
pertanyaan yang muncul saat mencoba).

Perlu diisi sekolah agar fitur Sarpras terpakai: data inventaris masih kosong (Inventaris Barang) dan belum ada daftar ruang
(kolom Ruang di Jadwal Pelajaran kosong, belum ada Ruang Ujian) — tambahkan lewat Peminjaman & Ruang → Daftar Ruang.

Data yang diubah langsung (setelah cadangan DB): tanggal lulus angkatan 2023 (95 siswa Lulus) = 4 Mei 2026; angkatan Meila Safitri
(pindahan diterima 13 Jan 2025) 2025 → 2024. Dapodik pindah ke PC 192.168.100.99 (NAT MikroTik dikecualikan untuk 172.15.0.3,
aturan blokir "Apache HTTP Server" di firewall Windows dimatikan); token Web Service baru di `.env`.

**Ditunda atas permintaan user (18 September 2026):** sembunyikan SELURUH jejak modul Bendahara (menu portal, halaman
`/dashboard/bendahara/**`, tautan dari portal lain). Sampai ada aba-aba, modul itu juga tidak boleh diubah sama sekali —
termasuk dikecualikan dari sapuan kosmetik lintas halaman.

Antrean (urut pengerjaan):
- [x] A. Nilai & Rapor — KKM per mapel, deskripsi capaian otomatis, impor nilai Excel, verifikasi bertingkat (wali kelas → kepsek)
- [x] B. Absensi — izin/sakit online ortu (lampiran rahasia), persentase kehadiran per semester di rapor, rekap harian ke wali kelas
- [x] Fondasi: antrean "Perlu tindakan" per jabatan, formulir berlampiran foto, pindai kamera dipakai ulang
- [ ] Dashboard Kepala Sekolah — SELESAI: eksekutif, antrean persetujuan, tren, PKG & supervisi online (27). SISA: bukti akreditasi per butir
- [ ] Kurikulum — SELESAI: progres penilaian, ketuntasan KKM + remedial, rekap 24 JP. SISA: supervisi, prota/promes & pekan efektif otomatis,
      pembagian pengawas ujian otomatis, bank soal bersama per mapel, kelengkapan perangkat ajar)
- [x] CBT (ujian susulan & remedial, simpan soal ke bank soal, tandai soal jelek dari analisis butir)
- [ ] Kesiswaan & BK — SELESAI: poin & surat panggilan, e-voting OSIS, janji konseling + rujukan, kotak aspirasi, AKPD &
      sosiometri (build 24). SISA: papan kehadiran, prestasi + sertifikat, peta kerawanan
- [x] Wali kelas (catatan perkembangan → rapor, jadwal piket kelas, kunjungan rumah, kontak ortu)
- [x] Guru Piket (dashboard harian, keterlambatan pindai kartu, izin keluar lingkungan dengan QR kembali, laporan piket)
- [x] Sarpras & Lab (laporan kerusakan, aset QR, peminjaman, mutasi ruang, stok opname, pemesanan ruang, perawatan berkala;
      dashboard Kepala Lab)
- [x] Humas & PKL (dashboard Humas, MoU + pengingat, penilaian pembimbing industri, sertifikat PKL, monitoring,
      logbook PKL berfoto+lokasi, berita kerja sama → draf Branding) — SISA: guru tamu
- [ ] Kaprogli, BKK, Branding, UKS, Perpustakaan, Ekstrakurikuler, Operator — SELESAI: BKK lowongan, Branding liputan & OG image,
      UKS (gizi, obat, laporan), Perpustakaan (usulan & opname), Ekstrakurikuler (nilai/jadwal/sertifikat), Operator (SPMB→Buku Induk),
      usulan alat praktik. SISA: dashboard Kaprogli diperkaya, rekomendasi bacaan & target literasi, OCR dokumen
- [ ] Umum — SELESAI: pengumuman bertarget + tanda dibaca (23), survei & angket, presensi kegiatan QR (24). SISA: pencarian cepat,
      papan tugas antar jabatan, rapat terpadu, e-arsip + pengingat kedaluwarsa, pusat bantuan & reset sandi, ringkasan mingguan ortu, janji temu,
      persetujuan kegiatan digital, e-portofolio & CV siswa
- [ ] Guru: portofolio PKB & pengingat jadwal mengajar harian · TU: antrean layanan bernomor · Laporan dinas siap unduh
- [ ] SMK vokasi: Teaching Factory, paspor keterampilan & lencana, showcase karya, pemetaan SKKNI, pendaftaran uji kompetensi,
      repositori modul/manual & karya siswa, direktori usaha alumni, rekomendasi jurusan SPMB, profil jurusan bergaleri
- [ ] Persuratan & Website (QR verifikasi semua surat, notifikasi disposisi, halaman prestasi & alumni, OG image berita)
- [x] Kepegawaian: rekap jam mengajar 24 JP, arsip SK & dokumen (presensi pegawai DICORET) — SISA: pengingat kenaikan pangkat
- Penelusur tautan jabatan (`rayap-jabatan.mjs`, 23 akun) — 17 Sep: semua tautan menu & dashboard jabatan terbuka.

---

## 🟡 Dikerjakan 14 September 2026 malam (dimulai lebih awal atas permintaan user)

Status per tahap (satu build per tahap, uji otomatis lewat HTTPS; lihat gotcha #31–#34 di CLAUDE.md):
- **A. Notifikasi push + pengingat** — LIVE, uji 18/19 (1 gagal = pemilih uji). Belum diuji di HP asli: minta user
  Profil → Aktifkan Notifikasi → Kirim Notifikasi Uji (Chromium headless tidak bisa berlangganan push sungguhan).
- **B. Peringatan dini siswa** — LIVE, uji 13/13 (339 siswa: 22 tinggi, 9 sedang, 43 pantau saat diuji).
- **C. Absensi mandiri pindai QR + log pindai + kamera di stasiun scan** — LIVE, uji 12/13. Yang belum terbukti otomatis
  justru jalur utamanya (siswa berhasil tercatat HADIR lewat QR, pindai ulang tidak menimpa, indikasi titip absen):
  percobaan 1 gagal karena skrip uji (insert SiteSetting tanpa `updatedAt`), percobaan 2 kena 502 sesaat saat server
  sibuk backup + build. Ulangi blok "Absen mandiri siswa" saat server tenang.
- **D. Portal Perpustakaan (/pusat-perpustakaan & /perpustakaan)** — LIVE, uji 19/22. Sirkulasi (pinjam/kembali lewat
  pindai), kiosk kunjungan, katalog & pesan buku di HP, kartu anggota digital, pembatasan petugas: lulus. Dua halaman
  (beranda & Laporan) sempat 500: halaman server mengoper komponen ikon mentah ke `StatTile` (client component) —
  diperbaiki jadi `icon={<Ikon />}` (Laporan pulih di build Batch E). Beranda tetap 500 karena penyebab kedua: ikon
  lucide kembar di halaman server (Wallet×2 antar-kartu, lalu DoorOpen & BookMarked masing-masing dua kali) — hanya
  rusak di build produksi. Penggantian Wallet saja (HandCoins) belum cukup; 5 build produksi lokal membuktikan semua ikon
  unik → 200 (gotcha #35). Beranda kini Footprints/History/HandCoins, Laporan juga dibuat unik (Tags). LIVE & diuji
  ulang 4/4 (beranda, Laporan, tautan sidebar, log bersih). Kegagalan ke-3 sebelumnya hanya pemilih uji.
- **Denah ruang & kisi-kisi ujian** (pilihan user setelah batch malam) — model `RuangUjian` + `PenempatanRuangUjian`,
  kolom `materi/indikator/levelKognitif` di soal. /pusat-ujian/administrasi/ruang: daftar ruang, bagikan otomatis
  (selang-seling tingkat / per kelas, sesi otomatis bila kapasitas kurang), pindah/tukar kursi, cetak denah pintu,
  kartu meja, rekap; ruang ikut tampil di kartu peserta, daftar hadir, berita acara. /pusat-ujian/[id]/kisi-kisi:
  isian per butir + cetak landscape; kolom juga di editor soal, bank soal, template & impor Excel. Build & uji berjalan.
  Belum: data ruang sekolah yang sebenarnya (nama, kapasitas, meja per baris) — diisi Admin/Wakasek Kurikulum.
  LIVE, uji 23/23 (satu pemeriksaan sempat gagal karena DNS sesaat, lulus di run lain).
- **Header portal tertutup saat digulir** (temuan user) — di portal perpustakaan PageHeader menempel di posisi 0 dan
  menutupi bar tab (Katalog & Data, Peringkat, Pinjaman Saya). PageHeader kini membaca `--pageheader-top`/`--pageheader-pt`;
  PortalShell mengaturnya (`offsetKepalaHalaman="47px"` untuk perpustakaan). Dashboard tidak berubah. Beranda Pusat Ujian
  di HP juga tidak lagi bisa digeser 1px (kotak tab filter kini bergulir di dalam kotaknya). Build & uji berjalan.
- **Pagination** (permintaan user) — komponen bersama `usePaginasi` + `Paginasi`: Akun Pengguna (1.820 akun), Kelola Siswa,
  Orang Tua (601), Agenda Surat, Perpustakaan (katalog/peminjaman/reservasi/riwayat), Katalog Anggota, Buku Saya.
  DESIGN_SYSTEM §5.6 & gotcha #37 diperbarui. Build & uji berjalan.
- **Perbaikan kecil CBT & surat** (pilihan user) — jam ujian lintas hari tampil dengan tanggal di daftar hadir & berita
  acara; berita acara tetap 1 lembar walau yang tidak hadir banyak; template Surat Keterangan Bebas Tanggungan;
  Berita Acara Verval Nominatif (/dashboard/admin/nominatif/berita-acara-verval, tombol di halaman Nominatif). LIVE, uji 9/10:
  tanggal lintas hari tampil, berita acara 35 peserta 1 lembar, template ter-build, Verval 116 = 116 siswa XII & 1 lembar.
  Satu-satunya yang gagal = gulir samping 1px beranda Pusat Ujian HP (perbaikan keduanya tertinggal build ini).
- **Pagination header & daftar — uji ulang 13/15**: header portal & semua daftar lulus. Kelola Siswa ternyata panjang karena
  18 kelas (tiap tabel ≤35), bukan tabelnya → kini dipaginasi 6 kelas/halaman. Build ini juga membawa perbaikan gulir samping
  1px Pusat Ujian (baris tombol `w-full sm:w-auto min-w-0`). Build & uji lengkap berjalan.
- **Kotak notifikasi semua akun** (keputusan user: aktivasi push per perangkat tidak bisa dipaksa dari superadmin) —
  model `NotifikasiPengguna`; lonceng di bar atas HP (Admin/TAS: ikon kotak masuk, karena sudah ada lonceng pesan) &
  tombol melayang desktop; pita **Tugas Hari Ini** (absensi/piket/jurnal belum diisi, tidak bisa ditutup — DIHAPUS 15 Sep karena dobel dengan lonceng); ajakan
  aktifkan notifikasi tiap sesi; daftar **Belum Mengaktifkan** + salin ke WA di `/dashboard/admin/notifikasi`.
  Diterapkan otomatis setelah build D mengambil kode, lalu build & uji sendiri.
- **Sinkron Dapodik** — pendaftaran Web Service sudah disimpan operator (14 Sep 2026 malam; getSekolah HTTP 200 dari
  server). Pengaturan di `.env` (`DAPODIK_URL/NPSN/KEY`, cadangan `.env.sebelum-dapodik` — hapus saat bersih-bersih) &
  diteruskan docker-compose. Halaman **/dashboard/admin/dapodik** (Admin: Sistem → Sinkron Dapodik; TAS: TU — Buku Induk &
  Data). **Arah data: data TU = acuan, Dapodik yang disamakan** (keputusan user) → Pratinjau Sinkron baca-saja + unduh
  daftar perbaikan .xlsx untuk operator; TIDAK ada penyalinan Dapodik → situs. Temuan: Dapodik masih semester 2025/2026
  Genap (TU sudah 2026/2027); data guru TU belum punya NIK/NUPTK/tanggal lahir sama sekali. VM Dapodik (Windows) baru melayani Web Service setelah
  Windows login dan aplikasi Dapodik dibuka & login (menurut operator 15 Sep 2026) — cukup dinyalakan saat operator
  bekerja di Dapodik, tidak perlu 24 jam. Daftar diminta berurutan (serentak → Dapodik membalas halaman galat HTML).
  Menunggu operator: pergantian semester di Dapodik. Jangan mencoba variasi kunci.
- Tiap tahap memanggil `scripts/backup-db.sh` (dump DB + arsip uploads ±84 MB). Saat berbarengan dengan build Docker,
  langkah arsip uploads bisa tertahan beberapa menit — pertimbangkan cukup dump DB untuk perubahan skema.
- SELESAI 15 Sep 2026: halaman lama `/dashboard/{admin,teacher}/perpustakaan` dialihkan ke `/pusat-perpustakaan/kelola`
  (cetak-barcode lama tetap, masih ditautkan); route `/api/teacher/bk/summary` dihapus.

### Rencana awal (dijadwalkan 18.10 WIB, lalu dimulai lebih awal)

Dikerjakan bertahap setelah jam sekolah (build & deploy tidak mengganggu kegiatan):
1. **Notifikasi push** (Web Push via PWA/HTTPS): orang tua (alpha/terlambat/poin), siswa (ujian dimulai/tugas baru),
   guru (jurnal belum diisi), **pengingat absensi kelas belum diisi** untuk sekretaris & ketua kelas serta wali kelas,
   **pengingat guru piket** yang belum mengisi.
2. **Peringatan dini siswa berisiko** (wali kelas & BK) + push.
3. **Absensi mandiri pindai QR** (QR berganti ±30 dtk; petugas piket pindai kartu pelajar).
4. **Sinkron Dapodik** baca-saja — VM 102 (Windows) di **172.15.0.4**, Web Service Dapodik **port 5774** terjangkau dari
   server situs (172.15.0.3); `/WebService/getSekolah?npsn=69896523` tanpa kunci → "Access denied … #1" (layanan hidup,
   menolak karena belum ada kunci/IP belum didaftarkan). Menunggu operator: daftarkan IP 172.15.0.3 + berikan kunci Web
   Service (simpan di .env, jangan dicetak).
5. **Portal Perpustakaan sendiri** seperti Pusat Ujian/Ujian Online.
Tidak termasuk: AI guru (perlu keputusan biaya & privasi), passkey (tunggu domain).

---

## 🟢 Tahap lanjutan 14 September 2026 (sore) — live & teruji

- **Kebijakan Privasi** `/kebijakan-privasi` (ID/EN, tautan di footer) — juga syarat kunci Google Drive "SMK Cadangan".
  Isi perlu dibaca TU/kepala sekolah sebelum dianggap final.
- **Tombol Keluar di HP**: `MenuAkunMobile` di bar atas mobile semua portal (uji HP Admin/Guru/Siswa lulus).
- **Portal Orang Tua** memakai MobileBottomNav (Dashboard · Anak · Pengumuman · Akun).
- **Papan pantau ujian realtime** (SSE `/pantau/stream` + `usePantauLangsung`, cadangan polling 5 dtk).
- **PWA**: ikon dari Logo Lambang (`/ikon-aplikasi/*`), manifest dinamis, halaman **`/pasang-aplikasi`** untuk disebar ke WA
  (tombol Pasang, panduan Android/iPhone/laptop, QR). Chrome menilai situs bisa dipasang (CDP tanpa hambatan).
- Uji tahap 1: 29/31 otomatis + 2 sisanya dibuktikan manual lewat diagnosis (pemilih uji, bukan bug).

### Berikutnya
- **Passkey (sidik jari/Face ID) — DITUNDA SAMPAI DOMAIN `smkalmunawwiriibs.sch.id` DISETUJUI** (keputusan user 14 Sep 2026).
  Passkey terikat ke nama domain; kalau diaktifkan di ts.net semua orang harus daftar ulang saat pindah domain.
  Urutan saat domain acc: aktifkan Caddy/HTTPS domain (`scripts/activate-https.sh`) → ganti `ALAMAT_APLIKASI`
  (`src/lib/alamat-aplikasi.ts`) & Branding Google "SMK Cadangan" → baru bangun passkey (RP ID = domain sekolah).
- **Rantai build**: tambahkan penahan SEBELUM build dimulai saat ada siswa ujian (sekarang hanya deploy yang ditahan).
- **Bersih-bersih 15 Sep 2026 — SELESAI:** tag image rollback lama dihapus (disimpan `sebelum-dapodik-tu-acuan`,
  `sebelum-dapodik`, `sebelum-paginasi-kelas`, `sebelum-dapodik-berurutan`); sampah sementara (scratchpad, /tmp, `.next/dev`,
  berkas `.tmp`, skrip konversi alumni); atribut `version` docker-compose; `.env.sebelum-dapodik`. Build cache Docker
  > 24 jam dibersihkan otomatis setelah build 14.00. **Masih ditunda:** `/root/.config/rclone/rclone.conf.sebelum-kunci-sekolah`
  (hapus setelah beberapa malam salinan Drive sukses — baru 1 malam per 15 Sep).
- **Perbaikan data 15 Sep 2026:** 663 avatar akun alumni (605 lulus, 58 keluar) menunjuk `/uploads/siswa/…` yang tidak
  pernah ada → diarahkan ke foto keluar/masuk Buku Induk yang berkasnya ada (663/663). Nilai lama:
  `/root/cadangan-db/avatar-rusak-sebelum-perbaikan-20260915.txt`.
- **Build 1 · 15 Sep 2026** (dijalankan langsung atas perintah user): notifikasi dobel (kartu dashboard guru dihapus, pengingat sehari tidak
  menumpuk, pengingat selesai otomatis dibaca), header Agenda, 207 token warna tak ada, kartu Keunggulan & ayat Login &
  slide pertama beranda bisa diubah di Konten Halaman (+ petunjuk letak kutipan dibetulkan), pesan galat Dapodik tanpa HTML.
- **Build 2 · 15 Sep 2026:** hari libur otomatis (`src/lib/hari-libur.ts`: Minggu + agenda Libur Kalender Pendidikan +
  tanggal merah nasional disalin mingguan + libur tambahan) dipakai pengingat, penanda pengingat selesai, absen mandiri QR, badge
  kelas belum absen; kartu "Hari Libur" di Notifikasi Push menampilkan libur 4 bulan ke depan. Kepala portal (Pusat
  Perpustakaan, Perpustakaan, Pusat Ujian) menempel bersama tab, tinggi diukur otomatis.
- **Build 3 — terjemahan Inggris (15 Sep 2026: teks antarmuka halaman publik; isi database masih Indonesia) — LIVE & TERUJI 16/16 (uji ulang Build 1 16/16), tag rollback `sebelum-inggris`:** audit mode EN situs live 15 Sep: teks tertanam masih Indonesia di menu navbar
  (beberapa halaman), filter Berita, halaman Agenda, "Jalur Pendaftaran", Tracer Study, Daftar Ulang, Pasang Aplikasi, slide
  hero bawaan. Isi dari database (jurusan, galeri, berita, agenda, struktur organisasi) hanya berbahasa Indonesia — perlu
  kolom versi Inggris bila ingin ikut berganti.
  Ikut di Build 3: (a) notifikasi "alpha 3 hari berturut-turut" tidak lagi dobel (kunci per hari kirim, bukan per tanggal
  data); (b) **pita "Tugas hari ini" di bawah logo DIHAPUS di semua portal** (temuan user: isinya sama persis dengan isi
  lonceng notifikasi) — pengingat absensi/piket/jurnal cukup di lonceng dan otomatis ditandai dibaca begitu tugasnya beres.
- **Build 4 · 15 Sep 2026 — ganti bahasa serempak:** tombol bahasa di navbar tidak lagi mengganti menu duluan (menu & isi
  berganti bersamaan setelah server merender ulang, tombol berputar selama menunggu); slide hero, kategori galeri, dan halaman
  Masuk ikut bahasa terpilih. Uji klik 16 halaman + HP: tidak ada teks salah bahasa (sisa beda = slide hero berganti tiap
  6 detik & tanda * formulir sebelum pengaturan termuat). Tag rollback `sebelum-bahasa-serempak`.
- **Build 5 · 15 Sep 2026 — Pola tampilan v2, tahap 1 (dashboard 5 portal + Masuk):** panel seragam, kartu angka lembut
  (warna hanya bila perlu perhatian), grafik ringkas HTML/CSS (grafik jurusan Admin dulu kosong), garis waktu jadwal hari ini
  + jadwal mingguan bertab, kalender agenda bisa diketuk di HP, "hari ini" dihitung WIB (server UTC), Login lebih ringan
  (animasi dirampingkan, formulir langsung terlihat di HP, isian 16px). Aturan: DESIGN_SYSTEM.md §17, CLAUDE.md #42.
  Tag rollback `sebelum-tampilan-v2`. **Tahap 2:** pindahkan halaman lain ke pola yang sama.
  **DI-ROLLBACK 15 Sep 2026 sore:** di build produksi `/dashboard/admin` 500 ("Element type is invalid … got: object",
  React #306 — gejala gotcha #35) padahal tsc lolos; Guru/Siswa/Orang Tua/Bendahara/Masuk 200. Situs kembali ke
  `sebelum-tampilan-v2` (Admin 200 terverifikasi); image rusak disimpan sebagai `smk-almunawwir-app:tampilan-v2-rusak`.
  Diagnosa: build produksi lokal di scratchpad (tanpa instrumentation.ts) dengan halaman diagnosa per bagian.
  Penyebab (bisect 2 putaran di build lokal): elemen ikon lucide (komponen klien di lucide 1.x) dioper dari halaman server ke
  komponen klien (StatTile/Link). Perbaikan: `IkonNama.tsx` (nama ikon dipilih di klien) di 5 dashboard; aturan di CLAUDE.md #35.
- **Build 6–9 · 15 Sep 2026 (sore–malam) — Pola tampilan v2 LIVE:**
  - Build 6: dashboard 5 portal v2 (setelah build 5 di-rollback; akar galat: elemen ikon lucide dioper dari halaman server ke
    komponen klien — dibuktikan bisect di build lokal, aturan di CLAUDE.md #35, `IkonNama.tsx`, `scripts/cek-ikon-kembar.mjs`).
  - Build 7: halaman Masuk disederhanakan seperti Cek Kelulusan (navbar, pita biru pendek, satu kartu formulir).
  - Build 8: kartu angka BERWARNA LEMBUT (pilihan user), perbaikan luber di HP (grid tanpa kolom tegas di panel Komposisi —
    menu bawah ikut terpotong), pita Login dipendekkan, 5 halaman tahap 2 bebas pola ikon rawan.
  - Build 9: SEMUA halaman ikut pola dashboard — `StatTile` bawaan lembut (gradien hanya rapor yang ikut tercetak),
    `EmptyState` bergaya panel, 366 huruf <12px di 101 berkas layar dinaikkan (cetak tidak disentuh), grafik donat L/P +
    batang berwarna jurusan (pilihan user), helper `bagianWib` di 13 lokasi, ikon kembar 8 berkas. Buka ulang 247 halaman
    vs baseline: tidak ada yang baru rusak.
  - Build 10 (LIVE): halaman server yang ditolak jabatan dialihkan, bukan 500 (`jabatanAtauAlihkan`, CLAUDE.md #13) —
    kasus nyata: /dashboard/teacher/wakasek/kurikulum/penugasan/print (500 → 307). Buka ulang 247 halaman: tidak ada yang baru rusak.
  - Build 11 (LIVE — 247 halaman aman, uji tampilan 46/46, sapu luber 208 halaman: 0 luber selain dokumen cetak Rekap Peserta Didik): grup menu 5 portal disusun per ALUR KERJA (DESIGN_SYSTEM §3.7, pita tab ditolak user —
    "lebih suka bottom navbar"); bottom navbar di Pusat Perpustakaan, Perpustakaan Digital, Pusat Ujian (`NavPortal`) & portal peserta
    ujian; tombol aksi SATU gaya per jenis (§4.1, 120 berkas); kepala tabel & `GroupedSection` terang; FREEZE tabel otomatis
    (`PembekuTabel`, §5.7); kartu bottom sheet berwarna lembut; Profil Sekolah (ringkasan kartu + tabel bisa digeser, cetak tetap),
    UKS & Ekstrakurikuler dirapikan; luberan HP diperbaiki di Rekap Absensi & QR Buku Tamu. Tag rollback `sebelum-grup-alur-kerja`.
    Alat uji baru: `sapu-luber.mjs` (semua halaman di lebar 360px, 3 jalur).
  - Build 12 (LIVE — 247 halaman aman, uji tampilan 46/46, sapu luber 208 halaman: sama, hanya Rekap Peserta Didik yang memang cetak; baris alat & susunan kartu diukur langsung di 1440px/360px): `StatTile` ikon + angka SEBARIS dengan label selebar kartu di bawahnya (permintaan user —
    label "Pendaftar Menunggu"/"Pesan Belum…" & angka "1.8…" tidak terpotong lagi); BARIS ALAT: kotak cari/saringan & tombol aksi
    bersanding di 17 halaman (Berita, Galeri, Arsip, Notulen, Cuti, Pendaftaran, Mitra, Siswa, Kelas, Jurusan, RPP, Klapper, Bantuan Siswa,
    Penerimaan Rapor, Laporan Penagihan, Inventaris, UKS — DESIGN_SYSTEM §4.1); 36 tabel racikan → `.data-table`; 15 tab aktif → navy padat;
    207 kartu racikan → `.panel`; tombol Cetak/Unduh yang sempat navy → putih bergaris. Tag rollback `sebelum-baris-alat`.
  - Build 13 (LIVE — 247 halaman aman, uji tampilan 46/46, sapu luber 208 halaman: hanya Rekap Peserta Didik yang memang dokumen cetak; audit sisa, permintaan user "cari yang lain juga selain kalender"): kalender absensi bulanan terang + freeze judul & kolom nama;
    16 kepala kartu navy racikan → terang; 9 tabel → `.data-table`; 42 huruf < 12px; 15 kartu → `.panel`; 8 tombol padat racikan → standar;
    2 `<select>` bawaan → `<Select>`; `window.alert` → toast; teks "Memuat" → Loader2; kartu filter Pendaftaran lembut; jarak atas HP di 3
    halaman. Pengecualian yang sengaja dibiarkan tercatat di DESIGN_SYSTEM §5.7. Tag rollback `sebelum-sisa-audit`.
  - Build 14 (LIVE — 247 halaman aman, uji tampilan 46/46, sapu luber 208 halaman: hanya Rekap Peserta Didik yang memang dokumen cetak; tangkapan layar user "masih banyak card/tombol/pita berbeda"): `.kisi-kartu` di 50+ grid kartu angka (HP selalu 2 kolom),
    `.baris-alat` di ±30 halaman (cari + tombol sebaris, di HP tombol ikon saja), satu pintu notifikasi (kotak + lonceng digabung, HP & desktop),
    63 tombol Kembali + PrintButton + 21 tombol racikan → standar, WhatsApp hilang dari portal perpustakaan, bottom sheet naik di atas
    keyboard, PageHeader di 4 halaman portal perpustakaan, kartu angka racikan (Legalisir, Bantuan Siswa, Kenaikan Kelas, Poin) → StatTile.
    Tag rollback `sebelum-seragam-detail`.
  - Build 15 (LIVE — 247 halaman aman, uji tampilan 46/46, sapu luber bersih selain dokumen cetak; jarak di bawah pita judul terukur 32px di HP & laptop): pembungkus `PageHeader` yang tidak baku (Katalog & Data Pusat Perpustakaan, Program Kerja Guru, Akun Pengguna, DKN Kelas) —
    di HP isi halaman menumpuk 8px ke pita judul (temuan user "katalog di bawah header tidak ada padding"). Tag rollback `sebelum-jarak-header`.
  - Build 16: menu portal Perpustakaan (petugas & anggota) disamakan dengan Pusat Ujian — kotak segmen putih, aktif navy
    (permintaan user "pembungkus menu di CBT terapkan juga di perpustakaan"); kotak cari satu gaya (17 ikon + 6 isian);
    6 teks "Memuat…" polos → Loader2. Tag rollback `sebelum-menu-portal`.
  - Uji tampilan wajib: bandingkan lebar dokumen dengan LEBAR LAYAR yang diset + ukuran huruf 115/130% (DESIGN_SYSTEM §17.4).
  - Sengaja belum: 113 berkas kartu racikan `bg-white rounded-2xl border shadow-sm` (dirapikan saat halaman disentuh),
    huruf kecil & ikon kembar di halaman CETAK (hasil cetak tidak boleh berubah).
  - Tag rollback yang disimpan (3 terbaru): `sebelum-grup-alur-kerja`, `sebelum-perbaikan-jabatan`, `sebelum-seragam-halaman`.
- **Usulan fitur/teknologi (menunggu pilihan user, 15 Sep 2026):** staging + uji otomatis di repo, deploy tanpa jeda,
  peringatan otomatis (situs mati/500/cadangan gagal), PWA offline + sinkron latar, kompresi foto WebP/AVIF, pencarian global,
  saran guru pengganti, laporan mingguan otomatis, kalender iCal, asrama & perizinan santri, tahfidz & absensi sholat, pesan
  wali kelas ↔ orang tua, survei umum, reservasi ruang/alat, janji temu BK, e-voting OSIS, portofolio & sertifikat siswa, katalog
  karya siswa, saldo kantin internal, pemulihan data per menit (WAL/PITR), header keamanan (CSP), statistik pengunjung
  self-hosted, gambar pratinjau berita (next/og), data terstruktur Google, OCR dokumen Buku Induk, pengumuman suara bel.
- **Dapodik 15 Sep siang:** aplikasi Dapodik membalas "Tidak terhubung dengan database #2" (database Dapodik di komputer
  Windows mati) — jendela Web Service tampil kosong karena daftarnya tidak termuat, BUKAN terhapus. Jangan tambah ulang;
  pulihkan database Dapodik dulu.
  DITUNDA atas permintaan user (15 Sep 12.40 WIB): setelah reboot VM + hapus `postmaster.pid` tetap "Whoops" (pemantauan
  12.16–12.37 WIB tidak berubah). Saat dilanjutkan, minta: status layanan database di services.msc, pesan galat saat Start,
  20–30 baris terakhir log di `C:\Program Files (x86)\Dapodik\database\log|pg_log`, sisa ruang drive C:. CPU host Proxmox
  terukur 100% (beban dari luar kontainer situs) saat itu — cek juga IO delay & pemakaian local-lvm.

---

## 🟢 Administrasi ujian, cadangan ke luar server, HTTPS lewat terowongan (14 September 2026)

### Administrasi Ujian — `/pusat-ujian/administrasi` (tombol **Administrasi** di Pusat Ujian)
- **Kartu peserta** per kelas (+ kegiatan): ukuran kartu ID CR80, 10 per A4, nomor peserta `STS-XTKJ1-01`,
  username, QR ke Portal Ujian (alamat host yang sedang dibuka), kotak foto 3×4 (belum ada foto siswa di sistem).
  Akses: Admin/TAS/Wakil Kepala Kurikulum semua kelas; guru kelas yang ia ampu/walikan.
- **Daftar hadir** & **berita acara** per ujian (`/pusat-ujian/[id]/daftar-hadir|berita-acara?kelas=`), satu halaman
  per kelas peserta; status hadir, yang tidak hadir, dan catatan pelanggaran terisi otomatis dari data pengerjaan.
- Belum ada: **denah/ruang ujian** (belum ada data ruang & kursi di sistem). Berita acara bisa 2 lembar kalau
  daftar tidak hadir panjang. Jam "s.d." hanya menampilkan jam tutup — untuk ujian lintas hari terlihat janggal.

### Cadangan ke luar server
- `scripts/salin-cadangan-luar.sh` (cron 19:30 UTC = 02:30 WIB, 30 menit setelah `backup-db.sh`): salin → cek ulang
  → hapus salinan > 30 hari, ke SEMUA tujuan di `/root/backups/smk-almunawwir/tujuan-luar.conf`. Status terakhir:
  `/root/backups/smk-almunawwir/status-salin-luar.json`.
- **Sekarang**: Google Drive sekolah (remote rclone `gdrive`, root_folder_id = folder Drive kiriman user), subfolder
  `SMK-Almunawwir-Cadangan`. rclone resmi di `/usr/local/bin/rclone` (versi apt 1.53 terlalu tua untuk login Google).
- **Nanti NAS/storage lain**: buat remote rclone (smb/sftp) lalu tambahkan satu baris di `tujuan-luar.conf` — skrip tidak diubah.
- ✅ **Kunci OAuth milik sekolah terpasang (14 Sep 2026)** — client_id bersama rclone (dipensiunkan 2026) sudah
  diganti. Google Cloud project `smk-cadangan` (akun smkalmunawir@gmail.com), app "SMK Cadangan", Desktop client,
  status **In production tanpa verifikasi** (JANGAN kirim untuk ditinjau — scope Drive penuh butuh audit keamanan
  berbayar; tanpa verifikasi token tidak hangus, cuma ada layar peringatan saat login). Branding memakai home page
  `https://smk-almunawwir.tail984090.ts.net`, privacy policy `/kebijakan-privasi`, authorized domain
  `tail984090.ts.net` — halaman itu WAJIB tetap ada selama kunci ini dipakai. Cadangan konfigurasi lama:
  `/root/.config/rclone/rclone.conf.sebelum-kunci-sekolah` (hapus setelah beberapa malam salinan sukses).
  Login ulang kalau suatu saat token dicabut: `rclone authorize drive <client_id> <client_secret>`, lalu ganti
  `token` di bagian `[gdrive]`.

### HTTPS tanpa domain — Tailscale Funnel (pilihan user)
- Domain sekolah belum disetujui; port 80/443 publik tidak diteruskan ke server. Tailscale dipasang dalam mode
  userspace (`/etc/default/tailscaled` FLAGS=--tun=userspace-networking, LXC tanpa /dev/net/tun), hostname
  `smk-almunawwir`, `--accept-dns=false`. Akun Tailscale: smkalmunawir@gmail.com (tailnet `tail984090.ts.net`).
- **AKTIF sejak 14 Sep 2026: https://smk-almunawwir.tail984090.ts.net** → proxy `http://127.0.0.1:3000`
  (`tailscale funnel status`; matikan: `tailscale funnel --https=443 off`). Sertifikat Let's Encrypt diperpanjang
  otomatis oleh tailscaled. Header yang diteruskan: `X-Forwarded-Proto: https`, `X-Forwarded-Host`, `X-Forwarded-For`
  (IP asli pengunjung), `Tailscale-Funnel-Request: ?1`. Alamat HTTP lama tetap jalan berdampingan.
- Cookie `Secure` kini ditentukan PER REQUEST (`pakaiSecure(headers)` di `src/lib/session.ts`) — JANGAN ganti
  `NEXT_PUBLIC_APP_URL` ke https hanya demi cookie; itu tetap cadangan saja.
- Lanjutan yang kini mungkin karena ada HTTPS: pasang PWA (install ke layar utama), login passkey/sidik jari,
  Clipboard API asli. `NEXT_PUBLIC_APP_URL` masih dipakai QR verifikasi rapor/buku induk & `metadataBase` — putuskan
  alamat resmi dulu (domain sekolah nanti vs ts.net) sebelum mengubahnya.

### Lain-lain
- Performa Server kini membaca cgroup LXC (CPU/RAM kontainer situs saja), kontainer aplikasi berlabel "Aplikasi web"
  (live 14 Sep 2026, bersama cookie Secure per-request — uji 12/12: login HTTPS & HTTP lab, penyegaran diam-diam).
- Skrip uji beban siap di scratchpad sesi (`uji-beban/jalankan.sh`), menolak jalan saat ada build atau siswa ujian.
- CPU host Proxmox 100% (dugaan VM 200) — user minta ditunda.

---

## 🟢 Panduan Ujian Online jadi fitur (14 September 2026)

- **Staf**: `/pusat-ujian/panduan` — tombol **Panduan** di baris tombol Pusat Ujian. Alur 6 tahap (persiapan,
  naskah Word & Excel, membuat ujian & kelas peserta, hari pelaksanaan, siswa mengerjakan, hasil) + arsip +
  masalah umum, dengan penyaring peran (Admin & Kurikulum / Guru / Pengawas / Siswa) dan daftar isi.
- **Siswa**: `/ujian-online/panduan` — kartu **Panduan Peserta** di Beranda Peserta; langkah, isi layar ujian,
  cara menjawab, yang tercatat, gangguan, setelah mengumpulkan.
- Isi di SATU berkas `src/components/ujian/PanduanUjian.tsx` (bagian yang dipakai staf & siswa disimpan
  sekali sebagai data). Gambar di `public/images/panduan-ujian/` — nama/NIS/NISN/nama guru disamarkan.
- **Kalau tampilan Pusat Ujian/Portal Peserta berubah besar, foto ulang gambarnya** dan perbarui teksnya
  di berkas yang sama. Versi artifact yang bisa dibagikan: claude.ai/code/artifact/a8d2c24d-eabc-4ca1-bc7b-afe8fd66d691.
- Temuan saat memotret: kalimat di daftar "Petunjuk Pengerjaan" halaman konfirmasi siswa terpecah jadi kolom
  (tiap `<li className="flex">` tanpa pembungkus teks) — sudah diperbaiki.

---

## 🟢 Ujian untuk banyak kelas + pencocokan Kode Test (14 September 2026)

Pertanyaan user: "bagaimana jika soal untuk beberapa kelas/jurusan — PJOK semua kelas X; Matematika XI dua guru".

- **Satu ujian, banyak kelas** (`Exam.kelasIds`): di Pengaturan ujian ada pemilih "Kelas peserta" per tingkat +
  "Pilih semua". Satu token, satu naskah, satu kunci; papan pantau & hasil menampilkan kelas tiap siswa;
  Excel hasil punya kolom Kelas.
- **Guru pembuat vs pengampu**: pengampu kelas lain (mapel sama) otomatis bisa memantau, mengoreksi, melihat hasil;
  mengubah soal/pengaturan/menghapus hanya pembuat atau Admin/Kurikulum.
- **Celah ditutup**: guru dulu bisa membuat ujian untuk kelas mana pun (penugasan tidak diperiksa).
- **Kode Test ↔ mapel**: Excel kunci mapel lain DITOLAK saat diterapkan ke ujian; pratinjau impor Word memberi
  peringatan kalau Mata Pelajaran/Kode Test beda. Petunjuk template Excel diperbarui; nama guru terisi otomatis.

Data Penugasan Mengajar saat ini (untuk contoh user): PJOK X semua 5 kelas = Saroni. Matematika XI = Lailatul
(XI ATU 1, DKV 1, DPIB 1, TKJ 1, TKJ 2) + Nikmatul (XI AK 1) — berbeda dengan gambaran user ("1 guru TKJ 1 & 2,
1 guru jurusan lain"); kalau yang benar gambaran user, perbaiki di Penugasan Mengajar (terkait 5 selisih penugasan).

---

## 🟢 Sistem sesi login dua token (14 September 2026)

Dibangun dari cetak biru autentikasi yang dikirim user, disesuaikan dengan server ini. Rincian teknis
ada di CLAUDE.md bagian "Auth & Session".

### Yang jadi
| Bagian | Isi |
|---|---|
| **Dua token** | token akses JWT 15 menit (`session`) + token segar acak 256 bit (`sesi_segar`, DB hanya menyimpan hash) di tabel `UserSession` |
| **Ingat saya** | centang di halaman login → 30 hari. Tidak dicentang (bawaan) → hilang saat browser ditutup / 8 jam tanpa aktivitas |
| **Tidak logout sendiri** | proxy menyegarkan token akses diam-diam di request yang sama; sesi di PostgreSQL selamat saat deploy; sengaja tanpa rotasi token (request paralel tidak saling menendang) |
| **Migrasi tanpa login ulang** | cookie lama (JWT 8 jam + cookie `impersonator`) dipindah otomatis ke sesi server saat deploy |
| **Masuk Sebagai** | sesi admin tidak diganti — baris sesinya ditandai; kembali tanpa login; semua log aktivitas selama itu mencatat nama admin asli |
| **Cabut sesi instan** | verifySession memeriksa baris sesi tiap request → keluar dari perangkat lain / dicabut admin langsung berlaku |
| **Ganti/reset password** | semua sesi lain akun itu dicabut (5 endpoint) |
| **Perangkat Aktif** | kartu di halaman Profil 5 portal: daftar perangkat, keluarkan satu / semua lainnya |
| **Keamanan & Sesi Login** | `/dashboard/admin/keamanan-sesi` (ADMIN): semua sesi aktif, cabut, kebijakan satu-akun-satu-perangkat per peran |
| **Penjaga tab** | kalau akun berganti di tab lain, tab lama ditutup peringatan sampai dimuat ulang (mencegah menyimpan atas nama akun yang salah) |
| **Anti cache silang** | `Cache-Control: private, no-store` untuk dashboard, API, portal ujian, login |

Cadangan DB sebelum perubahan skema: `/root/cadangan-db/smk_almunawwir-sebelum-sesi-20260914-0058.sql.gz`.
Image rollback: `smk-almunawwir-app:sebelum-sesi`.

### Yang SENGAJA tidak/belum dibangun
- **Redis** — belum ada di server; PostgreSQL memberi hal yang dicari cetak biru (sesi tidak hilang saat restart).
- **Cookie `Secure` & Passkey (sidik jari/Face ID)** — keduanya WAJIB HTTPS. Server masih HTTP; memaksa Secure
  membuat tidak ada yang bisa login. Menyala sendiri begitu `NEXT_PUBLIC_APP_URL` https. **Menunggu TLS** (sama
  dengan PWA).
- **Tabel permission RBAC baru** — peran + jabatan (`assertJabatan`) + cek cakupan (wali kelas/penugasan) sudah
  berfungsi sebagai RBAC+ABAC; merombak 300+ route tidak sepadan risikonya.
- **Token per-tab (sessionStorage / X-Tab-ID)** — tidak cocok dengan Server Component & cookie HttpOnly; diganti
  penjaga tab di atas.

### Tindak lanjut kecil
- Proxy juga menyegarkan token untuk request gambar `/uploads` saat token akses kebetulan habis (satu kali per
  15 menit per pengguna). Aman, tapi bisa dilewati untuk berkas statis pada build berikutnya.

## 🟢 CBT dirombak total mengikuti pola Bimasoft (13 September 2026, malam)

Dibangun setelah membedah: dokumentasi resmi Bimasoft (repo `wiki-bimasoft`), template Word (.docm,
nama makronya terbaca dari VBA: BenarSalah, Checklist, isiansingkat, isian, upload, Penjodohan,
PilihanGandaBerkolom, embed, ljksetujutidak, Survey, dragdrop), template Excel #13.1.0 (lembar SOAL,
Peserta, HASIL), dan **14 naskah soal sungguhan** dari Drive sekolah.

### Yang jadi
| Bagian | Isi |
|---|---|
| **8 jenis soal** | PG, PG Kompleks, Benar/Salah, Menjodohkan, Isian Singkat, Uraian, Unggah Berkas, Survei — aturan bentuk & penilaian di SATU berkas `src/lib/soal.ts` |
| **Skor & KD per butir** | bukan 1 poin rata; pecahan boleh (2,8) |
| **Wacana bersama (grouping)** | `ExamStimulus` — soal se-wacana tidak dipisah saat diacak |
| **Kunci posisi (LockN)** | listening selalu nomor 1, uraian selalu terakhir |
| **Sampel soal** | "Jumlah Soal" vs "Yang Harus Dikerjakan" — bank 50, siswa terima 30 acak |
| **Pengacakan per siswa** | soal & opsi, deterministik dari id attempt, disimpan sekali (`ExamAttempt.urutan`) — muat ulang tidak mengubah urutan |
| **Satu soal per halaman** | naskah tidak bisa disalin utuh lewat DevTools |
| **Waktu di server** | dari `startedAt`, klien hanya menampilkan; jam klien dikoreksi lewat `serverNow` |
| **Autosave** | tiap jawaban langsung disimpan (`PUT /jawab`) + denyut `lastSeenAt` |
| **Pelanggaran** | pindah tab, keluar layar penuh, salin — DICATAT, tidak menghentikan ujian; batas bisa disetel |
| **Examkey** | halaman ujian hanya terbuka lewat URL `?examkey=` (browser ujian sekolah) |
| **Papan pantau** | per siswa: status (belum/mengerjakan/terputus/waktu habis/selesai), kemajuan, sisa waktu, pelanggaran, denyut; aksi Lanjutkan +15m / Kumpulkan paksa / Ulang; segar tiap 5 detik |
| **Koreksi uraian** | per siswa per butir, nilai dihitung ulang otomatis |
| **Hasil & analisis butir** | tingkat kesukaran, daya beda (27% atas–bawah), per KD; ekspor Excel 3 sheet |
| **Impor Word** | mengenali 4 pola naskah nyata (tabel Bimasoft, daftar bernomor Word, paragraf A./a), tabel 2 kolom) + lembar uraian; gambar & pangkat ikut; **pratinjau dulu, guru koreksi, baru simpan** |
| **Impor Excel** | membaca template Bimasoft #13 apa adanya (pengaturan + tabel `No·Kunci·Skor·Grouping·LockN·KD`), teruji pada berkas asli |
| **Template unduhan** | Word (tabel 3 kolom seperti Bimasoft + penanda `[BENAR_SALAH]` dll) & Excel |

### Ruang Kendali Ujian — padanan "CBT Admin" Bimasoft
`/pusat-ujian/kendali`. Beda dengan papan pantau per-ujian: satu layar untuk SEMUA ujian sekaligus,
supaya operator di ruang server tahu keadaan semua ruang tanpa membuka ujian satu per satu.
Bedanya dengan Bimasoft: tidak perlu aplikasi desktop terpisah, dan tindakannya langsung berlaku
tanpa sinkronisasi.

- Papan angka: ujian berlangsung · mengerjakan · terputus · waktu habis · selesai · pelanggaran
- Per ujian: token (salin / **ganti kalau bocor**), terbitkan–tarik, jadwal, penanda examkey & acak
- Tindakan satu kelas: **buka yang terputus +15m**, **tambah 15 menit untuk semua**,
  **kumpulkan semua sekarang** (mis. saat listrik padam)
- Per siswa: +15m · Kumpulkan · Ulang
- Segar otomatis tiap 5 detik; baris ujian yang perlu perhatian diberi bingkai kuning

Terverifikasi: ganti token `SYG9KA → DVQ7QU` (siswa yang sudah masuk tidak terganggu, token lama
ditolak 404), tambah waktu massal 20 menit benar-benar sampai ke sisa waktu siswa.

### Halaman siswa TERPISAH dari portal siswa
`/ujian-online` punya layout sendiri (`src/app/ujian-online/layout.tsx`) — hanya logo + tombol
Keluar, tanpa sidebar/menu portal siswa, supaya tidak ada gangguan saat mengerjakan.

Halaman: guru `/pusat-ujian` (Ringkasan · Daftar Ujian · Bank Soal · Hasil), `/pusat-ujian/kendali`
(Ruang Kendali), `/pusat-ujian/[id]` (Soal & Pengaturan · Papan Pantau · Koreksi Uraian ·
Hasil & Analisis); siswa `/ujian-online`.

### Ujian contoh siap pakai
"CONTOH — Ujian Semua Jenis Soal" · X TKJ 1 · Bahasa Indonesia · 10 soal / 100 poin, memakai
kedelapan jenis soal, satu wacana bersama (3 soal), dan dua soal terkunci di akhir (Uraian@9,
Unggah@10). Terbuka sampai 12 November 2026. Boleh dihapus kapan saja.

### Hasil uji pembaca Word pada naskah asli
Akuntansi Dasar 32 PG · Akuntansi Keuangan 20 PG · APA 40 PG + 6 gambar · Fisika 35 PG + 3 gambar ·
Ekonomi Bisnis 35 PG · ADM Umum 40 PG (tabel 2 kolom) · template Bimasoft 34 PG · 6 lembar uraian
2025–2026 masing-masing 8–10 soal + nama mapel & guru terbaca. **`.doc` lama ditolak** dengan pesan
"simpan ulang sebagai .docx".

### Yang SENGAJA tidak dibangun
- **Exam client Android/desktop terkunci** — produk bertahun-tahun; pengacakan di server + papan
  pantau sudah menutup sebagian besar celah yang dikejar exam client.
- **Menyalin kode `cbtadmin64`** — itu klien proktor NW.js pihak ketiga (bukan CBT), dan repo
  `Exam-Mod`/`CBT-ExamMod` adalah alat menembus penguncian (menyontek) — tidak dibantu.

### Catatan migrasi
1 ujian lama ("Ulangan harian bab 1", 0 pengerjaan) dihapus agar skema bisa didorong. Bank soal
sebelumnya kosong, jadi tidak ada data yang hilang.

---

## 🔵 Temuan dari arsip Drive TU — calon fitur baru (ditelusuri 13 September 2026)

Hasil penelusuran ulang **15.093 berkas** di folder Drive Tata Usaha. Ini BUKAN daftar keinginan:
tiap butir di bawah punya bukti berapa berkas nyata yang selama ini dikerjakan manual.

**Sebaran arsip:**

| Folder | Berkas | Isi terbesar |
|---|---|---|
| KURIKULUM | 7.181 | UJIAN 6.960, DKN 118, Nominatif 59, SKL & Transkrip 17 |
| PERSURATAN & PENGARSIPAN | 4.054 | Surat Keluar 2.267, Surat Masuk 309, Pengarsipan Berkas 1.445 |
| KESISWAAN | 2.570 | Foto 2.279, Ekstrakurikuler 204, Jurnal 38 |
| KEPEGAWAIAN | 1.271 | Berkas pribadi guru 396, SK Panitia 255, Yayasan 148 |

*Catatan: dari 6.960 berkas UJIAN, **1.607 di antaranya adalah dump kode sumber aplikasi CBT**
(`cbtadmin64`, berisi contoh git hooks) — bukan dokumen. Dokumen ujian yang sebenarnya ±5.350.*

### Calon fitur, urut dari yang paling berdampak

**1. Arsip Berkas Digital per Siswa** — *rekomendasi utama*
`PENGARSIPAN BERKAS` memuat **Ijazah 599 · Sertifikat UKK 413 · Skill Passport 68 · Prestasi 128**,
semuanya bernama orang ("Skill Passport Dian Natasya.pdf"). Sekarang dicari dengan menyisir folder
Drive. Kalau tertaut ke record siswa, pencarian jadi seketika — dan **modul Legalisir yang sudah ada
langsung dapat manfaatnya**, karena yang dilegalisir justru scan ijazah itu.

**2. Arsip Berkas Kepegawaian** — kembaran no. 1 untuk guru
Tiap guru punya foldernya sendiri (`/KEPEGAWAIAN/Kepegawaian/<nama>`), isi 7–68 berkas. Contoh
P. Abdul Wahid (68 berkas): Akte Kelahiran, Ijazah SD/SMP/SMK/S1, KK, KTP, SKCK, Pakta Integritas,
Hasil NAPZA. Daftar jenis berkasnya baku — persis yang diminta Dapodik & akreditasi.

**3. Buku Prestasi Siswa**
128 piagam lomba, sebagian besar JPG tanpa daftar. Selalu diminta saat akreditasi dan dipakai
promosi PPDB. Belum ada modulnya.

**4. Buku Keputusan (SK)**
`SK Pembentukan Panitia 255 · SK Pembagian Tugas 63 · SK Pengangkatan 30 (+71 dari Yayasan)`.
Persuratan sudah punya 4 template kategori Keputusan, tapi belum ada **registernya** — nomor SK,
tanggal, perihal, dan siapa saja yang ditugaskan.

**5. Administrasi Ujian**
Kata tersering di nama berkas ujian: **Soal 880 · Kisi-kisi 266 · Kartu 291 · Daftar Hadir 196 ·
Berita Acara 83 · Tata Tertib Ujian 23**. Tiap ujian melahirkan berkas yang sama dan diketik ulang
tiap semester. Yang paling mudah dijadikan generator lebih dulu: **kartu peserta ujian, daftar
hadir, dan berita acara** — datanya sudah ada di sistem.

**6. Proposal & LPJ Kegiatan**
160 berkas (Proposal, LPJ, RAB, BKU, "Accountability Report"). Menyambung ke modul Bendahara.

### Temuan kecil yang bisa langsung dikerjakan

- **Template "Surat Keterangan Bebas Tanggungan" BELUM ADA** di pustaka 50 template, padahal ada
  **29 berkas** di arsip dan surat ini selalu menyertai mutasi siswa keluar.
- **Berita Acara Verval Nominatif** (83 berkas Berita Acara) — modul Nominatif Kelas XII sudah ada,
  berita acaranya belum.
- **SK Penetapan Komite Sekolah** ada di arsip, modul Komite belum ada sama sekali.
- **PKB / SKP / Supervisi guru** — ada "DATA PKB ASN SMK AL MUNAWWIR IIBS.xlsx" dan sertifikat
  diklat; modul Kinerja sudah ada, tapi belum memuat riwayat pengembangan keprofesian.

---

## 🟢 Buku Tamu isi mandiri lewat QR + perbaikan cetak (13 September 2026, malam)

### Kartu QR Buku Tamu — `/dashboard/admin/buku-tamu/qr`
Satu QR (bukan satu per kategori), ukuran **A6 105 × 148 mm** untuk standing acrylic meja depan.
Tamu memindai → halaman publik `/tamu` (tanpa login) → memilih jenis tamu sebagai pertanyaan
PERTAMA (Dinas / Wali Murid / Vendor / Umum / Lainnya) → isi nama & keperluan → selesai.

Kenapa satu QR: dengan QR terpisah per kategori, tamu dinas yang memindai papan "umum" tercatat
salah kategori selamanya dan tidak ada yang mengoreksi.

- **Jam datang diambil dari waktu server** (dikonversi ke WIB), bukan kiriman tamu — tidak bisa
  diatur sendiri.
- Satu alamat IP dibatasi **12 pengisian per jam**.
- Alamat di dalam QR diambil dari host yang dipakai membuka halaman itu, BUKAN `NEXT_PUBLIC_APP_URL`
  (nilainya masih `localhost:3000` di server, dan QR ke localhost tidak bisa dibuka dari ponsel).
  **Kalau IP server berubah, QR yang sudah dicetak jadi mati** — buka lagi halamannya lalu cetak ulang.
- Baris hasil QR diberi lencana biru **QR** di daftar Buku Tamu supaya TU tahu mana yang belum
  diverifikasi.
- **Foto sengaja TIDAK ada di formulir tamu.** Ada tombol kamera di tiap baris — TU yang mengunggah
  dokumentasi setelah barisnya ada.

### Motif cetak: selama ini TIDAK PERNAH kelihatan di halaman cetak mana pun
Temuan dari pertanyaan user "buku mutasi memang tidak punya pattern?". Motifnya ada, tapi
`.print-doc` punya `background-color: #ffffff` sementara motifnya dipasang di `::after` dengan
`z-index: -1` — jadi motif jatuh di belakang latar putihnya SENDIRI, bukan cuma di belakang teks.
Karena saat mencetak motifnya `position: fixed` (supaya penuh satu kertas), ia baru menyembul di
**sisa ruang kosong halaman terakhir** — persis yang terlihat di tangkapan layar user.

Perbaikan: `isolation: isolate` pada `.print-doc` → jadi stacking context sendiri, sehingga urutan
gambarnya latar putih → motif → isi. Tidak menyentuh satu pun anak elemen, jadi hiasan Buku Induk
aman. Berlaku di SEMUA halaman cetak sekaligus.

### Dropdown "Margins: None" di Chrome mengalahkan `@page`
Buku Mutasi punya `@page { margin: 1.2cm }`, tapi isinya tetap menempel ke tepi kertas karena
petugas memilih **Margins: None** di dialog cetak (lazim, karena Buku Induk memang perlu tanpa
margin). Pola barunya: `@page { margin: 0 }` + margin dipasang sebagai **padding wadah cetak** —
padding tidak bisa dimatikan dari dialog, jadi hasilnya sama apa pun setelan browsernya. Sudah
diterapkan di Buku Mutasi & Rekap Siswa.

### Rekapitulasi Jumlah Siswa — dirombak
`/dashboard/admin/reports/rekap-siswa`
- **Kop resmi** (navy + lambang) menggantikan tiga baris teks polos.
- **Grafik batang dibuang** ("ini tidak perlu, cukup tabel saja yang jelas").
- **Judul kolom yang salah diperbaiki**: grup "JUMLAH ROMBEL KELAS" ternyata berisi jumlah SISWA —
  angkanya kembar persis dengan kolom "Jml" di sebelahnya.
- **Dua tabel digabung jadi satu**, dicetak **A4 mendatar** (12 kolom angka tidak muat di potret).
  Banyaknya rombel sengaja tidak jadi kolom tersendiri (satuannya beda dengan kolom sebelahnya —
  itu justru sumber salah bacanya); angkanya menyatu di baris subtotal tiap jurusan.
- **Sel jurusan mendatar** (lambang kiri, nama kanan) — tinggi baris turun dari ±3 baris jadi 1.

### Pemeriksa Jadwal: tombol penyelaras Penugasan Mengajar
Temuan "Jadwal tidak cocok dengan Penugasan Mengajar" kini punya dua tombol per baris, karena
hanya sekolah yang tahu mana yang benar:
- **"Jadwal yang benar"** → penugasan dipindahkan ke guru yang ada di jadwal (membuka kembali
  akses nilai & jurnal untuk guru yang selama ini mengajar tanpa penugasan).
- **"Penugasan yang benar"** → semua baris jadwal kelas+mapel itu diganti gurunya.

Keduanya saling membatalkan, jadi salah pilih tinggal ditekan tombol sebelahnya.

**Penelusuran kasus nyatanya** (5 baris, semuanya dibuat MANUAL 10–11 Agustus 2026, sementara baris
hasil Generate 19 Juli semuanya cocok dengan penugasan):

| Kelas | Mapel | Guru di jadwal (manual, Agt) | Pemegang penugasan |
|---|---|---|---|
| X AK 1 (2 baris), X DPIB 1, X TKJ 1 | Seni Budaya | Ufia Ardina Zahirah, S.Psi | Moh. Ainun Najib, S.Pd |
| XI DPIB 1 (blok Selasa 07:15–12:45) | Produk Kreatif | Hadi Masruri, S.Ds | Virga Ahmad Fauzi, S.T. |

Petunjuk kuat bahwa ini penyerahan tugas yang belum dicatat, bukan salah klik: yang bergeser
**hanya kelas-kelas milik Ainun** (kelas Novita di mapel yang sama tetap Novita), dan Ufia sendiri
penugasannya cuma Sejarah + Tauhid. Ainun juga tidak kelebihan beban (18,7 jam/minggu). Tidak ada
nilai/jurnal yang sudah terisi untuk mapel ini, jadi tidak ada data yang ikut terdampak apa pun
keputusannya. **Menunggu kepastian sekolah.**

---

## 🟢 Pemeriksa Jadwal — fitur baru (13 September 2026, malam)

`/dashboard/admin/pemeriksa-jadwal` (menu **Akademik**, tepat di bawah Jadwal Pelajaran).
Saudara kandung Pemeriksa Data, 10 aturan, 1.536 baris jadwal diperiksa dalam ~1,2 detik.

Dibuat karena angka "bentrok" selama ini menyesatkan: mula-mula terbaca 222, lalu 67 setelah kelas
XII dikecualikan — dan ternyata **tidak satu pun bentrok sungguhan**. Pemeriksa ini memisahkan tiga
hal yang selama ini tercampur jadi satu angka:

| | Arti | Hasil sekarang |
|---|---|---|
| Kelas kebagian 2 pelajaran di jam sama | mustahil | **0** |
| Guru, **dua mapel berbeda** di jam sama | mustahil | **0** (28 ada, semuanya menyangkut kelas XII) |
| Guru, **mapel sama** di dua rombel | kelas gabungan, sah | 67 belum didaftarkan |

**67 sisa itu semuanya kelas gabungan.** Polanya tidak bisa salah baca: **XI TKJ 1 + XI TKJ 2**
muncul di hampir semua mapel (PAI, Bahasa Arab, Matematika, Koding, Konsentrasi Keahlian, dst),
menyusul pasangan X+XI satu jurusan untuk rombel kecil (X+XI AK, X+XI ATU, X+XI DKV).

Karena itu halaman ini tidak berhenti melapor: tiap mapel punya **tombol "tandai boleh kelas
gabungan"** yang menulis ke `Subject.maxSharedTeacher` — kolom yang SAMA yang dipakai penyusun
jadwal otomatis. Jadi sekali ditandai, temuannya hilang DAN Generate berikutnya ikut menghormatinya.
Sudah diuji jalan (67 → 65 saat satu mapel ditandai), lalu **dikembalikan seperti semula** — memilih
mapel mana yang digabung itu keputusan sekolah, bukan keputusan sistem.

### Dua temuan nyata yang langsung muncul (perlu dicek sekolah)

**1. Jadwal tidak cocok dengan Penugasan Mengajar — 5 baris.** Akibatnya nyata: guru yang mengajar
di jadwal TIDAK bisa mengisi nilai & jurnal untuk kelas itu (aksesnya berdasarkan Penugasan
Mengajar), sementara guru yang tercatat di penugasan melihat kelas yang tidak diajarnya.

| Kelas | Mapel | Di jadwal | Di Penugasan Mengajar |
|---|---|---|---|
| X AK 1, X DPIB 1, X TKJ 1 | Seni Budaya | Ufia Ardina Zahirah, S.Psi | Moh. Ainun Najib, S.Pd |
| XI DPIB 1 | Produk Kreatif Dan Kewirausahaan | Hadi Masruri, S.Ds | Virga Ahmad Fauzi, S.T. |

Perlu dipastikan mana yang benar, lalu disamakan di kedua tempat.

**2. Penjasorkes Selasa 07:15–09:15 digabung 5 kelas sekaligus** (XI DKV 1 + XI TKJ 1 + XI TKJ 2 +
X AK 1 + X ATU 1), padahal mapelnya disetel maksimal 3 kelas. Kalau lapangan memang memuat, batasnya
tinggal dinaikkan; kalau tidak, dua kelas perlu digeser.

---

## 🟢 Surat Keterangan dilebur ke Persuratan (13 September 2026, malam)

Dulu Surat Keterangan punya jalur sendiri — formulir sendiri, tata letak cetak sendiri, daftar
sendiri. Akibatnya sekolah punya **dua buku surat dan dua bentuk surat untuk hal yang sama**.

Sekarang tinggal satu jalur:

- Halaman `/dashboard/admin/surat-keterangan` **dialihkan** ke Persuratan (tautan lama tidak 404).
- Surat keterangan dibuat seperti surat keluar lain: pustaka template, kategori Keterangan/Mutasi.
- **Permohonan dari portal siswa/orang tua yang disetujui otomatis menjadi surat keluar** —
  nomor resmi dari urutan yang sama, kop asli, isi terisi sendiri dari data siswa. Tombol Edit &
  Cetak di menu Permintaan Surat langsung membuka halaman Persuratan.
- Tabel `SuratKeterangan` tetap ada, tapi sekarang murni **catatan permohonan** (pemohon, tanggal,
  keputusan, alasan penolakan) — riwayat yang memang tidak muat di tabel `Surat`.
- Satu data lama (405/B.3, Kholif Afda Khoirul Insani) sudah dipindahkan: 11 dari 12 isian terisi
  otomatis, tinggal `[TANGGAL]` (tanggal pindah efektif) yang harus diketik. Nomornya tidak diubah.

## 🟢 Halaman kosong di akhir cetakan — SELESAI, penyebabnya ketemu

Bukan lembar `.a4-page` yang meluber (sempat disangka begitu dan min-height dikecilkan sampai
280mm — itu cuma menutupi gejalanya). Penyebab sebenarnya: `<main>` tiap portal punya
`pb-[calc(4rem+env(safe-area-inset-bottom))]` (ruang untuk navigasi bawah versi HP) = **16,9mm**.
Peredamnya `lg:pb-0` **tidak berlaku saat mencetak**, karena cetakan dilayout selebar kertas
(210mm = 794px CSS) — di bawah breakpoint `lg` (1024px). 16,9mm itu ikut tercetak persis setelah
lembar terakhir dan mendorongnya ke halaman baru.

Perbaikannya `print:pt-0 print:pb-0` di `<main>` keempat portal; lembar kembali **297mm penuh**.
Terverifikasi: Surat Tugas + SPPD + Laporan = **4 halaman** (1+2+1), Buku Induk tetap 3 lembar
297mm tanpa perubahan apa pun. Dicatat sebagai gotcha #25 di `CLAUDE.md`.

## 🟢 Semua ekspor data jadi Excel (.xlsx), bukan CSV lagi

Keluhan user: CSV koma bikin Excel versi Indonesia menumpuk seluruh data di **satu kolom**.
Sepuluh unduhan dipindah ke `.xlsx` asli lewat `src/lib/ekspor-excel.ts`: Data Siswa, Pendaftaran,
Absensi (admin & guru), Nilai (admin & guru), Data PKL, Jadwal Pelajaran, Tagihan Bendahara, dan
Pemeriksa Data. Ikut membaik: **angka tetap angka** (dulu semua sel dibungkus kutip jadi teks,
tidak bisa dijumlah), lebar kolom otomatis, saringan per kolom sudah aktif, dan unduhan Pemeriksa
Data **tidak lagi terpotong 50** — file-nya memuat seluruh temuan (2 sheet: Ringkasan + Rincian).

---

## 🟢 Persuratan: nomor surat, template, dan Surat Tugas 3-lembar (13 September 2026)

### Nomor surat sempat kembar — sudah diperbaiki
Tiap modul dulu menghitung urutannya sendiri: Persuratan sudah di 405, sementara Surat Keterangan
dan Surat Tugas masing-masing mulai lagi dari **001** — nomor resmi sekolah bisa terbit dua kali.
Dua modul baru itu juga salah mengambil kode sekolah (`167`, itu Kd_Sekolah dokumen Dinas)
alih-alih `026`.

Sekarang ketiganya menarik dari **satu urutan yang sama** (`src/lib/nomor-surat-berikutnya.ts`),
dibatasi per tahun ajaran seperti perilaku Persuratan yang sudah berjalan. Terverifikasi: nomor
berikutnya `406/B.2/SMK_AM-IIBS/026/IX/2026`. Surat Keterangan a.n. Agis Nasulha yang terlanjur
bernomor `001/.../167/...` sudah dikoreksi jadi **406**.

### 50 template surat, 12 kategori
Dibangun dari arsip Drive sekolah sendiri (folder "SURAT KELUAR", **2.006 berkas** tahun
2020–2026, 1.180 di antaranya Word). Sub-jenisnya diambil dari yang benar-benar sering dibuat:

| Kategori | Sub | Kategori | Sub |
|---|---|---|---|
| Undangan | 7 | Keputusan (SK) | 4 |
| Permohonan | 7 | Rekomendasi | 3 |
| Keterangan | 6 | Panggilan | 3 |
| Pemberitahuan | 6 | Tugas & Mandat | 3 |
| Pernyataan | 3 | Mutasi | 2 |
| Edaran | 2 | Lain-lain | 4 |

Kalimatnya disalin dari surat aslinya. Dipakai lewat panel "Mulai dari Template Surat" di halaman
tulis surat; setelah dipakai tetap bisa diedit di lembar kerja maupun Editor Word.

### Surat Tugas + SPPD + Laporan Perjalanan Dinas jadi satu
Mengikuti berkas Excel yang dipakai sekolah: tiga lembar berurutan dalam satu cetakan. SPPD kini
lengkap butir 1–9 (termasuk **Pengikut** dan **Pembebanan Anggaran** Instansi/Biaya), kolom
singgah I–III, "Tiba kembali di" (IV), catatan lain-lain (V). Ditambah tiga baris tempat tujuan
dan kolom jam. Lembar Laporan punya kotak hasil kegiatan + dua tanda tangan.

### Kolom "Kepada" tidak lagi wajib
Surat Keterangan, Pernyataan, dan SK memang tidak punya alamat tujuan — dulu tercetak
"Kepada Yth." menggantung tanpa nama.

---

## 🟢 Penomoran NIS angkatan 2024 — SELESAI

Dua siswa susulan angkatan 2024 dulu bernomor seolah adik kelas dua angkatan. Keduanya sudah
dibetulkan, dan **login mereka ikut berubah — perlu diberitahukan ke siswanya.**

| Siswa | NIS lama | NIS baru | Login baru |
|---|---|---|---|
| Sabilana A'dhom (XII TKJ 1) | `1068/101.4.2.1` | **`951/056.4.2.1`** | `951056421@smkalmunawwir.sch.id` |
| Meila Syafitri (XII AK 1) | `1069/070.8.3.3` | **`949/041.8.3.3`** | `949041833@smkalmunawwir.sch.id` |
| Arini Aflahal Yaumi (XI AK 1) | `1012/041.8.3.3` | **`1012/070.8.3.3`** | `1012070833@smkalmunawwir.sch.id` |

Meila ditukar tempat dengan Arini Aflahal (keputusan user 13 September 2026, "opsi 4"): urutan AK
tidak punya celah, jadi Meila mengambil 041 tepat setelah Arini Salsabilah (040, ang 2024),
sementara Arini Aflahal geser ke 070 — ujung blok angkatan 2025, tepat sebelum angkatan 2026
mulai di 071. Nomor global Arini Aflahal sengaja TIDAK diubah (tetap 1012) supaya tidak ada
lubang baru di urutan global.

Batas antar-angkatan AK sekarang rapi: …039 040 **041 (2024)** | 042…069 **070 (2025)** | 071 (2026).

**Sisa catatan:** nomor urut global **952 dipakai dua orang** — Tari Cahya Ning Tiyas (TKJ) dan
Arini Salsabilah Rahmah (AK). Sudah ada sejak sebelumnya, belum diperbaiki karena keduanya sudah
terlanjur dipakai di dokumen.

---

## 🟢 Delapan modul Tata Usaha baru (13 September 2026)

1. **Disposisi Surat Masuk** — meneruskan surat masuk ke pihak yang menangani lengkap dengan
   instruksi, sifat (biasa/segera/sangat segera/rahasia), batas waktu, dan pelacakan tindak
   lanjut. Ada lembar disposisi siap cetak dengan kotak centang tujuan seperti blanko fisik.
   Menampilkan peringatan berapa surat masuk yang belum pernah didisposisikan.
2. **Buku Ekspedisi** — catatan serah-terima surat/dokumen keluar. Bisa mengambil data dari
   Surat Keluar yang sudah ada, atau diisi manual untuk berkas yang bukan surat. Cetak per bulan
   dengan kolom tanda tangan penerima.
3. **Permintaan Surat mandiri** — siswa & orang tua mengajukan Surat Keterangan/legalisir lewat
   portal masing-masing; TU memproses dari satu antrian. Nomor surat resmi **baru terbit saat
   disetujui**, jadi nomor tidak habis terpakai permintaan yang batal.
4. **Surat Tugas & SPPD** — bisa beberapa pegawai sekaligus, nomor otomatis, lembar SPPD
   opsional lengkap dengan kolom tanda tangan pejabat di tempat tujuan. Ada rekap tahunan
   "siapa berapa kali ditugaskan" untuk lampiran kinerja.
5. **Buku Penyerahan Ijazah** — serah-terima ijazah/SKHUN **asli** (beda dari Legalisir yang
   fotokopi), mencatat siapa yang mengambil, hubungannya, dan NIK bila diwakilkan.
6. **Presensi Pegawai** — daftar hadir harian 37 guru & tenaga kependidikan, rekap bulanan
   berbentuk kalender 31 kolom siap cetak. Status sengaja tidak punya nilai bawaan.
7. **Kalender Pendidikan** — agenda setahun per jenis (KBM/ujian/libur/kegiatan/rapat/PPDB),
   menghitung hari efektif belajar, siap cetak dua kolom per bulan.
8. **Profil Sekolah** — satu dokumen berisi angka yang biasa diminta asesor akreditasi:
   peserta didik per kompetensi keahlian, rombel, guru per mapel, sarana, lulusan 3 tahun, dan
   keterserapan alumni. Tidak ada input baru — semuanya dihitung ulang dari data sistem.

Semua sudah diuji jalan sampai tuntas (termasuk pengajuan siswa → persetujuan TU → nomor terbit,
dan penolakan pengajuan untuk siswa lain yang benar ditolak 403). Data uji sudah dihapus.

---

## 🟢 Yang selesai 12 September 2026 (malam)

### Buku Mutasi akhirnya berisi data
Sebelumnya **tidak akan pernah menampilkan apa pun**, apa pun bulan yang dipilih. Penyebabnya:
form Buku Induk menulis tanggal keluar ke `bukuIndukData.pindahDate`, sedangkan Buku Mutasi
membaca kolom `Student.exitDate` yang tidak pernah diisi siapa pun — 0 dari 839 siswa non-aktif.

Yang dikerjakan:
- Satu aturan tanggal keluar dipakai bersama Buku Mutasi & Buku Klapper (`resolveExitDate`),
  supaya tidak lagi bisa tidak sinkron.
- **715 data lama** diisikan tanggal keluarnya dari catatan yang sudah ada.
- Form simpan & impor Excel sekarang ikut mengisi kolom itu, jadi data baru tidak mengulang bug lama.

Terverifikasi: Desember 2025 → 1 keluar (Eko Restu Wibisono), Oktober 2025 → 3, Juli 2026 → 3,
April 2026 → 2, dan seterusnya.

### Pemeriksa Data (menu baru, Tata Usaha)
Menjalankan otomatis semua pemeriksaan yang selama dua hari ini dicari satu per satu secara manual.
Sekali buka, 1.180 siswa diperiksa dalam kurang dari 1 detik, hasilnya dikelompokkan **Kritis /
Penting / Saran**, tiap temuan menjelaskan *kenapa itu masalah* dan *apa yang harus dilakukan*,
lengkap dengan tautan langsung ke siswanya dan tombol unduh CSV.

13 aturan yang diperiksa lahir dari kesalahan nyata yang ditemukan minggu ini — NISN dipakai dua
orang, satu kelas penuh salah tingkat masuk, kelas yang kosong padahal ada 24 siswanya, ibu yang
lahir setelah anaknya, dan seterusnya. Semua itu pasti terulang tiap ada angkatan/impor baru.

Hasil pemeriksaan saat ini: **99 kritis, 131 penting, 341 saran** — rinciannya di bagian
"menunggu data" di bawah; tidak ada temuan untuk NISN ganda, angkatan kosong, kelas kosong,
kelas salah jurusan, NIS di luar pola, maupun email tak sinkron (semuanya sudah dibereskan).

### Riwayat perubahan data per siswa
Tiap penyimpanan Buku Induk sekarang mencatat **kolom mana yang berubah, isinya sebelum & sesudah,
siapa yang mengubah, dan kapan**. Bisa dibuka lewat ikon jam di Tabel Lengkap Buku Induk, atau
`/dashboard/admin/buku-induk/siswa/<id>/riwayat`. Buku Induk itu dokumen resmi — kalau suatu saat
ada data yang "tiba-tiba salah", sekarang ketahuan asal-usulnya.

### Pemeriksa kesiapan dokumen Dinas
Halaman Nominatif Kelas XII kini menampilkan peringatan di atas: berapa siswa Kelas XII yang kolom
wajibnya masih kosong, **sebelum** dokumen dicetak dan dikirim. Angkanya diambil dari Pemeriksa
Data (satu sumber aturan, bukan aturan kedua yang bisa berbeda).

### Motif kertas SMK di semua halaman cetak
Semua dokumen cetak sekarang memakai motif kertas yang sama seperti Buku Induk, bukan cuma
beberapa halaman. Halaman yang sudah punya motif sendiri (Persuratan, Notulen, Surat Keterangan)
dijaga supaya tidak tercetak dobel.

### Impor foto langsung dari berkas Excel sekolah
Impor Buku Induk sekarang ikut membaca **foto yang tertanam di dalam berkas Excel** dan
memasangkannya ke siswa yang benar. Sebelumnya foto harus diekstrak manual di luar sistem.
Foto yang sudah ada di sistem tidak ditimpa. Hasil impor melaporkan berapa foto yang terbaca.

---

## 🔴 Menunggu data/keputusan dari sekolah

### 1. Mutasi siswa XII DKV 1 belum tercatat
24 siswa XII DKV 1 baru dimasukkan sebagai **AKTIF semua**, padahal ada yang sudah keluar.
Untuk tiap siswa yang keluar dibutuhkan: **nama**, **tanggal keluar**, **status** (PINDAH = pindah
sekolah / KELUAR = berhenti), dan **ke mana/alasannya** kalau ada.

Ini memengaruhi jumlah peserta USP Kelas XII DKV di Rekap Peserta Didik & Nominatif, jadi sebaiknya
dibereskan sebelum dokumen dikirim ke Dinas.

### 2. Data Kelas XII belum lengkap untuk Nominatif — 99 siswa
Terbaca otomatis di **Pemeriksa Data** (kategori Kritis). Kolom yang wajib ada di dokumen Dinas
(tempat/tanggal lahir, alamat, nama orang tua, asal sekolah, nomor ijazah SMP, NISN) masih kosong.
Daftar lengkapnya bisa diunduh sebagai Excel dari halaman itu (2 sheet, tidak dipotong).

Termasuk di dalamnya XII DKV 1: yang masuk baru NIS, nama, L/P, dan NISN — itu pun 5 siswa belum
ada NISN-nya (A. Adib Doil Milal, Masjasim Ulin Nuha, Mawardatul A.M, Nur Laili Aprilia,
Rio Arizaldi Alfa Rizqi). Kalau berkas Excel-nya sudah lengkap tinggal dikirim — data yang sudah
masuk akan **diperbarui**, bukan diduplikasi, dan fotonya sekarang ikut terbaca dari berkas itu.

### 3. Foto siswa angkatan aktif (2024–2026) — 341 siswa
Berkas Excel alumni yang sudah dikirim hanya memuat foto angkatan 2014–2023. Kalau ada berkas
Excel angkatan aktif yang sudah ada fotonya, tinggal diimpor — fotonya otomatis ikut masuk.

### 4. Tanggal keluar/lulus 124 siswa tidak tercatat di mana pun
Tanpa tanggal, mereka tidak muncul di Buku Mutasi dan tingkat terakhirnya di Buku Klapper hanya
bisa dikira-kira. Daftarnya ada di Pemeriksa Data (kategori Penting).

### 5. Dua NISN ganda di berkas alumni
NISN nomor nasional, tidak boleh dipakai dua orang. Siswa **kedua** tiap pasang sudah dimasukkan
**tanpa NISN** — tinggal diisi setelah dicek berkas aslinya:

| NISN | Dipakai oleh |
|---|---|
| `0056480023` | Lutfyati Hasanah (506/027.085) **dan** Mohammad Rizky (508/029.085) |
| `0044106547` | Mohammad Ali Alfat Fahroji (507/028.085) **dan** Nirwan Hoirul Anam (509/030.085) |

### 6. Lima tanggal lahir orang tua yang janggal
Terbaca otomatis di Pemeriksa Data. Yang paling jelas: ibu **Chia Anggela** tercatat lahir
08/09/2023 dengan NIK `9999999999999999` — kemungkinan isian default yang tidak sempat diganti
(ibunya tercatat sudah meninggal).

---

## 🟡 Menunggu izin

### 7. Commit ke git
**300+ berkas** hasil kerja 11–13 September belum di-commit sama sekali: 9 fitur Tata Usaha
(Nominatif Kelas XII, Buku Klapper, Buku Tamu, Legalisir, Surat Keterangan, Cuti Pegawai,
Bantuan & Beasiswa, Penerimaan Rapor, Buku Kenaikan Kelas) + 4 fitur malam ini (Pemeriksa Data,
Riwayat Perubahan Data, kesiapan dokumen Dinas, impor foto dari Excel), perbaikan Buku Mutasi &
Buku Klapper, motif cetak, perbaikan performa tabel Buku Induk, serta skrip impor alumni & foto
yang bisa dipakai ulang untuk angkatan berikutnya.

---

## 🔵 Catatan kecil (tidak mendesak)

- **Dua siswa lulus 4 tahun setelah angkatannya** (Wahyudi Akbar, Dwi Cikal Matorur Rozak) tetap
  muncul di Pemeriksa Data sebagai "Penting". Sudah dikonfirmasi memang pernah tinggal kelas —
  jadi temuan itu benar adanya, bukan kesalahan data, dan bisa diabaikan.
- **Kode jurusan Akuntansi**: buku klapper fisik menulis **AKL**, sistem memakai **AK**.
- **Halaman lain yang menarik semua siswa** (Siswa 3,6 dtk / Buku Induk landing 4,7 dtk / Buku
  Klapper 3,4 dtk) masih wajar. Kalau nanti terasa berat, polanya tinggal disalin dari perbaikan
  Tabel Lengkap Buku Induk (paginasi + indeks pencarian lazy).
