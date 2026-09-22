"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";
import type { Lang } from "@/lib/lang";

const TEKS = {
  id: {
    status: [
      { value: "BEKERJA", label: "Bekerja" },
      { value: "KULIAH", label: "Melanjutkan Kuliah" },
      { value: "WIRAUSAHA", label: "Berwirausaha" },
      { value: "BELUM_BEKERJA", label: "Belum Bekerja/Kuliah" },
      { value: "LAINNYA", label: "Lainnya" },
    ],
    wajib: "NIS dan tanggal lahir wajib diisi.", gagalVerifikasi: "Gagal verifikasi", gagalSimpan: "Gagal menyimpan",
    terimaKasih: "Terima Kasih!", tersimpan: (nama: string) => `Data Anda sudah tersimpan. Semoga sukses selalu, ${nama}!`,
    angkatan: "Angkatan", statusSaatIni: "Status Saat Ini", instansi: "Nama Perusahaan/Kampus (opsional)", jabatan: "Jabatan/Jurusan (opsional)",
    hp: "No. HP (opsional)", email: "Email (opsional)", catatan: "Catatan (opsional)", catatanPh: "Cerita singkat, pesan untuk adik kelas, dsb.",
    simpan: "Simpan Data", petunjuk: "Masukkan NIS dan tanggal lahir sesuai data di Buku Induk untuk verifikasi identitas Anda.",
    nisPh: "Nomor Induk Siswa", tglLahir: "Tanggal Lahir", verifikasi: "Verifikasi",
  },
  en: {
    status: [
      { value: "BEKERJA", label: "Working" },
      { value: "KULIAH", label: "Continuing Studies" },
      { value: "WIRAUSAHA", label: "Self-employed" },
      { value: "BELUM_BEKERJA", label: "Not Yet Working/Studying" },
      { value: "LAINNYA", label: "Other" },
    ],
    wajib: "Student ID (NIS) and date of birth are required.", gagalVerifikasi: "Verification failed", gagalSimpan: "Failed to save",
    terimaKasih: "Thank You!", tersimpan: (nama: string) => `Your data has been saved. Wishing you continued success, ${nama}!`,
    angkatan: "Class of", statusSaatIni: "Current Status", instansi: "Company/University Name (optional)", jabatan: "Position/Major (optional)",
    hp: "Phone No. (optional)", email: "Email (optional)", catatan: "Notes (optional)", catatanPh: "A short story, a message for younger students, etc.",
    simpan: "Save Data", petunjuk: "Enter your Student ID (NIS) and date of birth as recorded in the school register to verify your identity.",
    nisPh: "Student ID Number", tglLahir: "Date of Birth", verifikasi: "Verify",
  },
};

interface VerifiedData {
  token: string; name: string; majorName: string; enrollYear: number | null;
  existing: { status: string; institutionName: string | null; position: string | null; contactPhone: string | null; contactEmail: string | null; notes: string | null } | null;
}

export default function TracerStudyForm({ lang = "id" }: { lang?: Lang }) {
  const c = TEKS[lang];
  const [step, setStep] = useState<"verify" | "form" | "done">("verify");
  const [nis, setNis] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [data, setData] = useState<VerifiedData | null>(null);

  const [form, setForm] = useState({ status: "BEKERJA", institutionName: "", position: "", contactPhone: "", contactEmail: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!nis.trim() || !birthDate) { setVerifyError(c.wajib); return; }
    setVerifying(true);
    setVerifyError("");
    const res = await fetch("/api/public/tracer-study/verify", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nis, birthDate }),
    });
    setVerifying(false);
    if (!res.ok) { const d = await res.json(); setVerifyError(d.error || c.gagalVerifikasi); return; }
    const result: VerifiedData = await res.json();
    setData(result);
    if (result.existing) {
      setForm({
        status: result.existing.status,
        institutionName: result.existing.institutionName ?? "",
        position: result.existing.position ?? "",
        contactPhone: result.existing.contactPhone ?? "",
        contactEmail: result.existing.contactEmail ?? "",
        notes: result.existing.notes ?? "",
      });
    }
    setStep("form");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/public/tracer-study/submit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.token, ...form }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setSaveError(d.error || c.gagalSimpan); return; }
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h2 className="font-heading text-lg font-bold text-primary-900 mb-1">{c.terimaKasih}</h2>
        <p className="text-gray-500 text-sm">{c.tersimpan(data?.name ?? "")}</p>
      </div>
    );
  }

  if (step === "form" && data) {
    return (
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-xl p-3 mb-2">
          <ShieldCheck size={18} className="text-primary-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary-900 text-sm">{data.name}</p>
            <p className="text-gray-400 text-xs">{data.majorName} · {c.angkatan} {data.enrollYear ?? "—"}</p>
          </div>
        </div>
        {saveError && <p className="error-msg">{saveError}</p>}
        <div>
          <label className="label-field">{c.statusSaatIni}</label>
          <Select value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={c.status} />
        </div>
        <div>
          <label className="label-field">{c.instansi}</label>
          <input value={form.institutionName} onChange={e => setForm(p => ({ ...p, institutionName: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="label-field">{c.jabatan}</label>
          <input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-field">{c.hp}</label>
            <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-field">{c.email}</label>
            <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="input-field" />
          </div>
        </div>
        <div>
          <label className="label-field">{c.catatan}</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="input-field resize-none" placeholder={c.catatanPh} />
        </div>
        <button type="submit" disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-900 text-white font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {c.simpan}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <p className="text-xs text-gray-400">{c.petunjuk}</p>
      {verifyError && <p className="error-msg">{verifyError}</p>}
      <div>
        <label className="label-field">NIS</label>
        <input value={nis} onChange={e => setNis(e.target.value)} className="input-field font-mono" placeholder={c.nisPh} />
      </div>
      <div>
        <label className="label-field">{c.tglLahir}</label>
        <DatePicker value={birthDate} onChange={setBirthDate} />
      </div>
      <button type="submit" disabled={verifying}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-900 text-white font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-60">
        {verifying ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {c.verifikasi}
      </button>
    </form>
  );
}
