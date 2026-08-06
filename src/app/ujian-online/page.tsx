"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Loader2, LogIn } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

export default function StudentUjianJoinPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    if (!token.trim()) { setError("Masukkan token ujian."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/exams/join", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal bergabung ke ujian"); return; }
      const d = await res.json();
      router.push(`/ujian-online/${d.examId}`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileQuestion size={22} />} title="Ujian Online (CBT)" description="Masukkan token ujian dari guru untuk mulai mengerjakan" />

      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mt-8 text-center">
        <FileQuestion size={40} className="mx-auto mb-4 text-primary-300" />
        <p className="text-sm text-gray-500 mb-5">Minta token ujian dari guru mata pelajaran, lalu masukkan di sini.</p>
        {error && <p className="error-msg mb-3">{error}</p>}
        <input
          value={token}
          onChange={e => setToken(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
          className="input-field text-center font-mono text-xl tracking-widest font-bold mb-4"
          placeholder="TOKEN"
          maxLength={6}
        />
        <button onClick={handleJoin} disabled={loading} className="btn-gold w-full flex items-center justify-center gap-2 text-sm">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Mulai Ujian
        </button>
      </div>
    </div>
  );
}
