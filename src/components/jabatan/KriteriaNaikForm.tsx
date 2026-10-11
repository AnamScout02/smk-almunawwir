"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";

/** Batas kenaikan kelas yang dipakai Proyeksi Kenaikan — ditetapkan sekolah, bukan ditulis di kode. */
export default function KriteriaNaikForm({ awal }: { awal: { minHadir: number; maksAlpha: number; maksDibawahKkm: number } }) {
  const toast = useToast(), router = useRouter();
  const [v, setV] = useState({ minHadir: String(awal.minHadir), maksAlpha: String(awal.maksAlpha), maksDibawahKkm: String(awal.maksDibawahKkm) });
  const [sibuk, setSibuk] = useState(false);
  async function simpan() {
    setSibuk(true);
    const r = await fetch("/api/analitik/kriteria", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minHadir: Number(v.minHadir), maksAlpha: Number(v.maksAlpha), maksDibawahKkm: Number(v.maksDibawahKkm) }) }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menyimpan."); return; }
    toast.success("Batas kenaikan tersimpan."); router.refresh();
  }
  const isi = (k: keyof typeof v, label: string, id: string) => (
    <div><label className="label-field" htmlFor={id}>{label}</label><input id={id} className="input-field w-32" inputMode="numeric" maxLength={3} value={v[k]} onChange={e => setV(s => ({ ...s, [k]: e.target.value.replace(/\D/g, "") }))} /></div>
  );
  return (
    <div className="panel flex flex-wrap items-end gap-4 p-4">
      {isi("minHadir", "Kehadiran minimal (%)", "kn-hadir")}{isi("maksAlpha", "Alpha paling banyak", "kn-alpha")}{isi("maksDibawahKkm", "Mapel di bawah KKM paling banyak", "kn-kkm")}
      <button type="button" onClick={simpan} disabled={sibuk} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan batas</button>
    </div>
  );
}
