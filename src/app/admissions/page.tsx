import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AdmissionsTabSection from "@/components/sections/AdmissionsTabSection";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/site-settings";
import { CheckCircle2, AlertCircle, Calendar, FileText, CreditCard, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

const content = {
  id: {
    badge: "SPMB 2026/2027",
    title: "Pendaftaran Peserta Didik Baru",
    desc: "Bergabunglah bersama ribuan siswa berprestasi di SMK Al Munawwir IIBS. Pendaftaran terbuka — kuota terbatas.",
    open: "Buka:",
    close: "Tutup:",
    quota: "Kuota:",
    quotaUnit: "Siswa",
    locale: "id-ID",
    flowTitle: "Alur Pendaftaran",
    flowDesc: "Ikuti langkah-langkah berikut dengan seksama",
    steps: [
      { icon: FileText, title: "1. Isi Formulir Online", desc: "Lengkapi formulir pendaftaran dengan data yang benar dan valid." },
      { icon: AlertCircle, title: "2. Seleksi Administrasi", desc: "Panitia memverifikasi berkas dan kelengkapan dokumen dalam 3 hari kerja." },
      { icon: Calendar, title: "3. Tes & Wawancara", desc: "Jalani tes akademik, wawancara motivasi, dan baca Al-Qur'an." },
      { icon: CreditCard, title: "4. Pengumuman & Daftar Ulang", desc: "Calon siswa diterima melakukan daftar ulang dan pembayaran." },
      { icon: GraduationCap, title: "5. Orientasi Peserta Didik Baru", desc: "Ikuti MPLS dan orientasi boarding school selama 1 minggu." },
    ],
    reqTitle: "Persyaratan Pendaftaran",
    requirements: [
      "Ijazah / Surat Keterangan Lulus SMP/MTs (asli & fotokopi)",
      "Rapor semester 1–5 (fotokopi, dilegalisir)",
      "Akta Kelahiran (fotokopi)",
      "Kartu Keluarga (fotokopi)",
      "Foto 3×4 & 4×6 masing-masing 4 lembar (background merah)",
      "Surat Keterangan Sehat dari dokter",
      "Sertifikat/piagam prestasi (jika ada)",
    ],
    scholarshipTitle: "Program Beasiswa",
    scholarships: [
      "Beasiswa Tahfidz (hafal minimal 10 Juz) — gratis SPP & asrama",
      "Beasiswa Prestasi (peringkat 1–3 di sekolah asal) — diskon 50% SPP",
      "Beasiswa Yatim/Dhuafa — berdasarkan seleksi panitia",
      "Beasiswa Kakak-Adik (keduanya bersekolah di sini) — diskon 30%",
    ],
  },
  en: {
    badge: "SPMB 2026/2027",
    title: "New Student Admissions",
    desc: "Join thousands of high-achieving students at SMK Al Munawwir IIBS. Registration is open — limited quota.",
    open: "Opens:",
    close: "Closes:",
    quota: "Quota:",
    quotaUnit: "Students",
    locale: "en-US",
    flowTitle: "Admission Flow",
    flowDesc: "Follow the steps below carefully",
    steps: [
      { icon: FileText, title: "1. Fill Out Online Form", desc: "Complete the registration form with accurate and valid data." },
      { icon: AlertCircle, title: "2. Administrative Selection", desc: "The committee verifies documents and completeness within 3 working days." },
      { icon: Calendar, title: "3. Test & Interview", desc: "Take the academic test, motivation interview, and Qur'an reading assessment." },
      { icon: CreditCard, title: "4. Announcement & Re-registration", desc: "Accepted candidates complete re-registration and payment." },
      { icon: GraduationCap, title: "5. New Student Orientation", desc: "Join MPLS and boarding school orientation for 1 week." },
    ],
    reqTitle: "Admission Requirements",
    requirements: [
      "Junior high (SMP/MTs) diploma / graduation certificate (original & copy)",
      "Semester 1–5 report cards (certified copy)",
      "Birth certificate (copy)",
      "Family card (Kartu Keluarga, copy)",
      "3×4 & 4×6 photos, 4 each (red background)",
      "Doctor's health certificate",
      "Achievement certificates (if any)",
    ],
    scholarshipTitle: "Scholarship Programs",
    scholarships: [
      "Tahfidz Scholarship (memorized at least 10 Juz) — free tuition & dormitory",
      "Achievement Scholarship (ranked 1–3 at previous school) — 50% tuition discount",
      "Orphan/Underprivileged Scholarship — based on committee selection",
      "Sibling Scholarship (both enrolled here) — 30% discount",
    ],
  },
} as const;

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export default async function AdmissionsPage() {
  const lang = await getLang();
  const c = content[lang];
  const s = await getSettings(["admissions.open_date", "admissions.close_date", "admissions.quota", "cta.ppdb_year"]);
  const openDate = formatDate(s["admissions.open_date"], c.locale);
  const closeDate = formatDate(s["admissions.close_date"], c.locale);
  const quotaValue = `${s["admissions.quota"]} ${c.quotaUnit}`;
  const badge = c.badge.replace(/\d{4}\/\d{4}/, s["cta.ppdb_year"] || "2026/2027");
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{badge}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              {c.title}
            </h1>
            <p className="text-white/70 text-lg mb-6 max-w-2xl mx-auto">
              {c.desc}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">{c.open}</span> {openDate}
              </div>
              <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">{c.close}</span> {closeDate}
              </div>
              <div className="bg-gold/20 border border-gold/40 rounded-xl px-5 py-3 text-sm">
                <span className="text-gold font-bold">{c.quota}</span> {quotaValue}
              </div>
            </div>
          </div>
        </section>

        {/* Alur */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold text-navy">{c.flowTitle}</h2>
              <p className="text-gray-500 mt-2">{c.flowDesc}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {c.steps.map(({ icon: Icon, title, desc }, i) => (
                <div key={title} className="relative">
                  <div className="bg-cream rounded-2xl p-5 h-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary-700 flex items-center justify-center mx-auto mb-3">
                      <Icon size={20} className="text-gold" />
                    </div>
                    <h3 className="font-heading font-bold text-navy text-sm mb-2">{title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                  {i < c.steps.length - 1 && (
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
                <h2 className="font-heading text-2xl font-bold text-navy mb-6">{c.reqTitle}</h2>
                <ul className="space-y-3 mb-8">
                  {c.requirements.map((r) => (
                    <li key={r} className="flex gap-3 items-start text-sm text-gray-600">
                      <CheckCircle2 size={18} className="text-primary-600 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="relative rounded-2xl p-6 text-white overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900">
                  <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }}
                  />
                  <div className="relative">
                    <h3 className="font-heading font-bold text-lg mb-3 text-gold">{c.scholarshipTitle}</h3>
                    <ul className="space-y-2 text-sm text-white/80">
                      {c.scholarships.map((s) => (
                        <li key={s}>• {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Kanan: Tab switcher + Form (client component) */}
              <AdmissionsTabSection lang={lang} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
