"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Loader2, CheckCircle } from "lucide-react";

interface Props {
  currentAvatar?: string | null;
  name: string;
}

export default function AvatarUpload({ currentAvatar, name }: Props) {
  const [preview, setPreview] = useState<string | null>(currentAvatar ?? null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  async function handleFile(file: File) {
    setError(""); setSuccess(false); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "avatars");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Gagal upload");

      const saveRes = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: uploadData.url }),
      });
      if (!saveRes.ok) throw new Error("Gagal menyimpan foto");

      setPreview(uploadData.url);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal upload foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary-100 flex items-center justify-center">
          {preview ? (
            <Image src={preview} alt={name} width={80} height={80} className="w-full h-full object-cover" unoptimized />
          ) : (
            <span className="font-heading font-bold text-2xl text-primary-700">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-700 hover:bg-primary-800 text-white rounded-full flex items-center justify-center shadow-md transition disabled:opacity-60"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      <div>
        <p className="font-semibold text-gray-800">{name}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-primary-700 hover:text-primary-900 font-medium mt-0.5"
          disabled={uploading}
        >
          {uploading ? "Mengupload..." : "Ganti foto profil"}
        </button>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        {success && (
          <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1">
            <CheckCircle size={11} /> Foto berhasil diperbarui
          </p>
        )}
      </div>
    </div>
  );
}
