/** Pita kata berjalan sebagai pembatas antarbagian beranda — kata dari Konten Halaman
 *  (`beranda.kataBerjalan`, dipisah "·"; KOSONG = pita tidak ditampilkan).
 *
 *  Diredam 4 Okt 2026 (laporan user: "terlalu rame dan membuat berat"): huruf jauh lebih kecil, tanpa
 *  huruf bergaris tepi (garis tepi pada huruf raksasa mahal digambar ulang tiap bingkai), gerak lebih
 *  pelan, dan `content-visibility: auto` (globals.css) sehingga pita berhenti dihitung saat di luar layar.
 *  Isi digandakan supaya putarannya menyambung; pembaca layar hanya membaca satu salinan. */
export default function PitaKata({ kata, gelap = false }: { kata: string; gelap?: boolean }) {
  const daftar = kata.split(/[·|•,]/).map(k => k.trim()).filter(Boolean);
  if (!daftar.length) return null;
  // Huruf kecil = satu putaran bisa lebih sempit dari layar lebar → daftar diulang sampai cukup panjang.
  const ulang = Math.max(1, Math.ceil(60 / daftar.join("").length));
  const deret = Array.from({ length: ulang }, () => daftar).flat();
  const isi = (sembunyi: boolean) => (
    <span className="pita-kata-isi" aria-hidden={sembunyi || undefined}>
      {deret.map((k, i) => (
        <span key={i} className="inline-flex items-center gap-8">
          <span className={`font-heading font-bold uppercase tracking-wide ${gelap ? "text-white/80" : "text-primary-900/70"}`}
            style={{ fontSize: "clamp(1.125rem, 2.4vw, 1.75rem)", lineHeight: 1 }}>{k}</span>
          <span className="h-2 w-2 rotate-45 bg-gold/80" />
        </span>
      ))}
    </span>
  );
  return (
    <div className={`pita-kata border-y py-4 ${gelap ? "border-white/10 bg-primary-900" : "border-gray-100 bg-white"}`}>
      <div className="gerak-pita" style={{ ["--durasi" as string]: `${Math.max(40, deret.join("").length * 1.4)}s` }}>
        {isi(false)}{isi(true)}
      </div>
    </div>
  );
}
