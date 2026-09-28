"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";

interface Props {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  accept?: string;
  hint?: string;
  aspect?: "wide" | "portrait";
  checkRatio?: number; // target width/height, mis. 3/4 untuk foto 3x4
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal membaca gambar")); };
    img.src = url;
  });
}

export default function ImageUpload({
  value, onChange, folder = "misc", label = "Foto",
  accept = "image/*", hint = "JPG, PNG, WEBP — maks. 5MB", aspect = "wide", checkRatio,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxSize = aspect === "portrait" ? "w-36 h-48" : "w-full h-48";

  async function handleFile(file: File) {
    setError("");
    setWarning("");
    if (accept !== "image/*") {
      const allowedTypes = accept.split(",").map(t => t.trim());
      if (!allowedTypes.includes(file.type)) {
        setError("Format tidak didukung. Gunakan JPG atau PNG.");
        return;
      }
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }
    if (checkRatio) {
      try {
        const { width, height } = await readImageDimensions(file);
        const ratio = width / height;
        const deviation = Math.abs(ratio - checkRatio) / checkRatio;
        if (deviation > 0.2) {
          setWarning(`Rasio foto ini ${width}×${height} px, kurang mendekati 3:4. Foto tetap diunggah, tapi disarankan pakai foto formal rasio 3:4.`);
        }
      } catch {
        // gagal baca dimensi tidak menghalangi upload
      }
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload");
      onChange(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {value ? (
        <div className={`relative ${boxSize} rounded-xl overflow-hidden border border-gray-200 group`}>
          <Image src={value} alt="Preview" fill sizes="100vw" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`${boxSize} border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors`}
        >
          {loading ? (
            <Loader2 size={24} className="animate-spin text-gray-400" />
          ) : (
            <>
              <Upload size={32} className="text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 text-center px-2">Klik atau drag & drop foto di sini</p>
              <p className="text-xs text-gray-400 mt-1 text-center px-2">{hint}</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {warning && <p className="text-amber-600 text-sm">{warning}</p>}
    </div>
  );
}
