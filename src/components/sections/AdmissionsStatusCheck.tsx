"use client";
import { useState, useRef } from "react";
import { Search, CheckCircle2, Clock, XCircle, CalendarCheck, MessageSquare, Loader2, AlertCircle } from "lucide-react";

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

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
  desc: string;
}> = {
  PENDING: {
    label: "Menunggu Verifikasi",
    icon: Clock,
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    desc: "Berkas Anda sedang dalam proses verifikasi oleh panitia. Harap tunggu 3 hari kerja.",
  },
  WAWANCARA: {
    label: "Tahap Wawancara",
    icon: CalendarCheck,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    desc: "Selamat! Anda lolos seleksi administrasi. Panitia akan menghubungi Anda untuk jadwal wawancara.",
  },
  ACCEPTED: {
    label: "Diterima",
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    desc: "Alhamdulillah! Anda dinyatakan DITERIMA di SMK Al-Munawwir IIBS. Segera lakukan daftar ulang.",
  },
  REJECTED: {
    label: "Tidak Diterima",
    icon: XCircle,
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    desc: "Mohon maaf, pendaftaran Anda belum bisa kami terima saat ini. Silakan hubungi panitia untuk informasi lebih lanjut.",
  },
};

export default function AdmissionsStatusCheck() {
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
        setResult({ found: null, error: data.error || "Terjadi kesalahan." });
      } else {
        setResult(data);
      }
    } catch {
      setResult({ found: null, error: "Koneksi gagal, silakan coba lagi." });
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
      <h2 className="font-heading text-2xl font-bold text-navy mb-1">Cek Status Pendaftaran</h2>
      <p className="text-gray-500 text-sm mb-7">
        Masukkan nomor WhatsApp atau alamat email yang Anda gunakan saat mendaftar.
      </p>

      <form onSubmit={handleCheck} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            type="text"
            placeholder="Contoh: 08387820xxxx atau nama@email.com"
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="shrink-0 flex items-center gap-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Mencari..." : "Cek"}
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
              <h3 className="font-heading font-bold text-navy mb-2">Data Tidak Ditemukan</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                Pastikan nomor WA atau email yang Anda masukkan sama persis dengan yang digunakan saat mendaftar.
              </p>
              <button onClick={reset} className="mt-4 text-sm text-primary-600 hover:text-primary-800 underline underline-offset-2">
                Coba lagi
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
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status Pendaftaran</p>
                  <p className={`font-heading font-bold text-xl ${cfg.text}`}>{cfg.label}</p>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Nama Pendaftar</p>
                  <p className="font-semibold text-navy text-sm">{result.data.maskedName}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Konsentrasi Keahlian</p>
                  <p className="font-semibold text-navy text-sm">{result.data.chosenMajor || "—"}</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-0.5">Tanggal Pendaftaran</p>
                  <p className="font-semibold text-navy text-sm">
                    {new Date(result.data.createdAt).toLocaleDateString("id-ID", {
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
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">Pesan dari Panitia</p>
                    <p className="text-sm text-gray-700">{result.data.notes}</p>
                  </div>
                </div>
              )}

              <button onClick={reset} className="mt-5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                Cek nomor / email lain
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {result === null && (
        <div className="mt-4 p-4 bg-cream rounded-xl text-xs text-gray-500 leading-relaxed">
          <strong className="text-navy">Tips:</strong> Jika data tidak ditemukan, pastikan format nomor WA benar
          (boleh diawali 08 atau 628). Proses verifikasi berlangsung maksimal 3 hari kerja setelah pendaftaran.
        </div>
      )}
    </div>
  );
}
