"use client";
import { useState } from "react";
import { Loader2, ArrowRight, CheckCircle2, XCircle, Printer } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import type { Lang } from "@/lib/lang";

interface Result { name: string; className: string; majorName: string; lulus: boolean }

const ui = {
  id: {
    requiredErr: "NIS dan tanggal lahir wajib diisi.",
    genericErr: "Gagal memproses",
    passTitle: "SELAMAT, ANDA DINYATAKAN LULUS",
    notYetTitle: "Belum Dinyatakan Lulus",
    print: "Cetak",
    checkOther: "Cek Lainnya",
    nis: "NIS",
    nisPh: "Nomor Induk Siswa",
    birthDate: "Tanggal Lahir",
    submit: "Cek Status",
  },
  en: {
    requiredErr: "NIS and date of birth are required.",
    genericErr: "Something went wrong",
    passTitle: "CONGRATULATIONS, YOU HAVE PASSED",
    notYetTitle: "Not Yet Declared Passed",
    print: "Print",
    checkOther: "Check Another",
    nis: "Student ID (NIS)",
    nisPh: "Student ID Number",
    birthDate: "Date of Birth",
    submit: "Check Status",
  },
} as const;

export default function CekKelulusanForm({ lang = "id" }: { lang?: Lang }) {
  const t = ui[lang];
  const [nis, setNis] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nis.trim() || !birthDate) { setError(t.requiredErr); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/public/cek-kelulusan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nis, birthDate }),
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || t.genericErr); return; }
    setResult(await res.json());
  }

  if (result) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center print:shadow-none print:border-0">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.lulus ? "bg-emerald-50" : "bg-gray-100"}`}>
          {result.lulus ? <CheckCircle2 size={32} className="text-emerald-600" /> : <XCircle size={32} className="text-gray-400" />}
        </div>
        <h2 className="font-heading text-xl font-bold text-primary-900 mb-1">{result.name}</h2>
        <p className="text-gray-400 text-sm mb-4">{result.className} · {result.majorName}</p>
        <p className={`font-bold text-lg mb-6 ${result.lulus ? "text-emerald-600" : "text-gray-500"}`}>
          {result.lulus ? t.passTitle : t.notYetTitle}
        </p>
        <div className="flex items-center justify-center gap-3 print:hidden">
          {result.lulus && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-900 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              <Printer size={16} /> {t.print}
            </button>
          )}
          <button onClick={() => { setResult(null); setNis(""); setBirthDate(""); }} className="text-sm text-gray-400 hover:text-gray-600 font-semibold">
            {t.checkOther}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      {error && <p className="error-msg">{error}</p>}
      <div>
        <label className="label-field">{t.nis}</label>
        <input value={nis} onChange={e => setNis(e.target.value)} className="input-field font-mono" placeholder={t.nisPh} />
      </div>
      <div>
        <label className="label-field">{t.birthDate}</label>
        <DatePicker value={birthDate} onChange={setBirthDate} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-900 text-white font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-60">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t.submit}
      </button>
    </form>
  );
}
