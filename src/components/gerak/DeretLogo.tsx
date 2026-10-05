import Image from "next/image";
import type { LogoMitra } from "@/lib/spmb-konten";

/** Deret logo mitra industri & kampus alumni yang bergulir tanpa henti (diatur di Pusat SPMB →
 *  Poster & Promosi). Logo abu-abu redup, berwarna saat ditunjuk; berhenti saat ditunjuk.
 *  Daftar pendek digandakan dulu supaya pita tidak bolong di layar lebar. */
export default function DeretLogo({ logo, judul, gelap = false }: { logo: LogoMitra[]; judul: string; gelap?: boolean }) {
  if (!logo.length) return null;
  const isi = logo.length < 8 ? [...logo, ...logo, ...logo].slice(0, Math.max(8, logo.length)) : logo;
  const deret = (sembunyi: boolean) => (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={sembunyi || undefined}>
      {isi.map((l, i) => (
        <li key={i} className="relative h-12 w-32 shrink-0 opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0" title={l.nama}>
          <Image src={l.logo} alt={sembunyi ? "" : l.nama} fill sizes="128px" className="object-contain" />
        </li>
      ))}
    </ul>
  );
  return (
    <section className={`py-12 ${gelap ? "bg-primary-900" : "bg-white"}`}>
      <p className={`mb-8 text-center text-sm font-semibold uppercase tracking-widest ${gelap ? "text-gold" : "text-gold-dark"}`}>{judul}</p>
      <div className="pita-logo">
        <div className="gerak-pita" style={{ ["--durasi" as string]: `${Math.max(30, isi.length * 4)}s` }}>
          {deret(false)}{deret(true)}
        </div>
      </div>
    </section>
  );
}
