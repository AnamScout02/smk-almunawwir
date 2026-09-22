"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Plus, Trash2, Save, Loader2, Image as ImageIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import {
  CoverTemplate, CoverTextBox, CoverField, COVER_TEMPLATE_KEY,
  FIELD_LABELS, resolveCoverText, defaultCoverTexts, DEFAULT_WIDTH_PCT,
} from "@/lib/cover-template";

const PREVIEW_CTX = {
  kelas: "X AK 1", kompetensi: "Akuntansi", waliKelas: "Nama Wali Kelas",
  tahunSemester: "2026-2027 · Ganjil", tahunPelajaran: "Tahun Pelajaran 2026-2027",
  semester: "Semester Ganjil", bulan: "Juli 2026",
};

export default function CoverEditorPage() {
  const toast = useToast();
  const [imageUrl, setImageUrl] = useState("");
  const [texts, setTexts] = useState<CoverTextBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/content")
      .then(r => r.json())
      .then((rows: { key: string; value: string }[]) => {
        const row = rows.find(r => r.key === COVER_TEMPLATE_KEY);
        if (row) {
          try {
            const tpl: CoverTemplate = JSON.parse(row.value);
            setImageUrl(tpl.imageUrl || "");
            setTexts(Array.isArray(tpl.texts) ? tpl.texts : []);
          } catch { /* ignore corrupt value */ }
        }
        setLoading(false);
      }).catch(() => { setLoading(false); });
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "absensi-jurnal/cover");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    setUploading(false);
    if (!res.ok) { toast.error(d.error || "Gagal mengupload gambar"); return; }
    setImageUrl(d.url);
    if (texts.length === 0) setTexts(defaultCoverTexts());
  }

  function addText() {
    const id = `t${Date.now()}`;
    const box: CoverTextBox = { id, field: "static", content: "Teks baru", xPct: 50, yPct: 50, widthPct: DEFAULT_WIDTH_PCT, fontSize: 18, color: "#0F1A45", bold: false, align: "center" };
    setTexts(t => [...t, box]);
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<CoverTextBox>) {
    if (!selectedId) return;
    setTexts(t => t.map(b => b.id === selectedId ? { ...b, ...patch } : b));
  }

  function deleteSelected() {
    if (!selectedId) return;
    setTexts(t => t.filter(b => b.id !== selectedId));
    setSelectedId(null);
  }

  function onPointerDownBox(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    setSelectedId(id);
    dragId.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveCanvas(e: React.PointerEvent) {
    if (!dragId.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setTexts(t => t.map(b => b.id === dragId.current ? { ...b, xPct, yPct } : b));
  }

  function onPointerUpCanvas() {
    dragId.current = null;
  }

  async function handleSave() {
    setSaving(true);
    const value = JSON.stringify({ imageUrl, texts } as CoverTemplate);
    const res = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: COVER_TEMPLATE_KEY, value }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Gagal menyimpan template"); return; }
    toast.success("Template cover tersimpan.");
  }

  const selected = texts.find(b => b.id === selectedId) ?? null;

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ImageIcon size={22} />}
        title="Desain Cover Absensi & Jurnal"
        description="Upload gambar latar dan atur teks — berlaku sebagai template untuk semua kelas"
      />

      <div className="flex items-center gap-2 mb-5">
        <Link href="/dashboard/admin/absensi-jurnal" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <button onClick={handleSave} disabled={saving}
          className="btn-modal-save sm:ml-auto">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Template
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Canvas */}
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-900 text-white rounded-lg text-sm cursor-pointer transition-colors">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {imageUrl ? "Ganti Gambar" : "Upload Gambar"}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <button onClick={addText} className="btn-modal-cancel">
              <Plus size={15} /> Tambah Teks
            </button>
          </div>

          <div
            ref={canvasRef}
            onPointerMove={onPointerMoveCanvas}
            onPointerUp={onPointerUpCanvas}
            onClick={() => setSelectedId(null)}
            className="relative w-full max-w-[794px] mx-auto bg-gray-100 border-2 border-dashed border-gray-200 rounded-lg overflow-hidden select-none"
            style={{ aspectRatio: "210 / 297", touchAction: "none" }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center px-8">
                Upload gambar latar (rasio A4 potrait) untuk mulai mendesain
              </div>
            )}
            {texts.map(box => (
              <div
                key={box.id}
                onPointerDown={e => onPointerDownBox(e, box.id)}
                onClick={e => e.stopPropagation()}
                className={`absolute px-1.5 py-0.5 cursor-move rounded ${selectedId === box.id ? "outline outline-2 outline-primary-500 bg-white/40" : "hover:bg-white/30"}`}
                style={{
                  left: `${box.xPct}%`, top: `${box.yPct}%`, transform: "translate(-50%, -50%)",
                  fontSize: `${box.fontSize}px`, color: box.color, fontWeight: box.bold ? 700 : 400,
                  textAlign: box.align, whiteSpace: "pre-wrap", width: `${box.widthPct ?? DEFAULT_WIDTH_PCT}%`,
                  fontFamily: "\"Arial Narrow\", Arial, sans-serif",
                }}
              >
                {resolveCoverText(box, PREVIEW_CTX) || "(kosong)"}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Klik &amp; seret teks untuk memindahkan posisi. Nilai seperti &quot;{PREVIEW_CTX.kelas}&quot; hanya contoh pratinjau — akan otomatis mengikuti kelas yang dicetak.</p>
        </div>

        {/* Side panel */}
        <div className="panel p-5 space-y-4">
          <h3 className="font-heading font-bold text-primary-900 text-sm">
            {selected ? "Edit Teks" : "Daftar Teks"}
          </h3>

          {!selected && (
            texts.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada teks. Klik &quot;Tambah Teks&quot; untuk mulai.</p>
            ) : (
              <div className="space-y-1.5">
                {texts.map(box => (
                  <button key={box.id} onClick={() => setSelectedId(box.id)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-primary-50 text-sm text-gray-700 truncate transition-colors">
                    {FIELD_LABELS[box.field]}{box.field === "static" ? `: ${box.content || "(kosong)"}` : ""}
                  </button>
                ))}
              </div>
            )
          )}

          {selected && (
            <>
              <div>
                <label className="label-field">Sumber Teks</label>
                <Select value={selected.field} onChange={v => updateSelected({ field: v as CoverField })}
                  options={Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label }))} />
              </div>
              {selected.field === "static" && (
                <div>
                  <label className="label-field">Isi Teks</label>
                  <input value={selected.content} onChange={e => updateSelected({ content: e.target.value })} className="input-field" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Ukuran (px)</label>
                  <input type="number" min={8} max={96} value={selected.fontSize} onChange={e => updateSelected({ fontSize: Number(e.target.value) || 12 })} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Warna</label>
                  <input type="color" value={selected.color} onChange={e => updateSelected({ color: e.target.value })} className="input-field h-[42px] p-1" />
                </div>
              </div>
              <div>
                <label className="label-field">Lebar Teks ({selected.widthPct ?? DEFAULT_WIDTH_PCT}%)</label>
                <input type="range" min={10} max={100} value={selected.widthPct ?? DEFAULT_WIDTH_PCT}
                  onChange={e => updateSelected({ widthPct: Number(e.target.value) })} className="w-full accent-primary-700" />
                <p className="text-xs text-gray-400 mt-0.5">Perbesar supaya teks panjang tidak terlalu banyak bungkus baris.</p>
              </div>
              <div>
                <label className="label-field">Perataan</label>
                <Select value={selected.align} onChange={v => updateSelected({ align: v as CoverTextBox["align"] })}
                  options={[{ value: "left", label: "Kiri" }, { value: "center", label: "Tengah" }, { value: "right", label: "Kanan" }]} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={selected.bold} onChange={e => updateSelected({ bold: e.target.checked })} />
                Tebal (Bold)
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setSelectedId(null)} className="btn-modal-cancel flex-1">Selesai</button>
                <button onClick={deleteSelected} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
