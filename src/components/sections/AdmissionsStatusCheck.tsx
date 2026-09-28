"use client";
import { useState, useRef } from "react";
import { Search, CheckCircle2, Clock, XCircle, CalendarCheck, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import type { Lang } from "@/lib/lang";

type StatusData = {
  maskedName: string;
  chosenMajor: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

type Result =
  | { found: false }
  | { found: true; data: StatusData }
  | { found: null; error: string };

const statusConfig: Record<Lang, Record<string, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
  desc: string;
}>> = {
  id: {
    PENDING: { label: "Menunggu Verifikasi", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", desc: "Berkas Anda sedang dalam proses verifikasi oleh panitia. Harap tunggu 3 hari kerja." },
    WAWANCARA: { label: "Tahap Wawancara", icon: CalendarCheck, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", desc: "Selamat! Anda lolos seleksi administrasi. Panitia akan menghubungi Anda untuk jadwal wawancara." },
    ACCEPTED: { label: "Diterima", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", desc: "Alhamdulillah! Anda dinyatakan DITERIMA di SMK Al Munawwir IIBS. Segera lakukan daftar ulang." },
    REJECTED: { label: "Tidak Diterima", icon: XCircle, bg: "bg-red-50", text: "text-red-600", border: "border-red-200", desc: "Mohon maaf, pendaftaran Anda belum bisa kami terima saat ini. Silakan hubungi panitia untuk informasi lebih lanjut." },
  },
  en: {
    PENDING: { label: "Awaiting Verification", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", desc: "Your documents are being verified by the committee. Please wait 3 working days." },
    WAWANCARA: { label: "Interview Stage", icon: CalendarCheck, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", desc: "Congratulations! You passed the administrative selection. The committee will contact you for an interview schedule." },
    ACCEPTED: { label: "Accepted", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", desc: "Alhamdulillah! You have been ACCEPTED at SMK Al Munawwir IIBS. Please complete re-registration soon." },
    REJECTED: { label: "Not Accepted", icon: XCircle, bg: "bg-red-50", text: "text-red-600", border: "border-red-200", desc: "We're sorry, we are unable to accept your registration at this time. Please contact the committee for more information." },
  },
};

const ui = {
  id: {
    title: "Cek Status Pendaftaran",
    desc: "Masukkan nomor WhatsApp atau alamat email yang Anda gunakan saat mendaftar.",
    placeholder: "Contoh: 08387820xxxx atau nama@email.com",
    searching: "Mencari...",
    check: "Cek",
    genericError: "Terjadi kesalahan.",
    connError: "Koneksi gagal, silakan coba lagi.",
    notFoundTitle: "Data Tidak Ditemukan",
    notFoundDesc: "Pastikan nomor WA atau email yang Anda masukkan sama persis dengan yang digunakan saat mendaftar.",
    tryAgain: "Coba lagi",
    statusLabel: "Status Pendaftaran",
    applicantName: "Nama Pendaftar",
    major: "Konsentrasi Keahlian",
    regDate: "Tanggal Pendaftaran",
    committeeNote: "Pesan dari Panitia",
    checkOther: "Cek nomor / email lain",
    tipsTitle: "Tips:",
    tipsBody: "Jika data tidak ditemukan, pastikan format nomor WA benar (boleh diawali 08 atau 628). Proses verifikasi berlangsung maksimal 3 hari kerja setelah pendaftaran.",
    locale: "id-ID",
  },
  en: {
    title: "Check Registration Status",
    desc: "Enter the WhatsApp number or email address you used when registering.",
    placeholder: "Example: 08387820xxxx or name@email.com",
    searching: "Searching...",
    check: "Check",
    genericError: "An error occurred.",
    connError: "Connection failed, please try again.",
    notFoundTitle: "Data Not Found",
    notFoundDesc: "Make sure the WhatsApp number or email you entered matches exactly what you used when registering.",
    tryAgain: "Try again",
    statusLabel: "Registration Status",
    applicantName: "Applicant Name",
    major: "Chosen Major",
    regDate: "Registration Date",
    committeeNote: "Note from Committee",
    checkOther: "Check another number / email",
    tipsTitle: "Tips:",
    tipsBody: "If your data isn't found, make sure the WhatsApp number format is correct (may start with 08 or 628). Verification takes up to 3 working days after registration.",
    locale: "en-US",
  },
};

export default function AdmissionsStatusCheck({ lang = "id" }: { lang?: Lang }) {
  const t = ui[lang];
  const STATUS_CONFIG = statusConfig[lang];
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admissions/status?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setResult({ found: null, error: data.error || t.genericError });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ found: null, error: t.connError });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuery("");
    setResult(null);
    inputRef.current?.focus();
  }

  const cfg = result && "data" in result && result.found
    ? STATUS_CONFIG[result.data.status] ?? STATUS_CONFIG.PENDING
    : null;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <h2 className="font-heading text-2xl font-bold text-navy mb-1">{t.title}</h2>
      <p className="text-gray-500 text-sm mb-7">
        {t.desc}
      </p>

      <form onSubmit={handleCheck} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            type="text"
            placeholder={t.placeholder}
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn-primary shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? t.searching : t.check}
        </button>
      </form>

      {/* Result */}
      {result !== null && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Error */}
          {"error" in result && result.found === null && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          {/* Not found */}
          {result.found === false && (
            <div className="text-center py-8 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="font-heading font-bold text-navy mb-2">{t.notFoundTitle}</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                {t.notFoundDesc}
              </p>
              <button onClick={reset} className="mt-4 text-sm text-primary-700 hover:text-primary-900 underline underline-offset-2">
                {t.tryAgain}
              </button>
            </div>
          )}

          {/* Found */}
          {result.found === true && cfg && (
            <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
              {/* Status badge */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm`}>
                  <cfg.icon size={24} className={cfg.text} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{t.statusLabel}</p>
                  <p className={`font-heading font-bold text-xl ${cfg.text}`}>{cfg.label}</p>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{t.applicantName}</p>
                  <p className="font-semibold text-navy text-sm">{result.data.maskedName}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{t.major}</p>
                  <p className="font-semibold text-navy text-sm">{result.data.chosenMajor || "—"}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">{t.regDate}</p>
                  <p className="font-semibold text-navy text-sm">
                    {new Date(result.data.createdAt).toLocaleDateString(t.locale, {
                      day: "numeric", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className={`text-sm leading-relaxed ${cfg.text} mb-4`}>{cfg.desc}</p>

              {/* Admin notes */}
              {result.data.notes && (
                <div className="bg-white/70 rounded-xl p-3 flex gap-2.5">
                  <MessageSquare size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">{t.committeeNote}</p>
                    <p className="text-sm text-gray-700">{result.data.notes}</p>
                  </div>
                </div>
              )}

              <button onClick={reset} className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                {t.checkOther}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {result === null && (
        <div className="mt-4 p-4 bg-cream rounded-xl text-xs text-gray-500 leading-relaxed">
          <strong className="text-navy">{t.tipsTitle}</strong> {t.tipsBody}
        </div>
      )}
    </div>
  );
}
