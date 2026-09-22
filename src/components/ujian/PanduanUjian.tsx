"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BookOpen, CalendarRange, CheckCircle2, ClipboardCheck, FileSpreadsheet,
  FileText, Info, LifeBuoy, Radio, ShieldAlert, Users2,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Alert from "@/components/admin/Alert";
import { GAYA_STATUS_PESERTA, LABEL_STATUS_PESERTA } from "@/components/ujian/AksiPesertaUjian";

/** PANDUAN UJIAN ONLINE — dipindahkan dari artifact panduan (14 September 2026) menjadi fitur
 * di dalam aplikasi, atas permintaan user.
 *
 * Satu berkas untuk dua halaman supaya isinya tidak bercabang:
 *   - `PanduanUjian`  → /pusat-ujian/panduan (guru, pengawas, admin & kurikulum), dengan penyaring peran.
 *   - `PanduanPeserta` → /ujian-online/panduan (siswa), hanya bagian yang dibutuhkan peserta.
 * Bagian yang dipakai keduanya (isi layar ujian, cara menjawab, gangguan) disimpan sekali sebagai data.
 *
 * Gambar di /images/panduan-ujian/ diambil dari sistem sungguhan memakai ujian contoh; semua
 * nama, NIS, NISN, dan nama guru sudah disamarkan. Kalau tampilan sistem berubah besar, foto ulang. */

/* ============================== potongan kecil ============================== */

const Ui = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block font-heading font-bold text-[0.8em] leading-relaxed text-primary-700 bg-white border border-gray-200 px-1.5 rounded-md whitespace-nowrap align-baseline">
    {children}
  </span>
);
const Kode = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[0.85em] bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded whitespace-nowrap">{children}</span>
);
const Jalur = ({ bagian }: { bagian: string[] }) => (
  <span className="font-semibold text-gray-800">
    {bagian.map((b, i) => <React.Fragment key={i}>{i > 0 && <span className="text-gray-400 font-normal mx-1">›</span>}{b}</React.Fragment>)}
  </span>
);

function Langkah({ daftar }: { daftar: { judul: string; isi: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {daftar.map((l, i) => (
        <li key={i} className="flex gap-3.5 max-w-3xl">
          <span className="w-7 h-7 shrink-0 rounded-full bg-primary-50 border border-primary-100 text-primary-700 font-mono text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="font-heading font-bold text-gray-800 mb-0.5">{l.judul}</p>
            {l.isi}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tabel({ kolom, baris }: { kolom: string[]; baris: React.ReactNode[][] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto scrollbar-visible">
        <table className="data-table">
          <thead><tr>{kolom.map(k => <th key={k}>{k}</th>)}</tr></thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={i}>{b.map((sel, j) => <td key={j} className={`align-top ${j === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>{sel}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Gambar({ src, alt, keterangan }: { src: string; alt: string; keterangan: React.ReactNode }) {
  return (
    <figure className="space-y-2">
      <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/images/panduan-ujian/${src}`} alt={alt} loading="lazy" className="w-full h-auto block" />
      </div>
      <figcaption className="text-xs text-gray-500 leading-relaxed">{keterangan}</figcaption>
    </figure>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-heading font-bold text-gray-800 text-base pt-2">{children}</h3>
);
const Paragraf = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">{children}</p>
);
const Butir = ({ daftar }: { daftar: React.ReactNode[] }) => (
  <ul className="space-y-1.5 max-w-3xl">
    {daftar.map((d, i) => (
      <li key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
        <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 mt-2" />
        <span>{d}</span>
      </li>
    ))}
  </ul>
);

/* ============================== isi bersama (staf & siswa) ============================== */

const LAYAR_UJIAN: [string, React.ReactNode][] = [
  ["Sisa waktu", "Dihitung server, bukan jam komputer. Berubah merah dan berkedip saat tersisa kurang dari 5 menit. Tambahan waktu dari pengawas langsung muncul."],
  ["Status simpan", "Jawaban tersimpan otomatis setiap kali memilih atau mengetik. Kalau jaringan putus, jawaban tetap tersimpan di komputer dan dikirim otomatis begitu tersambung lagi."],
  ["Nomor soal", <>Klik nomor untuk berpindah. Warna membedakan sudah dijawab, belum dijawab, dan ragu-ragu. Tombol <Ui>Sebelumnya</Ui> / <Ui>Berikutnya</Ui> ada di bawah soal.</>],
  ["Tandai ragu-ragu", "Penanda untuk diperiksa lagi. Soal ragu-ragu tetap dinilai sesuai jawabannya."],
  ["Ukuran huruf", "Tombol perkecil/perbesar huruf di bilah atas."],
  ["Kalkulator & Coretan", "Hanya muncul kalau diizinkan guru. Coretan tersimpan di komputer dan tidak dinilai."],
  ["Audio listening", "Jumlah putarnya bisa dibatasi per soal."],
  ["Layar penuh", "Disarankan. Keluar dari layar penuh tercatat."],
  ["Watermark", "Nama dan NIS samar di latar layar — foto layar yang tersebar langsung ketahuan milik siapa."],
];

const CARA_MENJAWAB: React.ReactNode[] = [
  <><strong>Pilihan Ganda</strong> — klik satu pilihan. <strong>Pilihan Ganda Kompleks</strong> — pilih <em>semua</em> jawaban yang benar.</>,
  <><strong>Benar / Salah</strong> — tentukan Benar atau Salah untuk setiap pernyataan.</>,
  <><strong>Menjodohkan</strong> — pasangkan setiap butir kiri dengan pilihan di kanan.</>,
  <><strong>Isian Singkat</strong> — ketik satu kata atau angka. <strong>Uraian</strong> — tulis jawaban lengkap.</>,
  <><strong>Unggah Berkas</strong> — tekan <Ui>Unggah berkas</Ui> (bisa diganti selama waktu masih ada). <strong>Survei</strong> — tidak dinilai.</>,
];

const GANGGUAN: React.ReactNode[] = [
  <><strong>Komputer mati / listrik padam</strong> — login lagi dan buka ujian yang sama. Jawaban yang sudah terisi tetap ada; waktu terus berjalan dari jam mulai pertama.</>,
  <><strong>Layar “Ujian Terbuka di Perangkat Lain”</strong> — angkat tangan; pengawas menekan Reset Login.</>,
  <><strong>Layar “Pengerjaan Dikunci”</strong> — angkat tangan; pengawas menekan Buka Kunci.</>,
  <>Jangan menutup ujian sendiri atau login dari HP tanpa izin pengawas.</>,
];

const LANGKAH_SISWA = [
  { judul: "Login", isi: <>Buka alamat sekolah, login dengan akun siswa, lalu pilih menu <Ui>Ujian Online (CBT)</Ui> — atau langsung buka <Kode>/ujian-online</Kode>. Jangan centang “Ingat saya” di komputer lab.</> },
  { judul: "Beranda Peserta", isi: <>Pastikan nama, kelas, dan NIS di layar adalah milik Anda. Kartu ujian muncul pada hari pelaksanaan. Tombol <Ui>Ikuti Ujian</Ui> aktif setelah jam buka; sebelumnya tertulis “Menunggu pukul …”.</> },
  { judul: "Konfirmasi & Petunjuk", isi: <>Baca rincian ujian: jumlah soal per jenis, alokasi waktu, jam buka–tutup, dan petunjuk. Ketik <strong>token</strong> dari pengawas dan centang pernyataan jujur. Tombol <Ui>MULAI MENGERJAKAN</Ui> baru bisa ditekan setelah keduanya terisi — waktu mulai berjalan saat tombol ini ditekan.</> },
  { judul: "Kerjakan soal", isi: <>Lihat penjelasan isi layar ujian di bawah.</> },
  { judul: "Kumpulkan", isi: <>Tekan <Ui>Kumpulkan</Ui>. Sistem mengingatkan kalau masih ada soal belum dijawab atau ditandai ragu-ragu. Setelah dikumpulkan jawaban tidak bisa diubah, dan layar kembali ke Beranda Peserta. Kalau waktu habis, jawaban yang tersimpan dikumpulkan otomatis.</> },
];

/* ============================== halaman staf ============================== */

type Peran = "semua" | "admin" | "guru" | "pengawas" | "siswa";
const PENYARING: { value: Peran; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "admin", label: "Admin & Kurikulum" },
  { value: "guru", label: "Guru" },
  { value: "pengawas", label: "Pengawas" },
  { value: "siswa", label: "Siswa" },
];

interface BabInfo { id: string; tahap: string; judul: string; daftarIsi: string; peran: Peran[]; label: string[]; ikon: React.ElementType }
const BAB: BabInfo[] = [
  { id: "sekilas", tahap: "Mulai di sini", judul: "Sekilas & pembagian peran", daftarIsi: "Sekilas & pembagian peran", peran: ["admin", "guru", "pengawas", "siswa"], label: [], ikon: Info },
  { id: "persiapan", tahap: "Tahap 1", judul: "Persiapan sekolah", daftarIsi: "1 · Persiapan sekolah", peran: ["admin"], label: ["Admin", "Wakil Kepala Kurikulum"], ikon: CalendarRange },
  { id: "naskah", tahap: "Tahap 2", judul: "Menyusun naskah soal", daftarIsi: "2 · Menyusun naskah soal", peran: ["guru"], label: ["Guru"], ikon: FileText },
  { id: "buat", tahap: "Tahap 3", judul: "Membuat ujian & menentukan kelas", daftarIsi: "3 · Membuat ujian & kelas", peran: ["guru", "admin"], label: ["Guru", "Admin & Kurikulum untuk ujian bersama"], ikon: Users2 },
  { id: "hari-h", tahap: "Tahap 4", judul: "Hari pelaksanaan", daftarIsi: "4 · Hari pelaksanaan", peran: ["pengawas", "admin", "guru"], label: ["Pengawas / proktor", "Operator lab"], ikon: Radio },
  { id: "siswa", tahap: "Tahap 5", judul: "Siswa mengerjakan", daftarIsi: "5 · Siswa mengerjakan", peran: ["siswa", "pengawas"], label: ["Siswa", "Pengawas (untuk dibacakan)"], ikon: ClipboardCheck },
  { id: "hasil", tahap: "Tahap 6", judul: "Koreksi, hasil & analisis", daftarIsi: "6 · Koreksi, hasil & analisis", peran: ["guru", "admin"], label: ["Guru", "Kurikulum"], ikon: FileSpreadsheet },
  { id: "arsip", tahap: "Setelah kegiatan selesai", judul: "Arsip & hapus data", daftarIsi: "Arsip & hapus data", peran: ["admin", "guru"], label: ["Admin", "Guru (ujian miliknya)"], ikon: ShieldAlert },
  { id: "masalah", tahap: "Rujukan cepat", judul: "Masalah yang sering terjadi", daftarIsi: "Masalah yang sering terjadi", peran: ["admin", "guru", "pengawas", "siswa"], label: [], ikon: LifeBuoy },
];

function KepalaBab({ info }: { info: BabInfo }) {
  const Ikon = info.ikon;
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
      <div className="w-10 h-10 rounded-xl bg-primary-900 text-gold flex items-center justify-center shrink-0"><Ikon size={18} /></div>
      <div className="min-w-0">
        <p className="font-mono text-xs text-gold-dark">{info.tahap}</p>
        <h2 className="font-heading font-extrabold text-gray-900 text-xl leading-tight">{info.judul}</h2>
        {info.label.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {info.label.map(l => <span key={l} className="text-xs font-semibold uppercase tracking-wide text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">{l}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PanduanUjian({ basePath }: { basePath: string }) {
  const [peran, setPeran] = useState<Peran>("semua");
  const [aktif, setAktif] = useState("sekilas");
  const tampil = useMemo(() => new Set(BAB.filter(b => peran === "semua" || b.peran.includes(peran)).map(b => b.id)), [peran]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entri => {
      for (const e of entri) if (e.isIntersecting) setAktif(e.target.id);
    }, { rootMargin: "-25% 0px -65% 0px" });
    for (const b of BAB) { const el = document.getElementById(b.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [peran]);

  const info = (id: string) => BAB.find(b => b.id === id)!;
  const bab = (id: string, isi: React.ReactNode) => tampil.has(id) && (
    <section id={id} className="space-y-4 scroll-mt-28">
      <KepalaBab info={info(id)} />
      {isi}
    </section>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookOpen size={22} />} title="Panduan Ujian Online"
        description="Alur lengkap dari persiapan, naskah Word & Excel, menentukan kelas, hari pelaksanaan, sampai hasil & analisis" />

      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tampilkan bagian untuk">
          <span className="text-xs text-gray-500 mr-1">Tampilkan untuk:</span>
          {PENYARING.map(p => (
            <button key={p.value} type="button" onClick={() => setPeran(p.value)} aria-pressed={peran === p.value}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${peran === p.value ? "bg-primary-900 text-white border-primary-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden lg:block sticky top-28 self-start" aria-label="Daftar isi">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.14em] text-gray-400 mb-2">Daftar isi</p>
          <ol className="space-y-0.5">
            {BAB.filter(b => tampil.has(b.id)).map(b => (
              <li key={b.id}>
                <a href={`#${b.id}`} className={`block px-2.5 py-1.5 rounded-lg text-[13px] leading-snug transition ${aktif === b.id ? "bg-primary-50 text-primary-700 font-semibold" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"}`}>
                  {b.daftarIsi}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-12">
          {/* ——— alur ——— */}
          <ol className="grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {BAB.slice(1, 7).map((b, i) => (
              <li key={b.id}>
                <a href={`#${b.id}`} onClick={() => { if (!tampil.has(b.id)) setPeran("semua"); }}
                  className="block h-full rounded-xl p-3 text-white hover:brightness-110 transition" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                  <span className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
                  <span className="block font-heading font-bold text-sm leading-snug mt-0.5">{b.judul}</span>
                  <span className="block text-xs text-white/60 mt-0.5">{b.label[0]}</span>
                </a>
              </li>
            ))}
          </ol>

          {/* ============================ SEKILAS ============================ */}
          {bab("sekilas", <>
            <Paragraf>Ujian online punya dua pintu. <strong>Pusat Ujian</strong> untuk guru, pengawas, dan admin: menu <Ui>Ujian Online (CBT)</Ui> di sidebar dashboard. <strong>Portal Peserta</strong> untuk siswa: menu yang sama di dashboard siswa, atau langsung alamat <Kode>/ujian-online</Kode>. Keduanya layar penuh tanpa menu lain supaya tidak ada gangguan saat ujian.</Paragraf>
            <Tabel kolom={["Peran", "Yang dikerjakan", "Batas wewenang"]} baris={[
              ["Admin & Wakil Kepala Kurikulum", "Mengatur kegiatan ujian (STS, SAS, PSAJ…), bawaan ujian baru, petunjuk sekolah; membuat ujian bersama lintas guru", "Boleh membuka dan mengubah semua ujian"],
              ["Guru pembuat", "Menyusun soal, membuat ujian, memilih kelas peserta, menerbitkan, mengoreksi uraian", "Hanya kelas yang tercatat ia ampu di Penugasan Mengajar"],
              ["Guru pengampu lain", "Ikut memantau, mengoreksi, dan melihat hasil ujian mapelnya yang diikuti kelasnya", "Tidak bisa mengubah soal, pengaturan, atau menghapus"],
              ["Pengawas / proktor", "Mengumumkan token, memantau peserta, Reset Login, tambah waktu, buka kunci, kumpulkan paksa", "Memakai akun guru/admin yang punya akses ke ujian itu"],
              ["Siswa", "Masuk Portal Peserta, memasukkan token, mengerjakan, mengumpulkan", "Hanya ujian yang diikuti kelasnya, pada jam yang dibuka"],
            ]} />
            <Alert variant="info" icon={CalendarRange} title="Jadwal kerja yang disarankan">
              <ul className="space-y-0.5 mt-1">
                <li><strong>H-7</strong> — naskah Word + Excel kunci selesai, diimpor ke Bank Soal.</li>
                <li><strong>H-3</strong> — ujian dibuat, kelas peserta dipilih, soal dipratinjau satu per satu.</li>
                <li><strong>H-1</strong> — ujian diterbitkan, jadwal diperiksa, siswa uji coba login di lab.</li>
                <li><strong>Hari-H</strong> — pengawas membuka Ruang Kendali 15 menit sebelum mulai, lalu mengumumkan token.</li>
              </ul>
            </Alert>
          </>)}

          {/* ============================ 1. PERSIAPAN ============================ */}
          {bab("persiapan", <>
            <Paragraf>Dikerjakan sekali per kegiatan ujian, sebelum guru mulai membuat ujian. Buka <Jalur bagian={["Pusat Ujian", "Pengaturan Ujian"]} />. Guru lain bisa melihat halaman ini, tetapi hanya Admin dan Wakil Kepala Kurikulum yang bisa mengubahnya.</Paragraf>
            <Langkah daftar={[
              { judul: "Periksa Penugasan Mengajar", isi: <>Guru hanya bisa mencentang kelas yang tercatat ia ampu untuk mapel itu. Kalau pembagian di data belum sesuai kenyataan, perbaiki dulu di <Jalur bagian={["Dashboard Admin", "Penugasan Mengajar"]} /> — ini penyebab paling sering guru “tidak bisa memilih kelas”.</> },
              { judul: "Buat Kegiatan Ujian", isi: <>Tekan <Ui>Tambah Kegiatan</Ui>: pilih jenis (STS, SAS, SAT, PSAJ, UKK, Remedial, Try Out, atau lainnya), semester, tahun ajaran, tingkat peserta, dan tanggal. Nama & singkatan terisi otomatis dan bisa diubah; sistem juga menawarkan kegiatan yang tanggalnya diambil dari Kalender Pendidikan. Nama kegiatan inilah yang tampil besar di layar siswa.</> },
              { judul: "Atur bawaan ujian baru", isi: <>Durasi, pengacakan, satu soal per halaman, tampilkan nilai, kalkulator, coretan, batas pindah tab, token berganti otomatis, batas putar audio. Nilai ini hanya isian awal — tiap guru tetap bisa mengubahnya per ujian.</> },
              { judul: "Tentukan kunci otomatis saat terputus", isi: <>Kalau diisi, misalnya <Kode>10</Kode>, pengerjaan siswa yang terputus lebih dari 10 menit terkunci dan harus dibuka pengawas. Isi <Kode>0</Kode> kalau tidak ingin ada penguncian otomatis.</> },
              { judul: "Tulis petunjuk tambahan", isi: <>Satu petunjuk per baris, misalnya “HP dikumpulkan di meja pengawas”. Tampil di halaman konfirmasi siswa, di bawah petunjuk bawaan.</> },
              { judul: "Batasi satu akun satu perangkat (disarankan saat musim ujian)", isi: <>Di <Jalur bagian={["Dashboard Admin", "Keamanan & Sesi Login"]} />, centang <strong>Siswa</strong>. Akun siswa yang login di perangkat lain otomatis keluar dari perangkat sebelumnya — mencegah akun dipakai bergantian.</> },
            ]} />
            <Gambar src="g-pengaturan.jpg" alt="Halaman Pengaturan Ujian berisi daftar kegiatan ujian dan bawaan ujian baru"
              keterangan={<><strong>Pusat Ujian › Pengaturan Ujian.</strong> Kegiatan ujian di atas, bawaan ujian baru dan petunjuk tambahan di bawahnya.</>} />
          </>)}

          {/* ============================ 2. NASKAH ============================ */}
          {bab("naskah", <>
            <Paragraf>Soal disimpan di <strong>Bank Soal</strong> per mata pelajaran, lalu dipakai berulang di ujian mana pun. Ada dua cara mengisinya: <strong>impor naskah Word + kunci Excel</strong> (paling cepat untuk puluhan soal, sama seperti Bimasoft) atau <strong>tulis langsung</strong> di sistem.</Paragraf>

            <Sub>Delapan jenis soal</Sub>
            <Tabel kolom={["Jenis", "Penanda di Word", "Isi kolom Kunci di Excel", "Dinilai"]} baris={[
              ["Pilihan Ganda", "(tanpa penanda)", <Kode key="k">B</Kode>, "Otomatis"],
              ["Pilihan Ganda Kompleks", <Kode key="p">[PG_KOMPLEKS]</Kode>, <><Kode>ACE</Kode> — gabungan huruf, tanpa spasi</>, "Otomatis"],
              ["Benar / Salah", <Kode key="p">[BENAR_SALAH]</Kode>, <><Kode>B,S,B</Kode> — urut pernyataan (boleh <Kode>1,0,1</Kode>)</>, "Otomatis"],
              ["Menjodohkan", <Kode key="p">[MENJODOHKAN]</Kode>, <><Kode>1-A,2-B,3-C</Kode> — butir kiri ke pilihan kanan</>, "Otomatis"],
              ["Isian Singkat", <Kode key="p">[ISIAN_SINGKAT]</Kode>, <><Kode>56|lima puluh enam</Kode> — jawaban lain dipisah <Kode>|</Kode></>, "Otomatis"],
              ["Uraian", <Kode key="p">[URAIAN]</Kode>, "Jawaban acuan + kolom Pedoman Penskoran", "Dikoreksi guru"],
              ["Unggah Berkas", <Kode key="p">[UNGGAH]</Kode>, "Kosong", "Dikoreksi guru"],
              ["Survei", <Kode key="p">[SURVEI]</Kode>, "Kosong", "Tidak dinilai"],
            ]} />

            <Sub>Berkas Word — naskah soal</Sub>
            <Paragraf>Unduh template dari <Jalur bagian={["Pusat Ujian", "Bank Soal"]} /> <Ui>Template Word</Ui> <em>setelah</em> memilih kelas & mapel di bagian atas — Mata Pelajaran dan nama guru langsung terisi benar. Template berisi contoh terisi nomor 1–9 untuk semua jenis soal.</Paragraf>
            <Tabel kolom={["Kepala naskah", "Isi", "Catatan"]} baris={[
              ["Mata Pelajaran", "Pendidikan Agama Islam Dan Budi Pekerti", <>Harus <strong>sama persis</strong> dengan Kode Test di Excel dan nama mapel di Penugasan Mengajar</>],
              ["Kelas", "X AK 1 · atau “XI TKJ 1, XI TKJ 2” · atau “X Semua Jurusan”", "Hanya keterangan. Kelas peserta sebenarnya dipilih di sistem (Tahap 3)"],
              ["Guru Pengampu", "Nama guru penyusun", "Keterangan"],
            ]} />
            <Butir daftar={[
              <>Satu soal = satu blok tabel: baris nomor berisi pertanyaan, baris di bawahnya huruf <Kode>A</Kode>–<Kode>E</Kode> berisi pilihan.</>,
              <>Jenis soal ditentukan <strong>penanda di awal sel pertanyaan</strong>. Tanpa penanda = pilihan ganda biasa.</>,
              <>Benar/Salah: tulis pernyataan bernomor <Kode>1)</Kode> <Kode>2)</Kode> <Kode>3)</Kode> di sel pertanyaan. Menjodohkan: butir kiri di baris bernomor, pilihan kanan di sel pertanyaan.</>,
              <><strong>Gambar</strong>: Insert › Picture langsung di sel — otomatis diperkecil saat diimpor. Pangkat dan indeks (x², H₂O) ikut terbaca.</>,
              <><strong>Rumus</strong>: tulis di antara tanda dolar, misalnya <Kode>{"$\\frac{3}{4} + x^2$"}</Kode> — tampil sebagai rumus rapi di layar siswa.</>,
              <><strong>Kunci jawaban tidak ditulis di Word</strong>, tetapi di Excel pada nomor yang sama. Simpan sebagai <Kode>.docx</Kode>; berkas <Kode>.doc</Kode> lama harus di-Save As dulu.</>,
            ]} />

            <Sub>Berkas Excel — pengaturan & kunci</Sub>
            <Paragraf>Blok kiri berisi pengaturan, blok kanan tabel kunci. Word dan Excel dihubungkan lewat <strong>nomor soal</strong>: soal nomor 3 di Word dipasangkan dengan baris <Kode>No. Soal 3</Kode>.</Paragraf>
            <Tabel kolom={["Blok pengaturan", "Contoh isi", "Artinya"]} baris={[
              ["Nama Test", "Sumatif Tengah Semester Ganjil", "Keterangan; judul yang tampil diatur di pengaturan ujian"],
              ["Kode Test", "Pendidikan Agama Islam Dan Budi Pekerti", <>Wajib nama mapel. Excel yang Kode Test-nya mapel lain <strong>ditolak</strong>; singkatan jelas (PJOK, B. Indonesia) diterima dengan catatan</>],
              ["Sub Test", "(kosong)", "Boleh dikosongkan"],
              ["Tanggal", "15/09/2026", "Tanggal pelaksanaan. Tanpa tanggal, Waktu Test tidak dipakai"],
              ["Waktu Test", "07:30", "Jam buka. Jam tutup otomatis = mulai + alokasi + 30 menit"],
              ["Alokasi", "90", "Lama pengerjaan tiap siswa (menit)"],
              ["Jumlah Soal", "9", "Banyaknya soal di Word"],
              ["Yang Harus Dikerjakan", "9", "Sama = semua soal. Lebih kecil = tiap siswa menerima soal acak sebanyak itu (bank 50, dikerjakan 30)"],
              ["Acak Soal / Option", <Kode key="a">1 / 1</Kode>, "1 = diacak, 0 = tidak. Yang diacak isi pilihannya — huruf A B C D E di layar siswa tetap urut"],
              ["Key", "(kosong)", "Token dibuat otomatis oleh sistem"],
            ]} />
            <Tabel kolom={["Kolom kunci", "Artinya"]} baris={[
              ["Skor", <>Bobot butir, boleh pecahan (<Kode>2.5</Kode>). Kosong = 1. Nilai akhir = skor diraih ÷ skor maksimum × 100</>],
              ["Grouping", <>Isi nomor soal <em>berikutnya</em> yang satu wacana. Soal 3 diisi 4, soal 4 diisi 5 → soal 3, 4, 5 tidak pernah dipisah saat diacak</>],
              ["LockN", "Posisi tetap saat diacak: 1 untuk soal listening/petunjuk, nomor terakhir untuk uraian"],
              ["KD", <>Kode kompetensi (mis. <Kode>3.1</Kode>) — dipakai di analisis hasil per KD</>],
            ]} />
            <Alert variant="warning" icon={AlertTriangle} title="Kelas tidak ditulis di Excel">
              Excel tidak punya kolom kelas, dan kolom Kelas di Word hanya keterangan. Satu naskah bisa dipakai untuk satu kelas atau banyak kelas sekaligus — pilihannya dibuat saat membuat ujian (Tahap 3).
            </Alert>

            <Sub>Mengimpor ke Bank Soal</Sub>
            <Langkah daftar={[
              { judul: "Pilih kelas & mapel", isi: <>Di bagian atas Pusat Ujian, pilih salah satu kelas yang diampu, misalnya “X AK 1 - Pendidikan Agama Islam Dan Budi Pekerti”. Mapel inilah yang dipakai bank soal.</> },
              { judul: "Buka tab Bank Soal lalu Impor dari Word", isi: <>Tekan <Ui>Impor dari Word</Ui>, pilih berkas Word dan (opsional) berkas Excel kunci.</> },
              { judul: "Baca & Pratinjau", isi: <>Sistem menampilkan jumlah soal terbaca, pola naskah, gambar, dan peringatan. Peringatan paling atas memberi tahu kalau Mata Pelajaran atau Kode Test <em>berbeda</em> dengan mapel yang dipilih — tanda berkas tertukar.</> },
              { judul: "Periksa tiap soal", isi: <>Pastikan jenisnya benar dan kuncinya tertandai. Hapus centang soal yang tidak ingin disimpan.</> },
              { judul: "Simpan ke bank", isi: <>Soal masuk Bank Soal mapel itu dan bisa dipakai di ujian mana pun.</> },
            ]} />
            <Gambar src="g-impor.jpg" alt="Jendela Impor dari Word di Bank Soal"
              keterangan={<><strong>Bank Soal › Impor dari Word.</strong> Word wajib, Excel kunci opsional. Tidak ada yang tersimpan sebelum guru menekan simpan.</>} />

            <Sub>Menulis soal langsung</Sub>
            <Paragraf>Tekan <Ui>Tambah Soal</Ui> di Bank Soal (atau <Ui>Soal baru</Ui> di halaman ujian). Isiannya berubah mengikuti jenis soal:</Paragraf>
            <Butir daftar={[
              <><strong>Jenis soal, Skor, KD / Indikator</strong> di baris atas.</>,
              <><strong>Pertanyaan</strong> — tombol untuk menyisipkan gambar, <strong>Audio listening</strong>, dan contoh rumus.</>,
              <><strong>Wacana / stimulus bersama</strong> — pilih wacana yang sama untuk beberapa soal; soal se-wacana tidak dipisah saat diacak.</>,
              <><strong>Pilihan jawaban</strong> dengan tanda jawaban benar; pernyataan Benar/Salah; butir kiri + pilihan kanan untuk Menjodohkan (pilihan kanan boleh lebih banyak sebagai pengecoh); jawaban yang diterima untuk Isian Singkat (satu per baris, tidak peka huruf besar/kecil); jawaban acuan & pedoman penskoran untuk Uraian.</>,
              <><strong>Pembahasan</strong> dan <strong>Kunci posisi</strong> (nomor tetap saat diacak).</>,
            ]} />
          </>)}

          {/* ============================ 3. BUAT UJIAN ============================ */}
          {bab("buat", <>
            <Langkah daftar={[
              { judul: "Pilih kelas & mapel, lalu Buat Ujian", isi: <>Di Pusat Ujian pilih kelas & mapel di bagian atas, buka tab <Ui>Daftar Ujian</Ui>, tekan <Ui>Buat Ujian</Ui>. Kelas yang dipilih tadi otomatis tercentang sebagai peserta.</> },
              { judul: "Isi soal", isi: <>Tekan <Ui>Dari bank</Ui> untuk mengambil soal dari Bank Soal, atau <Ui>Soal baru</Ui>. Atur urutan dengan panah atas/bawah dan periksa tiap soal dengan tombol <strong>Pratinjau</strong> (ikon mata). Soal pilihan ganda yang belum ditandai kuncinya diberi label kuning.</> },
              { judul: "Isi Identitas & Jadwal", isi: <>Kegiatan ujian, <strong>Kelas peserta</strong>, Judul, Petunjuk, jam Mulai & Tutup, Durasi, dan jumlah soal yang Dikerjakan (kosong = semua).</> },
              { judul: "Atur Pengamanan", isi: <>Lihat tabel Pengamanan di bawah.</> },
              { judul: "Simpan & Terbitkan", isi: <>Ujian yang masih <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-gray-50 text-gray-600 border-gray-200">Draft</span> tidak terlihat siswa. Tombol status di bagian atas halaman ujian bisa diklik untuk menerbitkan atau menariknya kembali.</> },
              { judul: "Terapkan Excel kunci (kalau memakai Excel)", isi: <>Tekan <Ui>Kunci dari Excel</Ui> di halaman ujian. Kunci, skor, KD, Grouping, LockN — serta tanggal, jam, alokasi, dan pengacakan dari blok pengaturan — diterapkan ke soal <strong>berdasarkan urutan</strong>: soal ke-3 di ujian = baris No. Soal 3. Pastikan urutan soal di ujian sama dengan nomor di Word.</> },
            ]} />
            <Gambar src="g-susun.jpg" alt="Halaman ujian tab Soal dan Pengaturan"
              keterangan={<><strong>Halaman ujian › Soal & Pengaturan.</strong> Daftar soal di kiri; Identitas & Jadwal (termasuk Kelas peserta) dan Pengamanan di kanan. Token ada di bagian atas — klik untuk menyalin.</>} />

            <Sub>Menentukan kelas peserta</Sub>
            <Paragraf>Di bagian <strong>Kelas peserta</strong>, kelas dikelompokkan per tingkat. Centang satu per satu, atau tekan <Ui>Pilih semua</Ui> di samping “Kelas X”. Satu ujian untuk banyak kelas berarti <strong>satu naskah, satu kunci, satu token</strong>; papan pantau dan hasil tetap menunjukkan kelas tiap siswa, dan Excel hasil punya kolom Kelas.</Paragraf>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["PJOK untuk semua kelas X", <>Guru PJOK membuat <strong>satu ujian</strong>, lalu <Ui>Pilih semua</Ui> pada Kelas X — kelima kelas (AK, ATU, DKV, DPIB, TKJ) ikut sekaligus.</>],
                ["Matematika XI, dua guru, soal berbeda", "Masing-masing guru membuat ujiannya sendiri dan hanya mencentang kelas yang ia ampu."],
                ["Matematika XI, dua guru, soal sama", "Satu guru (atau Kurikulum) membuat satu ujian untuk semua kelas XI. Guru lainnya otomatis bisa memantau, mengoreksi, dan melihat hasil kelasnya — tetapi tidak bisa mengubah soal."],
              ].map(([j, isi], i) => (
                <div key={i} className="panel p-4">
                  <p className="font-heading font-bold text-gray-800 text-sm mb-1">{j}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{isi}</p>
                </div>
              ))}
            </div>
            <Alert variant="info" icon={Info} title="Aturan kelas peserta">
              <ul className="space-y-0.5 mt-1">
                <li>Guru hanya bisa mencentang kelas yang tercatat ia ampu. Butuh kelas lain? Minta Admin/Kurikulum membuat ujian bersama, atau perbaiki Penugasan Mengajar.</li>
                <li>Kelas bisa ditambah kapan saja. Kelas yang siswanya <strong>sudah mengerjakan</strong> tidak bisa dilepas dari ujian.</li>
              </ul>
            </Alert>

            <Sub>Jam Mulai–Tutup dan Durasi</Sub>
            <Paragraf><strong>Mulai–Tutup</strong> adalah jendela kapan siswa boleh masuk. <strong>Durasi</strong> adalah jam pribadi tiap siswa yang berjalan sejak ia menekan MULAI. Batas waktu siswa = mulai siswa + durasi, tetapi tidak pernah melewati jam tutup.</Paragraf>
            <div className="panel p-4 space-y-2.5" aria-label="Contoh jendela ujian 07.30 sampai 09.30 dengan durasi 90 menit">
              <div className="flex justify-between font-mono text-xs text-gray-400 tabular-nums"><span>07.30</span><span>08.00</span><span>08.30</span><span>09.00</span><span>09.30</span></div>
              {[
                { kiri: 0, lebar: 100, gaya: "bg-primary-50 text-primary-700 border-dashed border-primary-100", teks: "Jendela ujian: dibuka 07.30 · ditutup 09.30" },
                { kiri: 8.33, lebar: 75, gaya: "bg-emerald-50 text-emerald-700 border-emerald-200", teks: "Siswa A mulai 07.40 → batas 09.10 (90 menit penuh)" },
                { kiri: 50, lebar: 50, gaya: "bg-amber-50 text-amber-700 border-amber-200", teks: "Siswa B mulai 08.30 → batas 09.30 (terpotong jam tutup)" },
              ].map((b, i) => (
                <div key={i} className="relative h-8 rounded-lg bg-gray-50">
                  <div className={`absolute top-1 bottom-1 rounded-md border flex items-center px-2 text-xs font-semibold whitespace-nowrap overflow-hidden ${b.gaya}`} style={{ left: `${b.kiri}%`, width: `${b.lebar}%` }}>{b.teks}</div>
                </div>
              ))}
              <p className="text-xs text-gray-500">Durasi 90 menit. Karena itu jam tutup sebaiknya diberi kelonggaran di atas durasi untuk siswa yang terlambat masuk atau komputernya bermasalah.</p>
            </div>

            <Sub>Pengamanan</Sub>
            <Tabel kolom={["Pengaturan", "Fungsinya"]} baris={[
              ["Acak urutan soal per siswa", "Nomor soal tiap siswa berbeda. Wacana (grouping) dan kunci posisi tetap dihormati. Urutan dibuat sekali — muat ulang halaman tidak mengubahnya"],
              ["Acak urutan pilihan", "Isi pilihan diacak, huruf tetap urut A–E. Tidak berlaku untuk Benar/Salah & Menjodohkan"],
              ["Satu soal per halaman", "Soal dikirim satu per satu, naskah tidak bisa disalin utuh sekali jalan"],
              ["Siswa boleh melihat nilainya", "Hanya angka nilai di beranda siswa — soal, jawaban, dan kunci tidak pernah ditampilkan"],
              ["Kalkulator ilmiah", "Tombol Kalkulator di layar siswa, untuk mapel hitungan"],
              ["Kertas coretan digital", "Pengganti kertas buram; tersimpan di komputer siswa, tidak dikirim dan tidak dinilai"],
              ["Batas pindah tab", <><Kode>0</Kode> = hanya dicatat. Diisi 3 = setelah 3 kali pindah tab, pengawas diberi tanda. Ujian tidak pernah dihentikan otomatis</>],
              ["Examkey", <>Kalau diisi, ujian hanya bisa dibuka lewat alamat <Kode>/ujian-online?examkey=…</Kode> (browser ujian sekolah). Kosong = bebas</>],
              ["Token berganti tiap", <>Menit. Token lama masih diterima sebentar setelah berganti. <Kode>0</Kode> = token tetap</>],
              ["Batas putar audio", <>Berapa kali audio listening boleh diputar per soal. <Kode>0</Kode> = bebas</>],
            ]} />
          </>)}

          {/* ============================ 4. HARI-H ============================ */}
          {bab("hari-h", <>
            <Langkah daftar={[
              { judul: "Cetak administrasi ujian (H-1)", isi: <><Jalur bagian={["Pusat Ujian", "Administrasi"]} />: pilih kegiatan & kelas lalu <Ui>Cetak Kartu Peserta</Ui> (10 kartu per A4, ukuran kartu ID, ada QR ke Portal Ujian). Untuk tiap ujian tersedia <Ui>Daftar Hadir</Ui> dan <Ui>Berita Acara</Ui> — status hadir, nama yang tidak hadir, dan catatan pelanggaran terisi otomatis dari data pengerjaan. <Ui>Denah Ruang Ujian</Ui> membagi peserta ke ruang, sesi & kursi lalu mencetak denah pintu, kartu meja, dan rekap; tombol <Ui>Kisi-kisi</Ui> tiap ujian untuk mengisi materi, indikator, dan level kognitif lalu mencetaknya.</> },
              { judul: "Buka Ruang Kendali sebelum ujian", isi: <><Jalur bagian={["Pusat Ujian", "Ruang Kendali"]} /> menampilkan semua ujian dalam satu layar, segar otomatis tiap 5 detik. Ujian yang perlu perhatian diberi bingkai kuning.</> },
              { judul: "Pastikan ujian sudah terbit", isi: <>Ikon mata hijau = diterbitkan. Kalau masih draft, klik untuk menerbitkan.</> },
              { judul: "Umumkan token", isi: <>Token 6 huruf/angka, misalnya <Kode>SVL9PE</Kode>, tulis di papan tulis. Kalau token telanjur bocor ke luar ruangan, tekan <strong>Ganti token</strong> — siswa yang sudah masuk tidak terganggu.</> },
              { judul: "Pantau peserta", isi: <>Klik baris ujian untuk melihat daftar siswa dan tindakan satu kelas, atau buka <Ui>Papan Pantau</Ui> di halaman ujian untuk rincian lengkap.</> },
              { judul: "Tangani masalah per siswa", isi: <>Tekan tombol <Ui>Tindakan</Ui> di baris siswa (lihat tabel).</> },
              { judul: "Tutup ujian", isi: <>Siswa yang waktunya habis dikumpulkan otomatis. Kalau harus ditutup serentak, gunakan <Ui>Kumpulkan semua sekarang</Ui>.</> },
            ]} />
            <Gambar src="g-kendali.jpg" alt="Ruang Kendali Ujian dengan papan angka dan satu ujian terbuka"
              keterangan={<><strong>Pusat Ujian › Ruang Kendali.</strong> Papan angka seluruh ujian di atas; tiap ujian bisa dibuka untuk token, tindakan satu kelas, dan daftar siswa. Nama siswa pada gambar disamarkan.</>} />

            <Sub>Status peserta</Sub>
            <Tabel kolom={["Status", "Artinya", "Yang biasanya dilakukan"]} baris={([
              ["BELUM_MULAI", "Belum menekan MULAI", "Cek kehadiran; bantu login"],
              ["MENGERJAKAN", "Aktif, denyut dari komputernya masuk", "—"],
              ["TERPUTUS", "Tidak ada denyut lebih dari 1 menit (jaringan putus, komputer mati, halaman ditutup)", "Minta siswa membuka lagi; jawaban yang sudah diisi aman"],
              ["TERKUNCI", "Dikunci pengawas, atau terputus melebihi batas di Pengaturan Ujian", <>Periksa, lalu <strong>Buka Kunci</strong></>],
              ["WAKTU_HABIS", "Durasi habis sebelum mengumpulkan", "Dikumpulkan otomatis; tambah waktu hanya bila ada alasan sah"],
              ["SELESAI", "Sudah dikumpulkan dan dinilai (nilai “sementara” kalau ada uraian)", "—"],
            ] as [keyof typeof LABEL_STATUS_PESERTA, string, React.ReactNode][]).map(([st, arti, tindak]) => [
              <span key={st} className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${GAYA_STATUS_PESERTA[st]}`}>{LABEL_STATUS_PESERTA[st]}</span>, arti, tindak,
            ])} />
            <Gambar src="g-pantau.jpg" alt="Papan Pantau berisi status dan tabel siswa"
              keterangan={<><strong>Halaman ujian › Papan Pantau.</strong> Kemajuan menjawab, jumlah ragu-ragu, sisa waktu, pelanggaran, dan aktif terakhir per siswa. Baris dengan 3 pelanggaran atau lebih ditandai merah. Nama pada gambar disamarkan.</>} />

            <Sub>Tindakan per siswa</Sub>
            <Paragraf>Semua tindakan tercatat di <strong>Jejak Aktivitas</strong> siswa itu, lengkap dengan nama pengawas dan jamnya.</Paragraf>
            <Tabel kolom={["Tombol", "Kapan dipakai", "Jawaban"]} baris={[
              ["Reset Login", "Siswa pindah komputer, atau layarnya berkata “Ujian Terbuka di Perangkat Lain”. Pengerjaan terikat ke komputer pertama yang membukanya; tombol ini melepas ikatan itu", "Tetap"],
              ["Buka Kunci", "Status Terkunci — siswa melanjutkan dari sisa waktunya", "Tetap"],
              ["Kunci Sekarang", "Menghentikan sementara, misalnya dugaan kecurangan, sampai dibuka lagi", "Tetap"],
              ["Tambah waktu", <>Isi jumlah menit lalu <Ui>Tambahkan</Ui> — hanya untuk siswa itu</>, "Tetap"],
              ["Reset Waktu", "Sisa waktu kembali ke durasi penuh (komputer rusak lama di awal ujian)", "Tetap"],
              ["Buka Kembali", "Siswa salah pencet Kumpulkan. Status kembali Mengerjakan, dengan sisa waktu minimal sesuai isian menit", "Tetap"],
              ["Kumpulkan Paksa", "Menutup dan menilai jawaban yang sudah tersimpan sekarang", "Dinilai"],
              ["Ulang dari Awal", "Siswa harus mengulang dari nol", <strong key="h" className="text-red-600">Dihapus permanen</strong>],
            ]} />

            <Sub>Tindakan satu kelas (Ruang Kendali)</Sub>
            <Butir daftar={[
              <><Ui>Buka yang terputus +15m</Ui> — setelah listrik atau jaringan pulih; semua yang terputus, waktu habis, atau terkunci diberi waktu lagi.</>,
              <><Ui>Tambah 15 menit untuk semua</Ui> — misalnya ujian mulai terlambat.</>,
              <><Ui>Buka … yang terkunci</Ui> — muncul kalau ada yang terkunci.</>,
              <><Ui>Kumpulkan semua sekarang</Ui> — menutup serentak semua yang belum mengumpulkan.</>,
            ]} />
            <Alert variant="warning" icon={AlertTriangle} title="Ada soal yang salah ketik saat ujian berjalan?">
              Begitu ada siswa yang mengerjakan, susunan soal terkunci, tetapi isinya masih bisa diperbaiki lewat tombol <strong>pensil oranye</strong> di daftar soal: teks, gambar, kunci, dan skor. Siswa yang sedang mengerjakan menerima soal terbaru dengan pemberitahuan “Pengawas baru saja memperbaiki soal”; kalau kunci atau skor berubah, semua yang sudah mengumpulkan dinilai ulang otomatis. Yang tidak bisa diubah: jenis soal dan jumlah pilihan.
            </Alert>
          </>)}

          {/* ============================ 5. SISWA ============================ */}
          {bab("siswa", <>
            <Paragraf>Versi khusus siswa ada di Portal Peserta (tautan <strong>Panduan Peserta</strong> di Beranda Peserta). Bagian ini untuk dibacakan pengawas sebelum ujian.</Paragraf>
            <Langkah daftar={LANGKAH_SISWA} />
            <div className="grid gap-4 xl:grid-cols-2">
              <Gambar src="s-beranda.jpg" alt="Beranda Peserta Ujian" keterangan={<><strong>Beranda Peserta.</strong> Identitas siswa, kartu ujian hari ini, dan riwayat. Identitas disamarkan.</>} />
              <Gambar src="s-konfirmasi.jpg" alt="Halaman Konfirmasi dan Petunjuk Ujian" keterangan={<><strong>Konfirmasi & Petunjuk.</strong> Rincian soal per jenis, petunjuk, token, dan pernyataan kesanggupan.</>} />
            </div>
            <Sub>Isi layar ujian</Sub>
            <Gambar src="s-mengerjakan.jpg" alt="Layar pengerjaan ujian"
              keterangan={<><strong>Layar pengerjaan.</strong> Bilah atas: judul, jumlah terjawab, status simpan, ukuran huruf, alat bantu, layar penuh, dan sisa waktu. Peta nomor di samping. Watermark identitas disembunyikan pada gambar ini.</>} />
            <Tabel kolom={["Bagian layar", "Yang perlu diketahui siswa"]} baris={LAYAR_UJIAN.map(([a, b]) => [a, b])} />
            <Sub>Cara menjawab tiap jenis soal</Sub>
            <Butir daftar={CARA_MENJAWAB} />
            <Alert variant="error" icon={ShieldAlert} title="Yang tercatat dan terlihat pengawas">
              Pindah tab atau jendela, keluar dari layar penuh, menyalin teks, dan Print Screen dicatat beserta jamnya. Ujian tidak berhenti karenanya, tetapi siswa langsung melihat peringatan dan pengawas melihat jumlahnya di Papan Pantau.
            </Alert>
            <Alert variant="info" icon={LifeBuoy} title="Kalau terjadi gangguan">
              <ul className="space-y-0.5 mt-1">{GANGGUAN.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Alert>
          </>)}

          {/* ============================ 6. HASIL ============================ */}
          {bab("hasil", <>
            <Paragraf>Soal objektif dinilai otomatis saat siswa mengumpulkan. Selama masih ada Uraian atau Unggah Berkas yang belum dikoreksi, nilainya berlabel <strong>sementara</strong>.</Paragraf>
            <Langkah daftar={[
              { judul: "Koreksi uraian", isi: <>Tab <Ui>Koreksi Uraian</Ui> menampilkan jawaban per siswa per soal, lengkap dengan jawaban acuan & pedoman penskoran. Isi skor (kelipatan 0,5, maksimum sesuai skor soal) lalu <Ui>Simpan</Ui>. Untuk Unggah Berkas, buka berkas jawaban dari tautannya. Nilai dihitung ulang otomatis.</> },
              { judul: "Baca hasil", isi: <>Tab <Ui>Hasil & Analisis</Ui>: jumlah selesai, rerata, tertinggi, terendah, dan yang menunggu koreksi, disusul rekap nilai per siswa.</> },
              { judul: "Unduh Excel", isi: <><Ui>Unduh Excel</Ui> berisi lima lembar: Rekap Nilai, Skor per Butir, Analisis Butir, Analisis Pengecoh, dan Waktu per Soal — dengan kolom Kelas untuk ujian banyak kelas.</> },
            ]} />
            <Gambar src="g-hasil.jpg" alt="Tab Hasil dan Analisis" keterangan={<><strong>Halaman ujian › Hasil & Analisis.</strong> Nama pada gambar disamarkan.</>} />
            <Sub>Membaca analisis butir</Sub>
            <Tabel kolom={["Ukuran", "Cara dihitung", "Kategori"]} baris={[
              ["Tingkat kesukaran", "Proporsi skor benar dari peserta yang menerima soal itu", "≥ 0,70 Mudah · 0,30–0,69 Sedang · < 0,30 Sukar"],
              ["Daya beda", "Proporsi benar kelompok atas 27% dikurangi kelompok bawah 27%", "≥ 0,40 Baik · 0,20–0,39 Cukup · 0–0,19 Lemah · negatif Terbalik"],
              ["Pengecoh", "Persentase peserta yang memilih tiap opsi salah", "Tidak berfungsi kalau dipilih kurang dari 5% peserta — sebaiknya diganti"],
              ["Waktu & ganti jawaban", "Rata-rata lama di soal dan berapa kali jawaban diganti", "Ganti jawaban tinggi = banyak siswa ragu atau menebak"],
            ]} />
            <Alert variant="info" icon={Info} title="Daya beda “Terbalik”">
              Siswa yang nilainya tinggi justru banyak salah di soal itu. Hampir selalu tanda kunci salah atau soal membingungkan — periksa kuncinya; perbaikan kunci lewat pensil oranye langsung menilai ulang semua pengerjaan.
            </Alert>
          </>)}

          {/* ============================ ARSIP ============================ */}
          {bab("arsip", <>
            <Paragraf>Buka <Jalur bagian={["Pusat Ujian", "Cadangan & Hapus Data"]} />. Panel paling atas menampilkan <strong>nama ujian yang sedang berlangsung</strong> beserta jumlah peserta aktif — ujian itu dikunci dari penghapusan sampai selesai.</Paragraf>
            <Tabel kolom={["Pilihan", "Isi / akibat"]} baris={[
              ["Cadangan Lengkap (.json)", "Semua isi apa adanya: bank soal, wacana, pengaturan, soal + kunci, jawaban siswa. Simpan sebelum menghapus atau berganti tahun ajaran"],
              ["Arsip Terbaca (.xlsx)", "Daftar Ujian, Soal & Kunci, Nilai Siswa, Bank Soal — untuk arsip TU, tidak bisa dimasukkan kembali"],
              ["Hapus hasil (ikon putar)", "Semua pengerjaan satu ujian dihapus; soal & pengaturan tetap, ujian bisa diulang"],
              ["Hapus ujian", "Satu ujian beserta soal & pengerjaannya"],
              ["Hapus Ujian Lama", "Ujian yang sudah tutup lebih dari sekian hari"],
              ["Hapus Semua Data Ujian", "Khusus Admin, wajib mengetik “HAPUS SEMUA DATA UJIAN”"],
            ]} />
          </>)}

          {/* ============================ MASALAH ============================ */}
          {bab("masalah", <>
            <Tabel kolom={["Gejala", "Penyebab", "Solusi"]} baris={[
              ["Siswa tidak melihat kartu ujian", "Ujian masih Draft · belum hari pelaksanaan · kelasnya tidak dicentang sebagai peserta · akun belum terhubung ke kelas", "Terbitkan ujian; periksa tanggal dan Kelas peserta; hubungi TU untuk data kelas siswa"],
              ["Tombol Ikuti Ujian tidak aktif", "Belum jam buka", "Tunggu jam buka, atau majukan jam Mulai"],
              ["“Token sudah berganti”", "Token berganti otomatis atau diganti pengawas", "Umumkan token terbaru dari Ruang Kendali"],
              ["“Token itu milik ujian yang lain”", "Token ujian mapel lain diketik di kartu ujian yang salah", "Periksa kartu ujian dan tokennya"],
              ["“Hanya bisa dibuka lewat browser ujian sekolah”", "Ujian memakai Examkey", "Buka lewat browser ujian sekolah, atau kosongkan Examkey"],
              ["“Ujian Terbuka di Perangkat Lain”", "Siswa pindah komputer", "Pengawas: Reset Login"],
              ["Satu kelas terputus serentak", "Jaringan / listrik lab", "Setelah pulih, Ruang Kendali › Buka yang terputus +15m"],
              ["Siswa salah pencet Kumpulkan", "—", "Pengawas: Buka Kembali"],
              ["Kunci dari Excel ditolak “bukan mata pelajaran ujian ini”", "Kode Test di Excel berisi mapel lain — berkas tertukar", "Buka berkas yang benar, atau perbaiki Kode Test menjadi nama mapel ujian"],
              ["“Kunci tidak bisa diubah lagi”", "Sudah ada siswa yang mengerjakan", "Perbaiki per soal lewat pensil oranye (live)"],
              ["Guru tidak bisa mencentang kelas tertentu", "Kelas itu tidak tercatat ia ampu di Penugasan Mengajar", "Perbaiki Penugasan Mengajar, atau minta Admin/Kurikulum membuat ujian bersama"],
              ["Guru tidak bisa mengubah soal ujian", "Ia guru pengampu, bukan pembuat ujian", "Minta guru pembuat atau Admin/Kurikulum"],
              ["Nilai tertulis “sementara”", "Masih ada Uraian/Unggah yang belum dikoreksi", "Tab Koreksi Uraian"],
              ["Siswa tidak melihat nilainya", "“Siswa boleh melihat nilainya” tidak dicentang", "Centang di Pengamanan kalau nilai memang boleh diumumkan"],
            ]} />
            <p className="text-xs text-gray-400">Gambar diambil dari sistem memakai ujian contoh “CONTOH — Ujian Semua Jenis Soal”; semua nama, NIS, dan NISN disamarkan.</p>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ============================== halaman siswa ============================== */

/** Panduan versi peserta — dirender di dalam kulit Portal Peserta (kartu putih di atas latar krem). */
export function PanduanPeserta() {
  const kartu = "rounded-2xl border border-primary-100 bg-white shadow-sm p-5 space-y-3";
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary-100 bg-white shadow-lg p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading font-bold text-gray-800 flex items-center gap-2"><BookOpen size={18} className="text-gold-dark" /> Langkah mengikuti ujian</p>
          <Link href="/ujian-online" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary-700">
            <ArrowLeft size={14} /> Beranda Peserta
          </Link>
        </div>
        <Langkah daftar={LANGKAH_SISWA} />
      </div>

      <div className={kartu}>
        <p className="font-heading font-bold text-gray-800">Isi layar ujian</p>
        <Gambar src="s-mengerjakan.jpg" alt="Contoh layar pengerjaan ujian"
          keterangan="Contoh layar pengerjaan: sisa waktu di kanan atas, nomor soal di samping, tombol ragu-ragu dan berikutnya di bawah soal." />
        <div className="divide-y divide-gray-100">
          {LAYAR_UJIAN.map(([judul, isi]) => (
            <div key={judul} className="py-2.5 grid gap-1 sm:grid-cols-[150px_1fr] sm:gap-4">
              <p className="text-sm font-semibold text-gray-800">{judul}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{isi}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={kartu}>
        <p className="font-heading font-bold text-gray-800">Cara menjawab tiap jenis soal</p>
        <Butir daftar={CARA_MENJAWAB} />
      </div>

      <Alert variant="error" icon={ShieldAlert} title="Yang tercatat dan terlihat pengawas">
        Pindah tab atau jendela, keluar dari layar penuh, menyalin teks, dan Print Screen dicatat beserta jamnya. Ujian tidak berhenti, tetapi Anda langsung melihat peringatan dan pengawas melihat jumlahnya.
      </Alert>

      <Alert variant="info" icon={LifeBuoy} title="Kalau terjadi gangguan">
        <ul className="space-y-1 mt-1">{GANGGUAN.map((g, i) => <li key={i}>{g}</li>)}</ul>
      </Alert>

      <div className={kartu}>
        <p className="font-heading font-bold text-gray-800 flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600" /> Setelah mengumpulkan</p>
        <Butir daftar={[
          "Layar kembali ke Beranda Peserta dengan tanda “Ujian berhasil dikumpulkan”.",
          "Ujian tercatat di bagian Ujian yang Sudah Selesai.",
          "Nilai hanya tampil kalau guru mengizinkan. Kalau ada soal uraian yang belum dikoreksi, nilainya ditandai sementara.",
        ]} />
      </div>
    </div>
  );
}
