"use client";
import { useRouter } from "next/navigation";
import Select from "@/components/admin/Select";

/** Saringan halaman cetak label aset (mengubah query string). */
export default function SaringLabel({ basePath, kategori, lokasi, daftarKategori, daftarLokasi }: {
  basePath: string; kategori: string; lokasi: string; daftarKategori: string[]; daftarLokasi: string[];
}) {
  const router = useRouter();
  const ke = (k: string, l: string) => {
    const q = new URLSearchParams();
    if (k) q.set("kategori", k);
    if (l) q.set("lokasi", l);
    router.push(`${basePath}${q.size ? `?${q}` : ""}`);
  };
  return (
    <>
      <div className="alat-saring"><Select value={kategori} onChange={v => ke(v, lokasi)} options={[{ value: "", label: "Semua kategori" }, ...daftarKategori.map(k => ({ value: k, label: k }))]} /></div>
      <div className="alat-saring"><Select value={lokasi} onChange={v => ke(kategori, v)} options={[{ value: "", label: "Semua lokasi" }, ...daftarLokasi.map(k => ({ value: k, label: k }))]} /></div>
    </>
  );
}
