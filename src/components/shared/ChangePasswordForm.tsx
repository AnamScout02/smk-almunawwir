"use client";
import { useState, useTransition } from "react";
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";

/** Isian sandi dengan tombol lihat/sembunyikan. SENGAJA di luar `ChangePasswordForm`: komponen yang didefinisikan di
 *  dalam komponen lain dibuat ulang tiap render, sehingga kolom kehilangan fokus setiap satu huruf diketik
 *  (laporan user 5 Okt 2026: "setelah menuliskan 1 karakter harus dipencet lagi kolomnya"). */
function IsianSandi({ value, onChange, show, onToggle, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string; autoComplete: string;
}) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} className="input-field pr-10" />
      <button type="button" onClick={onToggle} aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPw !== confirm) { setError("Konfirmasi password tidak cocok."); return; }
    if (newPw.length < 6) { setError("Password baru minimal 6 karakter."); return; }

    startTransition(async () => {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
      }).catch(() => null);
      if (!res?.ok) { const d = await res?.json().catch(() => ({})); setError(d?.error || "Gagal mengubah password."); return; }
      setSuccess(true);
      setCurrent(""); setNewPw(""); setConfirm("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="error-msg">{error}</p>}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} /> Password berhasil diubah!
        </div>
      )}
      <div>
        <label className="label-field">Password Lama</label>
        <IsianSandi value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)}
          placeholder="Masukkan password lama" autoComplete="current-password" />
      </div>
      <div>
        <label className="label-field">Password Baru</label>
        <IsianSandi value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)}
          placeholder="Minimal 6 karakter" autoComplete="new-password" />
      </div>
      <div>
        <label className="label-field">Konfirmasi Password Baru</label>
        <input type={showNew ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Ulangi password baru" autoComplete="new-password" className="input-field" />
      </div>
      <button type="submit" disabled={isPending} className="btn-modal-save w-full">
        {isPending ? <Loader2 className="animate-spin" /> : <Lock />}
        Ubah Password
      </button>
    </form>
  );
}
