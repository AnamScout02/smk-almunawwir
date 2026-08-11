"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Loader2, Save, Wand2, FileType2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import DatePicker from "@/components/shared/DatePicker";
import RichTextEditor from "@/components/shared/RichTextEditor";
import LetterheadImage from "@/components/shared/LetterheadImage";
import { useToast } from "@/components/shared/ToastProvider";

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

function fmtLong(dateStr: string) {
  if (!dateStr) return "…………………………";
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function BlankInput({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-transparent border-0 border-b border-dotted border-gray-400 focus:border-primary-500 outline-none px-1 py-1 text-sm text-primary-900 placeholder:text-gray-300 placeholder:italic ${className}`} />
  );
}

export default function SuratKeluarEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [nomor, setNomor] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [pihak, setPihak] = useState("");
  const [perihal, setPerihal] = useState("");
  const [klasifikasi, setKlasifikasi] = useState("");
  const [content, setContent] = useState("");
  const [penandaTangan, setPenandaTangan] = useState("Kepala SMK Al Munawwir IIBS");
  const [kopAtas, setKopAtas] = useState("");
  const [kopBawah, setKopBawah] = useState("");
  const [principalName, setPrincipalName] = useState("");

  useEffect(() => {
    fetch("/api/settings/school-info").then(r => r.json())
      .then(d => { setKopAtas(d.kopAtas ?? ""); setKopBawah(d.kopBawah ?? ""); setPrincipalName(d.principalName ?? ""); })
      .catch(() => {});
  }, []);

  const isKepalaSekolah = penandaTangan.trim() === "Kepala SMK Al Munawwir IIBS";

  // Begitu masuk mode "Tulis Surat Baru", langsung buat baris draft kosong di database supaya
  // halaman ini (dan tombol Editor Word) punya id nyata sejak awal, tanpa perlu isi+simpan dulu.
  useEffect(() => {
    if (!isNew) return;
    fetch("/api/admin/surat/draft", { method: "POST" }).then(async r => {
      if (!r.ok) { setError("Gagal membuat draft surat baru"); setLoading(false); return; }
      const d = await r.json();
      router.replace(`/dashboard/admin/persuratan/${d.id}/edit`);
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
      setContent(d.content ?? ""); setPenandaTangan(d.penandaTangan ?? "Kepala SMK Al Munawwir IIBS");
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

  async function handleSave() {
    if (!nomor.trim() || !pihak.trim() || !perihal.trim()) { setError("Nomor, kepada, dan perihal wajib diisi."); return; }
    setError("");
    setSaving(true);
    const body = { tipe: "KELUAR", nomor, tanggal, pihak, perihal, klasifikasi, content, penandaTangan };
    const res = await fetch(isNew ? "/api/admin/surat" : `/api/admin/surat/${id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    const saved = await res.json();
    toast.success("Surat berhasil disimpan");
    router.push(`/dashboard/admin/persuratan/${saved.id}/cetak`);
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Mail size={22} />}
        title={isNew ? "Tulis Surat Keluar" : "Edit Surat Keluar"}
        description="Isi langsung di lembar kerja di bawah — tampilannya mengikuti surat yang akan dicetak"
      />

      <div className="flex items-center gap-2 mb-5">
        {!isNew && (
          <Link href={`/dashboard/admin/persuratan/${id}/edit-word`}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
            <FileType2 size={13} /> Buka di Editor Word <span className="text-primary-600">(Beta)</span>
          </Link>
        )}
        <Link href="/dashboard/admin/persuratan" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition sm:ml-auto">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {/* Toolbar metadata — tidak tercetak langsung di badan surat, hanya dipakai untuk membentuk nomor otomatis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 max-w-[800px] mx-auto flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="label-field">Klasifikasi / Kode Jenis Surat</label>
          <input list="klasifikasi-list" value={klasifikasi} onChange={e => setKlasifikasi(e.target.value)} className="input-field" placeholder="cth: A.2" />
          <datalist id="klasifikasi-list">
            {KLASIFIKASI_SUGGESTIONS.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
          </datalist>
        </div>
        <div className="w-[160px]">
          <label className="label-field">Tanggal Surat</label>
          <DatePicker value={tanggal} onChange={setTanggal} />
        </div>
        <button type="button" onClick={handleGenerateNomor} disabled={generating}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold transition-colors">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Buat Nomor Otomatis
        </button>
      </div>

      {/* Slot toolbar RichTextEditor — dirender lewat portal, sengaja diletakkan DI LUAR kertas
          surat (sticky menempel di bawah header) supaya toolbar terasa seperti ribbon Word/Google
          Docs, bukan kotak yang menempel di tengah halaman. */}
      <div ref={setToolbarSlot} className="sticky top-[72px] lg:top-[84px] z-20 max-w-[800px] mx-auto mb-4" />

      {/* Lembar kerja — meniru tampilan surat resmi yang akan dicetak */}
      <div className="overflow-x-auto mb-6">
      <div className="a4-page print-doc bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mx-auto">
        <LetterheadImage url={kopAtas} alt="Kop Surat" />
        <div className="a4-page-body">

        <table className="text-sm mb-4 w-full">
          <tbody>
            <tr>
              <td className="pr-2 py-1 align-top w-24 text-primary-900">Nomor</td>
              <td className="pr-2 py-1 align-top text-primary-900">:</td>
              <td className="py-1 align-top"><BlankInput value={nomor} onChange={setNomor} placeholder="359/B.2/SMK_AM-IIBS/026/VII/2026" className="font-mono" /></td>
            </tr>
            <tr>
              <td className="pr-2 py-1 align-top text-primary-900">Perihal</td>
              <td className="pr-2 py-1 align-top text-primary-900">:</td>
              <td className="py-1 align-top"><BlankInput value={perihal} onChange={setPerihal} placeholder="Undangan Rapat Koordinasi" /></td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm text-primary-900 mb-1">Kepada Yth.</p>
        <div className="mb-6 max-w-md">
          <BlankInput value={pihak} onChange={setPihak} placeholder="Kepala Dinas Pendidikan Kab. Banyuwangi" className="font-semibold" />
        </div>

        <div className="mb-10">
          <RichTextEditor value={content} onChange={setContent} placeholder="Dengan hormat, ..." toolbarSlot={toolbarSlot} />
        </div>

        <div className="flex justify-end">
          <div className="text-sm text-center min-w-[220px]">
            <p className="mb-1 text-primary-900">Singojuruh, {fmtLong(tanggal)}</p>
            <div className="mb-14"><BlankInput value={penandaTangan} onChange={setPenandaTangan} className="text-center" /></div>
            <p className="font-bold underline text-primary-900">{isKepalaSekolah && principalName ? `( ${principalName} )` : " "}</p>
          </div>
        </div>
        </div>
        <LetterheadImage url={kopBawah} alt="Kop Bawah" />
      </div>
      </div>

      <div className="flex justify-center mb-8 max-w-[800px] mx-auto">
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm px-8">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Surat
        </button>
      </div>
    </div>
  );
}
