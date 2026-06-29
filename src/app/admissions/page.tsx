import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdmissionsTabSection from "@/components/sections/AdmissionsTabSection";
import { CheckCircle2, AlertCircle, Calendar, FileText, CreditCard, GraduationCap } from "lucide-react";

const steps = [
  { icon: FileText, title: "1. Isi Formulir Online", desc: "Lengkapi formulir pendaftaran dengan data yang benar dan valid." },
  { icon: AlertCircle, title: "2. Seleksi Administrasi", desc: "Panitia memverifikasi berkas dan kelengkapan dokumen dalam 3 hari kerja." },
  { icon: Calendar, title: "3. Tes & Wawancara", desc: "Jalani tes akademik, wawancara motivasi, dan baca Al-Qur'an." },
  { icon: CreditCard, title: "4. Pengumuman & Daftar Ulang", desc: "Calon siswa diterima melakukan daftar ulang dan pembayaran." },
  { icon: GraduationCap, title: "5. Orientasi Peserta Didik Baru", desc: "Ikuti MPLS dan orientasi boarding school selama 1 minggu." },
];

const requirements = [
  "Ijazah / Surat Keterangan Lulus SMP/MTs (asli & fotokopi)",
  "Rapor semester 1–5 (fotokopi, dilegalisir)",
  "Akta Kelahiran (fotokopi)",
  "Kartu Keluarga (fotokopi)",
  "Foto 3×4 & 4×6 masing-masing 4 lembar (background merah)",
  "Surat Keterangan Sehat dari dokter",
  "Sertifikat/piagam prestasi (jika ada)",
];

export default function AdmissionsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white section-padding">
          <div className="container-custom max-w-3xl">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">PPDB 2026/2027</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              Pendaftaran Peserta Didik Baru
            </h1>
            <p className="text-white/70 text-lg mb-6">
              Bergabunglah bersama ribuan siswa berprestasi di SMK Al-Munawwir IIBS. Pendaftaran terbuka — kuota terbatas.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">Buka:</span> 1 Juni 2026
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">Tutup:</span> 31 Agustus 2026
              </div>
              <div className="bg-gold/20 border border-gold/40 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">Kuota:</span> 200 Siswa
              </div>
            </div>
          </div>
        </section>

        {/* Alur */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold text-navy">Alur Pendaftaran</h2>
              <p className="text-gray-500 mt-2">Ikuti langkah-langkah berikut dengan seksama</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {steps.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="relative">
                  <div className="bg-cream rounded-2xl p-5 h-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary-700 flex items-center justify-center mx-auto mb-3">
                      <Icon size={20} className="text-gold" />
                    </div>
                    <h3 className="font-heading font-bold text-navy text-sm mb-2">{title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 -right-2 text-gold font-bold text-lg z-10">›</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Persyaratan & Form / Cek Status */}
        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Kiri: Persyaratan */}
              <div>
                <h2 className="font-heading text-2xl font-bold text-navy mb-6">Persyaratan Pendaftaran</h2>
                <ul className="space-y-3 mb-8">
                  {requirements.map((r) => (
                    <li key={r} className="flex gap-3 items-start text-sm text-gray-600">
                      <CheckCircle2 size={18} className="text-primary-600 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="bg-gradient-to-br from-primary-700 to-primary-900 rounded-2xl p-6 text-white">
                  <h3 className="font-heading font-bold text-lg mb-3 text-gold">Program Beasiswa</h3>
                  <ul className="space-y-2 text-sm text-white/80">
                    <li>• Beasiswa Tahfidz (hafal minimal 10 Juz) — gratis SPP & asrama</li>
                    <li>• Beasiswa Prestasi (peringkat 1–3 di sekolah asal) — diskon 50% SPP</li>
                    <li>• Beasiswa Yatim/Dhuafa — berdasarkan seleksi panitia</li>
                    <li>• Beasiswa Kakak-Adik (keduanya bersekolah di sini) — diskon 30%</li>
                  </ul>
                </div>
              </div>

              {/* Kanan: Tab switcher + Form (client component) */}
              <AdmissionsTabSection />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
