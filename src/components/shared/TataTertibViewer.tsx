"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

function Pasal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="font-heading font-bold text-primary-900 text-sm mb-2">{title}</h4>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
function Bab({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 break-inside-avoid-page">
      <h3 className="font-heading font-bold text-primary-900 text-base mb-1">{no}</h3>
      <h3 className="font-heading font-bold text-primary-800 text-sm uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </section>
  );
}
function Ol({ items }: { items: React.ReactNode[] }) {
  return <ol className="list-decimal list-outside pl-5 space-y-1.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ol>;
}

/** Isi lengkap SK Tata Tertib Peserta Didik SMK Al Munawwir IIBS TP 2026/2027 — ditranskrip dari
 * dokumen resmi (upload BK 2026-08-10), ditampilkan read-only. Bisa diakses SEMUA warga sekolah
 * (Admin/Guru/TAS/Siswa) — dipakai bareng 3 portal (pola manager lintas portal, no.14 CLAUDE.md).
 * Tabel poin (Lampiran I & II) yang bisa dikelola & dijadikan basis catatan ada di halaman
 * terpisah "Poin Siswa" — ini murni teks aturan lengkapnya utk dibaca. */
export default function TataTertibViewer({ backHref }: { backHref: string }) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  useEffect(() => {
    fetch("/api/settings/logos").then(r => r.json()).then(d => setLogoUrl(d.fullWhite)).catch(() => {});
  }, []);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<BookOpenCheck size={22} />} title="Tata Tertib Peserta Didik" description="SMK Al Munawwir IIBS — Tahun Pelajaran 2026/2027" printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href={backHref} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"><ArrowLeft size={18} /></Link>
        <PrintButton />
      </div>

      <div className="print-doc max-w-3xl mx-auto px-6 py-8 print:p-6 print:max-w-none bg-white rounded-2xl border border-gray-100 shadow-sm print:border-0 print:shadow-none">
        <PrintKop title="Tata Tertib Peserta Didik" subtitle="SMK Al Munawwir IIBS — Tahun Pelajaran 2026/2027" logoUrl={logoUrl} />

        <Bab no="BAB I" title="Ketentuan Umum">
          <Pasal title="Pasal 1 — Pengertian">
            <Ol items={[
              "Tata tertib peserta didik adalah ketentuan-ketentuan yang bersifat mengikat dalam mengatur tata kehidupan peserta didik selama sekolah di Al Munawwir IIBS.",
              "Peserta didik adalah anggota masyarakat yang terdaftar secara administratif di Al Munawwir IIBS, dalam upayanya mengembangkan potensi diri melalui proses KBM yang tersedia.",
              "KBM adalah proses interaksi peserta didik dengan pendidik dan sumber belajar pada lingkungan belajar Al Munawwir IIBS.",
              "Pelanggaran tata tertib adalah setiap ucapan, perbuatan dan/atau sikap peserta didik yang bertentangan dengan tata tertib sekolah.",
              "Poin pelanggaran adalah angka kuantitatif yang diberikan sekolah kepada peserta didik sebagai konsekuensi pelanggaran, sekaligus pedoman: (1) penilaian kepribadian; (2) bentuk pembinaan; dan/atau (3) sanksi.",
              "Sanksi adalah tindakan yang dikenakan terhadap peserta didik yang melakukan pelanggaran tata tertib.",
              "Poin prestasi adalah angka kuantitatif sebagai bentuk penghargaan atas prestasi peserta didik sesuai ketentuan sekolah, digunakan untuk keringanan/pengurangan jumlah poin pelanggaran.",
              "Remisi adalah keringanan/pengurangan jumlah poin pelanggaran, hanya bisa diberikan Kepala Sekolah melalui forum rapat dengan Guru BK dan pihak terkait, sekali dalam satu tahun ajaran.",
            ]} />
          </Pasal>
          <Pasal title="Pasal 2 — Landasan, Maksud dan Tujuan">
            <Ol items={[
              "Landasan tata tertib ini adalah Pancasila; Undang-Undang 1945; dan UU RI No. 20 Tahun 2003 tentang Sistem Pendidikan Nasional.",
              "Maksud tata tertib peserta didik adalah memberikan pedoman dalam pembinaan karakter kepribadian dan kedisiplinan peserta didik.",
              "Tujuan tata tertib peserta didik adalah mengatur dan memperlancar usaha pembinaan peserta didik dalam bersikap dan berperilaku sehari-hari, baik di dalam maupun di luar sekolah.",
            ]} />
          </Pasal>
        </Bab>

        <Bab no="BAB II" title="Hak dan Kewajiban Peserta Didik">
          <Pasal title="Pasal 1 — Hak Peserta Didik">
            <Ol items={[
              "Mendapatkan pelayanan akademik sebaik-baiknya sesuai Kompetensi Keahlian yang dipilih dalam proses KBM.",
              "Mendapatkan kesempatan pengembangan kepribadian melalui kegiatan yang difasilitasi sekolah (Bimbingan & Konseling; keorganisasian; ekstrakurikuler), dengan pendampingan pendidik.",
              "Mendapatkan layanan kesehatan dan kesejahteraan sesuai peraturan dan perundang-undangan yang berlaku.",
              "Mendapatkan pengembangan bidang Pribadi, Sosial, Belajar, dan Karir melalui layanan Bimbingan & Konseling.",
              "Mendapatkan informasi dan pengarahan tentang Dunia Usaha/Dunia Industri (DU/DI) dan pendidikan lanjutan melalui Prakerin dan layanan BKK.",
            ]} />
          </Pasal>
          <Pasal title="Pasal 2 — Kewajiban Peserta Didik">
            <Ol items={[
              "Menaati aturan syariat agama Islam.",
              "Beribadah dan mengamalkan agama yang diikuti dengan sebaik-baiknya.",
              "Memahami, menghayati dan mengamalkan Pancasila serta mentaati semua ketentuan hukum yang berlaku di Republik Indonesia.",
              "Menaati seluruh tata tertib sekolah.",
            ]} />
          </Pasal>
        </Bab>

        <Bab no="BAB III" title="Penjabaran Tata Tertib Peserta Didik">
          <Pasal title="Pasal 1 — Masuk Sekolah">
            <Ol items={[
              "Semua peserta didik harus hadir sebelum bel masuk (06:45 WIB); yang hadir setelahnya dianggap terlambat.",
              <>Kegiatan KBM diawali dengan: (a) upacara bendera (Senin 06:45); (b) Sholat Dluha, Doa Asmaul Husna, lagu Indonesia Raya, dan jargon semangat pagi (Selasa–Sabtu 06:45).</>,
              "Peserta didik terlambat tidak boleh masuk kelas sebelum izin guru piket/guru, dikenai poin pelanggaran, boleh ikut pelajaran jika mendapat kartu izin masuk dari guru piket.",
              "Peserta didik tidak boleh meninggalkan KBM sebelum izin guru pengajar dan guru piket.",
              <>Izin: orang tua meminta izin langsung (bisa telepon) ke wali kelas; surat izin sah bila ditandatangani orang tua/wali (sesuai contoh tanda tangan di tatib), kalau tidak dianggap Alpa; izin saat KBM berlangsung dgn izin guru piket dianggap masuk; urusan luar sekolah wajib dikerjakan di luar jam/hari sekolah.</>,
              <>Sakit: tidak masuk 3 hari wajib Surat Keterangan Dokter (kalau tidak ada, surat sakit ortu + konfirmasi wali kelas/BK hari itu juga, berlaku 3 hari); sakit tanpa surat sah dianggap Alpa; Alpa yang ternyata terbukti sakit (surat sah/keterangan pendidik) dinyatakan tidak hadir karena sakit; terbukti tidak sakit tetap dianggap Alpa; surat sakit boleh disusulkan hari berikutnya kalau ada halangan.</>,
              "Alpa/Tanpa Keterangan: tidak masuk tanpa keterangan atau membolos saat KBM berlangsung dianggap Alpa.",
              "Setelah KBM & sholat Dzuhur, peserta didik harus segera pulang. Toleransi masih di lingkungan sekolah maksimal 15 menit setelah bel pulang, kecuali ada tugas tambahan/ekstrakurikuler/pendalaman materi.",
            ]} />
          </Pasal>
          <Pasal title="Pasal 2 — Penampilan Peserta Didik">
            <Ol items={[
              <>Berpenampilan bersih, rapi, sesuai peraturan: rambut tidak dicat/disemir (laki-laki potong rapi &amp; pendek, tidak botak/mohak/skin-head/berkuncir, tidak menutupi kuping/alis/kerah; perempuan rapi, tidak disambung/dicat); tidak bertato (termasuk temporer/stiker); perempuan tidak bertindik lebih dari 1, laki-laki tidak bertindik; tidak berperhiasan berlebihan (perempuan)/berperhiasan (laki-laki, gelang/kalung); tidak memakai make up (kecuali bedak tipis utk perempuan); tidak berkuteks; tidak berkuku panjang; tidak mencukur alis.</>,
              <>Seragam sesuai jadwal: Senin &amp; Selasa Putih Berjas + celana/rok Putih; Rabu &amp; Kamis Almamater; Jumat &amp; Sabtu Pramuka — berlaku kelas X, XI, XII. Seragam olahraga cuma dipakai saat kegiatan olahraga sekolah. Baju wajib sopan (tidak ketat/tembus pandang), atribut lengkap (OSIS/Pramuka, lambang jurusan), dimasukkan (kecuali baju muslim/Pramuka perempuan), atribut tingkatan kelas (X=1 padi, XI=2 padi, XII=3 padi), bawahan tidak diubah jahitannya, ikat pinggang berlogo sekolah, peci hitam sekolah, kaos kaki hitam, dasi berlogo sekolah, kerudung berlogo & sesuai warna seragam.</>,
            ]} />
          </Pasal>
          <Pasal title="Pasal 3 — Etika Pergaulan Peserta Didik">
            <Ol items={[
              "Mengucap salam & bersalaman dengan sesama teman, Kepala Sekolah, guru, karyawan terutama di area sekolah.",
              "Saling menghormati, menghargai perbedaan teman belajar/bermain/bergaul, agama, dan latar belakang sosial budaya.",
              "Menghormati ide, pikiran, pendapat, hak cipta, dan milik orang lain/warga sekolah.",
              "Berani menyampaikan yang salah adalah salah, yang benar adalah benar.",
              "Menyampaikan pendapat secara sopan tanpa menyinggung perasaan orang lain.",
              "Mengucapkan terima kasih atas bantuan/jasa orang lain.",
              "Berani mengakui kesalahan dan meminta maaf bila melanggar hak/berbuat salah pada orang lain.",
              "Menggunakan bahasa sopan & beradab, membedakan lawan bicara lebih tua/sebaya, tidak berkata kotor/kasar/mencaci/berbau pornografi.",
            ]} />
          </Pasal>
          <Pasal title="Pasal 4 — Kegiatan Keagamaan dan Upacara Bendera">
            <Ol items={[
              "Bagi yang muslim: mampu membaca Al-Qur'an dengan baik dan benar; wajib ikut tadarus, pengajian, dan kegiatan keagamaan lain yang diadakan sekolah.",
              "Wajib mengikuti perayaan keagamaan dan hari besar umum yang diselenggarakan sekolah.",
              "Wajib mengikuti sholat duha tiap pagi, Kajian Kitab Akhlaq (Rabu pagi) oleh Pengasuh Pesantren Manbaul Falah.",
              "Wajib mengikuti upacara bendera tiap Senin pagi dengan seragam sesuai ketentuan.",
              "Wajib mengikuti upacara hari besar lainnya sesuai jadwal & ketetapan sekolah.",
            ]} />
          </Pasal>
          <Pasal title="Pasal 5 — Kebersihan, Kedisiplinan dan Ketertiban">
            <Ol items={[
              "Tiap kelas dibentuk tim piket kelas bergiliran menjaga kebersihan & ketertiban kelas.",
              "Tim piket menyiapkan & memelihara perlengkapan kelas: penghapus/penggaris/spidol; taplak meja & vas bunga; sapu/pengki/tempat sampah; lap tangan/alat pel/ember.",
              <>Tugas tim piket: membersihkan lantai/dinding, merapikan bangku/meja sebelum jam pertama/setelah pulang sekolah sehari sebelumnya; menyiapkan sarana pembelajaran; melengkapi hiasan dinding kelas (bagan struktur, jadwal piket, papan absensi, dll); melengkapi meja guru dengan taplak & bunga; melapor guru piket soal pelanggaran kebersihan/ketertiban kelas.</>,
              "Menjaga kebersihan toilet, halaman, kebun, dan lingkungan sekolah lainnya.",
              "Membuang sampah pada tempatnya.",
              "Berbudaya antri dalam kegiatan sekolah maupun luar sekolah bersama-sama.",
              "Menjaga ketenangan belajar di kelas, perpustakaan, laboratorium, ruang komputer, maupun tempat lain.",
              "Mentaati jadwal kegiatan sekolah: peminjaman buku perpustakaan, penggunaan laboratorium, sumber belajar lainnya.",
              "Menyelesaikan tugas sekolah sesuai ketentuan.",
            ]} />
          </Pasal>
        </Bab>

        <Bab no="BAB IV" title="Pelanggaran, Sanksi, Penyitaan, Pembinaan Terhadap Pelanggaran Tata Tertib">
          <Pasal title="Pasal 1 — Pelanggaran">
            <Ol items={[
              "Setiap pelanggaran yang dilakukan siswa akan mendapat sanksi berupa poin dan pembinaan dari pembina.",
              "Jenis pelanggaran lebih lanjut ada di menu \"Poin Siswa\" (Tabel Poin Pelanggaran Peserta Didik).",
            ]} />
          </Pasal>
          <Pasal title="Pasal 2 — Sanksi">
            <Ol items={[
              "Sanksi diberikan kepada peserta didik yang melakukan pelanggaran.",
              "Sanksi diberikan untuk membentuk peserta didik yang lebih berkarakter dan memberi efek jera.",
              "Sanksi diberikan dalam bentuk pembentukan sikap, kebugaran, dan poin pelanggaran.",
              "Jenis sanksi lebih lanjut ada di menu \"Poin Siswa\".",
            ]} />
          </Pasal>
          <Pasal title="Pasal 3 — Penyitaan">
            <Ol items={[
              "Sekolah berhak melakukan razia dan menyita barang milik peserta didik untuk tujuan pembinaan sesuai ketentuan.",
              "Mekanisme dan waktu razia/penyitaan sepenuhnya wewenang sekolah, sesuai situasi & kondisi.",
              "Barang yang dirazia/disita: (1) senjata tajam & barang membahayakan; (2) minuman keras; (3) narkoba/NAPZA; (4) rokok; (5) pornografi; (6) barang lain yang penggunaannya melanggar hukum/ketentuan sekolah.",
              <>Barang sitaan TANPA unsur senjata tajam/miras/narkoba/rokok/pornografi: sekali pelanggaran diambil ortu hari berikutnya; dua kali setelah 1 minggu; tiga kali setelah 1 bulan; empat kali setelah 1 semester; lima kali setelah 1 tahun/lulus. Unsur pornografi di HP/laptop/elektronik disita minimal 1 semester, dikembalikan setelah unsur dihilangkan (pengambilan wajib orang tua); unsur pornografi non-elektronik langsung dimusnahkan.</>,
              "Barang sitaan senjata tajam/miras/narkoba/rokok ditangani melalui kebijakan sekolah.",
              "Penyimpanan: barang elektronik disimpan di tempat yang ditentukan sekolah; kerusakan barang sitaan setelah disita jadi tanggung jawab peserta didik bersangkutan.",
            ]} />
          </Pasal>
        </Bab>

        <Bab no="BAB V" title="Remisi Poin Pelanggaran">
          <Ol items={[
            "Kepala Sekolah memberikan remisi atas usulan Wakil Kesiswaan dan Guru BK selaku pembimbing karakter peserta didik.",
            "Peserta didik yang telah mendapat peringatan pertama, kedua, dan ketiga, menunjukkan perubahan sikap/perilaku dan tidak melanggar sama sekali berhak mendapat remisi atas usulan wali kelas, Guru BK, atau Wakil Bag. Kesiswaan.",
            "Remisi tidak berlaku bagi peserta didik pada jenjang peringatan terakhir/dikembalikan pada orang tua.",
            "Remisi diberikan dengan ketentuan diatur kemudian oleh sekolah.",
          ]} />
        </Bab>

        <Bab no="BAB VI" title="Poin Prestasi">
          <Ol items={[
            "Peserta didik yang berprestasi diberikan penghargaan oleh sekolah.",
            <>Jenis prestasi yang diberikan penghargaan: (a) Akademik peringkat 1–3 di tiap rombel; (b) Non-akademik: olahraga/seni minimal juara tingkat sekolah, aktivis kelembagaan pelajar, peserta didik yang berjasa bagi sekolah.</>,
            "Penerima penghargaan ditetapkan Kepala Sekolah berdasarkan usulan pendidik/tenaga kependidikan.",
            "Bentuk & besaran penghargaan ditentukan sesuai kebijakan Kepala Sekolah.",
            "Besaran poin prestasi lebih lanjut ada di menu \"Poin Siswa\" (Tabel Poin Prestasi Peserta Didik).",
          ]} />
        </Bab>

        <Bab no="BAB VII" title="Mekanisme Penilaian Poin Peserta Didik">
          <Ol items={[
            "Poin-poin peserta didik dicatat dalam buku Penilaian Karakter Peserta Didik.",
            "Akumulasi maksimal poin pelanggaran setiap tahun ajaran adalah 100 (seratus) poin.",
            "Pencatatan pelanggaran (penambahan poin) dan prestasi (pengurangan poin) dilaksanakan tiap hari untuk masing-masing kejadian.",
            <>Pihak berwenang (supervisor) mengisi Penilaian Karakter Peserta Didik: Kepala Sekolah, Wakil Kepala Sekolah, Guru BK, Wali Kelas, Guru Mata Pelajaran, Guru Pembina/Pelatih Ekstrakurikuler, Guru Piket.</>,
            "Buku tersedia di meja Guru Piket selama KBM, pengawasan jadi tanggung jawab Guru Piket. Selesai KBM disimpan & ditata di ruang BK — Guru BK bertanggung jawab membuat rekap mingguan poin.",
            "Supervisor mengisi buku di hadapan siswa bersangkutan untuk ditandatangani bersama, lalu disimpan kembali.",
            "Jika poin pelanggaran mencapai 100 sebelum/di akhir tahun ajaran, peserta didik dikembalikan pada orang tua.",
            <>Mekanisme sanksi sistem poin: <strong>&lt;25</strong> — pembinaan & pemanggilan siswa oleh Guru BK + surat pemberitahuan ortu; <strong>26–50</strong> — pembinaan & pemanggilan siswa+ortu oleh Guru BK & Wakil Kesiswaan, Surat Peringatan 1; <strong>51–75</strong> — sda + skorsing 1 hari/wajib lapor 1 minggu ke Guru BK, Surat Peringatan 2; <strong>76–99</strong> — sda + skorsing 3 hari/wajib lapor 2 minggu ke Guru BK diketahui Wakil Kesiswaan, Surat Peringatan 3 + pernyataan pengembalian ke ortu tertulis di atas materai Rp10.000; <strong>100 ke atas</strong> — dikembalikan kepada orang tua.</>,
            "Poin tiap semester disampaikan Guru BK kepada Wali Kelas sebagai bahan pertimbangan nilai kepribadian peserta didik/tenaga kependidikan.",
          ]} />
        </Bab>

        <Bab no="BAB VIII" title="Lain-Lain">
          <Ol items={[
            "Dengan bukti tanda tangan pada tata tertib ini, semua pihak terkait menyatakan telah (1) membaca, (2) memahami, dan (3) menyatakan diri mematuhi setiap peraturan (lengkap dengan lampiran poin pelanggaran & prestasi).",
            "Hal-hal yang belum tercantum, khususnya sanksi, remisi, dan reward (prestasi), akan diatur tersendiri sesuai kebijakan sekolah.",
            "Tata tertib ini berlaku sejak diumumkan.",
          ]} />
        </Bab>

        <div className="mt-10 text-sm text-gray-700">
          <p className="mb-6">Singojuruh, 08 Juli 2026</p>
          <p className="mb-8 font-semibold">Mengetahui,</p>
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <p className="mb-16">Kepala<br />SMK Al Munawwir IIBS</p>
              <p className="font-bold underline">Ahmad Azmi Khoirul Umam, S.Pd.I., M.Pt., M.Sc.</p>
            </div>
            <div>
              <p className="mb-16">Wakil Kepala<br />Bid. Kesiswaan</p>
              <p className="font-bold underline">Miftahul Huda, S.Pd., Gr.</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-10 italic print:hidden">
          Tabel Lampiran I (Poin Pelanggaran) & Lampiran II (Poin Prestasi) beserta rincian poinnya tersedia interaktif di menu &quot;Poin Siswa&quot;.
        </p>
      </div>
    </div>
  );
}
