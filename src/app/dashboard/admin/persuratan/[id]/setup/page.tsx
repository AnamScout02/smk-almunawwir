"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Loader2, Wand2, FileType2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DatePicker from "@/components/shared/DatePicker";

const KLASIFIKASI_SUGGESTIONS = [
  { code: "A.1", label: "A.1 — Surat Keputusan Yayasan" },
  { code: "A.2", label: "A.2 — Surat Keputusan Kepala Sekolah" },
  { code: "B.1", label: "B.1 — Surat Permohonan" },
  { code: "B.2", label: "B.2 — Surat Keterangan" },
  { code: "B.3", label: "B.3 — Surat Pemberitahuan" },
  { code: "B.4", label: "B.4 — Surat Undangan" },
  { code: "B.5", label: "B.5 — Surat Tugas / Mandat" },
  { code: "B.6", label: "B.6 — Surat Rekomendasi / Mutasi" },
  { code: "B.7", label: "B.7 — Surat Perjanjian" },
  { code: "B.8", label: "B.8 — Surat Pernyataan" },
  { code: "B.9", label: "B.9 — Surat Edaran" },
  { code: "B.10", label: "B.10 — Surat Laporan / Pertanggungjawaban" },
  { code: "B.11", label: "B.11 — Surat Panggilan" },
  { code: "B.12", label: "B.12 — Surat Pengantar" },
];

// Alur "langsung ke Editor Word": cukup isi metadata singkat di sini (klasifikasi, nomor,
// perihal, tanggal, tujuan, penandatangan), lalu langsung diarahkan ke ONLYOFFICE untuk
// menulis isi suratnya — tidak lewat lembar kerja Tiptap penuh seperti alur /edit lama
// (yang tetap ada & dipertahankan utuh untuk mengedit surat yang sudah ada).
export default function SuratKeluarSetupPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [nomor, setNomor] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [pihak, setPihak] = useState("");
  const [perihal, setPerihal] = useState("");
  const [klasifikasi, setKlasifikasi] = useState("");
  const [penandaTangan, setPenandaTangan] = useState("Kepala SMK Al Munawwir IIBS");

  useEffect(() => {
    if (!isNew) return;
    fetch("/api/admin/surat/draft", { method: "POST" }).then(async r => {
      if (!r.ok) { setError("Gagal membuat draft surat baru"); setLoading(false); return; }
      const d = await r.json();
      router.replace(`/dashboard/admin/persuratan/${d.id}/setup`);
    }).catch(() => { setError("Gagal membuat draft surat baru"); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/admin/surat/${id}`).then(async r => {
      if (!r.ok) { setError("Surat tidak ditemukan"); setLoading(false); return; }
      const d = await r.json();
      setNomor(d.nomor ?? ""); setTanggal(new Date(d.tanggal).toISOString().slice(0, 10));
      setPihak(d.pihak ?? ""); setPerihal(d.perihal ?? ""); setKlasifikasi(d.klasifikasi ?? "");
      setPenandaTangan(d.penandaTangan ?? "Kepala SMK Al Munawwir IIBS");
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [id, isNew]);

  async function handleGenerateNomor() {
    if (!klasifikasi.trim()) { setError("Isi klasifikasi/kode jenis surat dulu sebelum membuat nomor otomatis."); return; }
    setError("");
    setGenerating(true);
    const res = await fetch(`/api/admin/surat/next-nomor?klasifikasi=${encodeURIComponent(klasifikasi.trim())}`);
    setGenerating(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal membuat nomor otomatis"); return; }
    const d = await res.json();
    setNomor(d.nomor);
  }

  async function handleContinue() {
    if (!nomor.trim() || !pihak.trim() || !perihal.trim()) { setError("Nomor, tujuan, dan perihal wajib diisi."); return; }
    setError("");
    setSaving(true);
    const res = await fetch(`/api/admin/surat/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipe: "KELUAR", nomor, tanggal, pihak, perihal, klasifikasi, penandaTangan }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    router.push(`/dashboard/admin/persuratan/${id}/edit-word`);
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Mail size={22} />}
        title="Tulis Surat Keluar"
        description="Isi data singkat surat, lalu lanjut ke Editor Word untuk menulis isinya"
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/admin/persuratan" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl mx-auto space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label-field">Klasifikasi / Kode Jenis Surat</label>
            <input list="klasifikasi-list" value={klasifikasi} onChange={e => setKlasifikasi(e.target.value)} className="input-field" placeholder="cth: A.2" />
            <datalist id="klasifikasi-list">
              {KLASIFIKASI_SUGGESTIONS.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
            </datalist>
          </div>
          <div>
            <label className="label-field">Tanggal Surat</label>
            <DatePicker value={tanggal} onChange={setTanggal} />
          </div>
        </div>

        <div>
          <label className="label-field">Nomor Surat</label>
          <div className="flex gap-2">
            <input value={nomor} onChange={e => setNomor(e.target.value)} className="input-field flex-1 font-mono" placeholder="359/B.2/SMK_AM-IIBS/026/VII/2026" />
            <button type="button" onClick={handleGenerateNomor} disabled={generating}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold transition-colors">
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Otomatis
            </button>
          </div>
        </div>

        <div>
          <label className="label-field">Perihal</label>
          <input value={perihal} onChange={e => setPerihal(e.target.value)} className="input-field" placeholder="Undangan Rapat Koordinasi" />
        </div>

        <div>
          <label className="label-field">Kepada Yth. / Tujuan Surat</label>
          <input value={pihak} onChange={e => setPihak(e.target.value)} className="input-field" placeholder="Kepala Dinas Pendidikan Kab. Banyuwangi" />
        </div>

        <div>
          <label className="label-field">Penandatangan</label>
          <input value={penandaTangan} onChange={e => setPenandaTangan(e.target.value)} className="input-field" placeholder="Kepala SMK Al Munawwir IIBS" />
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleContinue} disabled={saving} className="btn-gold flex items-center gap-2 text-sm px-8">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <FileType2 size={14} />} Lanjut ke Editor Word
          </button>
        </div>
      </div>
    </div>
  );
}
