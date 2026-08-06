"use client";
import { useRef, useState } from "react";
import { Loader2, Search, CheckCircle2, Upload, X, Clock, ShieldCheck } from "lucide-react";

interface VerifiedData {
  token: string; fullName: string; chosenMajor: string; jalur: string;
  buktiPembayaranUrl: string | null; daftarUlangConfirmedAt: string | null; paymentVerified: boolean;
}

const JALUR_LABEL: Record<string, string> = {
  REGULER: "Reguler", PRESTASI_AKADEMIK: "Prestasi Akademik", PRESTASI_NON_AKADEMIK: "Prestasi Non-Akademik",
  TAHFIDZ: "Tahfidz Qur'an", AFIRMASI: "Afirmasi",
};

export default function DaftarUlangForm() {
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
    if (!fullName.trim() || !phone.trim()) { setError("Nama lengkap dan nomor WA wajib diisi."); return; }
    setError("");
    setVerifying(true);
    const res = await fetch("/api/public/daftar-ulang/verify", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, phone }),
    });
    setVerifying(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal memverifikasi data"); return; }
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
    if (!buktiUrl) { setError("Unggah bukti pembayaran terlebih dahulu."); return; }
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/public/daftar-ulang/submit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.token, buktiPembayaranUrl: buktiUrl }),
    });
    setSubmitting(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal mengirim konfirmasi"); return; }
    setConfirmed(true);
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" placeholder="Sesuai formulir pendaftaran" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor WhatsApp</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="Sesuai formulir pendaftaran" />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button onClick={handleVerify} disabled={verifying} className="btn-gold w-full flex items-center justify-center gap-2 text-sm">
            {verifying ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Cari Data Saya
          </button>
        </div>
      </div>
    );
  }

  const isDone = confirmed || !!data.daftarUlangConfirmedAt;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <CheckCircle2 size={20} className="text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-primary-900">{data.fullName}</p>
          <p className="text-xs text-gray-400">{data.chosenMajor} · {JALUR_LABEL[data.jalur] ?? data.jalur}</p>
        </div>
      </div>

      {isDone ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Daftar ulang & bukti pembayaran sudah dikonfirmasi.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 ${data.paymentVerified ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
            {data.paymentVerified ? <ShieldCheck size={18} className="text-emerald-600 shrink-0" /> : <Clock size={18} className="text-amber-600 shrink-0" />}
            <p className={`text-sm font-medium ${data.paymentVerified ? "text-emerald-700" : "text-amber-700"}`}>
              {data.paymentVerified ? "Pembayaran sudah diverifikasi TU." : "Menunggu verifikasi pembayaran oleh TU."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Unggah bukti transfer/pembayaran daftar ulang untuk menyelesaikan proses.</p>
          {uploadStatus === "idle" || uploadStatus === "error" ? (
            <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-400 bg-gray-50 hover:bg-primary-50 cursor-pointer transition-colors">
              <Upload size={22} className="text-gray-300 mb-1" />
              <span className="text-xs text-gray-400 font-medium">Klik untuk unggah bukti pembayaran</span>
              <span className="text-xs text-gray-300 mt-0.5">JPG, PNG, atau PDF — maks. 5MB</span>
              {uploadStatus === "error" && <span className="text-xs text-red-500 mt-1">Gagal mengunggah, coba lagi.</span>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
          ) : uploadStatus === "uploading" ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
              <Loader2 size={18} className="animate-spin text-primary-500" />
              <span className="text-sm text-gray-500">Mengunggah {fileName}…</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-700 truncate">{fileName}</p>
                <a href={buktiUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">Lihat file</a>
              </div>
              <button type="button" onClick={() => { setUploadStatus("idle"); setBuktiUrl(""); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={15} />
              </button>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting || !buktiUrl} className="btn-gold w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Konfirmasi Daftar Ulang
          </button>
        </div>
      )}
    </div>
  );
}
