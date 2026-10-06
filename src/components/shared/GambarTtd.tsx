/** Gambar TTD di dokumen cetak (server component — `src` = data URL dari `petaTtd`). Tanpa TTD: ruang kosong
 *  setinggi yang sama, jadi tata letak dokumen tidak bergeser dan tetap bisa ditandatangani tangan. */
export default function GambarTtd({ src, tinggi = 56, className = "" }: { src?: string | null; tinggi?: number; className?: string }) {
  if (!src) return <div style={{ height: tinggi }} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- data URL, tidak lewat pengoptimal gambar
  return <img src={src} alt="Tanda tangan" style={{ height: tinggi, maxWidth: "100%" }} className={`mx-auto object-contain ${className}`} />;
}
