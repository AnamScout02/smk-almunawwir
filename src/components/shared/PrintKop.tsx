// Kop surat untuk halaman cetak — banner navy + pattern SMK + judul (kiri) + logo full putih
// (kanan), gaya sama persis dengan yang dipakai di BukuIndukPrintSheet. Diekstrak jadi komponen
// bersama supaya halaman cetak lain (jadwal, dll) pakai kop yang konsisten tanpa duplikasi.
export default function PrintKop({
  title, subtitle, logoUrl,
  edgeClassName = "-mx-8 print:-mx-2",
  spacingClassName = "mb-4 px-10 py-6",
  titleClassName = "text-lg",
  subtitleClassName = "text-sm",
  logoClassName = "h-12",
}: {
  title: string; subtitle: string; logoUrl?: string;
  /** Kelas margin negatif untuk bleed penuh ke tepi kertas — sesuaikan kalau halaman punya padding kiri/kanan asimetris (mis. ruang jilid). */
  edgeClassName?: string;
  /** Jarak & padding kop. Dipisah dari `edgeClassName` supaya pemanggil bisa MENGGANTINYA, bukan
   * menambahkan kelas yang bertabrakan — dua utility Tailwind untuk properti yang sama (mis.
   * `px-10` vs `px-[6mm]`) punya kekhususan sama, jadi yang menang ditentukan urutan di berkas CSS
   * hasil build, bukan urutan penulisan di className. Dipakai kartu QR Buku Tamu yang ukurannya
   * A6 sehingga butuh padding jauh lebih kecil. */
  spacingClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  logoClassName?: string;
}) {
  return (
    <div className={`print-doc relative ${edgeClassName} ${spacingClassName} overflow-hidden flex items-center justify-between gap-4`}
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "127.28px 127.28px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      <div className="absolute -top-10 -right-6 w-44 h-44 rounded-full opacity-25 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)" }} />
      <div className="absolute -bottom-12 left-1/3 w-36 h-36 rounded-full opacity-15 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b5bdb 0%, transparent 70%)" }} />
      <div className="absolute top-1/2 -translate-y-1/2 right-28 w-20 h-20 rounded-full border border-gold/25 pointer-events-none" />
      <div className="absolute top-1/2 -translate-y-1/2 right-28 w-14 h-14 rounded-full border border-gold/15 pointer-events-none" />
      <div className="absolute bottom-2 left-24 w-10 h-10 rounded-full border border-white/10 pointer-events-none" />
      {[
        { top: "18%", left: "38%", size: 5, gold: true },
        { top: "70%", left: "44%", size: 3, gold: false },
        { top: "30%", left: "48%", size: 4, gold: true },
        { top: "60%", left: "52%", size: 3, gold: false },
        { top: "20%", left: "58%", size: 4, gold: false },
        { top: "75%", left: "62%", size: 5, gold: true },
        { top: "40%", left: "67%", size: 3, gold: false },
        { top: "15%", left: "72%", size: 4, gold: true },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{
            top: p.top, left: p.left, width: p.size, height: p.size,
            background: p.gold ? "rgba(232,160,32,0.65)" : "rgba(255,255,255,0.35)",
            boxShadow: p.gold ? `0 0 ${p.size * 2}px rgba(232,160,32,0.5)` : "none",
          }}
        />
      ))}
      <div className="relative">
        <p className={`font-bold uppercase tracking-wide text-white ${titleClassName}`}>{title}</p>
        <p className={`font-bold uppercase text-gold ${subtitleClassName}`}>{subtitle}</p>
      </div>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo SMK Al Munawwir IIBS" className={`relative w-auto object-contain shrink-0 ${logoClassName}`} />
      )}
    </div>
  );
}
