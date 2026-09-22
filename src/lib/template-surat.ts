/** Pustaka template surat keluar — bertingkat: KATEGORI → SUB-JENIS.
 *
 * Daftar sub-jenisnya BUKAN karangan: ditambang dari arsip surat sekolah sendiri (folder Drive
 * "SURAT KELUAR", 2.006 berkas tahun 2020–2026), lalu dikelompokkan menurut berapa sering
 * jenis surat itu benar-benar dibuat. Susunan kalimat, salam pembuka, dan penutupnya disalin
 * dari surat aslinya supaya hasil sistem tidak terasa beda dari surat yang selama ini diketik
 * manual.
 *
 * Template hanya berisi BADAN surat. Kop, baris Nomor/Perihal, blok "Kepada Yth", dan tanda
 * tangan sudah dirender otomatis oleh halaman cetak Persuratan — jangan ditulis ulang di sini.
 *
 * Bagian yang perlu disesuaikan ditandai kurung siku KAPITAL, mis. [NAMA KEGIATAN]. Sengaja
 * bukan pengisian otomatis: petugas TU menggantinya langsung di editor sambil membaca konteks,
 * persis seperti waktu menyalin surat lama. */

export interface TemplateSurat {
  value: string;
  kategori: string;
  label: string;
  /** Kode klasifikasi arsip — ikut mengisi nomor surat otomatis. */
  klasifikasi: string;
  perihal: string;
  /** Data SIAPA yang dibutuhkan surat ini. Menentukan pencarian mana yang muncul di formulir:
   * "siswa" -> cari nama siswa, "guru" -> cari nama pegawai, kosong -> tidak perlu keduanya.
   *
   * WAJIB ADA. Tanpa ini, tanda yang dipakai bersama (mis. [TEMPAT, TGL LAHIR], [ALAMAT],
   * [JABATAN]) selalu ditebak sebagai data siswa — akibatnya Surat Keterangan Aktif MENGAJAR
   * ikut memunculkan pencarian siswa (temuan user 13 September 2026). */
  subjek?: "siswa" | "guru";
  /** Usulan isi "Kepada Yth". Kosong = surat tanpa penerima (Keterangan, Pernyataan, SK);
   * halaman cetak otomatis menyembunyikan blok itu. */
  pihak: string;
  keterangan: string;
  html: string;
}

const SALAM = `<p>Assalamu'alaikum Warahmatullahi Wabarakatuh.</p>`;
const PUJI = `<p style="text-align:justify">Segala puji bagi Allah SWT yang telah melimpahkan rahmat dan hidayah-Nya kepada kita semua. Shalawat serta salam semoga senantiasa tercurah kepada Nabi Muhammad SAW.</p>`;
const TUTUP = `<p>Wassalamu'alaikum Warahmatullahi Wabarakatuh.</p>`;
const HORMAT = `<p>Dengan hormat,</p>`;

/** Blok Hari/Tanggal–Jam–Tempat yang muncul di hampir semua surat sekolah ini. */
const waktu = (label = "Acara") => `<table><tbody>
<tr><td>Hari/Tanggal</td><td>:</td><td>[HARI], [TANGGAL]</td></tr>
<tr><td>Pukul</td><td>:</td><td>[JAM] WIB s.d. selesai</td></tr>
<tr><td>${label}</td><td>:</td><td>[${label.toUpperCase()}]</td></tr>
<tr><td>Tempat</td><td>:</td><td>[TEMPAT]</td></tr>
</tbody></table>`;

/** Tabel daftar nama — dipakai surat yang menyebut banyak orang sekaligus. */
const tabelNama = (kolom: string[], contoh: string[]) => `<table><tbody>
<tr>${kolom.map(k => `<td><strong>${k}</strong></td>`).join("")}</tr>
<tr>${contoh.map(c => `<td>${c}</td>`).join("")}</tr>
<tr>${kolom.map(() => "<td></td>").join("")}</tr>
</tbody></table>`;

/** Identitas penandatangan di badan surat (untuk Keterangan/Mandat/Rekomendasi). */
const YBTT = `<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA KEPALA SEKOLAH]</td></tr>
<tr><td>NIP</td><td>:</td><td>-</td></tr>
<tr><td>Jabatan</td><td>:</td><td>Kepala SMK Al Munawwir IIBS</td></tr>
</tbody></table>`;

const PENUTUP_KETERANGAN = `<p style="text-align:justify">Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>`;
const PENUTUP_UMUM = `<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>`;

const judul = (t: string) => `<p style="text-align:center"><strong>${t}</strong></p>`;

export const TEMPLATE_SURAT: TemplateSurat[] = [
  // ══════════════════════════ UNDANGAN (B.4) ══════════════════════════════
  {
    value: "UND_RAPAT", kategori: "Undangan", label: "Undangan Rapat Dinas / Bulanan",
    klasifikasi: "B.4", perihal: "Undangan Rapat [NAMA RAPAT]",
    pihak: "Bapak/Ibu Guru dan Karyawan SMK Al Munawwir IIBS",
    keterangan: "Rapat rutin dewan guru, rapat bulanan, rapat terbatas.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>[NAMA RAPAT]</strong>, dengan ini kami mengundang Bapak/Ibu untuk hadir pada:</p>
${waktu("Agenda")}
<p style="text-align:justify">Mengingat pentingnya agenda tersebut, kami mohon Bapak/Ibu hadir tepat waktu.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "UND_KOORDINASI", kategori: "Undangan", label: "Undangan Rapat Koordinasi Program Kerja",
    klasifikasi: "B.4", perihal: "Undangan Koordinasi Program Kerja [BIDANG]",
    pihak: "Bapak/Ibu [PENERIMA]",
    keterangan: "Koordinasi antar-bidang atau penyusunan program kerja.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dalam rangka penyusunan dan koordinasi program kerja <strong>[BIDANG/TAHUN PELAJARAN]</strong>, dengan ini kami mengundang Bapak/Ibu untuk hadir pada:</p>
${waktu("Agenda")}
<p style="text-align:justify">Kami mohon Bapak/Ibu membawa [BERKAS YANG PERLU DIBAWA].</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "UND_RAPOR", kategori: "Undangan", label: "Undangan Pengambilan Rapor",
    klasifikasi: "B.4", perihal: "Undangan Pengambilan Rapor [STS/SAS] Semester [GANJIL/GENAP]",
    pihak: "Bapak/Ibu Wali Murid Kelas [KELAS]",
    keterangan: "Undangan wali murid mengambil rapor tengah/akhir semester.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan telah selesainya pelaksanaan <strong>[PENILAIAN TENGAH/AKHIR SEMESTER]</strong> Tahun Pelajaran [TAHUN PELAJARAN], dengan ini kami mengundang Bapak/Ibu Wali Murid untuk hadir mengambil laporan hasil belajar (rapor) putra/putrinya pada:</p>
${waktu("Keperluan")}
<p style="text-align:justify">Mengingat pentingnya acara tersebut, kami mohon Bapak/Ibu hadir sendiri dan tidak diwakilkan. Apabila berhalangan, mohon memberitahukan kepada wali kelas.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "UND_WAWANCARA", kategori: "Undangan", label: "Undangan Wawancara / Seleksi Guru Baru",
    klasifikasi: "B.4", perihal: "Undangan Wawancara Kerja",
    pihak: "Sdr/i. [NAMA PELAMAR]",
    keterangan: "Memanggil pelamar untuk tahap seleksi lanjutan.",
    html: `${SALAM}
<p style="text-align:justify">Segala puji bagi Allah SWT atas limpahan rahmat dan karunia-Nya. Sehubungan dengan lamaran kerja yang telah Saudara/i kirimkan untuk posisi <strong>[POSISI YANG DILAMAR]</strong> di SMK Al Munawwir IIBS, kami mengundang Saudara/i untuk mengikuti tahapan seleksi lanjutan yang akan dilaksanakan pada:</p>
${waktu("Acara")}
<p style="text-align:justify">Mohon Saudara/i membawa berkas lamaran asli dan hadir tepat waktu.</p>
<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Saudara/i, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "UND_PENGUJI_UKK", kategori: "Undangan", label: "Undangan Penguji Eksternal UKK",
    klasifikasi: "B.4", perihal: "Undangan sebagai Penguji Eksternal UKK [JURUSAN]",
    pihak: "Bapak/Ibu [NAMA PENGUJI] — [NAMA PERUSAHAAN]",
    keterangan: "Mengundang penguji dari DUDI untuk Uji Kompetensi Keahlian.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>Uji Kompetensi Keahlian (UKK)</strong> Kompetensi Keahlian [JURUSAN] Tahun Pelajaran [TAHUN PELAJARAN], dengan ini kami mengundang Bapak/Ibu untuk berkenan menjadi <strong>Penguji Eksternal</strong> pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Besar harapan kami Bapak/Ibu berkenan memenuhi undangan ini demi terselenggaranya uji kompetensi yang objektif dan sesuai standar dunia industri.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "UND_WISUDA", kategori: "Undangan", label: "Undangan Wisuda / Tasyakur Kelas Akhir",
    klasifikasi: "B.4", perihal: "Undangan Wisuda dan Tasyakur Kelas Akhir",
    pihak: "Bapak/Ibu Wali Murid Kelas XII",
    keterangan: "Undangan acara wisuda/tasyakur untuk wali murid & tamu.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan telah selesainya masa pendidikan peserta didik kelas XII SMK Al Munawwir IIBS Tahun Pelajaran [TAHUN PELAJARAN], dengan ini kami mengundang Bapak/Ibu untuk menghadiri acara <strong>Wisuda dan Tasyakur Kelas Akhir</strong> yang akan dilaksanakan pada:</p>
${waktu("Acara")}
<p style="text-align:justify">Merupakan suatu kehormatan bagi kami apabila Bapak/Ibu berkenan hadir dan memberikan doa restu kepada putra/putri kita.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "UND_INSTANSI", kategori: "Undangan", label: "Undangan kepada Instansi / Tokoh",
    klasifikasi: "B.4", perihal: "Undangan [NAMA ACARA]",
    pihak: "Bapak/Ibu [JABATAN] [NAMA INSTANSI]",
    keterangan: "Mengundang kepala desa, dinas, atau sekolah lain.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan diselenggarakannya <strong>[NAMA ACARA]</strong> oleh SMK Al Munawwir IIBS, dengan ini kami mengundang Bapak/Ibu untuk berkenan hadir pada:</p>
${waktu("Acara")}
<p style="text-align:justify">Merupakan suatu kehormatan bagi kami atas kehadiran Bapak/Ibu dalam acara tersebut.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },

  // ══════════════════════════ PERMOHONAN (B.1) ═════════════════════════════
  {
    value: "PMH_IZIN_KEGIATAN", kategori: "Permohonan", label: "Permohonan Izin Kegiatan",
    klasifikasi: "B.1", perihal: "Permohonan Izin [NAMA KEGIATAN]",
    pihak: "Bapak/Ibu [PENERIMA]",
    keterangan: "Meminta izin kegiatan kepada pengasuh pondok, pemilik tempat, atau instansi.",
    html: `${SALAM}
<p style="text-align:justify">Segala puji bagi Allah SWT yang telah melimpahkan rahmat dan hidayah-Nya, dan semoga kita selalu dalam limpahan iman kepada-Nya. Sholawat serta salam semoga senantiasa tercurahkan kepada Nabi besar Muhammad SAW hingga akhir zaman.</p>
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>[NAMA KEGIATAN]</strong>, dari pihak sekolah memohon izin kepada Bapak/Ibu untuk kelancaran kegiatan tersebut yang akan dilaksanakan pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Karena pentingnya acara tersebut, dengan ini kami memohon agar Bapak/Ibu berkenan memberikan izin kepada [SIAPA YANG DIMOHONKAN IZIN] untuk mengikuti kegiatan tersebut.</p>
<p style="text-align:justify">Demikian surat permohonan izin ini kami buat. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>${TUTUP}
${tabelNama(["No", "Nama Peserta", "Kelas"], ["1", "[NAMA]", "[KELAS]"])}`,
  },
  {
    value: "PMH_IZIN_WALI", kategori: "Permohonan", label: "Permohonan Izin kepada Wali Murid",
    klasifikasi: "B.1", perihal: "Permohonan Izin Mengikuti [NAMA KEGIATAN]",
    pihak: "Bapak/Ibu Wali Murid",
    keterangan: "Meminta izin wali murid untuk kegiatan siswa di luar jam sekolah.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Dalam rangka <strong>[NAMA KEGIATAN]</strong>, siswa-siswi dengan nama terlampir akan melaksanakan kegiatan tersebut pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Sehubungan dengan hal tersebut, kami mohon Bapak/Ibu wali murid berkenan memberikan izin dan dukungan kepada putra/putrinya untuk mengikuti kegiatan ini.</p>
<p style="text-align:justify">Demikian surat izin ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.</p>${TUTUP}
${tabelNama(["No", "Nama Siswa", "Kelas"], ["1", "[NAMA]", "[KELAS]"])}`,
  },
  {
    value: "PMH_PKL", kategori: "Permohonan", label: "Permohonan Tempat PKL / Prakerin",
    klasifikasi: "B.1", perihal: "Permohonan Tempat Praktik Kerja Lapangan (PKL)",
    pihak: "Pimpinan [NAMA PERUSAHAAN/INSTANSI]",
    keterangan: "Permohonan tempat PKL ke perusahaan/instansi.",
    html: `${SALAM}
<p style="text-align:justify">Disampaikan dengan hormat, berkenaan dengan program SMK Al Munawwir IIBS tentang pelatihan siswa di luar sekolah yakni Praktik Kerja Lapangan (PKL) siswa-siswi kelas XI, dengan tujuan melatih siswa-siswi kami mengenal dunia kerja nyata agar menjadi pribadi yang lebih kreatif dan produktif.</p>
<p style="text-align:justify">Maka kami mohon kerja samanya agar siswa-siswi kami dapat melaksanakan PKL di perusahaan/instansi yang Bapak/Ibu pimpin selama <strong>[LAMA PELAKSANAAN]</strong>, mulai bulan [BULAN MULAI] s.d. [BULAN SELESAI]. Berikut kami sertakan nama-nama peserta PKL:</p>
${tabelNama(["No", "Nama", "Kelas", "L/P"], ["1", "[NAMA SISWA]", "[KELAS]", "[L/P]"])}
<p style="text-align:justify">Demikian surat ini kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu pimpinan, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "PMH_PENGUJI_UKK", kategori: "Permohonan", label: "Permohonan Penguji UKK ke DUDI",
    klasifikasi: "B.1", perihal: "Permohonan Penguji Eksternal Uji Kompetensi Keahlian",
    pihak: "Pimpinan [NAMA PERUSAHAAN]",
    keterangan: "Memohon perusahaan menugaskan penguji eksternal UKK.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>Uji Kompetensi Keahlian (UKK)</strong> Kompetensi Keahlian [JURUSAN] Tahun Pelajaran [TAHUN PELAJARAN] di SMK Al Munawwir IIBS, dengan ini kami memohon kesediaan Bapak/Ibu pimpinan untuk menugaskan salah satu staf/tenaga ahli sebagai <strong>Penguji Eksternal</strong> pada kegiatan tersebut yang akan dilaksanakan pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Kehadiran penguji dari dunia usaha/dunia industri sangat kami butuhkan agar penilaian kompetensi peserta didik sesuai dengan standar kerja yang berlaku.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PMH_BANTUAN", kategori: "Permohonan", label: "Permohonan Bantuan / Bansos",
    klasifikasi: "B.1", perihal: "Permohonan Bantuan [JENIS BANTUAN]",
    pihak: "Yth. [PEJABAT/INSTANSI TUJUAN]",
    keterangan: "Permohonan bantuan dana/sarana ke pemerintah atau donatur.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dalam rangka [LATAR BELAKANG / KEBUTUHAN SEKOLAH], SMK Al Munawwir IIBS Desa Kemiri Kecamatan Singojuruh Kabupaten Banyuwangi bermaksud mengajukan permohonan bantuan berupa <strong>[JENIS BANTUAN]</strong>.</p>
<p style="text-align:justify">Adapun rincian kebutuhan dan rencana penggunaannya kami lampirkan bersama surat ini.</p>
<p style="text-align:justify">Besar harapan kami permohonan ini dapat dikabulkan demi peningkatan mutu layanan pendidikan di sekolah kami.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PMH_NARASUMBER", kategori: "Permohonan", label: "Permohonan Narasumber / Guru Tamu",
    klasifikasi: "B.1", perihal: "Permohonan Narasumber [NAMA KEGIATAN]",
    pihak: "Bapak/Ibu [NAMA] — [INSTANSI]",
    keterangan: "Memohon kesediaan menjadi narasumber atau guru tamu.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>[NAMA KEGIATAN]</strong> di SMK Al Munawwir IIBS, dengan ini kami memohon kesediaan Bapak/Ibu untuk berkenan menjadi <strong>narasumber</strong> pada kegiatan tersebut, yang akan dilaksanakan pada:</p>
${waktu("Materi")}
<p style="text-align:justify">Besar harapan kami Bapak/Ibu berkenan memenuhi permohonan ini.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PMH_DATA", kategori: "Permohonan", label: "Permohonan Tarik/Verifikasi Data Siswa",
    klasifikasi: "B.1", perihal: "Permohonan Tarik Data Peserta Didik",
    pihak: "Yth. Kepala [SEKOLAH ASAL / CABANG DINAS]",
    keterangan: "Tarik data Dapodik, approval PD baru, verifikasi data.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Sehubungan dengan proses [PEMUTAKHIRAN DATA / PENERIMAAN PESERTA DIDIK BARU] Tahun Pelajaran [TAHUN PELAJARAN], dengan ini kami memohon bantuan Bapak/Ibu untuk berkenan melakukan <strong>[tarik data / approval / verifikasi]</strong> atas peserta didik berikut:</p>
${tabelNama(["No", "Nama", "NISN", "Asal Sekolah"], ["1", "[NAMA]", "[NISN]", "[ASAL SEKOLAH]"])}
${PENUTUP_UMUM}${TUTUP}`,
  },

  // ══════════════════════════ KETERANGAN (B.2) ═════════════════════════════
  {
    value: "KET_AKTIF", kategori: "Keterangan", label: "Keterangan Siswa Aktif",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Aktif Sekolah", pihak: "",
    keterangan: "Menerangkan siswa masih aktif — bisa beberapa siswa sekaligus.",
    html: `${judul("SURAT KETERANGAN")}${YBTT}
<p>Menerangkan:</p>
${tabelNama(["No", "Nama", "NIK", "L/P", "Tempat, Tanggal Lahir", "Nama Ibu Kandung", "Kelas"],
  ["1", "[NAMA SISWA]", "[NIK]", "[L/P]", "[TEMPAT, TGL LAHIR]", "[NAMA IBU]", "[KELAS]"])}
<p style="text-align:justify">Yang bersangkutan adalah benar-benar siswa SMK Al Munawwir IIBS tahun ajaran [TAHUN PELAJARAN], dan masih aktif serta berkelakuan baik.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_SISWA_INSTANSI", kategori: "Keterangan", label: "Keterangan Siswa untuk Instansi",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Siswa", pihak: "",
    keterangan: "Untuk syarat bank, BPJS, kartu, atau keringanan biaya.",
    html: `${judul("SURAT KETERANGAN")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jurusan</td><td>:</td><td>[KELAS] / [JURUSAN]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
<tr><td>Nama Orang Tua</td><td>:</td><td>[NAMA ORANG TUA]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar siswa SMK Al Munawwir IIBS yang masih aktif mengikuti kegiatan belajar mengajar pada Tahun Pelajaran [TAHUN PELAJARAN].</p>
<p style="text-align:justify">Surat keterangan ini dibuat untuk keperluan <strong>[KEPERLUAN]</strong>.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_LULUS", kategori: "Keterangan", label: "Keterangan Lulus / Tamat Belajar",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Lulus", pihak: "",
    keterangan: "Pengganti sementara ijazah bagi lulusan.",
    html: `${judul("SURAT KETERANGAN LULUS")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kompetensi Keahlian</td><td>:</td><td>[JURUSAN]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar peserta didik SMK Al Munawwir IIBS yang telah menyelesaikan seluruh program pembelajaran dan dinyatakan <strong>LULUS</strong> pada Tahun Pelajaran [TAHUN PELAJARAN] berdasarkan Surat Keputusan Kepala Sekolah Nomor [NOMOR SK] tanggal [TANGGAL SK].</p>
<p style="text-align:justify">Surat keterangan ini berlaku sementara sampai ijazah yang bersangkutan diterbitkan.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_BEBAS_TANGGUNGAN", kategori: "Keterangan", label: "Keterangan Bebas Tanggungan",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Bebas Tanggungan", pihak: "",
    keterangan: "Menyatakan siswa tidak punya tanggungan administrasi — menyertai mutasi keluar, kelulusan, atau pengambilan ijazah.",
    html: `${judul("SURAT KETERANGAN BEBAS TANGGUNGAN")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jurusan</td><td>:</td><td>[KELAS] / [JURUSAN]</td></tr>
<tr><td>Nama Orang Tua/Wali</td><td>:</td><td>[NAMA ORANG TUA]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar peserta didik SMK Al Munawwir IIBS yang sampai dengan tanggal surat ini dibuat <strong>tidak memiliki tanggungan</strong> kepada sekolah, meliputi:</p>
<table><tbody>
<tr><td>1.</td><td>Administrasi keuangan (SPP, infaq, dan biaya kegiatan)</td><td>:</td><td>Lunas</td></tr>
<tr><td>2.</td><td>Peminjaman buku perpustakaan</td><td>:</td><td>Tidak ada</td></tr>
<tr><td>3.</td><td>Peminjaman sarana, prasarana, dan alat praktik</td><td>:</td><td>Tidak ada</td></tr>
<tr><td>4.</td><td>Asrama / pondok</td><td>:</td><td>[ASRAMA]</td></tr>
</tbody></table>
<p style="text-align:justify">Surat keterangan ini dibuat untuk keperluan <strong>[KEPERLUAN]</strong>.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_MENGAJAR", kategori: "Keterangan", label: "Keterangan Aktif Mengajar (Guru)",
    subjek: "guru",
    klasifikasi: "B.2", perihal: "Surat Keterangan Aktif Mengajar", pihak: "",
    keterangan: "Untuk tunjangan, sertifikasi, studi lanjut, atau pengajuan kredit.",
    html: `${judul("SURAT KETERANGAN AKTIF MENGAJAR")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA GURU]</td></tr>
<tr><td>NUPTK / NIP</td><td>:</td><td>[NOMOR]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Jabatan</td><td>:</td><td>[JABATAN]</td></tr>
<tr><td>Mata Pelajaran</td><td>:</td><td>[MATA PELAJARAN]</td></tr>
<tr><td>Mulai Bertugas</td><td>:</td><td>[TANGGAL MULAI]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar tenaga pendidik di SMK Al Munawwir IIBS yang masih aktif melaksanakan tugas mengajar pada Tahun Pelajaran [TAHUN PELAJARAN].</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_PENGUNDURAN", kategori: "Keterangan", label: "Keterangan Pengunduran Diri",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Pengunduran Diri", pihak: "",
    keterangan: "Menerangkan siswa/pegawai mengundurkan diri dari sekolah.",
    html: `${judul("SURAT KETERANGAN")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jabatan</td><td>:</td><td>[KELAS / JABATAN]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
</tbody></table>
<p style="text-align:justify">Yang bersangkutan telah <strong>mengundurkan diri</strong> dari SMK Al Munawwir IIBS terhitung sejak tanggal [TANGGAL] dengan alasan [ALASAN].</p>
<p style="text-align:justify">Selama berada di sekolah kami, yang bersangkutan tidak memiliki tanggungan apa pun terhadap sekolah.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "KET_KELAKUAN_BAIK", kategori: "Keterangan", label: "Keterangan Kelakuan Baik",
    subjek: "siswa",
    klasifikasi: "B.2", perihal: "Surat Keterangan Kelakuan Baik", pihak: "",
    keterangan: "Syarat melamar kerja atau melanjutkan studi.",
    html: `${judul("SURAT KETERANGAN KELAKUAN BAIK")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jurusan</td><td>:</td><td>[KELAS] / [JURUSAN]</td></tr>
</tbody></table>
<p style="text-align:justify">Selama menjadi peserta didik di SMK Al Munawwir IIBS, yang bersangkutan <strong>berkelakuan baik</strong> dan tidak pernah terlibat dalam pelanggaran tata tertib sekolah maupun tindakan yang melanggar hukum.</p>
<p style="text-align:justify">Surat keterangan ini dibuat untuk keperluan <strong>[KEPERLUAN]</strong>.</p>
${PENUTUP_KETERANGAN}`,
  },

  // ══════════════════════════ PANGGILAN (B.11) ═════════════════════════════
  {
    value: "PGL_UMUM", kategori: "Panggilan", label: "Panggilan Wali Murid (Umum)",
    subjek: "siswa",
    klasifikasi: "B.11", perihal: "Panggilan Wali Murid",
    pihak: "Bapak/Ibu Wali Murid dari [NAMA SISWA] — [KELAS]",
    keterangan: "Memanggil wali murid terkait perkembangan anaknya.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Sehubungan dengan adanya hal yang perlu kami sampaikan terkait perkembangan putra/putri Bapak/Ibu di sekolah, maka dengan ini kami mengundang Bapak/Ibu untuk hadir ke sekolah pada:</p>
${waktu("Keperluan")}
<p style="text-align:justify">Adapun terkait keperluan tersebut, dimohon kepada Bapak/Ibu untuk membawa:</p>
<ol><li>[DOKUMEN 1]</li><li>[DOKUMEN 2]</li></ol>
<p style="text-align:justify">Demikian surat panggilan ini kami sampaikan. Besar harapan kami Bapak/Ibu dapat hadir tepat waktu demi kebaikan putra/putri kita bersama. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "PGL_PELANGGARAN", kategori: "Panggilan", label: "Panggilan Wali — Pelanggaran / Alfa",
    subjek: "siswa",
    klasifikasi: "B.11", perihal: "Panggilan Wali Murid terkait Kedisiplinan",
    pihak: "Bapak/Ibu Wali Murid dari [NAMA SISWA] — [KELAS]",
    keterangan: "Pemanggilan karena pelanggaran tata tertib atau sering tidak masuk.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Berdasarkan catatan kedisiplinan sekolah, putra/putri Bapak/Ibu atas nama <strong>[NAMA SISWA]</strong> kelas [KELAS] tercatat [URAIAN PELANGGARAN / JUMLAH KETIDAKHADIRAN] pada periode [PERIODE].</p>
<p style="text-align:justify">Sehubungan dengan hal tersebut dan demi kebaikan bersama, kami mengundang Bapak/Ibu untuk hadir ke sekolah pada:</p>
${waktu("Keperluan")}
<p style="text-align:justify">Kehadiran Bapak/Ibu sangat kami harapkan agar dapat dicari jalan keluar terbaik bagi perkembangan pendidikan putra/putri kita.</p>
<p style="text-align:justify">Demikian surat panggilan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "PGL_ADMINISTRASI", kategori: "Panggilan", label: "Panggilan Wali — Administrasi / Data",
    subjek: "siswa",
    klasifikasi: "B.11", perihal: "Panggilan Wali Murid terkait Administrasi",
    pihak: "Bapak/Ibu Wali Murid dari [NAMA SISWA] — [KELAS]",
    keterangan: "Validasi data, kelengkapan berkas, atau tanggungan pembayaran.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Sehubungan dengan [VALIDASI DATA / KELENGKAPAN BERKAS / PENYELESAIAN ADMINISTRASI] putra/putri Bapak/Ibu, dengan ini kami mengundang Bapak/Ibu untuk hadir ke sekolah pada:</p>
${waktu("Keperluan")}
<p style="text-align:justify">Mohon Bapak/Ibu membawa:</p>
<ol><li>Ijazah terakhir siswa</li><li>Kartu Keluarga (KK)</li><li>[DOKUMEN LAIN]</li></ol>
<p style="text-align:justify">Demikian surat panggilan ini kami sampaikan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>${TUTUP}`,
  },

  // ══════════════════════════ PEMBERITAHUAN (B.3) ══════════════════════════
  {
    value: "PBT_LIBUR", kategori: "Pemberitahuan", label: "Pemberitahuan Hari Libur",
    klasifikasi: "B.3", perihal: "Pemberitahuan Libur [NAMA HARI LIBUR]",
    pihak: "Bapak/Ibu Wali Murid, Guru, dan Karyawan",
    keterangan: "Memberitahukan libur hari raya, libur semester, atau libur nasional.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dengan ini kami sampaikan bahwa sehubungan dengan <strong>[ALASAN LIBUR]</strong>, kegiatan belajar mengajar di SMK Al Munawwir IIBS <strong>diliburkan</strong> pada:</p>
<table><tbody>
<tr><td>Tanggal Libur</td><td>:</td><td>[TANGGAL MULAI] s.d. [TANGGAL SELESAI]</td></tr>
<tr><td>Masuk Kembali</td><td>:</td><td>[HARI], [TANGGAL MASUK]</td></tr>
</tbody></table>
<p style="text-align:justify">Kami mohon Bapak/Ibu wali murid turut mengawasi putra/putrinya selama masa libur berlangsung.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PBT_MASUK", kategori: "Pemberitahuan", label: "Pemberitahuan Masuk Sekolah",
    klasifikasi: "B.3", perihal: "Pemberitahuan Awal Masuk Sekolah",
    pihak: "Bapak/Ibu Wali Murid",
    keterangan: "Awal tahun pelajaran atau masuk setelah libur panjang.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dengan ini kami sampaikan bahwa kegiatan belajar mengajar SMK Al Munawwir IIBS Tahun Pelajaran [TAHUN PELAJARAN] akan dimulai pada:</p>
<table><tbody>
<tr><td>Hari/Tanggal</td><td>:</td><td>[HARI], [TANGGAL]</td></tr>
<tr><td>Pukul</td><td>:</td><td>[JAM] WIB</td></tr>
<tr><td>Pakaian</td><td>:</td><td>[SERAGAM]</td></tr>
</tbody></table>
<p style="text-align:justify">Mohon putra/putri Bapak/Ibu hadir tepat waktu dan membawa perlengkapan belajar sebagaimana mestinya.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PBT_REKRUTMEN", kategori: "Pemberitahuan", label: "Pemberitahuan Hasil Rekrutmen",
    klasifikasi: "B.3", perihal: "Pemberitahuan Hasil Seleksi Rekrutmen",
    pihak: "Peserta Seleksi Penerimaan Tenaga Kerja SMK Al Munawwir IIBS",
    keterangan: "Hasil seleksi guru/karyawan — diterima maupun belum.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Kami mengucapkan terima kasih dan penghargaan setinggi-tingginya kepada Bapak/Ibu/Saudara(i) yang telah mengikuti proses seleksi rekrutmen tenaga kerja di SMK Al Munawwir IIBS, mulai dari tahap administrasi, wawancara, hingga tes.</p>
<p style="text-align:justify">Setelah melalui pertimbangan dan evaluasi secara menyeluruh oleh tim rekrutmen, dengan ini kami sampaikan bahwa Bapak/Ibu/Saudara(i) dinyatakan <strong>[DITERIMA / BELUM DAPAT DITERIMA]</strong> untuk bergabung sebagai bagian dari tenaga kerja di lingkungan SMK Al Munawwir IIBS pada rekrutmen kali ini.</p>
<p style="text-align:justify">[Bagi yang diterima: mohon hadir pada [HARI, TANGGAL] pukul [JAM] untuk penandatanganan kontrak kerja.]</p>
<p style="text-align:justify">Keputusan ini semata-mata didasarkan pada kesesuaian kualifikasi dan kebutuhan formasi yang ada. Kami sangat menghargai minat dan semangat Bapak/Ibu/Saudara(i).</p>
<p style="text-align:justify">Demikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan partisipasinya, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "PBT_IJAZAH", kategori: "Pemberitahuan", label: "Pemberitahuan Pengambilan Ijazah",
    klasifikasi: "B.3", perihal: "Pemberitahuan Pengambilan Ijazah",
    pihak: "Alumni SMK Al Munawwir IIBS Angkatan [ANGKATAN]",
    keterangan: "Memberitahu alumni bahwa ijazah sudah bisa diambil.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dengan ini kami sampaikan bahwa <strong>Ijazah dan SKHUN</strong> lulusan SMK Al Munawwir IIBS Tahun Pelajaran [TAHUN PELAJARAN] sudah dapat diambil di ruang Tata Usaha, dengan ketentuan:</p>
<ol>
<li>Diambil sendiri oleh yang bersangkutan dengan membawa <strong>Kartu Tanda Penduduk (KTP)</strong>.</li>
<li>Apabila diwakilkan, wajib membawa <strong>surat kuasa bermaterai</strong> dan fotokopi KTP kedua belah pihak.</li>
<li>Menyelesaikan seluruh administrasi sekolah (bila masih ada tanggungan).</li>
</ol>
<table><tbody>
<tr><td>Waktu Pengambilan</td><td>:</td><td>[HARI KERJA], pukul [JAM] WIB</td></tr>
<tr><td>Tempat</td><td>:</td><td>Ruang Tata Usaha SMK Al Munawwir IIBS</td></tr>
</tbody></table>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PBT_KEGIATAN", kategori: "Pemberitahuan", label: "Pemberitahuan Kegiatan ke Wali Murid",
    klasifikasi: "B.3", perihal: "Pemberitahuan [NAMA KEGIATAN]",
    pihak: "Bapak/Ibu Wali Murid Kelas [KELAS]",
    keterangan: "Outing class, vaksinasi, LDKS, simulasi ujian, dan sejenisnya.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dengan ini kami sampaikan bahwa SMK Al Munawwir IIBS akan menyelenggarakan kegiatan <strong>[NAMA KEGIATAN]</strong> yang akan dilaksanakan pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Adapun hal-hal yang perlu diperhatikan:</p>
<ol><li>[KETENTUAN 1]</li><li>[KETENTUAN 2]</li></ol>
<p style="text-align:justify">Besar harapan kami Bapak/Ibu memberikan dukungan agar putra/putrinya dapat mengikuti kegiatan tersebut dengan baik.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "PBT_UJIAN", kategori: "Pemberitahuan", label: "Pemberitahuan Jadwal & Biaya Ujian",
    klasifikasi: "B.3", perihal: "Pemberitahuan Pelaksanaan [NAMA UJIAN]",
    pihak: "Bapak/Ibu Wali Murid Kelas [KELAS]",
    keterangan: "Jadwal STS/SAS/USP/UKK beserta ketentuan pembayarannya.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Dengan ini kami sampaikan bahwa <strong>[NAMA UJIAN]</strong> Tahun Pelajaran [TAHUN PELAJARAN] akan dilaksanakan pada:</p>
<table><tbody>
<tr><td>Tanggal Pelaksanaan</td><td>:</td><td>[TANGGAL MULAI] s.d. [TANGGAL SELESAI]</td></tr>
<tr><td>Tempat</td><td>:</td><td>SMK Al Munawwir IIBS</td></tr>
<tr><td>Biaya</td><td>:</td><td>Rp [NOMINAL]</td></tr>
<tr><td>Batas Pembayaran</td><td>:</td><td>[TANGGAL]</td></tr>
</tbody></table>
<p style="text-align:justify">Peserta didik diharapkan menyelesaikan administrasi sebelum batas waktu agar dapat mengikuti ujian dengan tertib.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },

  // ══════════════════════════ TUGAS & MANDAT (B.5) ═════════════════════════
  {
    value: "MDT_UMUM", kategori: "Tugas & Mandat", label: "Surat Mandat / Penugasan Umum",
    klasifikasi: "B.5", perihal: "Penugasan sebagai [PERAN]", pihak: "",
    keterangan: "Mandat kepada guru/pegawai untuk suatu tugas di dalam sekolah.",
    html: `<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA KEPALA SEKOLAH]</td></tr>
<tr><td>Jabatan</td><td>:</td><td>Kepala SMK Al Munawwir IIBS</td></tr>
</tbody></table>
<p>Dengan ini memberikan mandat kepada:</p>
${tabelNama(["No", "Nama", "Jabatan"], ["1.", "[NAMA]", "[JABATAN]"])}
<p style="text-align:justify">Untuk melaksanakan tugas sebagai <strong>[PERAN]</strong> dalam kegiatan [NAMA KEGIATAN], yang akan dilaksanakan pada:</p>
${waktu("Kegiatan")}
<p style="text-align:justify">Mandat ini diberikan untuk dilaksanakan dengan penuh tanggung jawab. Demikian surat mandat ini dibuat untuk digunakan sebagaimana mestinya.</p>`,
  },
  {
    value: "MDT_SOAL", kategori: "Tugas & Mandat", label: "Mandat Pembuatan Soal Ujian",
    klasifikasi: "B.5", perihal: "Penugasan Pembuatan Soal [NAMA UJIAN]", pihak: "",
    keterangan: "Menugaskan guru menyusun soal STS/SAS/USP.",
    html: `<p style="text-align:justify">Yang bertanda tangan di bawah ini Kepala SMK Al Munawwir IIBS dengan ini menugaskan kepada:</p>
${tabelNama(["No", "Nama Guru", "Mata Pelajaran", "Kelas"], ["1.", "[NAMA GURU]", "[MAPEL]", "[KELAS]"])}
<p style="text-align:justify">Untuk menyusun dan menyerahkan <strong>naskah soal [NAMA UJIAN]</strong> Tahun Pelajaran [TAHUN PELAJARAN] dengan ketentuan:</p>
<ol>
<li>Jumlah soal: [JUMLAH] butir ([BENTUK SOAL]).</li>
<li>Naskah diserahkan kepada panitia paling lambat <strong>[TANGGAL BATAS]</strong>.</li>
<li>Naskah dilengkapi kunci jawaban dan kisi-kisi.</li>
</ol>
<p style="text-align:justify">Demikian surat penugasan ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.</p>`,
  },
  {
    value: "MDT_HOME_VISIT", kategori: "Tugas & Mandat", label: "Surat Tugas Home Visit",
    klasifikasi: "B.5", perihal: "Penugasan Home Visit Peserta Didik", pihak: "",
    keterangan: "Menugaskan guru BK/wali kelas berkunjung ke rumah siswa.",
    html: `<p style="text-align:justify">Yang bertanda tangan di bawah ini Kepala SMK Al Munawwir IIBS dengan ini menugaskan kepada:</p>
${tabelNama(["No", "Nama", "Jabatan"], ["1.", "[NAMA]", "[JABATAN]"])}
<p style="text-align:justify">Untuk melaksanakan <strong>kunjungan rumah (home visit)</strong> kepada peserta didik berikut:</p>
${tabelNama(["No", "Nama Siswa", "Kelas", "Alamat"], ["1.", "[NAMA SISWA]", "[KELAS]", "[ALAMAT]"])}
<p style="text-align:justify">Kunjungan dilaksanakan pada [HARI, TANGGAL] dengan maksud [MAKSUD KUNJUNGAN]. Hasil kunjungan dilaporkan kepada Kepala Sekolah setelah kegiatan selesai.</p>
<p style="text-align:justify">Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.</p>`,
  },

  // ══════════════════════════ PERNYATAAN (B.8) ═════════════════════════════
  {
    value: "PNY_PERJANJIAN_SISWA", kategori: "Pernyataan", label: "Surat Perjanjian Siswa",
    subjek: "siswa",
    klasifikasi: "B.8", perihal: "Surat Perjanjian Peserta Didik", pihak: "",
    keterangan: "Perjanjian siswa setelah pelanggaran — ditandatangani siswa & wali.",
    html: `${judul("SURAT PERJANJIAN")}
<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>Tempat/Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>NIS/NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Kelas</td><td>:</td><td>[KELAS]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
</tbody></table>
<p style="text-align:justify">Dengan ini menyatakan dan berjanji dengan sesungguhnya bahwa saya:</p>
<ol>
<li>Tidak akan mengulangi perbuatan [URAIAN PELANGGARAN].</li>
<li>Akan menaati seluruh tata tertib yang berlaku di SMK Al Munawwir IIBS.</li>
<li>Bersedia menerima sanksi sesuai ketentuan sekolah, termasuk dikembalikan kepada orang tua, apabila melanggar perjanjian ini.</li>
</ol>
<p style="text-align:justify">Demikian surat perjanjian ini saya buat dengan penuh kesadaran, tanpa paksaan dari pihak manapun, dan dapat dipergunakan sebagaimana mestinya.</p>
<table><tbody>
<tr><td><strong>Mengetahui,<br>Wali Murid</strong><br><br><br><br>( ____________________ )</td>
<td><strong>Wali Kelas</strong><br><br><br><br>( ____________________ )</td>
<td><strong>Yang Membuat Perjanjian</strong><br><br><br><br>( ____________________ )</td></tr>
</tbody></table>`,
  },
  {
    value: "PNY_KELUAR", kategori: "Pernyataan", label: "Pernyataan Keluar / Pengunduran Diri",
    subjek: "siswa",
    klasifikasi: "B.8", perihal: "Surat Pernyataan Pengunduran Diri", pihak: "",
    keterangan: "Pernyataan siswa & wali bahwa keluar atas kemauan sendiri.",
    html: `${judul("SURAT PERNYATAAN")}
<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama Wali Murid</td><td>:</td><td>[NAMA WALI]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
<tr><td>Orang tua/wali dari</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS/NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Kelas</td><td>:</td><td>[KELAS]</td></tr>
</tbody></table>
<p style="text-align:justify">Dengan ini menyatakan dengan sebenar-benarnya bahwa putra/putri kami <strong>mengundurkan diri / pindah sekolah</strong> dari SMK Al Munawwir IIBS terhitung sejak tanggal [TANGGAL], dengan alasan [ALASAN].</p>
<p style="text-align:justify">Pengunduran diri ini kami lakukan atas kemauan sendiri tanpa paksaan dari pihak manapun, dan kami tidak akan menuntut pihak sekolah di kemudian hari.</p>
<p style="text-align:justify">Demikian surat pernyataan ini kami buat dengan penuh kesadaran untuk dapat dipergunakan sebagaimana mestinya.</p>
<table><tbody>
<tr><td><strong>Mengetahui,<br>Kepala Sekolah</strong><br><br><br><br>( ____________________ )</td>
<td><strong>Yang Membuat Pernyataan</strong><br><br><br><br>( ____________________ )</td></tr>
</tbody></table>`,
  },
  {
    value: "PNY_UMUM", kategori: "Pernyataan", label: "Surat Pernyataan Umum",
    subjek: "siswa",
    klasifikasi: "B.8", perihal: "Surat Pernyataan", pihak: "",
    keterangan: "Pernyataan bebas — kesanggupan, orisinalitas karya, dll.",
    html: `${judul("SURAT PERNYATAAN")}
<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA]</td></tr>
<tr><td>Tempat/Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>NIS/NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
<tr><td>Asal Sekolah</td><td>:</td><td>SMK Al Munawwir IIBS</td></tr>
</tbody></table>
<p>Dengan ini menyatakan dengan sebenar-benarnya bahwa:</p>
<p style="text-align:justify">[ISI PERNYATAAN]</p>
<p style="text-align:justify">Demikian surat pernyataan ini saya buat dengan penuh kesadaran, tanpa adanya paksaan dari pihak manapun, dan dapat dipergunakan sebagaimana mestinya.</p>
<p style="text-align:justify"><em>Catatan: surat ini ditandatangani oleh yang membuat pernyataan, bukan Kepala Sekolah.</em></p>`,
  },

  // ══════════════════════════ KEPUTUSAN (A.2) ══════════════════════════════
  {
    value: "SK_KELULUSAN", kategori: "Keputusan", label: "SK Penetapan Kelulusan",
    klasifikasi: "A.2", perihal: "Penetapan Kelulusan Peserta Didik Kelas XII", pihak: "",
    keterangan: "SK kelulusan kelas XII — dasar penerbitan ijazah & SKL.",
    html: `${judul("SURAT KEPUTUSAN<br>KEPALA SMK AL MUNAWWIR IIBS SINGOJURUH")}
${judul("TENTANG<br>PENETAPAN KELULUSAN PESERTA DIDIK KELAS XII<br>TAHUN PELAJARAN [TAHUN PELAJARAN]")}
<table><tbody>
<tr><td>Menimbang</td><td>:</td><td>Bahwa peserta didik telah menyelesaikan seluruh rangkaian program pembelajaran dan rangkaian kegiatan ujian akhir kelas XII Tahun Pelajaran [TAHUN PELAJARAN], maka perlu ditegaskan melalui keputusan Kelulusan Peserta Didik Kelas XII SMK Al Munawwir IIBS.</td></tr>
<tr><td>Mengingat</td><td>:</td><td><ol>
<li>Undang-Undang Republik Indonesia Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</li>
<li>Peraturan Pemerintah Republik Indonesia Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan sebagaimana telah diubah dengan Peraturan Pemerintah Nomor 4 Tahun 2022.</li>
<li>Peraturan Menteri Pendidikan, Kebudayaan, Riset, dan Teknologi Nomor 21 Tahun 2022 tentang Standar Penilaian Pendidikan.</li>
<li>Peraturan Menteri Pendidikan, Kebudayaan, Riset, dan Teknologi Nomor 5 Tahun 2022 tentang Standar Kompetensi Lulusan.</li>
<li>Hasil Rapat Dewan Guru SMK Al Munawwir IIBS tanggal [TANGGAL RAPAT].</li>
<li>Kriteria Kelulusan Peserta Didik yang ditetapkan oleh Satuan Pendidikan SMK Al Munawwir IIBS.</li>
</ol></td></tr>
</tbody></table>
${judul("MEMUTUSKAN")}
<table><tbody>
<tr><td>Menetapkan</td><td>:</td><td></td></tr>
<tr><td>PERTAMA</td><td>:</td><td>Peserta didik kelas XII yang namanya tercantum dalam lampiran keputusan ini dinyatakan <strong>LULUS</strong> dari SMK Al Munawwir IIBS Tahun Pelajaran [TAHUN PELAJARAN].</td></tr>
<tr><td>KEDUA</td><td>:</td><td>Peserta didik yang dinyatakan lulus berhak menerima Ijazah dan Surat Keterangan Lulus sesuai ketentuan yang berlaku.</td></tr>
<tr><td>KETIGA</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila di kemudian hari terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</td></tr>
</tbody></table>`,
  },
  {
    value: "SK_PANITIA", kategori: "Keputusan", label: "SK Panitia Kegiatan",
    klasifikasi: "A.2", perihal: "Pembentukan Panitia [NAMA KEGIATAN]", pihak: "",
    keterangan: "Panitia UKK, SAS, STS, wisuda, pesantren ramadhan, dll.",
    html: `${judul("SURAT KEPUTUSAN<br>KEPALA SMK AL MUNAWWIR IIBS SINGOJURUH")}
${judul("TENTANG<br>PEMBENTUKAN PANITIA [NAMA KEGIATAN]<br>TAHUN PELAJARAN [TAHUN PELAJARAN]")}
<table><tbody>
<tr><td>Menimbang</td><td>:</td><td>Bahwa demi kelancaran pelaksanaan [NAMA KEGIATAN] Tahun Pelajaran [TAHUN PELAJARAN], perlu dibentuk kepanitiaan yang ditetapkan dengan Surat Keputusan Kepala Sekolah.</td></tr>
<tr><td>Mengingat</td><td>:</td><td><ol>
<li>Undang-Undang Republik Indonesia Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</li>
<li>Peraturan Pemerintah Republik Indonesia Nomor 57 Tahun 2021 tentang Standar Nasional Pendidikan.</li>
<li>Program Kerja SMK Al Munawwir IIBS Tahun Pelajaran [TAHUN PELAJARAN].</li>
<li>Hasil Rapat Dewan Guru tanggal [TANGGAL RAPAT].</li>
</ol></td></tr>
</tbody></table>
${judul("MEMUTUSKAN")}
<table><tbody>
<tr><td>PERTAMA</td><td>:</td><td>Mengangkat nama-nama pada lampiran keputusan ini sebagai Panitia [NAMA KEGIATAN].</td></tr>
<tr><td>KEDUA</td><td>:</td><td>Panitia bertugas merencanakan, melaksanakan, dan melaporkan hasil kegiatan kepada Kepala Sekolah.</td></tr>
<tr><td>KETIGA</td><td>:</td><td>Segala biaya yang timbul akibat keputusan ini dibebankan pada anggaran sekolah yang relevan.</td></tr>
<tr><td>KEEMPAT</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</td></tr>
</tbody></table>
<p style="text-align:justify"><strong>Lampiran — Susunan Panitia</strong></p>
${tabelNama(["No", "Nama", "Jabatan Kedinasan", "Jabatan dalam Panitia"], ["1", "[NAMA]", "[JABATAN]", "[POSISI PANITIA]"])}`,
  },
  {
    value: "SK_PENGANGKATAN", kategori: "Keputusan", label: "SK Pengangkatan Tim / Petugas",
    klasifikasi: "A.2", perihal: "Pengangkatan [NAMA TIM/JABATAN]", pihak: "",
    keterangan: "Operator sekolah, tim penjaminan mutu, TPPK, pengawas ANBK, dll.",
    html: `${judul("SURAT KEPUTUSAN<br>KEPALA SMK AL MUNAWWIR IIBS SINGOJURUH")}
${judul("TENTANG<br>PENGANGKATAN [NAMA TIM/JABATAN]<br>TAHUN PELAJARAN [TAHUN PELAJARAN]")}
<table><tbody>
<tr><td>Menimbang</td><td>:</td><td>Bahwa untuk kelancaran [TUGAS/PROGRAM], perlu mengangkat [NAMA TIM/JABATAN] yang ditetapkan dengan Surat Keputusan Kepala Sekolah.</td></tr>
<tr><td>Mengingat</td><td>:</td><td><ol>
<li>Undang-Undang Republik Indonesia Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</li>
<li>[DASAR HUKUM KHUSUS SESUAI TUGAS].</li>
<li>Hasil Rapat Dewan Guru tanggal [TANGGAL RAPAT].</li>
</ol></td></tr>
</tbody></table>
${judul("MEMUTUSKAN")}
<table><tbody>
<tr><td>PERTAMA</td><td>:</td><td>Mengangkat nama berikut sebagai [NAMA JABATAN]:</td></tr>
</tbody></table>
${tabelNama(["No", "Nama", "NUPTK/NIP", "Jabatan"], ["1", "[NAMA]", "[NOMOR]", "[JABATAN]"])}
<table><tbody>
<tr><td>KEDUA</td><td>:</td><td>Yang bersangkutan bertugas [URAIAN TUGAS] dan bertanggung jawab kepada Kepala Sekolah.</td></tr>
<tr><td>KETIGA</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan sampai dengan berakhirnya Tahun Pelajaran [TAHUN PELAJARAN].</td></tr>
</tbody></table>`,
  },
  {
    value: "SK_BEASISWA", kategori: "Keputusan", label: "SK Penerima Beasiswa",
    klasifikasi: "A.2", perihal: "Penetapan Penerima Beasiswa [JENIS BEASISWA]", pihak: "",
    keterangan: "Beasiswa anak yatim, PIP, atau keringanan biaya.",
    html: `${judul("SURAT KEPUTUSAN<br>KEPALA SMK AL MUNAWWIR IIBS SINGOJURUH")}
${judul("TENTANG<br>PENETAPAN PENERIMA BEASISWA [JENIS BEASISWA]<br>TAHUN PELAJARAN [TAHUN PELAJARAN]")}
<table><tbody>
<tr><td>Menimbang</td><td>:</td><td>Bahwa dalam rangka meringankan beban biaya pendidikan peserta didik yang [KRITERIA: kurang mampu / yatim / berprestasi], perlu ditetapkan penerima beasiswa melalui Surat Keputusan Kepala Sekolah.</td></tr>
<tr><td>Mengingat</td><td>:</td><td><ol>
<li>Undang-Undang Republik Indonesia Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</li>
<li>Hasil verifikasi data peserta didik oleh tim sekolah tanggal [TANGGAL].</li>
<li>Hasil Rapat Dewan Guru tanggal [TANGGAL RAPAT].</li>
</ol></td></tr>
</tbody></table>
${judul("MEMUTUSKAN")}
<table><tbody>
<tr><td>PERTAMA</td><td>:</td><td>Menetapkan peserta didik berikut sebagai penerima beasiswa [JENIS BEASISWA]:</td></tr>
</tbody></table>
${tabelNama(["No", "Nama", "NIS", "Kelas", "Keterangan"], ["1", "[NAMA]", "[NIS]", "[KELAS]", "[KETERANGAN]"])}
<table><tbody>
<tr><td>KEDUA</td><td>:</td><td>Beasiswa diberikan dalam bentuk [BENTUK BEASISWA] selama [JANGKA WAKTU].</td></tr>
<tr><td>KETIGA</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan, dengan ketentuan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</td></tr>
</tbody></table>`,
  },

  // ══════════════════════════ EDARAN (B.9) ═════════════════════════════════
  {
    value: "EDR_KETENTUAN", kategori: "Edaran", label: "Edaran Ketentuan Internal",
    klasifikasi: "B.9", perihal: "Edaran tentang [HAL]",
    pihak: "Bapak/Ibu Guru dan Karyawan SMK Al Munawwir IIBS",
    keterangan: "Ketentuan hasil rapat untuk seluruh guru & karyawan.",
    html: `${SALAM}
<p style="text-align:justify">Berdasarkan [DASAR: hasil rapat / kebijakan sekolah] yang telah dilaksanakan pada [HARI, TANGGAL], terdapat beberapa ketentuan yang perlu diperhatikan dan dilaksanakan, yaitu:</p>
<ol>
<li><strong>[POKOK KETENTUAN 1]</strong><br>[Penjelasan.]</li>
<li><strong>[POKOK KETENTUAN 2]</strong><br>[Penjelasan.]</li>
<li><strong>Sanksi Pelanggaran</strong><br>Apabila ketentuan di atas dilanggar, akan dikenakan sanksi secara bertahap: teguran lisan, Surat Peringatan 1 (SP1), SP2, dan SP3.</li>
</ol>
<p style="text-align:justify">Demikian surat edaran ini disampaikan untuk dilaksanakan dengan sebaik-baiknya. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
  {
    value: "EDR_IURAN", kategori: "Edaran", label: "Edaran Iuran / Pembayaran",
    klasifikasi: "B.9", perihal: "Edaran [JENIS IURAN]",
    pihak: "Bapak/Ibu Wali Murid",
    keterangan: "Iuran kegiatan, pembayaran ujian, atau sumbangan.",
    html: `${SALAM}${PUJI}
<p style="text-align:justify">Sehubungan dengan akan dilaksanakannya <strong>[NAMA KEGIATAN]</strong>, dengan ini kami sampaikan rincian iuran/pembayaran sebagai berikut:</p>
<table><tbody>
<tr><td><strong>Uraian</strong></td><td><strong>Nominal</strong></td><td><strong>Batas Waktu</strong></td></tr>
<tr><td>[URAIAN]</td><td>Rp [NOMINAL]</td><td>[TANGGAL]</td></tr>
<tr><td></td><td></td><td></td></tr>
</tbody></table>
<p style="text-align:justify">Pembayaran dapat dilakukan di [TEMPAT/REKENING PEMBAYARAN]. Kami mohon Bapak/Ibu dapat menyelesaikannya sebelum batas waktu yang ditentukan.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },

  // ══════════════════════════ REKOMENDASI (B.6) ════════════════════════════
  {
    value: "REK_KERJA", kategori: "Rekomendasi", label: "Rekomendasi Melamar Kerja",
    subjek: "siswa",
    klasifikasi: "B.6", perihal: "Surat Rekomendasi", pihak: "",
    keterangan: "Merekomendasikan siswa/alumni melamar pekerjaan.",
    html: `${judul("SURAT REKOMENDASI")}
<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA KEPALA SEKOLAH]</td></tr>
<tr><td>Jabatan</td><td>:</td><td>Kepala Sekolah</td></tr>
<tr><td>Sekolah</td><td>:</td><td>SMK Al Munawwir IIBS</td></tr>
</tbody></table>
<p>Dengan ini memberikan rekomendasi kepada:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>Tempat/Tgl Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar siswa/siswi kelas [KELAS] di sekolah kami yang saat ini masih aktif mengikuti proses pembelajaran pada Tahun Pelajaran [TAHUN PELAJARAN].</p>
<p style="text-align:justify">Selama menjadi siswa di sekolah kami, yang bersangkutan menunjukkan sikap dan perilaku yang baik, disiplin, serta memiliki tanggung jawab dalam melaksanakan tugas. Selain itu, yang bersangkutan juga memiliki kemampuan kerja sama yang baik dan dapat diandalkan.</p>
<p style="text-align:justify">Berdasarkan hal tersebut, kami merekomendasikan yang bersangkutan untuk dapat melamar pekerjaan di instansi/perusahaan yang dituju.</p>
<p style="text-align:justify">Demikian surat rekomendasi ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>`,
  },
  {
    value: "REK_STUDI", kategori: "Rekomendasi", label: "Rekomendasi Studi Lanjut (SNBP/PMDK)",
    subjek: "siswa",
    klasifikasi: "B.6", perihal: "Surat Rekomendasi Studi Lanjut", pihak: "",
    keterangan: "Rekomendasi kepala sekolah untuk seleksi masuk perguruan tinggi.",
    html: `${judul("SURAT REKOMENDASI")}
<p style="text-align:justify">Yang bertanda tangan di bawah ini Kepala SMK Al Munawwir IIBS dengan ini memberikan rekomendasi kepada:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat/Tgl Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jurusan</td><td>:</td><td>[KELAS] / [JURUSAN]</td></tr>
</tbody></table>
<p style="text-align:justify">Untuk mengikuti seleksi <strong>[NAMA SELEKSI]</strong> pada [NAMA PERGURUAN TINGGI] program studi [PROGRAM STUDI].</p>
<p style="text-align:justify">Berdasarkan catatan akademik dan kepribadian, yang bersangkutan termasuk peserta didik yang berprestasi, disiplin, serta berkelakuan baik selama menempuh pendidikan di sekolah kami.</p>
<p style="text-align:justify">Demikian surat rekomendasi ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>`,
  },
  {
    value: "REK_LOMBA", kategori: "Rekomendasi", label: "Rekomendasi Mengikuti Lomba",
    subjek: "siswa",
    klasifikasi: "B.6", perihal: "Surat Rekomendasi Peserta Lomba", pihak: "",
    keterangan: "Merekomendasikan siswa mewakili sekolah dalam lomba.",
    html: `${judul("SURAT REKOMENDASI")}
<p style="text-align:justify">Yang bertanda tangan di bawah ini Kepala SMK Al Munawwir IIBS dengan ini merekomendasikan peserta didik berikut:</p>
${tabelNama(["No", "Nama", "Kelas", "Cabang/Bidang Lomba"], ["1", "[NAMA]", "[KELAS]", "[BIDANG]"])}
<p style="text-align:justify">Untuk mewakili SMK Al Munawwir IIBS dalam kegiatan <strong>[NAMA LOMBA]</strong> yang akan dilaksanakan pada [HARI, TANGGAL] di [TEMPAT].</p>
<p style="text-align:justify">Peserta didik tersebut kami nilai memiliki kemampuan dan kesungguhan untuk mengikuti kegiatan dimaksud.</p>
<p style="text-align:justify">Demikian surat rekomendasi ini dibuat untuk dapat dipergunakan sebagaimana mestinya.</p>`,
  },

  // ══════════════════════════ MUTASI (B.6) ═════════════════════════════════
  {
    value: "MUT_KELUAR", kategori: "Mutasi", label: "Surat Keterangan Pindah / Mutasi Keluar",
    subjek: "siswa",
    klasifikasi: "B.6", perihal: "Surat Keterangan Pindah Sekolah", pihak: "",
    keterangan: "Melepas siswa yang pindah ke sekolah lain.",
    html: `${judul("SURAT KETERANGAN PINDAH SEKOLAH")}${YBTT}
<p>Dengan ini menerangkan bahwa:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NIS / NISN</td><td>:</td><td>[NIS] / [NISN]</td></tr>
<tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>[TEMPAT, TGL LAHIR]</td></tr>
<tr><td>Kelas / Jurusan</td><td>:</td><td>[KELAS] / [JURUSAN]</td></tr>
<tr><td>Nama Orang Tua/Wali</td><td>:</td><td>[NAMA ORANG TUA]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
</tbody></table>
<p style="text-align:justify">Adalah benar peserta didik SMK Al Munawwir IIBS yang <strong>pindah sekolah</strong> ke <strong>[SEKOLAH TUJUAN]</strong> terhitung sejak tanggal [TANGGAL], dengan alasan [ALASAN].</p>
<p style="text-align:justify">Yang bersangkutan telah menyelesaikan seluruh kewajiban administrasi di sekolah kami dan tidak memiliki tanggungan apa pun.</p>
${PENUTUP_KETERANGAN}`,
  },
  {
    value: "MUT_MASUK", kategori: "Mutasi", label: "Surat Kesediaan Menerima Mutasi Masuk",
    subjek: "siswa",
    klasifikasi: "B.6", perihal: "Kesediaan Menerima Peserta Didik Pindahan",
    pihak: "Yth. Kepala [SEKOLAH ASAL]",
    keterangan: "Menyatakan sekolah bersedia menerima siswa pindahan.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Menanggapi permohonan pindah sekolah peserta didik berikut:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA SISWA]</td></tr>
<tr><td>NISN</td><td>:</td><td>[NISN]</td></tr>
<tr><td>Asal Sekolah</td><td>:</td><td>[SEKOLAH ASAL]</td></tr>
<tr><td>Kelas yang Dituju</td><td>:</td><td>[KELAS] — [JURUSAN]</td></tr>
</tbody></table>
<p style="text-align:justify">dengan ini kami menyatakan <strong>bersedia menerima</strong> peserta didik tersebut di SMK Al Munawwir IIBS terhitung mulai [TANGGAL], dengan ketentuan melengkapi berkas administrasi yang dipersyaratkan.</p>
<p style="text-align:justify">Kami mohon kerja sama Bapak/Ibu untuk memproses perpindahan data peserta didik tersebut pada aplikasi Dapodik.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },

  // ══════════════════════════ LAIN-LAIN ════════════════════════════════════
  {
    value: "KUASA", kategori: "Lain-lain", label: "Surat Kuasa",
    klasifikasi: "B.7", perihal: "Surat Kuasa", pihak: "",
    keterangan: "Memberi kuasa pengurusan administrasi/keuangan kepada pegawai.",
    html: `${judul("SURAT KUASA")}
<p>Yang bertanda tangan di bawah ini:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA KEPALA SEKOLAH]</td></tr>
<tr><td>Jabatan</td><td>:</td><td>Kepala SMK Al Munawwir IIBS</td></tr>
<tr><td>Alamat</td><td>:</td><td>Jl. Kedungliwung No. 36, Ds. Kemiri, Kec. Singojuruh, Banyuwangi</td></tr>
</tbody></table>
<p style="text-align:justify">Selanjutnya disebut sebagai <strong>PEMBERI KUASA</strong>, dengan ini memberikan kuasa kepada:</p>
<table><tbody>
<tr><td>Nama</td><td>:</td><td>[NAMA PENERIMA KUASA]</td></tr>
<tr><td>NIK</td><td>:</td><td>[NIK]</td></tr>
<tr><td>Jabatan</td><td>:</td><td>[JABATAN]</td></tr>
<tr><td>Alamat</td><td>:</td><td>[ALAMAT]</td></tr>
</tbody></table>
<p style="text-align:justify">Selanjutnya disebut sebagai <strong>PENERIMA KUASA</strong>.</p>
<p style="text-align:justify"><strong>KHUSUS</strong> untuk mewakili PEMBERI KUASA dalam hal <strong>[URAIAN KUASA]</strong> di [INSTANSI TUJUAN].</p>
<p style="text-align:justify">Demikian surat kuasa ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.</p>
<table><tbody>
<tr><td><strong>Penerima Kuasa</strong><br><br><br><br>( ____________________ )</td>
<td><strong>Pemberi Kuasa</strong><br><br><br><br>( ____________________ )</td></tr>
</tbody></table>`,
  },
  {
    value: "BERITA_ACARA", kategori: "Lain-lain", label: "Berita Acara",
    klasifikasi: "B.10", perihal: "Berita Acara [HAL]", pihak: "",
    keterangan: "Berita acara rapat, serah terima, atau kehilangan inventaris.",
    html: `${judul("BERITA ACARA<br>[JUDUL BERITA ACARA]")}
<p style="text-align:justify">Pada hari ini, [HARI] tanggal [TANGGAL], bertempat di [TEMPAT], telah dilaksanakan <strong>[NAMA KEGIATAN]</strong> yang dihadiri oleh:</p>
${tabelNama(["No", "Nama", "Jabatan", "Tanda Tangan"], ["1", "[NAMA]", "[JABATAN]", ""])}
<p style="text-align:justify">Dengan hasil sebagai berikut:</p>
<ol><li>[HASIL 1]</li><li>[HASIL 2]</li></ol>
<p style="text-align:justify">Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.</p>`,
  },
  {
    value: "PENGANTAR", kategori: "Lain-lain", label: "Surat Pengantar",
    klasifikasi: "B.12", perihal: "Pengantar [DOKUMEN YANG DIKIRIM]",
    pihak: "Yth. [PENERIMA]",
    keterangan: "Menyertai pengiriman proposal, laporan, atau berkas.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Bersama surat ini kami sampaikan dokumen berikut untuk dapat dipergunakan sebagaimana mestinya:</p>
${tabelNama(["No", "Nama Dokumen", "Jumlah", "Keterangan"], ["1", "[NAMA DOKUMEN]", "[JUMLAH]", "[KETERANGAN]"])}
<p style="text-align:justify">Besar harapan kami dokumen tersebut dapat diterima dan diproses lebih lanjut.</p>
${PENUTUP_UMUM}${TUTUP}`,
  },
  {
    value: "BALASAN", kategori: "Lain-lain", label: "Surat Balasan",
    klasifikasi: "B.3", perihal: "Balasan Surat Nomor [NOMOR SURAT MASUK]",
    pihak: "Yth. [PENGIRIM SURAT]",
    keterangan: "Menjawab surat masuk dari instansi lain.",
    html: `${SALAM}${HORMAT}
<p style="text-align:justify">Menanggapi surat Bapak/Ibu Nomor <strong>[NOMOR SURAT]</strong> tanggal [TANGGAL SURAT] perihal [PERIHAL SURAT MASUK], dengan ini kami sampaikan bahwa:</p>
<ol><li>[ISI JAWABAN 1]</li><li>[ISI JAWABAN 2]</li></ol>
<p style="text-align:justify">Demikian surat balasan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.</p>${TUTUP}`,
  },
];

/** Kategori terurut sesuai urutan kemunculan pertama di TEMPLATE_SURAT. */
export const KATEGORI_TEMPLATE: string[] = [...new Set(TEMPLATE_SURAT.map(t => t.kategori))];

export function templateSurat(value: string): TemplateSurat | undefined {
  return TEMPLATE_SURAT.find(t => t.value === value);
}
