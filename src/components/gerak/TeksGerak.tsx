/** Memecah judul jadi huruf-huruf ber-indeks untuk animasi `.gerak-judul` (huruf demi huruf, gaya
 *  thursinaiibs.sch.id). Pembaca layar membaca SATU teks utuh (`.sr-hanya`); pecahan hurufnya
 *  `aria-hidden`. Kata dibungkus `whitespace-nowrap` supaya baris tidak patah di tengah kata.
 *  Komponen server biasa (tanpa hook) — boleh dipakai di halaman server maupun klien. */
export default function TeksGerak({ teks }: { teks: string }) {
  let i = 0;
  const kata = teks.split(/\s+/).filter(Boolean);
  return (
    <>
      <span className="sr-hanya">{teks}</span>
      <span aria-hidden="true">
        {kata.map((k, ki) => (
          <span key={ki}>
            <span className="gerak-kata inline-block whitespace-nowrap">
              {Array.from(k).map((h, hi) => (
                <span key={hi} className="gerak-huruf" style={{ ["--i" as string]: i++ }}>{h}</span>
              ))}
            </span>
            {ki < kata.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    </>
  );
}
