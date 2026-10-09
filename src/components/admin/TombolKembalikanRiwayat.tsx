"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

/** Tombol "Kembalikan" di Riwayat Buku Induk: seluruh catatan (tanpa `jalur`) atau satu isian. */
export default function TombolKembalikanRiwayat({ logId, jalur, apa, kecil = false }: { logId: string; jalur?: string[]; apa: string; kecil?: boolean }) {
  const [sibuk, setSibuk] = useState(false);
  const toast = useToast(), confirm = useConfirm(), router = useRouter();
  const jalan = async () => {
    if (!(await confirm(`Kembalikan ${apa} ke nilai sebelumnya? Isian yang sudah diubah lagi setelah catatan ini tidak ikut dikembalikan.`))) return;
    setSibuk(true);
    fetch(`/api/admin/buku-induk/riwayat/${logId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jalur }) })
      .then(async r => ({ ok: r.ok, j: await r.json().catch(() => ({})) }))
      .then(({ ok, j }) => {
        if (!ok) { toast.error(j.error || "Gagal mengembalikan."); return; }
        toast.success(`${j.dikembalikan} isian dikembalikan${j.dilewati?.length ? `, ${j.dilewati.length} dilewati karena sudah diubah lagi` : ""}.`);
        router.refresh();
      })
      .catch(() => toast.error("Gagal mengembalikan."))
      .finally(() => setSibuk(false));
  };
  if (kecil) return (
    <button type="button" onClick={jalan} disabled={sibuk} title={`Kembalikan ${apa}`}
      className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50">
      {sibuk ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
    </button>
  );
  return (
    <button type="button" onClick={jalan} disabled={sibuk} className="btn-modal-cancel btn-teks px-3 text-xs">
      {sibuk ? <Loader2 className="animate-spin" /> : <Undo2 />} Kembalikan
    </button>
  );
}
