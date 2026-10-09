"use client";
import { useState } from "react";
import { Loader2, Send, CircleCheck } from "lucide-react";

const T = {
  id: { nama: "Nama usaha / instansi", bidang: "Bidang usaha", alamat: "Alamat lengkap", narahubung: "Nama narahubung", wa: "Nomor WhatsApp", kuota: "Sanggup menerima berapa siswa (boleh kosong)", catatan: "Pesan untuk sekolah (boleh kosong)",
    kirim: "Kirim Usulan", terkirim: "Terima kasih. Usulan Anda sudah kami terima — tim Humas sekolah akan menghubungi lewat WhatsApp.", gagal: "Gagal mengirim. Periksa sambungan lalu coba lagi." },
  en: { nama: "Company / institution name", bidang: "Line of business", alamat: "Full address", narahubung: "Contact person", wa: "WhatsApp number", kuota: "How many students can you host (optional)", catatan: "Message to the school (optional)",
    kirim: "Send Proposal", terkirim: "Thank you. We have received your proposal — our partnership team will contact you via WhatsApp.", gagal: "Failed to send. Check your connection and try again." },
};

export default function FormulirMitra({ lang = "id" }: { lang?: "id" | "en" }) {
  const t = T[lang];
  const [f, setF] = useState({ nama: "", bidang: "", alamat: "", narahubung: "", wa: "", kuota: "", catatan: "", situs: "" });
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [beres, setBeres] = useState(false);
  const isi = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }));
  async function kirim(e: React.FormEvent) {
    e.preventDefault(); setSibuk(true); setPesan(""); setGalat({});
    try {
      const r = await fetch("/api/public/mitra-usulan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, kuota: /^\d+$/.test(f.kuota) ? Number(f.kuota) : null }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setGalat(j.kolom ?? {}); setPesan(j.error ?? t.gagal); } else setBeres(true);
    } catch { setPesan(t.gagal); } finally { setSibuk(false); }
  }
  if (beres) return <p className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><CircleCheck size={20} className="mt-0.5 shrink-0" /> {t.terkirim}</p>;
  const kolom = (k: "nama" | "bidang" | "narahubung" | "wa" | "kuota", extra: Record<string, string> = {}) => (
    <div><label className="label-field" htmlFor={`m-${k}`}>{t[k]}</label><input id={`m-${k}`} className="input-field" value={f[k]} onChange={isi(k)} aria-invalid={!!galat[k]} {...extra} />{galat[k] && <p className="mt-1 text-xs text-red-600">{galat[k]}</p>}</div>
  );
  return (
    <form onSubmit={kirim} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{kolom("nama")}{kolom("bidang")}</div>
      <div><label className="label-field" htmlFor="m-alamat">{t.alamat}</label><textarea id="m-alamat" className="input-field" rows={2} value={f.alamat} onChange={isi("alamat")} aria-invalid={!!galat.alamat} />{galat.alamat && <p className="mt-1 text-xs text-red-600">{galat.alamat}</p>}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{kolom("narahubung")}{kolom("wa", { inputMode: "tel" })}{kolom("kuota", { inputMode: "numeric" })}</div>
      <div><label className="label-field" htmlFor="m-catatan">{t.catatan}</label><textarea id="m-catatan" className="input-field" rows={2} value={f.catatan} onChange={isi("catatan")} /></div>
      {/* Kolom jebakan robot — tidak terlihat & tidak terjangkau tombol Tab. */}
      <input type="text" name="situs" value={f.situs} onChange={isi("situs")} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {pesan && <p className="error-msg">{pesan}</p>}
      <button type="submit" disabled={sibuk} className="btn-primary inline-flex items-center gap-2">{sibuk ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t.kirim}</button>
    </form>
  );
}
