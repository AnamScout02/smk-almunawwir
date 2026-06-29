"use client";
import { useState, useRef } from "react";
import { Upload, CheckCircle2, Loader2, ExternalLink } from "lucide-react";

interface LogoCardProps {
  settingKey: string;
  currentUrl: string;
  label: string;
  description: string;
  isSquare: boolean;
  darkPreview: boolean;
}

function LogoCard({ settingKey, currentUrl, label, description, isSquare, darkPreview }: LogoCardProps) {
  const [url, setUrl] = useState(currentUrl);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "logos");
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "Gagal upload");

      setStatus("saving");
      const saveRes = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: settingKey, value: upData.url }),
      });
      if (!saveRes.ok) throw new Error("Gagal menyimpan");

      setUrl(upData.url);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const isLoading = status === "uploading" || status === "saving";

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <div className="mb-4">
        <h3 className="font-heading font-bold text-primary-900 text-sm">{label}</h3>
        <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{description}</p>
      </div>

      {/* Preview */}
      <div className={`relative rounded-xl border flex items-center justify-center overflow-hidden mb-4 ${
        darkPreview ? "bg-primary-900 border-primary-700" : "bg-gray-50 border-gray-200"
      } ${isSquare ? "h-36 w-36 mx-auto" : "h-28 w-full"}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-full max-w-full object-contain p-3" />
        ) : (
          <p className={`text-xs text-center px-4 ${darkPreview ? "text-white/30" : "text-gray-300"}`}>
            {darkPreview ? "Belum ada logo putih" : "Belum ada logo"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className={`flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-60 ${
            status === "saved"
              ? "bg-emerald-600 text-white"
              : status === "error"
              ? "bg-red-500 text-white"
              : "bg-primary-700 hover:bg-primary-800 text-white"
          }`}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "saved" ? (
            <CheckCircle2 size={14} />
          ) : (
            <Upload size={14} />
          )}
          {status === "uploading"
            ? "Mengupload..."
            : status === "saving"
            ? "Menyimpan..."
            : status === "saved"
            ? "Tersimpan!"
            : status === "error"
            ? "Gagal — Coba lagi"
            : "Ganti Logo"}
        </button>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka logo saat ini"
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition shrink-0"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="text-red-600 text-xs mt-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}
      {status === "saved" && (
        <p className="text-emerald-600 text-xs mt-2">
          Logo berhasil diperbarui. Refresh halaman untuk melihat perubahan di seluruh situs.
        </p>
      )}
    </div>
  );
}

export default function LogoEditor({
  logoEmblem,
  logoFull,
  logoFullWhite,
}: {
  logoEmblem: string;
  logoFull: string;
  logoFullWhite: string;
}) {
  return (
    <div>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <strong>Format:</strong> PNG transparan disarankan. Maks. 5MB.
        Logo Lambang: persegi (contoh 200×200px). Logo Lengkap: horizontal (contoh 600×150px).
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <LogoCard
          settingKey="logo.emblem"
          currentUrl={logoEmblem}
          label="Logo Lambang"
          description="Sidebar admin & guru, header mobile, halaman login."
          isSquare
          darkPreview={false}
        />
        <LogoCard
          settingKey="logo.full"
          currentUrl={logoFull}
          label="Logo Lengkap"
          description="Navbar desktop (background terang)."
          isSquare={false}
          darkPreview={false}
        />
        <LogoCard
          settingKey="logo.full_white"
          currentUrl={logoFullWhite}
          label="Logo Putih"
          description="Footer dan area background gelap. Teks logo berwarna putih."
          isSquare={false}
          darkPreview
        />
      </div>
    </div>
  );
}
