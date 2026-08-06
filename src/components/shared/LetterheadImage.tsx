// Kop atas/bawah berupa gambar yang diunggah admin sendiri (Konten Halaman > Logo Sekolah), dipakai
// apa adanya (horizontal, lebar penuh) — bukan kop hasil generate kode. Kalau belum diunggah, tidak
// render apa-apa (bukan placeholder yang mengganggu tampilan cetak).
export default function LetterheadImage({ url, alt }: { url?: string; alt: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="w-full h-auto block" />;
}
