"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Trash2, Save, Loader2, IdCard, Image as ImageIcon, ScanLine, PenTool, Type } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import {
  KartuTemplate, KartuBox, KartuBoxType, KartuTextField, KARTU_TEMPLATE_KEY,
  FIELD_LABELS, BOX_TYPE_LABELS, resolveKartuText, resolveShape, DEFAULT_WIDTH_PCT, DEFAULT_PHOTO_SIZE, DEFAULT_QR_SIZE,
  emptyKartuTemplate,
} from "@/lib/kartu-tanda-template";

const SHAPE_LABELS: Record<"square" | "rounded" | "circle", string> = { square: "Persegi", rounded: "Membulat", circle: "Bulat" };

// Ukuran fisik kartu ID standar CR80/KTP (mm) — dipakai buat konversi %<->mm khusus elemen Foto,
// supaya admin bisa isi ukuran foto langsung dalam mm (mis. standar foto formal 3x4cm = 30x40mm)
// alih-alih persen yang susah dibayangkan ukuran aslinya.
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 54;
const pctToMmW = (pct: number) => Math.round((pct / 100) * CARD_WIDTH_MM * 10) / 10;
const pctToMmH = (pct: number) => Math.round((pct / 100) * CARD_HEIGHT_MM * 10) / 10;
const mmToPctW = (mm: number) => (mm / CARD_WIDTH_MM) * 100;
const mmToPctH = (mm: number) => (mm / CARD_HEIGHT_MM) * 100;

const PREVIEW_CTX = {
  nama: "Ahmad Nuril Hakim", identifier: "SPMB26-TKJ-015", sub: "X TKJ 1 · Teknik Komputer dan Jaringan",
  kelas: "X TKJ 1", jurusan: "Teknik Komputer dan Jaringan",
  ttl: "Banyuwangi, 12 Januari 2010", agama: "Islam", jenisKartu: "Pelajar",
  namaSekolah: "SMK Al-Munawwir IIBS", alamatSekolah: "Jl. Kedungliwung No. 36, Kemiri, Banyuwangi",
  kontakSekolah: "0838-7820-3670 · smkalmunawwir@gmail.com", namaKepsek: "Ahmad Azmi Khoirul Umam, S.Pt, M.Pt, M.Sc",
};

const BOX_TYPE_ICON: Record<KartuBoxType, React.ElementType> = { text: Type, photo: ImageIcon, qr: ScanLine, signature: PenTool };

export default function KartuTandaEditorPage() {
  const toast = useToast();
  const [template, setTemplate] = useState<KartuTemplate>(emptyKartuTemplate());
  const [side, setSide] = useState<"front" | "back">("front");
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
        const row = rows.find(r => r.key === KARTU_TEMPLATE_KEY);
        if (row) {
          try {
            const tpl = JSON.parse(row.value) as Partial<KartuTemplate>;
            setTemplate({ front: tpl.front ?? { imageUrl: "", boxes: [] }, back: tpl.back ?? { imageUrl: "", boxes: [] } });
          } catch { /* ignore corrupt value */ }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const current = template[side];
  function setCurrent(patch: Partial<typeof current>) {
    setTemplate(t => ({ ...t, [side]: { ...t[side], ...patch } }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "kartu-tanda");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    setUploading(false);
    if (!res.ok) { toast.error(d.error || "Gagal mengupload gambar"); return; }
    setCurrent({ imageUrl: d.url });
  }

  function addBox(type: KartuBoxType) {
    // Event handler (dipanggil dari onClick), bukan dieksekusi saat render; pola sama persis dgn
    // addText() di cover-editor yg lolos lint, cuma beda bentuk ekspresi (ternary) yg kelihatannya
    // bikin analisis statis rule ini salah duga.
    // eslint-disable-next-line react-hooks/purity
    const id = `b${Date.now()}`;
    const base = { id, type, xPct: 50, yPct: 50 };
    const box: KartuBox = type === "text"
      ? { ...base, field: "static", content: "Teks baru", widthPct: DEFAULT_WIDTH_PCT, fontSize: 14, color: "#0F1A45", bold: false, align: "center" }
      : type === "photo"
        ? { ...base, widthPct: DEFAULT_PHOTO_SIZE.widthPct, heightPct: DEFAULT_PHOTO_SIZE.heightPct, shape: "rounded" }
        : { ...base, widthPct: DEFAULT_QR_SIZE.widthPct, heightPct: DEFAULT_QR_SIZE.heightPct, shape: "square" };
    setCurrent({ boxes: [...current.boxes, box] });
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<KartuBox>) {
    if (!selectedId) return;
    setCurrent({ boxes: current.boxes.map(b => b.id === selectedId ? { ...b, ...patch } : b) });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setCurrent({ boxes: current.boxes.filter(b => b.id !== selectedId) });
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
    setCurrent({ boxes: current.boxes.map(b => b.id === dragId.current ? { ...b, xPct, yPct } : b) });
  }
  function onPointerUpCanvas() { dragId.current = null; }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/content", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: KARTU_TEMPLATE_KEY, value: JSON.stringify(template) }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Gagal menyimpan template"); return; }
    toast.success("Desain Kartu Tanda tersimpan.");
  }

  const selected = current.boxes.find(b => b.id === selectedId) ?? null;

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<IdCard size={22} />} title="Desain Kartu Tanda"
        description="Upload gambar latar depan/belakang, atur foto/QR/teks — berlaku sbg template semua kartu. Kosongkan gambar latar utk pakai desain bawaan." />

      <div className="flex items-center gap-2 mb-5">
        <Link href="/dashboard/admin/kartu-tanda" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(["front", "back"] as const).map(s => (
            <button key={s} onClick={() => { setSide(s); setSelectedId(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${side === s ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
              {s === "front" ? "Sisi Depan" : "Sisi Belakang"}
            </button>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm sm:ml-auto">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Template
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Canvas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm cursor-pointer transition-colors">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {current.imageUrl ? "Ganti Gambar" : "Upload Gambar"}
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(["text", "photo", "qr", "signature"] as KartuBoxType[]).map(t => {
                const Icon = BOX_TYPE_ICON[t];
                return (
                  <button key={t} onClick={() => addBox(t)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-semibold transition-colors">
                    <Icon size={13} /> {BOX_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            ref={canvasRef}
            onPointerMove={onPointerMoveCanvas}
            onPointerUp={onPointerUpCanvas}
            onClick={() => setSelectedId(null)}
            className="relative w-full max-w-[600px] mx-auto bg-gray-100 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden select-none"
            style={{ aspectRatio: "85.6 / 54", touchAction: "none" }}
          >
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center px-8">
                Upload gambar latar (rasio kartu ID 85.6:54) untuk mulai mendesain — kosongkan utk pakai desain bawaan
              </div>
            )}
            {current.boxes.map(box => {
              const Icon = BOX_TYPE_ICON[box.type];
              const isSelected = selectedId === box.id;
              const commonStyle = { left: `${box.xPct}%`, top: `${box.yPct}%`, transform: "translate(-50%, -50%)" };
              if (box.type === "text") {
                return (
                  <div key={box.id} onPointerDown={e => onPointerDownBox(e, box.id)} onClick={e => e.stopPropagation()}
                    className={`absolute px-1.5 py-0.5 cursor-move rounded ${isSelected ? "outline outline-2 outline-primary-500 bg-white/40" : "hover:bg-white/30"}`}
                    style={{
                      ...commonStyle, fontSize: `${box.fontSize}px`, color: box.color, fontWeight: box.bold ? 700 : 400,
                      textAlign: box.align, whiteSpace: "pre-wrap", width: `${box.widthPct ?? DEFAULT_WIDTH_PCT}%`,
                    }}>
                    {resolveKartuText(box, PREVIEW_CTX) || "(kosong)"}
                  </div>
                );
              }
              return (
                <div key={box.id} onPointerDown={e => onPointerDownBox(e, box.id)} onClick={e => e.stopPropagation()}
                  className={`absolute cursor-move flex flex-col items-center justify-center gap-0.5 bg-white/70 border overflow-hidden ${isSelected ? "outline outline-2 outline-primary-500 border-primary-400" : "border-gray-300 hover:border-primary-300"} ${{ square: "rounded-none", rounded: "rounded-lg", circle: "rounded-full" }[resolveShape(box)]}`}
                  style={{ ...commonStyle, width: `${box.widthPct}%`, height: `${box.heightPct}%` }}>
                  <Icon size={16} className="text-gray-400" />
                  <span className="text-[9px] font-semibold text-gray-400 uppercase">{BOX_TYPE_LABELS[box.type]}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Klik &amp; seret elemen untuk memindahkan posisi. Foto/QR/TTD ditampilkan sbg placeholder di sini — akan otomatis diisi data asli tiap orang saat dicetak.</p>
        </div>

        {/* Side panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-heading font-bold text-primary-900 text-sm">{selected ? `Edit ${BOX_TYPE_LABELS[selected.type]}` : "Daftar Elemen"}</h3>

          {!selected && (
            current.boxes.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada elemen. Pilih salah satu tombol di atas kanvas untuk mulai.</p>
            ) : (
              <div className="space-y-1.5">
                {current.boxes.map(box => (
                  <button key={box.id} onClick={() => setSelectedId(box.id)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-primary-50 text-sm text-gray-700 truncate transition-colors">
                    {BOX_TYPE_LABELS[box.type]}{box.type === "text" ? `: ${box.field === "static" ? (box.content || "(kosong)") : FIELD_LABELS[box.field as KartuTextField]}` : ""}
                  </button>
                ))}
              </div>
            )
          )}

          {selected && selected.type === "text" && (
            <>
              <div>
                <label className="label-field">Sumber Teks</label>
                <Select value={selected.field ?? "static"} onChange={v => updateSelected({ field: v as KartuTextField })}
                  options={Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label }))} />
              </div>
              {selected.field === "static" && (
                <div>
                  <label className="label-field">Isi Teks</label>
                  <input value={selected.content ?? ""} onChange={e => updateSelected({ content: e.target.value })} className="input-field" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Ukuran (px)</label>
                  <input type="number" min={6} max={48} value={selected.fontSize} onChange={e => updateSelected({ fontSize: Number(e.target.value) || 12 })} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Warna</label>
                  <input type="color" value={selected.color} onChange={e => updateSelected({ color: e.target.value })} className="input-field h-[42px] p-1" />
                </div>
              </div>
              <div>
                <label className="label-field">Lebar Teks ({selected.widthPct}%)</label>
                <input type="range" min={10} max={100} value={selected.widthPct} onChange={e => updateSelected({ widthPct: Number(e.target.value) })} className="w-full accent-primary-700" />
              </div>
              <div>
                <label className="label-field">Perataan</label>
                <Select value={selected.align ?? "center"} onChange={v => updateSelected({ align: v as KartuBox["align"] })}
                  options={[{ value: "left", label: "Kiri" }, { value: "center", label: "Tengah" }, { value: "right", label: "Kanan" }]} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={!!selected.bold} onChange={e => updateSelected({ bold: e.target.checked })} /> Tebal (Bold)
              </label>
            </>
          )}

          {selected && selected.type !== "text" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Lebar (mm)</label>
                  <input type="number" min={3} max={CARD_WIDTH_MM} step={0.5} value={pctToMmW(selected.widthPct)}
                    onChange={e => updateSelected({ widthPct: mmToPctW(Number(e.target.value) || 10) })} className="input-field" />
                </div>
                <div>
                  <label className="label-field">Tinggi (mm)</label>
                  <input type="number" min={3} max={CARD_HEIGHT_MM} step={0.5} value={pctToMmH(selected.heightPct ?? 20)}
                    onChange={e => updateSelected({ heightPct: mmToPctH(Number(e.target.value) || 10) })} className="input-field" />
                </div>
              </div>
              {selected.type === "photo" && (
                <p className="text-[11px] text-gray-400">Standar foto formal Indonesia 3x4cm = lebar 30mm, tinggi 40mm.</p>
              )}
              <div>
                <label className="label-field">Bentuk</label>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {(["square", "rounded", "circle"] as const).map(s => (
                    <button key={s} type="button" onClick={() => updateSelected({ shape: s })}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${resolveShape(selected) === s ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
                      {SHAPE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {selected && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => setSelectedId(null)} className="btn-modal-cancel flex-1 text-sm">Selesai</button>
              <button onClick={deleteSelected} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">
                <Trash2 size={14} /> Hapus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
