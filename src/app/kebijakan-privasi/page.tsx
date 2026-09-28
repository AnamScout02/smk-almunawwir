export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ShieldCheck, Mail, Phone, MapPin } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang, type Lang } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — SMK Al Munawwir IIBS",
  description: "Cara SMK Al Munawwir IIBS mengumpulkan, menggunakan, dan melindungi data pribadi.",
};

/** Paragraf = string, daftar berbutir = string[]. Halaman ini juga menjadi tautan kebijakan privasi
 * aplikasi Google "SMK Cadangan" (akses Google Drive untuk salinan cadangan) — bagian "Layanan
 * Google" wajib tetap ada selama aplikasi itu dipakai. */
type Blok = { judul: string; isi: (string | string[])[] };
type Isi = {
  label: string; judul: string; berlaku: string; kontakJudul: string;
  kontak: { email: string; telepon: string; alamat: string }; blok: Blok[];
};

const content: Record<Lang, Isi> = {
  id: {
    label: "Pelindungan Data Pribadi",
    judul: "Kebijakan Privasi",
    berlaku: "Berlaku sejak 14 September 2026",
    kontakJudul: "Hubungi Kami",
    kontak: { email: "Email", telepon: "Telepon", alamat: "Alamat" },
    blok: [
      {
        judul: "Tentang kebijakan ini",
        isi: [
          "Kebijakan ini menjelaskan bagaimana SMK Al Munawwir IIBS (\"sekolah\", \"kami\") mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi melalui situs web dan sistem informasi akademik sekolah, sejalan dengan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
        ],
      },
      {
        judul: "Data yang kami kumpulkan",
        isi: [[
          "Pendaftaran peserta didik baru: data calon siswa dan orang tua/wali yang diisi pada formulir pendaftaran.",
          "Pesan kontak dan buku tamu: data yang Anda isi, seperti nama, nomor kontak, dan isi pesan atau keperluan kunjungan.",
          "Tracer study alumni: data kontak dan kegiatan setelah lulus yang diisi oleh alumni.",
          "Akun sistem akademik (guru, tenaga kependidikan, siswa, dan orang tua/wali): identitas, data kepegawaian atau kesiswaan, nilai, kehadiran, dan data akademik lain yang diperlukan.",
          "Ujian online: jawaban, waktu pengerjaan, penanda perangkat ujian, dan catatan pelanggaran tata tertib ujian.",
          "Data teknis keamanan: alamat IP, jenis perangkat dan browser, serta waktu masuk dan aktivitas akun.",
        ]],
      },
      {
        judul: "Cara kami menggunakan data",
        isi: [[
          "Menyelenggarakan pendidikan dan administrasi sekolah: penerimaan siswa, pembelajaran, penilaian, rapor, dan ujian.",
          "Berkomunikasi dengan siswa, orang tua/wali, alumni, dan masyarakat.",
          "Menjaga keamanan akun dan mencegah penyalahgunaan sistem.",
          "Memenuhi kewajiban pelaporan kepada instansi pendidikan yang berwenang.",
        ]],
      },
      {
        judul: "Cookie dan penyimpanan di browser",
        isi: [
          "Kami hanya memakai cookie yang diperlukan agar situs berfungsi: menjaga Anda tetap masuk ke akun, verifikasi dua langkah untuk akun tertentu, dan mengingat pilihan bahasa. Halaman ujian online menyimpan penanda perangkat di penyimpanan lokal browser agar satu akun tidak dikerjakan dari beberapa perangkat sekaligus.",
          "Kami tidak memakai cookie iklan maupun alat pelacak pihak ketiga.",
        ],
      },
      {
        judul: "Pembagian data",
        isi: [
          "Kami tidak menjual atau menyewakan data pribadi. Data hanya dibagikan kepada:",
          [
            "instansi pemerintah di bidang pendidikan, sesuai kewajiban hukum;",
            "penyedia layanan teknis yang membantu mengoperasikan sistem (misalnya penyimpanan salinan cadangan), terbatas pada keperluan tersebut;",
            "pihak lain apabila diwajibkan oleh peraturan perundang-undangan.",
          ],
        ],
      },
      {
        judul: "Penggunaan layanan Google",
        isi: [
          "Sistem sekolah memakai akses Google Drive (aplikasi \"SMK Cadangan\") hanya untuk menyimpan salinan cadangan data sistem ke Google Drive milik sekolah sendiri. Akses tersebut tidak dipakai untuk membaca, mengubah, atau membagikan berkas lain, dan kami tidak meminta maupun mengumpulkan data akun Google milik pengunjung atau pengguna situs.",
          "Penggunaan data yang diterima dari Google API mematuhi Google API Services User Data Policy, termasuk ketentuan Limited Use.",
        ],
      },
      {
        judul: "Penyimpanan dan keamanan",
        isi: [
          "Data disimpan di server yang dikelola sekolah. Kata sandi disimpan dalam bentuk hash, akses dibatasi sesuai peran pengguna, dan sesi login dapat dicabut sewaktu-waktu. Salinan cadangan dibuat setiap hari dan dihapus otomatis setelah 14 hari di server serta 30 hari di penyimpanan cadangan luar.",
          "Data akademik disimpan selama diperlukan untuk penyelenggaraan pendidikan dan kearsipan sekolah sesuai ketentuan yang berlaku.",
        ],
      },
      {
        judul: "Data anak",
        isi: [
          "Sebagian besar siswa berusia di bawah 18 tahun. Data mereka diproses dalam rangka penyelenggaraan pendidikan, dan orang tua/wali dapat menggunakan hak-hak di bawah ini atas nama anaknya.",
        ],
      },
      {
        judul: "Hak Anda",
        isi: [
          [
            "Mengetahui dan meminta salinan data pribadi Anda.",
            "Meminta perbaikan data yang keliru atau tidak lengkap.",
            "Meminta penghapusan data yang tidak lagi diperlukan, sepanjang tidak bertentangan dengan kewajiban kearsipan sekolah.",
            "Menarik persetujuan atas pemrosesan yang didasarkan pada persetujuan.",
          ],
          "Ajukan permintaan melalui kontak di bawah. Kami akan menanggapinya sesuai ketentuan peraturan perundang-undangan.",
        ],
      },
      {
        judul: "Perubahan kebijakan",
        isi: ["Kebijakan ini dapat diperbarui sewaktu-waktu. Versi terbaru selalu tersedia di halaman ini beserta tanggal berlakunya."],
      },
    ],
  },
  en: {
    label: "Personal Data Protection",
    judul: "Privacy Policy",
    berlaku: "Effective 14 September 2026",
    kontakJudul: "Contact Us",
    kontak: { email: "Email", telepon: "Phone", alamat: "Address" },
    blok: [
      {
        judul: "About this policy",
        isi: [
          "This policy explains how SMK Al Munawwir IIBS (\"the school\", \"we\") collects, uses, stores, and protects personal data through the school website and academic information system, in line with Indonesian Law No. 27 of 2022 on Personal Data Protection.",
        ],
      },
      {
        judul: "Data we collect",
        isi: [[
          "New student admissions: applicant and parent/guardian data entered in the admission form.",
          "Contact messages and guest book: the data you enter, such as name, contact number, and message or purpose of visit.",
          "Alumni tracer study: contact details and post-graduation activities entered by alumni.",
          "Academic system accounts (teachers, staff, students, and parents/guardians): identity, staff or student records, grades, attendance, and other necessary academic data.",
          "Online exams: answers, working time, exam device identifier, and records of exam rule violations.",
          "Security data: IP address, device and browser type, and account sign-in and activity times.",
        ]],
      },
      {
        judul: "How we use data",
        isi: [[
          "To run education and school administration: admissions, teaching, assessment, report cards, and exams.",
          "To communicate with students, parents/guardians, alumni, and the public.",
          "To keep accounts secure and prevent misuse of the system.",
          "To meet reporting obligations to the competent education authorities.",
        ]],
      },
      {
        judul: "Cookies and browser storage",
        isi: [
          "We only use cookies required for the site to work: keeping you signed in, two-step verification for certain accounts, and remembering your language choice. The online exam page stores a device identifier in the browser's local storage so one account cannot take an exam from several devices at once.",
          "We do not use advertising cookies or third-party trackers.",
        ],
      },
      {
        judul: "Sharing data",
        isi: [
          "We do not sell or rent personal data. Data is only shared with:",
          [
            "government education authorities, as required by law;",
            "technical service providers that help operate the system (for example backup storage), limited to that purpose;",
            "other parties where required by law.",
          ],
        ],
      },
      {
        judul: "Use of Google services",
        isi: [
          "The school system uses Google Drive access (the \"SMK Cadangan\" app) solely to store backup copies of system data in the school's own Google Drive. This access is not used to read, modify, or share any other files, and we do not request or collect Google account data from visitors or users of this site.",
          "Use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
        ],
      },
      {
        judul: "Storage and security",
        isi: [
          "Data is stored on servers managed by the school. Passwords are stored as hashes, access is limited by user role, and sign-in sessions can be revoked at any time. Backups are made daily and deleted automatically after 14 days on the server and 30 days in off-site backup storage.",
          "Academic data is kept for as long as needed for education and school record-keeping under applicable regulations.",
        ],
      },
      {
        judul: "Children's data",
        isi: [
          "Most students are under 18. Their data is processed for educational purposes, and parents/guardians may exercise the rights below on their child's behalf.",
        ],
      },
      {
        judul: "Your rights",
        isi: [
          [
            "Know about and request a copy of your personal data.",
            "Request correction of inaccurate or incomplete data.",
            "Request deletion of data that is no longer needed, as long as it does not conflict with the school's record-keeping obligations.",
            "Withdraw consent for processing based on consent.",
          ],
          "Send requests using the contact details below. We will respond in accordance with applicable regulations.",
        ],
      },
      {
        judul: "Changes to this policy",
        isi: ["This policy may be updated from time to time. The latest version is always available on this page with its effective date."],
      },
    ],
  },
};

export default async function KebijakanPrivasiPage() {
  const lang = await getLang();
  const c = content[lang];
  const s = await getSettings(["contact.email", "contact.phone", "contact.address"]);
  const kontak = [
    { icon: Mail, label: c.kontak.email, value: s["contact.email"], href: `mailto:${s["contact.email"]}` },
    { icon: Phone, label: c.kontak.telepon, value: s["contact.phone"], href: `tel:${s["contact.phone"]}` },
    { icon: MapPin, label: c.kontak.alamat, value: s["contact.address"], href: null },
  ];

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
              <ShieldCheck size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.judul}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{c.berlaku}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-3xl mx-auto">
            <article className="panel p-6 md:p-10 space-y-8">
              {c.blok.map((b) => (
                <section key={b.judul} className="space-y-3">
                  <h2 className="font-heading text-xl font-bold text-primary-900">{b.judul}</h2>
                  {b.isi.map((x, i) =>
                    typeof x === "string" ? (
                      <p key={i} className="text-gray-600 leading-relaxed">{x}</p>
                    ) : (
                      <ul key={i} className="list-disc pl-5 space-y-1.5 text-gray-600 leading-relaxed marker:text-gold">
                        {x.map((li) => <li key={li}>{li}</li>)}
                      </ul>
                    ),
                  )}
                </section>
              ))}

              <section className="space-y-3 border-t border-gray-100 pt-8">
                <h2 className="font-heading text-xl font-bold text-primary-900">{c.kontakJudul}</h2>
                <p className="text-gray-600">SMK Al Munawwir IIBS</p>
                <ul className="space-y-3">
                  {kontak.map(({ icon: Icon, label, value, href }) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                        <Icon size={16} />
                      </span>
                      <span className="text-sm">
                        <span className="block text-gray-400">{label}</span>
                        {href ? (
                          <a href={href} className="text-primary-700 hover:text-gold transition-colors break-words">{value}</a>
                        ) : (
                          <span className="text-gray-700">{value}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
