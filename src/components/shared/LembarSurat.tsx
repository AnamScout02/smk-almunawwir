import LetterheadImage from "@/components/shared/LetterheadImage";

/** Satu DOKUMEN surat berkop — boleh sepanjang apa pun.
 *
 * Aturan tata letaknya (ditetapkan user 13 September 2026):
 *   · isi muat 1 halaman  -> kop atas dan kop bawah sama-sama di halaman itu
 *   · isi jadi 2 halaman  -> kop atas di halaman 1, kop bawah di halaman 2
 *   · isi jadi 3-4 halaman-> kop atas tetap di halaman 1, kop bawah di halaman TERAKHIR
 *
 * Jadi kop TIDAK diulang tiap halaman — ia menandai awal dan akhir satu dokumen, bukan hiasan
 * tiap lembar. (Sempat dibuat berulang memakai thead/tfoot, itu keliru.)
 *
 * Caranya: kotak setinggi minimal satu halaman penuh, isi memakai `flex: 1` sehingga saat isinya
 * pendek kop bawah terdorong ke dasar kertas, dan saat isinya panjang kotaknya memanjang sendiri
 * sehingga kop bawah jatuh di halaman terakhir. `break-inside: avoid` menjaga gambar kop tidak
 * pernah terpotong di tengah pergantian halaman. */
export default function LembarSurat({
  kopAtas, kopBawah, children, terakhir = false, className = "",
}: {
  kopAtas?: string;
  kopBawah?: string;
  children: React.ReactNode;
  /** Dokumen terakhir — tidak diberi pemutus halaman supaya tidak menyisakan kertas kosong. */
  terakhir?: boolean;
  className?: string;
}) {
  return (
    <div className={`a4-page print-doc shadow-lg bg-white text-primary-900 mx-auto shrink-0 ${terakhir ? "" : "break-after-page"} ${className}`}>
      <div style={{ breakInside: "avoid" }}>
        <LetterheadImage url={kopAtas} alt="Kop Surat" />
      </div>
      <div className="a4-page-body">{children}</div>
      {kopBawah ? (
        <div style={{ breakInside: "avoid" }}>
          <LetterheadImage url={kopBawah} alt="Kop Bawah" />
        </div>
      ) : null}
    </div>
  );
}
