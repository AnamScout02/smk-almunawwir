export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ContactForm from "@/components/sections/ContactForm";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Kontak — SMK Al Munawwir IIBS",
  description: "Hubungi SMK Al Munawwir IIBS — alamat, telepon, email, dan formulir pesan.",
};

const content = {
  id: {
    heroLabel: "Kontak",
    heroTitle: "Hubungi Kami",
    heroDesc: "Kami siap menjawab pertanyaan seputar pendaftaran, program, dan informasi sekolah.",
    infoTitle: "Informasi Kontak",
    labels: { address: "Alamat", phone: "Telepon", whatsapp: "WhatsApp", email: "Email", hours: "Jam Operasional" },
    closed: "Minggu: Tutup",
    prayerNote: "Jadwal kegiatan menyesuaikan waktu shalat dan kegiatan pesantren.",
    mapTitle: "Lokasi SMK Al Munawwir IIBS",
  },
  en: {
    heroLabel: "Contact",
    heroTitle: "Get in Touch",
    heroDesc: "We're ready to answer your questions about admissions, programs, and school information.",
    infoTitle: "Contact Information",
    labels: { address: "Address", phone: "Phone", whatsapp: "WhatsApp", email: "Email", hours: "Operating Hours" },
    closed: "Sunday: Closed",
    prayerNote: "The activity schedule adjusts to prayer times and boarding school activities.",
    mapTitle: "SMK Al Munawwir IIBS Location",
  },
} as const;

export default async function ContactPage() {
  const lang = await getLang();
  const c = content[lang];
  const s = await getSettings([
    "contact.phone",
    "contact.email",
    "contact.address",
    "contact.hours_main",
    "contact.hours_friday",
  ]);

  const phone = s["contact.phone"];
  const waNumber = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  const contactItems = [
    { icon: MapPin, label: c.labels.address, value: s["contact.address"], href: `https://maps.google.com/?q=-8.2907167,114.2072342` },
    { icon: Phone, label: c.labels.phone, value: phone, href: `tel:${phone}` },
    { icon: MessageCircle, label: c.labels.whatsapp, value: phone, href: `https://wa.me/${waNumber}` },
    { icon: Mail, label: c.labels.email, value: s["contact.email"], href: `mailto:${s["contact.email"]}` },
    {
      icon: Clock,
      label: c.labels.hours,
      value: `${s["contact.hours_main"]} · ${s["contact.hours_friday"]} · ${c.closed}`,
      href: null,
    },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.heroLabel}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.heroTitle}</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              {c.heroDesc}
            </p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Info kontak */}
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-navy">{c.infoTitle}</h2>
                <div className="space-y-3">
                  {contactItems.map(({ icon: Icon, label, value, href }) => {
                    const inner = (
                      <div className="flex gap-4 p-4 bg-white rounded-xl group hover:shadow-sm transition-shadow">
                        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
                          <Icon size={18} className="text-primary-700" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 font-medium mb-0.5">{label}</div>
                          <div className="text-navy font-medium text-sm">{value}</div>
                        </div>
                      </div>
                    );
                    return href ? (
                      <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="block">
                        {inner}
                      </a>
                    ) : (
                      <div key={label}>{inner}</div>
                    );
                  })}
                </div>

                {/* Google Maps embed */}
                <div className="rounded-2xl overflow-hidden border border-gray-200 h-56">
                  <iframe
                    src="https://maps.google.com/maps?q=-8.2907167,114.2072342&z=17&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={c.mapTitle}
                  />
                </div>

                {/* Waktu sholat */}
                <div className="relative rounded-2xl p-5 text-white overflow-hidden bg-primary-900">
                  <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
                    style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }}
                  />
                  <div className="relative">
                    <p className="font-arabic text-gold text-xl mb-2">الصَّلَاةُ خَيْرٌ مِنَ النَّوْمِ</p>
                    <p className="text-white/70 text-sm">{c.prayerNote}</p>
                  </div>
                </div>
              </div>

              {/* Form */}
              <ContactForm lang={lang} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
