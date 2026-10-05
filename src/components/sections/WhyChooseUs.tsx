import Image from "next/image";
import { Building2, BookOpenCheck, GraduationCap, Briefcase, Wrench, Moon } from "lucide-react";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import TeksGerak from "@/components/gerak/TeksGerak";

const items = [
  { icon: Building2, n: 1, accent: "from-primary-500 to-primary-900" },
  { icon: BookOpenCheck, n: 2, accent: "from-gold to-gold-dark" },
  { icon: GraduationCap, n: 3, accent: "from-emerald-500 to-emerald-700" },
  { icon: Briefcase, n: 4, accent: "from-blue-500 to-blue-700" },
  { icon: Wrench, n: 5, accent: "from-purple-500 to-purple-700" },
  { icon: Moon, n: 6, accent: "from-primary-700 to-primary-900" },
] as const;

const KUNCI = ["why.label", "why.heading", "why.sub", "why.foto", "spmb.tahun",
  ...items.flatMap(({ n }) => [`why.${n}_title`, `why.${n}_desc`])];

/** KEUNGGULAN KAMI (beranda) — tata letak BENTO (2 Oktober 2026, permintaan user): satu kotak foto besar
 *  berisi judul bagian + 6 kotak keunggulan tak seragam + satu kotak ajakan SPMB (gelombang dari data
 *  panitia; menggantikan kotak angka siswa aktif atas permintaan user 3 Okt 2026). Teks Indonesia
 *  dari Konten Halaman → "Keunggulan (Beranda)"; Inggris dari terjemahan bawaan. Foto besar = `why.foto`;
 *  kosong = latar navy bertekstur (aurora + noise). SENGAJA tidak mengambil foto promosi SPMB sebagai
 *  cadangan: isinya poster bertulisan, dan dipotong `object-cover` teksnya bertabrakan dengan judul. */
export default async function WhyChooseUs() {
  const lang = await getLang();
  const tr = t(lang);
  const kini = new Date();
  const [s, gelombang] = await Promise.all([
    getSettings(KUNCI),
    prisma.gelombangSpmb.findMany({ where: { aktif: true, tutup: { gte: kini } }, orderBy: { buka: "asc" }, select: { nama: true, buka: true, tutup: true } })
      .catch(() => []),
  ]);
  const dibuka = gelombang.find(g => g.buka <= kini);
  const berikut = dibuka ? null : gelombang[0] ?? null;
  // WIB, bukan jam server (CLAUDE.md #42).
  const tgl = (d: Date) => d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const statusSpmb = dibuka
    ? (lang === "id" ? `${dibuka.nama} dibuka sampai ${tgl(dibuka.tutup)}` : `${dibuka.nama} open until ${tgl(dibuka.tutup)}`)
    : berikut
      ? (lang === "id" ? `${berikut.nama} dibuka ${tgl(berikut.buka)}` : `${berikut.nama} opens ${tgl(berikut.buka)}`)
      : (lang === "id" ? "Lihat jadwal & persyaratan pendaftaran" : "See admission schedule & requirements");
  const teks = (kunci: string, cadangan: string) => (lang === "id" && s?.[kunci]?.trim() ? s[kunci] : cadangan);
  const foto = s["why.foto"]?.trim() || "";

  // Urutan kotak di kisi 4 kolom: [besar 2×2][1][2] / [3][4] / [5 lebar][6][angka]
  const kotak = (i: number, extra = "") => {
    const { icon: Icon, n, accent } = items[i];
    const gelap = n === 6;
    return (
      <div key={n} style={{ ["--tunda" as string]: `${(i % 3) * 100}ms` }}
        className={`gerak-naik sorot-kursor group overflow-hidden rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${extra} ${
          gelap ? "tekstur-noise border-primary-900 bg-primary-900 text-white" : "border-gray-100 bg-cream hover:border-gold/30"}`}>
        <div className="relative z-[2]">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}>
            <Icon size={22} />
          </div>
          <h3 className={`font-heading mb-2 text-lg font-bold ${gelap ? "text-white" : "text-navy"}`}>{teks(`why.${n}_title`, tr[`why_${n}_title`])}</h3>
          <p className={`text-sm leading-relaxed ${gelap ? "text-white/70" : "text-gray-500"}`}>{teks(`why.${n}_desc`, tr[`why_${n}_desc`])}</p>
        </div>
      </div>
    );
  };

  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <div className="kisi-bento">
          {/* Kotak besar: foto + judul bagian */}
          <div className={`gerak-naik bento-besar relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 to-primary-700 ${foto ? "" : "tekstur-noise"}`}>
            {!foto && <div className="latar-aurora" aria-hidden />}
            {foto && (
              <div className="absolute inset-0 overflow-hidden">
                <Image src={foto} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="gulir-zoom object-cover" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/70 to-primary-900/10" />
            <div className="relative flex h-full flex-col justify-end p-7 lg:p-9">
              <span className="text-sm font-semibold uppercase tracking-widest text-gold">{teks("why.label", tr.why_label)}</span>
              <h2 className="gerak-judul font-heading mt-2 text-3xl font-bold text-white md:text-4xl"><TeksGerak teks={teks("why.heading", tr.why_heading)} /></h2>
              <p className="mt-3 max-w-md text-white/75">{teks("why.sub", tr.why_sub)}</p>
            </div>
          </div>
          {kotak(0)}{kotak(1)}{kotak(2)}{kotak(3)}
          {kotak(4, "bento-lebar")}{kotak(5)}
          {/* Kotak ajakan SPMB — status gelombang dari data panitia (Pusat SPMB), bukan teks tetap. */}
          <a href="/admissions" style={{ ["--tunda" as string]: "200ms" }}
            className="gerak-naik sorot-kursor group flex flex-col justify-between gap-4 rounded-3xl bg-gold p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:col-span-2 lg:col-span-1">
            <span className="relative z-[2] text-xs font-bold uppercase tracking-widest text-primary-900/70">
              {`SPMB ${s["spmb.tahun"] ?? ""}`.trim()}
            </span>
            <span className="relative z-[2]">
              <span className="font-heading block text-2xl font-extrabold leading-tight text-primary-900">
                {dibuka ? (lang === "id" ? "Pendaftaran Dibuka" : "Admissions Open") : (lang === "id" ? "Daftar Jadi Santri" : "Join Us")}
              </span>
              <span className="mt-1 block text-sm font-medium text-primary-900/75">{statusSpmb}</span>
            </span>
            <span className="relative z-[2] inline-flex items-center gap-1.5 text-sm font-bold text-primary-900 transition-all group-hover:gap-2.5">
              {lang === "id" ? "Lihat SPMB" : "View Admissions"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
