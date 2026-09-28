"use client";
import { useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, Upload, X, Clock, ShieldCheck } from "lucide-react";
import type { Lang } from "@/lib/lang";

interface VerifiedData {
  token: string; fullName: string; chosenMajor: string; jalur: string;
  buktiPembayaranUrl: string | null; daftarUlangConfirmedAt: string | null; paymentVerified: boolean;
}

const TEKS = {
  id: {
    jalur: { REGULER: "Reguler", PRESTASI_AKADEMIK: "Prestasi Akademik", PRESTASI_NON_AKADEMIK: "Prestasi Non-Akademik", TAHFIDZ: "Tahfidz Qur'an", AFIRMASI: "Afirmasi" } as Record<string, string>,
    namaLengkap: "Nama Lengkap", nomorWa: "Nomor WhatsApp", sesuaiFormulir: "Sesuai formulir pendaftaran", cari: "Cari Data Saya",
    wajib: "Nama lengkap dan nomor WA wajib diisi.", gagalVerifikasi: "Gagal memverifikasi data", unggahDulu: "Unggah bukti pembayaran terlebih dahulu.",
    gagalKirim: "Gagal mengirim konfirmasi", sudahKonfirmasi: "Daftar ulang & bukti pembayaran sudah dikonfirmasi.",
    terverifikasi: "Pembayaran sudah diverifikasi TU.", menunggu: "Menunggu verifikasi pembayaran oleh TU.",
    petunjukUnggah: "Unggah bukti transfer/pembayaran daftar ulang untuk menyelesaikan proses.", klikUnggah: "Klik untuk unggah bukti pembayaran",
    format: "JPG, PNG, atau PDF — maks. 5MB", gagalUnggah: "Gagal mengunggah, coba lagi.", mengunggah: (f: string) => `Mengunggah ${f}…`,
    lihat: "Lihat file", konfirmasi: "Konfirmasi Daftar Ulang",
  },
  en: {
    jalur: { REGULER: "Regular", PRESTASI_AKADEMIK: "Academic Achievement", PRESTASI_NON_AKADEMIK: "Non-Academic Achievement", TAHFIDZ: "Qur'an Memorization (Tahfidz)", AFIRMASI: "Affirmation" } as Record<string, string>,
    namaLengkap: "Full Name", nomorWa: "WhatsApp Number", sesuaiFormulir: "As written on the registration form", cari: "Find My Data",
    wajib: "Full name and WhatsApp number are required.", gagalVerifikasi: "Failed to verify data", unggahDulu: "Please upload the payment proof first.",
    gagalKirim: "Failed to send confirmation", sudahKonfirmasi: "Re-registration and payment proof have been confirmed.",
    terverifikasi: "Payment has been verified by the school office.", menunggu: "Waiting for payment verification by the school office.",
    petunjukUnggah: "Upload the re-registration transfer/payment proof to complete the process.", klikUnggah: "Click to upload payment proof",
    format: "JPG, PNG, or PDF — max. 5MB", gagalUnggah: "Upload failed, please try again.", mengunggah: (f: string) => `Uploading ${f}…`,
    lihat: "View file", konfirmasi: "Confirm Re-registration",
  },
};

export default function DaftarUlangForm({ lang = "id" }: { lang?: Lang }) {
  const c = TEKS[lang];
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<VerifiedData | null>(null);

  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleVerify() {
    if (!fullName.trim() || !phone.trim()) { setError(c.wajib); return; }
    setError("");
    setVerifying(true);
    const res = await fetch("/api/public/daftar-ulang/verify", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, phone }),
    });
    setVerifying(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || c.gagalVerifikasi); return; }
    const d: VerifiedData = await res.json();
    setData(d);
    setBuktiUrl(d.buktiPembayaranUrl ?? "");
  }

  async function handleFile(file: File) {
    setUploadStatus("uploading");
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "pembayaran");
    const res = await fetch("/api/admissions/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) { setUploadStatus("done"); setBuktiUrl(d.url); } else { setUploadStatus("error"); }
  }

  async function handleSubmit() {
    if (!data) return;
    if (!buktiUrl) { setError(c.unggahDulu); return; }
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/public/daftar-ulang/submit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.token, buktiPembayaranUrl: buktiUrl }),
    });
    setSubmitting(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || c.gagalKirim); return; }
    setConfirmed(true);
  }

  if (!data) {
    return (
      <div className="panel p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.namaLengkap}</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" placeholder={c.sesuaiFormulir} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{c.nomorWa}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder={c.sesuaiFormulir} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button onClick={handleVerify} disabled={verifying} className="btn-gold w-full flex items-center justify-center gap-2 text-sm">
            {verifying ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {c.cari}
          </button>
        </div>
      </div>
    );
  }

  const isDone = confirmed || !!data.daftarUlangConfirmedAt;

  return (
    <div className="panel p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle2 size={20} className="text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-primary-900">{data.fullName}</p>
          <p className="text-xs text-gray-400">{data.chosenMajor} · {c.jalur[data.jalur] ?? data.jalur}</p>
        </div>
      </div>

      {isDone ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">{c.sudahKonfirmasi}</p>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${data.paymentVerified ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
            {data.paymentVerified ? <ShieldCheck size={18} className="text-emerald-600 shrink-0" /> : <Clock size={18} className="text-amber-600 shrink-0" />}
            <p className={`text-sm font-medium ${data.paymentVerified ? "text-emerald-700" : "text-amber-700"}`}>
              {data.paymentVerified ? c.terverifikasi : c.menunggu}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{c.petunjukUnggah}</p>
          {uploadStatus === "idle" || uploadStatus === "error" ? (
            <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-500 bg-gray-50 hover:bg-primary-50 cursor-pointer transition-colors">
              <Upload size={22} className="text-gray-300 mb-1" />
              <span className="text-xs text-gray-400 font-medium">{c.klikUnggah}</span>
              <span className="text-xs text-gray-300 mt-0.5">{c.format}</span>
              {uploadStatus === "error" && <span className="text-xs text-red-500 mt-1">{c.gagalUnggah}</span>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
          ) : uploadStatus === "uploading" ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
              <Loader2 size={18} className="animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">{c.mengunggah(fileName)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-700 truncate">{fileName}</p>
                <a href={buktiUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{c.lihat}</a>
              </div>
              <button type="button" onClick={() => { setUploadStatus("idle"); setBuktiUrl(""); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={15} />
              </button>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting || !buktiUrl} className="btn-gold w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {c.konfirmasi}
          </button>
        </div>
      )}
    </div>
  );
}
