"use client";
import { useState, useTransition } from "react";
import { Send, CheckCircle2 } from "lucide-react";

export default function ContactForm() {
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
        setError("Gagal mengirim pesan, silakan coba lagi.");
      }
    });
  }

  if (success) {
    return (
      <div className="bg-white rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-primary-900 mb-2">Pesan Terkirim!</h3>
        <p className="text-gray-500 mb-2 max-w-sm">Terima kasih telah menghubungi kami. Kami akan membalas pesan Anda dalam 1×24 jam.</p>
        <p className="font-arabic text-primary-700 text-xl mt-3">جَزَاكُمُ اللَّهُ خَيْرًا</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-8">
      <h2 className="font-heading text-2xl font-bold text-navy mb-2">Kirim Pesan</h2>
      <p className="text-gray-500 text-sm mb-6">Isi formulir di bawah dan kami akan merespons dalam 1×24 jam.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Nama Lengkap</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} type="text" required placeholder="Nama Anda"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} type="email" required placeholder="email@domain.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Subjek</label>
          <select value={form.subject} onChange={e => set("subject", e.target.value)} required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 outline-none transition text-gray-700">
            <option value="">Pilih subjek...</option>
            <option>Informasi Pendaftaran</option>
            <option>Konsentrasi Keahlian</option>
            <option>Biaya & Beasiswa</option>
            <option>Fasilitas Asrama</option>
            <option>Lainnya</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Pesan</label>
          <textarea value={form.message} onChange={e => set("message", e.target.value)} required rows={5} placeholder="Tulis pesan Anda di sini..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition resize-none" />
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2">{error}</p>}
        <button type="submit" disabled={isPending}
          className="btn-primary w-full !rounded-xl flex items-center justify-center gap-2">
          <Send size={16} />
          {isPending ? "Mengirim..." : "Kirim Pesan"}
        </button>
      </form>
    </div>
  );
}
