"use client";
import { useState, useTransition } from "react";
import { Lock, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";

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
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setSuccess(true);
      setCurrent(""); setNewPw(""); setConfirm("");
    });
  }

  const InputField = ({
    value, onChange, show, onToggle, placeholder
  }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string }) => (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:border-primary-500 outline-none"
      />
      <button type="button" onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} /> Password berhasil diubah!
        </div>
      )}
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Password Lama</label>
        <InputField value={current} onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} placeholder="Masukkan password lama" />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Password Baru</label>
        <InputField value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="Minimal 6 karakter" />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Konfirmasi Password Baru</label>
        <div className="relative">
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Ulangi password baru"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" />
        </div>
      </div>
      <button type="submit" disabled={isPending}
        className="w-full bg-primary-700 hover:bg-primary-800 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60">
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        Ubah Password
      </button>
    </form>
  );
}
