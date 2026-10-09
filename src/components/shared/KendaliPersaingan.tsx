"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Keadaan = { berjalan: boolean; jenis?: string; selesai: number; total: number; galat: string };

/** Saringan Peta Persaingan (kabupaten, radius, jenjang, status) + tombol ambil data SMK/SMA/MA dari Sekolah Kita. */
export default function KendaliPersaingan({ alamat, kab, radius, jenjang, status, daftarKab, adaData }: {
  alamat: string; kab: string; radius: string; jenjang: string; status: string; daftarKab: { value: string; label: string }[]; adaData: boolean;
}) {
  const router = useRouter(), toast = useToast(), confirm = useConfirm();
  const [k, setK] = useState<Keadaan | null>(null);
  const tadi = useRef(false);
  const ke = (ubah: Partial<Record<"kab" | "r" | "jenjang" | "status", string>>) => {
    const u = new URLSearchParams();
    for (const [a, b] of Object.entries({ kab, r: radius, jenjang, status, ...ubah })) if (b) u.set(a, b);
    router.replace(`${alamat}&${u}`, { scroll: false });
  };
  useEffect(() => {
    let hidup = true;
    const cek = () => fetch("/api/spmb/potensi").then(r => (r.ok ? r.json() : null)).then((d: Keadaan | null) => {
      if (!hidup || !d) return;
      setK(d);
      if (tadi.current && !d.berjalan) { d.galat ? toast.error(d.galat) : toast.success("Data sekolah lanjutan diperbarui"); router.refresh(); }
      tadi.current = d.berjalan;
    }).catch(() => {});
    cek();
    const t = setInterval(cek, 4000);
    return () => { hidup = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function ambil() {
    if (!(await confirm(`Mengambil jumlah siswa kelas X, XI, XII seluruh SMK, SMA & MA di ${kab} dari situs Sekolah Kita Kemendikdasmen. Berjalan di latar beberapa menit; halaman ini boleh ditinggal. Lanjutkan?`))) return;
    const r = await fetch("/api/spmb/potensi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kab, jenis: "lanjutan" }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || "Gagal memulai"); return; }
    setK(d); tadi.current = true;
  }
  return (
    <div className="baris-alat">
      <div className="alat-saring w-full sm:w-64"><Select value={kab} onChange={v => ke({ kab: v })} options={daftarKab} /></div>
      <div className="alat-saring w-[calc(50%-0.25rem)] sm:w-44"><Select value={radius} onChange={v => ke({ r: v })} options={[{ value: "", label: "Seluruh kabupaten" }, ...[5, 10, 15, 25].map(n => ({ value: String(n), label: `Radius ${n} km` }))]} /></div>
      <div className="alat-saring w-[calc(50%-0.25rem)] sm:w-40"><Select value={jenjang} onChange={v => ke({ jenjang: v })} options={[{ value: "", label: "SMK, SMA & MA" }, { value: "SMK", label: "SMK saja" }, { value: "SMA", label: "SMA saja" }, { value: "MA", label: "MA saja" }]} /></div>
      <div className="alat-saring w-full sm:w-40"><Select value={status} onChange={v => ke({ status: v })} options={[{ value: "", label: "Negeri & swasta" }, { value: "NEGERI", label: "Negeri" }, { value: "SWASTA", label: "Swasta" }]} /></div>
      <div className="alat-aksi alat-teks">
        <button type="button" onClick={ambil} disabled={!!k?.berjalan} className="btn-modal-save">
          {k?.berjalan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {k?.berjalan ? `Mengambil ${k.selesai}/${k.total || "…"}` : adaData ? "Perbarui SMK/SMA/MA" : "Ambil data SMK/SMA/MA"}
        </button>
      </div>
    </div>
  );
}
