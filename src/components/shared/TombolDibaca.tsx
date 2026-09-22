"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Tombol "Sudah dibaca" untuk pengumuman wajib konfirmasi. Tanpa ikon lucide (dipakai di halaman server lewat DaftarPengumuman). */
export default function TombolDibaca({ id, dibaca }: { id: string; dibaca: boolean }) {
  const router = useRouter();
  const [sudah, setSudah] = useState(dibaca);
  const [sibuk, setSibuk] = useState(false);
  if (sudah) return <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">✓ Sudah dikonfirmasi dibaca</span>;
  return (
    <button type="button" disabled={sibuk} className="btn-modal-save mt-2 px-3 text-xs"
      onClick={async () => {
        setSibuk(true);
        const r = await fetch(`/api/pengumuman/${id}/dibaca`, { method: "POST" }).catch(() => null);
        setSibuk(false);
        if (r?.ok) { setSudah(true); router.refresh(); }
      }}>
      {sibuk ? "Menyimpan…" : "Saya sudah membaca"}
    </button>
  );
}
