"use client";
import { useState } from "react";
import { Quote, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { t } from "@/lib/translations";
import type { Lang } from "@/lib/lang";

const testimonials = [
  {
    name: "Rizky Firmansyah",
    role: {
      id: "Alumni TKJ 2022 — IT Supervisor, Bank Syariah Indonesia",
      en: "TKJ Alumni 2022 — IT Supervisor, Bank Syariah Indonesia",
    },
    content: {
      id: "Ilmu jaringan yang saya dapat di Al-Munawwir sangat solid. Ditambah pengalaman PKL yang terarah, saya langsung bisa bersaing di dunia kerja. Alhamdulillah, sekarang sudah jadi IT Supervisor.",
      en: "The networking knowledge I gained at Al-Munawwir was incredibly solid. Combined with well-structured internship experience, I was immediately competitive in the job market. Alhamdulillah, I'm now an IT Supervisor.",
    },
    rating: 5,
  },
  {
    name: "Nur Aini Safitri",
    role: {
      id: "Alumni AK 2023 — Staf Keuangan, Koperasi Syariah Banyuwangi",
      en: "AK Alumni 2023 — Finance Staff, Koperasi Syariah Banyuwangi",
    },
    content: {
      id: "Program AKL di sini tidak hanya mengajarkan akuntansi, tapi juga etika kerja Islami. Lingkungan pesantren membuat saya disiplin dan mandiri. Ilmu yang saya dapat langsung terpakai di dunia kerja.",
      en: "The accounting program here doesn't just teach bookkeeping — it also instills Islamic work ethics. The boarding school environment made me disciplined and independent. Everything I learned was directly applicable in the workplace.",
    },
    rating: 5,
  },
  {
    name: "Bpk. Hasan Basri",
    role: {
      id: "Orang Tua Siswa — Banyuwangi",
      en: "Parent of Student — Banyuwangi",
    },
    content: {
      id: "Amanah orang tua terjaga betul di sini. Anak saya berkembang pesat tidak hanya secara akademik, tapi juga dalam hal agama dan kemandirian. Program boarding school-nya benar-benar membentuk karakter.",
      en: "The trust placed by parents is truly honored here. My child has grown tremendously — not only academically, but also spiritually and in terms of independence. The boarding school program genuinely shapes character.",
    },
    rating: 5,
  },
  {
    name: "Wahyu Pradana",
    role: {
      id: "Siswa Kelas XII TKJ — Santri Tahfidz",
      en: "Grade XII TKJ Student — Tahfidz Santri",
    },
    content: {
      id: "Di Al-Munawwir saya bisa hafal Al-Qur'an sekaligus belajar jaringan komputer. Dua hal yang awalnya saya kira tidak bisa dijalani bersamaan, di sini justru saling menguatkan.",
      en: "At Al-Munawwir I can memorize the Qur'an while studying computer networking. Two things I once thought couldn't coexist — here they actually reinforce each other.",
    },
    rating: 5,
  },
];

export default function Testimonials({ lang = "id" }: { lang?: Lang }) {
  const [current, setCurrent] = useState(0);
  const tr = t(lang);

  const prev = () => setCurrent((c) => (c === 0 ? testimonials.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const item = testimonials[current];

  return (
    <section className="section-padding bg-primary-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="container-custom relative">
        <div className="text-center mb-12">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.testimonials_label}</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mt-2">
            {tr.testimonials_heading}
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 text-center">
            <Quote size={40} className="text-gold/40 mx-auto mb-6" />

            <p className="text-white/90 text-lg md:text-xl leading-relaxed mb-8 italic">
              &ldquo;{item.content[lang]}&rdquo;
            </p>

            <div className="flex justify-center gap-1 mb-5">
              {Array.from({ length: item.rating }).map((_, i) => (
                <Star key={i} size={18} className="text-gold fill-gold" />
              ))}
            </div>

            <div>
              <div className="font-heading font-bold text-white text-lg">{item.name}</div>
              <div className="text-gold/80 text-sm mt-1">{item.role[lang]}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button onClick={prev}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 hover:border-gold transition">
              <ChevronLeft size={20} />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === current ? "w-8 bg-gold" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>

            <button onClick={next}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 hover:border-gold transition">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
