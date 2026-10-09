"use client";
import { useRouter } from "next/navigation";
import Select from "@/components/admin/Select";

/** Saringan rentang ANGKATAN MASUK untuk laporan cetak (8 Okt 2026, user: "bisa difilter dari tahun berapa sampai berapa").
 *  Mengubah `?dari=&sampai=` di alamat — laporannya dihitung server, jadi yang tercetak sama dengan yang tampil. */
export default function SaringAngkatan({ alamat, tahun, dari, sampai }: { alamat: string; tahun: number[]; dari: number | null; sampai: number | null }) {
  const router = useRouter();
  const ke = (d: string, s: string) => {
    // Rentang terbalik dibetulkan sendiri, bukan ditolak.
    if (d && s && Number(d) > Number(s)) [d, s] = [s, d];
    const q = new URLSearchParams();
    if (d) q.set("dari", d);
    if (s) q.set("sampai", s);
    router.replace(q.size ? `${alamat}${alamat.includes("?") ? "&" : "?"}${q}` : alamat, { scroll: false });
  };
  const opsi = (kosong: string) => [{ value: "", label: kosong }, ...[...tahun].reverse().map(t => ({ value: String(t), label: String(t) }))];
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
      <span className="max-sm:hidden">Angkatan masuk</span><span className="sm:hidden">Angkatan</span>
      <div className="w-28 shrink-0 sm:w-32"><Select value={dari ? String(dari) : ""} onChange={v => ke(v, sampai ? String(sampai) : "")} options={opsi("dari awal")} /></div>
      <span>s.d.</span>
      <div className="w-28 shrink-0 sm:w-32"><Select value={sampai ? String(sampai) : ""} onChange={v => ke(dari ? String(dari) : "", v)} options={opsi("terbaru")} /></div>
    </div>
  );
}
