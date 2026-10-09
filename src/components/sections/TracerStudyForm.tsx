"use client";
import { useState } from "react";
import { Loader2, CheckCircle2, ArrowRight, ShieldCheck, Copy, Share2 } from "lucide-react";
import { salinTeks } from "@/lib/salin-teks";
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
    wajib: "NISN/NIS dan tanggal lahir wajib diisi.", gagalVerifikasi: "Gagal verifikasi", gagalSimpan: "Gagal menyimpan",
    terimaKasih: "Terima Kasih!", tersimpan: (nama: string) => `Data Anda sudah tersimpan. Semoga sukses selalu, ${nama}!`,
    angkatan: "Angkatan", statusSaatIni: "Status Saat Ini", instansi: "Nama Perusahaan/Kampus (opsional)", jabatan: "Jabatan/Jurusan (opsional)",
    hp: "No. HP (opsional)", email: "Email (opsional)", catatan: "Catatan (opsional)", catatanPh: "Cerita singkat, pesan untuk adik kelas, dsb.",
    simpan: "Simpan Data", petunjuk: "Masukkan NISN (tercetak di ijazah) atau NIS, dan tanggal lahir Anda, untuk memastikan ini benar Anda.",
    nomor: "NISN atau NIS", nisPh: "Contoh: 0051234567", tglLahir: "Tanggal Lahir", verifikasi: "Verifikasi",
    ajakJudul: "Ajak adik kelas mendaftar", ajakIsi: "Ini tautan ajakan pribadi Anda. Calon murid yang mendaftar lewat tautan ini tercatat atas nama Anda.",
    kode: "Kode referral", salin: "Salin tautan", disalin: "Tautan disalin", gagalSalin: "Gagal menyalin — salin manual dari kotak di atas", bagikan: "Bagikan ke WhatsApp",
    pesanWa: (t: string) => `Assalamu'alaikum. Saya alumni SMK Al-Munawwir IIBS. Pendaftaran murid baru sudah dibuka — daftar lewat tautan ini ya: ${t}`,
  },
  en: {
    status: [
      { value: "BEKERJA", label: "Working" },
      { value: "KULIAH", label: "Continuing Studies" },
      { value: "WIRAUSAHA", label: "Self-employed" },
      { value: "BELUM_BEKERJA", label: "Not Yet Working/Studying" },
      { value: "LAINNYA", label: "Other" },
    ],
    wajib: "NISN/NIS and date of birth are required.", gagalVerifikasi: "Verification failed", gagalSimpan: "Failed to save",
    terimaKasih: "Thank You!", tersimpan: (nama: string) => `Your data has been saved. Wishing you continued success, ${nama}!`,
    angkatan: "Class of", statusSaatIni: "Current Status", instansi: "Company/University Name (optional)", jabatan: "Position/Major (optional)",
    hp: "Phone No. (optional)", email: "Email (optional)", catatan: "Notes (optional)", catatanPh: "A short story, a message for younger students, etc.",
    simpan: "Save Data", petunjuk: "Enter your NISN (printed on your diploma) or school ID (NIS), and your date of birth, to confirm it is you.",
    nomor: "NISN or NIS", nisPh: "e.g. 0051234567", tglLahir: "Date of Birth", verifikasi: "Verify",
    ajakJudul: "Invite others to enrol", ajakIsi: "This is your personal invitation link. Applicants who register through it are recorded under your name.",
    kode: "Referral code", salin: "Copy link", disalin: "Link copied", gagalSalin: "Could not copy — please copy it manually from the box above", bagikan: "Share on WhatsApp",
    pesanWa: (t: string) => `Hello. I am an alumnus of SMK Al-Munawwir IIBS. New student admission is open — register through this link: ${t}`,
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
  const [referral, setReferral] = useState<{ kode: string; tautan: string } | null>(null);
  const [salin, setSalin] = useState<"" | "ok" | "gagal">("");

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
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setSaveError(d.error || c.gagalSimpan); return; }
    setReferral(d.referral ?? null);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="panel p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h2 className="font-heading text-lg font-bold text-primary-900 mb-1">{c.terimaKasih}</h2>
        <p className="text-gray-500 text-sm">{c.tersimpan(data?.name ?? "")}</p>
        {referral && (
          <div className="mt-6 rounded-xl border border-gold/40 bg-amber-50/60 p-4 text-left">
            <p className="font-heading text-sm font-semibold text-primary-900">{c.ajakJudul}</p>
            <p className="mt-1 text-xs text-gray-500">{c.ajakIsi}</p>
            <p className="mt-3 text-xs text-gray-500">{c.kode}: <span className="font-mono text-sm font-bold text-primary-900">{referral.kode}</span></p>
            <input readOnly value={referral.tautan} onFocus={e => e.target.select()} className="input-field mt-2 font-mono text-xs" />
            {salin && <p className={`mt-2 text-xs ${salin === "ok" ? "text-emerald-700" : "text-red-600"}`}>{salin === "ok" ? c.disalin : c.gagalSalin}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-modal-cancel" onClick={async () => setSalin((await salinTeks(referral.tautan)) ? "ok" : "gagal")}>
                <Copy size={16} /> {c.salin}
              </button>
              <a className="btn-modal-save" target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(c.pesanWa(referral.tautan))}`}>
                <Share2 size={16} /> {c.bagikan}
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "form" && data) {
    return (
      <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
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
          className="btn-primary w-full disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {c.simpan}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="panel p-6 space-y-4">
      <p className="text-xs text-gray-400">{c.petunjuk}</p>
      {verifyError && <p className="error-msg">{verifyError}</p>}
      <div>
        <label className="label-field">{c.nomor}</label>
        <input value={nis} onChange={e => setNis(e.target.value)} className="input-field font-mono" placeholder={c.nisPh} inputMode="text" autoComplete="off" />
      </div>
      <div>
        <label className="label-field">{c.tglLahir}</label>
        <DatePicker value={birthDate} onChange={setBirthDate} />
      </div>
      <button type="submit" disabled={verifying}
        className="btn-primary w-full disabled:opacity-60">
        {verifying ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {c.verifikasi}
      </button>
    </form>
  );
}
