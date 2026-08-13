"use client";
import { useEffect, useState, useTransition, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Save, Loader2, ArrowLeft, Plus, X, ImagePlus, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ImageUpload from "@/components/admin/ImageUpload";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
}

interface MajorDetail {
  id: string;
  name: string;
  code: string;
  tagline: string | null;
  longDesc: string | null;
  skills: string[];
  career: string[];
  cert: string | null;
  features: string[];
  themeColor: string | null;
  gallery: GalleryPhoto[];
}

function ListEditor({ label, items, onChange, placeholder }: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="label-field">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => onChange(items.map((it, j) => j === i ? e.target.value : it))}
              className="input-field flex-1 min-w-0"
              placeholder={placeholder}
            />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="w-10 h-10 shrink-0 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ""])}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-gold transition-colors">
          <Plus size={14} /> Tambah item
        </button>
      </div>
    </div>
  );
}

export default function MajorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [major, setMajor] = useState<MajorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/majors/${id}`);
    if (res.ok) setMajor(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function update<K extends keyof MajorDetail>(key: K, value: MajorDetail[K]) {
    setMajor(m => m ? { ...m, [key]: value } : m);
    setSaved(false);
  }

  async function handleSave() {
    if (!major) return;
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/majors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: major.name,
          code: major.code,
          description: major.tagline || major.name,
          tagline: major.tagline,
          longDesc: major.longDesc,
          skills: major.skills,
          career: major.career,
          cert: major.cert,
          features: major.features,
          themeColor: major.themeColor,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  async function addPhoto(url: string) {
    if (!url) return;
    setUploading(true);
    const res = await fetch(`/api/admin/majors/${id}/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url }),
    });
    if (res.ok) await load();
    setUploading(false);
  }

  async function deletePhoto(photoId: string) {
    if (!(await confirmDialog("Hapus foto ini?"))) return;
    await fetch(`/api/admin/majors/${id}/gallery/${photoId}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
      </div>
    );
  }

  if (!major) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8 text-center text-gray-400 py-20">
        Jurusan tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Save size={22} />}
        title={`Detail Halaman Publik — ${major.name}`}
        description="Konten ini tampil di halaman /programs di website"
      />

      <div className="flex justify-end mb-5">
        <button onClick={() => router.push("/dashboard/admin/majors")}
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-heading font-bold text-navy">Konten Utama</h2>
            {error && <p className="error-msg">{error}</p>}
            <div>
              <label className="label-field">Tagline</label>
              <input value={major.tagline ?? ""} onChange={e => update("tagline", e.target.value)}
                placeholder="cth: Networking, Security, Cloud & Server Management"
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Deskripsi Lengkap</label>
              <textarea value={major.longDesc ?? ""} onChange={e => update("longDesc", e.target.value)}
                rows={4} placeholder="Paragraf deskripsi lengkap program keahlian ini..."
                className="input-field resize-none" />
            </div>
            <div>
              <label className="label-field">Sertifikasi</label>
              <input value={major.cert ?? ""} onChange={e => update("cert", e.target.value)}
                placeholder="cth: Sertifikasi BNSP Skema Teknisi Jaringan Komputer"
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Warna Tema Jurusan</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={major.themeColor ?? "#1B2B6B"}
                  onChange={e => update("themeColor", e.target.value)}
                  className="w-12 h-11 rounded-xl border border-gray-200 cursor-pointer shrink-0 p-0.5"
                />
                <input
                  value={major.themeColor ?? ""}
                  onChange={e => update("themeColor", e.target.value)}
                  placeholder="#1B2B6B"
                  className="input-field font-mono uppercase"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Dipakai untuk warna latar halaman detail publik jurusan ini (badge, tombol, dll).</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-heading font-bold text-navy">Kompetensi yang Dipelajari</h2>
            <ListEditor label="" items={major.skills} onChange={v => update("skills", v)} placeholder="cth: Instalasi & Konfigurasi Jaringan Komputer" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-heading font-bold text-navy">Peluang Karier</h2>
            <ListEditor label="" items={major.career} onChange={v => update("career", v)} placeholder="cth: Network Administrator" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-heading font-bold text-navy">Keunggulan Program</h2>
            <ListEditor label="" items={major.features} onChange={v => update("features", v)} placeholder="cth: Lab Jaringan Cisco" />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={isPending} className="btn-modal-save">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
            {saved && <span className="text-emerald-600 text-sm font-semibold">Tersimpan ✓</span>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-heading font-bold text-navy flex items-center gap-2">
              <ImagePlus size={18} className="text-primary-700" /> Galeri Kegiatan
            </h2>
            <p className="text-xs text-gray-400">Foto kegiatan jurusan ini yang tampil di halaman detail publik.</p>

            <ImageUpload
              value=""
              onChange={addPhoto}
              folder="majors-gallery"
              label={uploading ? "Mengunggah..." : "Tambah Foto"}
            />

            {major.gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {major.gallery.map(g => (
                  <div key={g.id} className="relative rounded-xl overflow-hidden border border-gray-100 group aspect-video">
                    <Image src={g.imageUrl} alt={g.caption ?? major.name} fill sizes="200px" className="object-cover" unoptimized />
                    <button
                      onClick={() => deletePhoto(g.id)}
                      className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
