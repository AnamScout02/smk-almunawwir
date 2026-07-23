"use client";
import { useState, useTransition } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import type { Lang } from "@/lib/lang";

const ui = {
  id: {
    sendFailed: "Gagal mengirim pesan, silakan coba lagi.",
    sentTitle: "Pesan Terkirim!",
    sentDesc: "Terima kasih telah menghubungi kami. Kami akan membalas pesan Anda dalam 1×24 jam.",
    title: "Kirim Pesan",
    desc: "Isi formulir di bawah dan kami akan merespons dalam 1×24 jam.",
    name: "Nama Lengkap", namePh: "Nama Anda",
    email: "Email",
    subject: "Subjek", subjectPh: "Pilih subjek...",
    subjects: ["Informasi Pendaftaran", "Konsentrasi Keahlian", "Biaya & Beasiswa", "Fasilitas Asrama", "Lainnya"],
    message: "Pesan", messagePh: "Tulis pesan Anda di sini...",
    sending: "Mengirim...",
    submit: "Kirim Pesan",
  },
  en: {
    sendFailed: "Failed to send message, please try again.",
    sentTitle: "Message Sent!",
    sentDesc: "Thank you for contacting us. We will reply to your message within 1×24 hours.",
    title: "Send a Message",
    desc: "Fill out the form below and we'll respond within 1×24 hours.",
    name: "Full Name", namePh: "Your name",
    email: "Email",
    subject: "Subject", subjectPh: "Choose a subject...",
    subjects: ["Admission Information", "Areas of Expertise", "Fees & Scholarships", "Dormitory Facilities", "Other"],
    message: "Message", messagePh: "Write your message here...",
    sending: "Sending...",
    submit: "Send Message",
  },
} as const;

export default function ContactForm({ lang = "id" }: { lang?: Lang }) {
  const t = ui[lang];
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(t.sendFailed);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-primary-900 mb-2">{t.sentTitle}</h3>
        <p className="text-gray-500 mb-2 max-w-sm">{t.sentDesc}</p>
        <p className="font-arabic text-primary-700 text-xl mt-3">جَزَاكُمُ اللَّهُ خَيْرًا</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-8">
      <h2 className="font-heading text-2xl font-bold text-navy mb-2">{t.title}</h2>
      <p className="text-gray-500 text-sm mb-6">{t.desc}</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">{t.name}</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} type="text" required placeholder={t.namePh}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">{t.email}</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} type="email" required placeholder="email@domain.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">{t.subject}</label>
          <select value={form.subject} onChange={e => set("subject", e.target.value)} required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 outline-none transition text-gray-700">
            <option value="">{t.subjectPh}</option>
            {t.subjects.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">{t.message}</label>
          <textarea value={form.message} onChange={e => set("message", e.target.value)} required rows={5} placeholder={t.messagePh}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition resize-none" />
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2">{error}</p>}
        <button type="submit" disabled={isPending}
          className="btn-primary w-full !rounded-xl flex items-center justify-center gap-2">
          <Send size={16} />
          {isPending ? t.sending : t.submit}
        </button>
      </form>
    </div>
  );
}
