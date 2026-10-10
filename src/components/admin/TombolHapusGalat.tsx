"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmProvider";

/** Hapus satu catatan galat (ikon di baris) atau semuanya (tombol berteks). */
export default function TombolHapusGalat({ id }: { id?: string }) {
  const router = useRouter(), confirm = useConfirm();
  const [sibuk, setSibuk] = useState(false);
  async function hapus() {
    if (!id && !await confirm("Hapus semua catatan galat? Galat yang terjadi lagi akan tercatat ulang.")) return;
    setSibuk(true);
    await fetch(`/api/admin/galat-server${id ? `?id=${id}` : ""}`, { method: "DELETE" }).catch(() => null);
    setSibuk(false); router.refresh();
  }
  return id
    ? <button type="button" onClick={hapus} disabled={sibuk} title="Sudah beres — hapus catatan" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">{sibuk ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
    : <button type="button" onClick={hapus} disabled={sibuk} className="btn-modal-cancel btn-teks">{sibuk ? <Loader2 className="animate-spin" /> : <Trash2 />} Kosongkan Catatan</button>;
}
