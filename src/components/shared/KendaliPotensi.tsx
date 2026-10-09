"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Search, Printer, FileDown } from "lucide-react";
import Select from "@/components/admin/Select";
import PilihBanyak from "@/components/shared/PilihBanyak";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Keadaan = { berjalan: boolean; kab: string; selesai: number; total: number; galat: string; usai: number };

/** Saringan kabupaten/kecamatan + tombol "Perbarui dari Sekolah Kita" (Potensi Lulusan SMP/MTs). Pengambilan berjalan di
 *  server; di sini hanya memulai dan menampilkan kemajuannya. */
export default function KendaliPotensi({ alamat, kab, kec, jenjang, status, q, urut, daftarKab, daftarKec, adaData }: {
  alamat: string; kab: string; kec: string; jenjang: string; status: string; q: string; urut: string; daftarKab: { value: string; label: string }[]; daftarKec: { value: string; label: string }[]; adaData: boolean;
}) {
  const router = useRouter(), toast = useToast(), confirm = useConfirm();
  const [k, setK] = useState<Keadaan | null>(null);
  const tadiBerjalan = useRef(false);
  const [cari, setCari] = useState(q);
  const param = (ubah: Partial<Record<"kab" | "kec" | "jenjang" | "status" | "q" | "urut", string>>) => {
    const semua = { kab, kec, jenjang, status, q: cari.trim(), urut: urut === "ix" ? "" : urut, ...ubah };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(semua)) if (v) u.set(k, v);
    return u.toString();
  };
  const ke = (ubah: Parameters<typeof param>[0]) => router.replace(`${alamat}&${param(ubah)}`, { scroll: false });

  useEffect(() => {
    let hidup = true;
    const cek = () => fetch("/api/spmb/potensi").then(r => (r.ok ? r.json() : null)).then((d: Keadaan | null) => {
      if (!hidup || !d) return;
      setK(d);
      if (tadiBerjalan.current && !d.berjalan) { d.galat ? toast.error(d.galat) : toast.success("Data potensi diperbarui"); router.refresh(); }
      tadiBerjalan.current = d.berjalan;
    }).catch(() => {});
    cek();
    const t = setInterval(cek, 4000);
    return () => { hidup = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function perbarui() {
    if (!(await confirm(`Mengambil jumlah siswa seluruh SMP & MTs di ${kab} dari situs Sekolah Kita Kemendikdasmen. Berjalan di latar ±3–6 menit; halaman ini boleh ditinggal. Lanjutkan?`))) return;
    const r = await fetch("/api/spmb/potensi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kab }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || "Gagal memulai"); return; }
    setK(d); tadiBerjalan.current = true;
  }

  return (
    <>
    <div className="baris-alat">
      <div className="alat-saring w-full sm:w-64"><Select value={kab} onChange={v => ke({ kab: v, kec: "" })} options={daftarKab} /></div>
      <div className="alat-saring w-[calc(50%-0.25rem)] sm:w-36"><Select value={jenjang} onChange={v => ke({ jenjang: v })} options={[{ value: "", label: "SMP & MTs" }, { value: "SMP", label: "SMP saja" }, { value: "MTs", label: "MTs saja" }]} /></div>
      <div className="alat-saring w-[calc(50%-0.25rem)] sm:w-40"><Select value={status} onChange={v => ke({ status: v })} options={[{ value: "", label: "Negeri & swasta" }, { value: "NEGERI", label: "Negeri" }, { value: "SWASTA", label: "Swasta" }]} /></div>
      <div className="alat-saring w-full sm:w-48"><Select value={urut} onChange={v => ke({ urut: v === "ix" ? "" : v })} options={[{ value: "ix", label: "Urut: kelas IX terbanyak" }, { value: "jarak", label: "Urut: terdekat" }, { value: "serapan", label: "Urut: serapan tertinggi" }]} /></div>
      <form className="alat-cari" onSubmit={e => { e.preventDefault(); ke({ q: cari.trim() }); }}>
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={cari} onChange={e => setCari(e.target.value)} onBlur={() => cari.trim() !== q && ke({ q: cari.trim() })}
          placeholder="Cari nama sekolah / NPSN, lalu Enter" className="input-field pl-10" />
      </form>
      <div className="alat-aksi alat-teks">
        {adaData && <a href={`/pusat-spmb/sasaran/potensi-cetak?${param({})}`} className="btn-modal-cancel"><Printer /> Cetak / PDF</a>}
        {adaData && <a href={`/api/spmb/potensi/ekspor?${param({})}`} className="btn-modal-cancel"><FileDown /> Unduh Excel</a>}
        <button type="button" onClick={perbarui} disabled={!!k?.berjalan} className="btn-modal-save">
          {k?.berjalan ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {k?.berjalan ? `Mengambil ${k.selesai}/${k.total || "…"}` : adaData ? "Perbarui dari Sekolah Kita" : "Ambil dari Sekolah Kita"}
        </button>
      </div>
    </div>
    {adaData && (
      <div className="panel p-4">
        <PilihBanyak label="Kecamatan (boleh beberapa; kosong = semua)" opsi={daftarKec} nilai={kec ? kec.split(",") : []} onChange={v => ke({ kec: v.join(",") })} />
      </div>
    )}
    </>
  );
}
