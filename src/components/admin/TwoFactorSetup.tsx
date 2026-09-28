"use client";
import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, ShieldOff, KeyRound, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import Alert from "@/components/admin/Alert";
import { useToast } from "@/components/shared/ToastProvider";
import { salinTeks } from "@/lib/salin-teks";

type Step = "idle" | "qr" | "backup-codes" | "disable-confirm";

/** Setup 2FA (TOTP) — KHUSUS akun ADMIN, dipasang di halaman Profil Admin. Alur 2 langkah:
 * (1) generate QR lewat /api/admin/2fa/setup, (2) verifikasi 1 kode dari authenticator app lewat
 * /api/admin/2fa/enable untuk BUKTI QR sudah benar ke-scan sebelum benar2 diaktifkan — mencegah
 * admin "terkunci sendiri" gara2 salah scan QR yang tidak pernah dites. */
export default function TwoFactorSetup({ initialEnabled }: { initialEnabled: boolean }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  async function startSetup() {
    setLoading(true); setError("");
    const res = await fetch("/api/admin/2fa/setup", { method: "POST" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) { setError("Gagal memulai setup 2FA."); return; }
    const data = await res.json();
    setQrDataUrl(data.qrDataUrl); setSecret(data.secret); setCode("");
    setStep("qr");
  }

  async function verifyAndEnable() {
    if (!code.trim()) return;
    setLoading(true); setError("");
    const res = await fetch("/api/admin/2fa/enable", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setLoading(false);
    if (!res?.ok) { setError(data?.error ?? "Gagal memverifikasi kode."); return; }
    setBackupCodes(data.backupCodes ?? []);
    setEnabled(true);
    setStep("backup-codes");
    toast.success("2FA berhasil diaktifkan.");
  }

  async function disable2fa() {
    if (!disablePassword.trim()) return;
    setLoading(true); setError("");
    const res = await fetch("/api/admin/2fa/disable", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: disablePassword }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setLoading(false);
    if (!res?.ok) { setError(data?.error ?? "Gagal menonaktifkan 2FA."); return; }
    setEnabled(false);
    setDisablePassword("");
    setStep("idle");
    toast.success("2FA dinonaktifkan.");
  }

  // Lewat salinTeks: navigator.clipboard tidak ada di situs HTTP, dan pemanggilan langsung dulu
  // membuat tombol ini error diam-diam — kode cadangan tidak pernah tersalin.
  async function copyBackupCodes() {
    if (await salinTeks(backupCodes.join("\n"))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Tidak bisa menyalin otomatis. Blok dan salin kode cadangan secara manual.");
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.04) 0%, rgba(27,43,107,0.02) 100%)", borderBottom: "1px solid rgba(15,26,69,0.06)" }}>
        <h3 className="font-heading font-semibold text-primary-900 text-sm">Autentikasi Dua Faktor (2FA)</h3>
        {enabled ? (
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
            <ShieldCheck size={11} /> Aktif
          </span>
        ) : (
          <span className="text-xs bg-gray-50 text-gray-500 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-gray-200">
            <ShieldOff size={11} /> Nonaktif
          </span>
        )}
      </div>

      <div className="p-6">
        {error && <p className="error-msg mb-4">{error}</p>}

        {step === "idle" && !enabled && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Tambahkan lapis keamanan ekstra — setelah diaktifkan, login akun ini butuh kode dari
              aplikasi authenticator (Google Authenticator, Authy, dll) selain password.
              Sangat disarankan karena akun Admin punya akses &ldquo;Masuk Sebagai&rdquo; akun lain.
            </p>
            <button onClick={startSetup} disabled={loading}
              className="btn-modal-save">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Aktifkan 2FA
            </button>
          </>
        )}

        {step === "idle" && enabled && (
          <>
            <p className="text-sm text-gray-500 mb-4">2FA aktif untuk akun ini. Kode dibutuhkan setiap kali login.</p>
            <button onClick={() => { setStep("disable-confirm"); setError(""); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
              <ShieldOff size={15} /> Nonaktifkan 2FA
            </button>
          </>
        )}

        {step === "qr" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">1. Scan QR ini dengan aplikasi authenticator (Google Authenticator/Authy/dll):</p>
            <div className="flex justify-center">
              {qrDataUrl && <Image src={qrDataUrl} alt="QR 2FA" width={200} height={200} className="rounded-xl border border-gray-100" />}
            </div>
            <p className="text-xs text-gray-400 text-center">Tidak bisa scan? Masukkan manual: <code className="bg-gray-50 px-1.5 py-0.5 rounded font-mono">{secret}</code></p>
            <div>
              <label className="label-field">2. Masukkan kode 6 digit yang muncul di aplikasi</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
                className="input-field tracking-widest" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("idle")} className="btn-modal-cancel flex-1">Batal</button>
              <button onClick={verifyAndEnable} disabled={loading || !code.trim()} className="btn-modal-save flex-1">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Verifikasi & Aktifkan
              </button>
            </div>
          </div>
        )}

        {step === "backup-codes" && (
          <div className="space-y-4">
            <Alert variant="warning" title="Simpan kode cadangan ini SEKARANG">
              Kode ini HANYA ditampilkan sekali — pakai kalau HP/authenticator app hilang. Setiap kode cuma bisa dipakai sekali.
            </Alert>
            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map(c => <div key={c} className="text-center py-1">{c}</div>)}
            </div>
            <button onClick={copyBackupCodes}
              className="flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 transition">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Tersalin!" : "Salin semua kode"}
            </button>
            <button onClick={() => setStep("idle")} className="btn-modal-save w-full">
              Saya Sudah Menyimpan Kode Ini
            </button>
          </div>
        )}

        {step === "disable-confirm" && (
          <div className="space-y-4">
            <Alert variant="error" title="Konfirmasi password diperlukan">
              <span className="flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Menonaktifkan 2FA mengurangi keamanan akun ini.</span>
            </Alert>
            <div>
              <label className="label-field">Password saat ini</label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
                  className="input-field pl-10" autoFocus />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStep("idle"); setDisablePassword(""); setError(""); }} className="btn-modal-cancel flex-1">Batal</button>
              <button onClick={disable2fa} disabled={loading || !disablePassword.trim()}
                className="btn-hapus flex-1 justify-center">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldOff size={15} />}
                Ya, Nonaktifkan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
