"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Globe, ChevronDown, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

/** MENU SITUS (22 Sep 2026, permintaan user "terlalu banyak, buat sub menu saja"): 5 menu utama — sisanya di submenu.
 * Nama menu/label dua bahasa (#41); tujuan tautan tidak berubah. */
type Tautan = { name: string; href: string };
type MenuUtama = { key: string; name: string; href?: string; items?: Tautan[] };
const menuSitus: Record<"id" | "en", MenuUtama[]> = {
  id: [
    { key: "beranda", name: "Beranda", href: "/" },
    { key: "profil", name: "Profil", items: [
      { name: "Tentang Kami", href: "/about" }, { name: "Program Keahlian", href: "/programs" },
      { name: "Fasilitas", href: "/facilities" }, { name: "Ekstrakurikuler", href: "/extracurricular" }, { name: "Alumni", href: "/alumni" },
    ] },
    { key: "informasi", name: "Informasi", items: [
      { name: "Berita", href: "/news" }, { name: "Agenda", href: "/agenda" }, { name: "Lomba & Event", href: "/lomba" }, { name: "Mitra Industri", href: "/mitra-industri" }, { name: "Galeri", href: "/gallery" },
    ] },
    { key: "layanan", name: "Layanan", items: [
      { name: "Cek Kelulusan", href: "/cek-kelulusan" }, { name: "Tahapan Pendaftaran SPMB", href: "/spmb/tahapan" },
      { name: "Tracer Study Alumni", href: "/tracer-study" }, { name: "Aplikasi MyAlwis Mobile", href: "/pasang-aplikasi" },
    ] },
    { key: "kontak", name: "Kontak", href: "/contact" },
  ],
  en: [
    { key: "beranda", name: "Home", href: "/" },
    { key: "profil", name: "Profile", items: [
      { name: "About Us", href: "/about" }, { name: "Programs", href: "/programs" },
      { name: "Facilities", href: "/facilities" }, { name: "Extracurricular", href: "/extracurricular" }, { name: "Alumni", href: "/alumni" },
    ] },
    { key: "informasi", name: "Information", items: [
      { name: "News", href: "/news" }, { name: "Agenda", href: "/agenda" }, { name: "Competitions & Events", href: "/lomba" }, { name: "Industry Partners", href: "/mitra-industri" }, { name: "Gallery", href: "/gallery" },
    ] },
    { key: "layanan", name: "Services", items: [
      { name: "Graduation Status", href: "/cek-kelulusan" }, { name: "Registration Progress", href: "/spmb/tahapan" },
      { name: "Alumni Tracer Study", href: "/tracer-study" }, { name: "MyAlwis Mobile App", href: "/pasang-aplikasi" },
    ] },
    { key: "kontak", name: "Contact", href: "/contact" },
  ],
};

const ui = {
  id: { login: "Masuk", register: "Daftar Sekarang", registerShort: "Daftar", services: "Layanan" },
  en: { login: "Login", register: "Register Now", registerShort: "Register", services: "Services" },
};

interface NavbarClientProps {
  transparent?: boolean;
  initialEmblem: string;
  initialFull: string;
  initialFullWhite: string;
  /** Bahasa dari cookie `lang` (dibaca server di Navbar.tsx) — menu langsung benar sejak render pertama. */
  langAwal?: "id" | "en";
}

export default function NavbarClient({
  transparent = false,
  initialEmblem,
  initialFull,
  initialFullWhite,
  langAwal = "id",
}: NavbarClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuBuka, setMenuBuka] = useState<string | null>(null);       // submenu desktop yang terbuka
  const [menuBukaHp, setMenuBukaHp] = useState<string | null>(null);   // submenu di menu HP
  // Bahasa SELALU dari server (cookie `lang`). Tidak diganti duluan di klien: dulu menu langsung berganti sementara isi
  // halaman baru menyusul 1–2 detik kemudian, sehingga halaman sempat tampil campur dua bahasa (temuan user 15 Sep 2026).
  const lang = langAwal;
  const [gantiBahasa, mulaiGanti] = useTransition();
  const tundaTutup = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoEmblem = initialEmblem;
  const logoFull = initialFull;
  const logoFullWhite = initialFullWhite;

  // Cookie `lang` (dibaca server) adalah acuan; localStorage hanya disamakan untuk kompatibilitas.
  useEffect(() => {
    try { localStorage.setItem("lang", langAwal); } catch { /* mode privat */ }
  }, [langAwal]);

  useEffect(() => {
    setScrolled(window.scrollY > 80);
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleLang() {
    if (gantiBahasa) return;
    const next = lang === "id" ? "en" : "id";
    document.cookie = `lang=${next};path=/;max-age=31536000;samesite=lax`;
    // Menu, tombol, dan isi halaman berganti BERSAMAAN setelah server merender ulang; selama menunggu tombol berputar.
    mulaiGanti(() => router.refresh());
  }

  const isDark = transparent && !scrolled;
  const menu = menuSitus[lang];
  const t = ui[lang];
  const aktifGrup = (m: MenuUtama) => (m.href ? isActive(m.href) : (m.items ?? []).some(x => isActive(x.href)));

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-400 ${
        scrolled || !transparent
          ? "bg-white/96 backdrop-blur-md shadow-sm py-3 border-b border-gold/20"
          : "bg-gradient-to-b from-black/50 to-transparent py-5"
      }`}
    >
      {/* Gold top accent line + kilauan tipis */}
      {(scrolled || !transparent) && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent overflow-hidden">
          <div className="absolute top-0 h-full w-24"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
              animation: "navShimmer 5s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Pattern Islami tipis agar tidak polos */}
      {(scrolled || !transparent) && (
        <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat" }}
        />
      )}
      <nav className="container-custom relative flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5 mr-6">
          {isDark ? (
            logoFullWhite ? (
              <Image
                src={logoFullWhite}
                alt="SMK Al Munawwir IIBS"
                width={180}
                height={50}
                style={{ height: "3rem", width: "auto", objectFit: "contain" }}
                priority
              />
            ) : (
              <>
                <Image
                  src={logoEmblem}
                  alt="SMK Al Munawwir IIBS"
                  width={44}
                  height={44}
                  className="rounded-full object-contain"
                  priority
                />
                <div>
                  <span className="font-heading font-bold text-lg leading-tight block text-white">Al Munawwir</span>
                  <span className="text-xs font-medium text-gold/90">IIBS</span>
                </div>
              </>
            )
          ) : (
            <Image
              src={logoFull}
              alt="SMK Al Munawwir IIBS"
              width={180}
              height={50}
              className="object-contain h-12 w-auto"
              priority
            />
          )}
        </Link>

        {/* Desktop Menu — 5 menu utama, submenu terbuka saat disorot/diklik */}
        <ul className="hidden lg:flex flex-1 items-center justify-center gap-1 xl:absolute xl:left-1/2 xl:flex-none xl:-translate-x-1/2 xl:gap-2">
          {menu.map(m => {
            const aktif = aktifGrup(m);
            const warna = aktif ? "text-gold" : isDark ? "text-white/90" : "text-navy";
            if (m.href) return (
              <li key={m.key}>
                <Link href={m.href} className={`relative block px-3 py-2 font-medium text-sm whitespace-nowrap transition-colors hover:text-gold ${warna}`}>
                  {m.name}
                  {aktif && <span className="absolute left-3 right-3 bottom-0.5 h-0.5 rounded-full bg-gold" />}
                </Link>
              </li>
            );
            const buka = menuBuka === m.key;
            return (
              <li key={m.key} className="relative"
                onMouseEnter={() => { if (tundaTutup.current) clearTimeout(tundaTutup.current); setMenuBuka(m.key); }}
                onMouseLeave={() => { tundaTutup.current = setTimeout(() => setMenuBuka(k => (k === m.key ? null : k)), 150); }}>
                <button type="button" aria-expanded={buka} onClick={() => setMenuBuka(k => (k === m.key ? null : m.key))}
                  className={`relative flex items-center gap-1 px-3 py-2 font-medium text-sm whitespace-nowrap transition-colors hover:text-gold ${warna}`}>
                  {m.name}
                  <ChevronDown size={14} className={`transition-transform ${buka ? "rotate-180" : ""}`} />
                  {aktif && <span className="absolute left-3 right-3 bottom-0.5 h-0.5 rounded-full bg-gold" />}
                </button>
                {buka && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-60 z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1.5">
                      {m.items!.map(x => (
                        <Link key={x.href} href={x.href} onClick={() => setMenuBuka(null)}
                          className={`block px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary-700 ${isActive(x.href) ? "text-gold" : "text-navy"}`}>
                          {x.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden lg:flex shrink-0 items-center gap-2 xl:gap-3">
          <button
            onClick={toggleLang}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              isDark
                ? "border-white/30 text-white/80 hover:bg-white/10"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
            title={lang === "id" ? "Switch to English" : "Ganti ke Indonesia"}
            disabled={gantiBahasa}
            aria-busy={gantiBahasa}
          >
            {gantiBahasa ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
            <span>{lang === "id" ? "ID" : "EN"}</span>
          </button>

          <Link
            href="/login"
            className={`text-sm font-semibold px-4 py-2 rounded-full transition ${
              isDark
                ? "text-white hover:bg-white/10"
                : "text-primary-700 hover:bg-primary-50"
            }`}
          >
            {t.login}
          </Link>
          <Link href="/admissions" className="btn-gold !py-2 !px-5 text-sm whitespace-nowrap">
            {t.register}
          </Link>
        </div>

        {/* Mobile Toggle */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            onClick={toggleLang}
            disabled={gantiBahasa}
            aria-busy={gantiBahasa}
            title={lang === "id" ? "Switch to English" : "Ganti ke Indonesia"}
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition ${
              isDark ? "border-white/30 text-white/80" : "border-gray-200 text-gray-500"
            }`}
          >
            {gantiBahasa ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
            {lang === "id" ? "ID" : "EN"}
          </button>
          <button
            className="p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? (
              <X className={isDark ? "text-white" : "text-navy"} size={24} />
            ) : (
              <Menu className={isDark ? "text-white" : "text-navy"} size={24} />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          open ? "max-h-[42rem]" : "max-h-0"
        }`}
      >
        <div className="bg-white border-t border-gray-100 px-6 py-4 max-h-[80vh] overflow-y-auto">
          {menu.map(m => {
            const aktif = aktifGrup(m);
            if (m.href) return (
              <Link key={m.key} href={m.href} onClick={() => setOpen(false)}
                className={`flex items-center justify-between py-3 font-medium border-b border-gray-100 hover:text-gold transition-colors ${aktif ? "text-gold" : "text-navy"}`}>
                {m.name}
                {aktif && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
              </Link>
            );
            const buka = menuBukaHp === m.key || (menuBukaHp === null && aktif);
            return (
              <div key={m.key} className="border-b border-gray-100">
                <button type="button" aria-expanded={buka} onClick={() => setMenuBukaHp(k => (k === m.key || (k === null && aktif) ? "" : m.key))}
                  className={`w-full flex items-center justify-between py-3 font-medium hover:text-gold transition-colors ${aktif ? "text-gold" : "text-navy"}`}>
                  {m.name}
                  <ChevronDown size={16} className={`transition-transform ${buka ? "rotate-180" : ""}`} />
                </button>
                {buka && (
                  <div className="pl-3 pb-2">
                    {m.items!.map(x => (
                      <Link key={x.href} href={x.href} onClick={() => setOpen(false)}
                        className={`flex items-center justify-between py-2.5 text-sm font-medium hover:text-gold transition-colors ${isActive(x.href) ? "text-gold" : "text-gray-600"}`}>
                        {x.name}
                        {isActive(x.href) && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 mt-4">
            <Link
              href="/login"
              className="flex-1 text-center py-2.5 border border-primary-700 text-primary-700 rounded-full text-sm font-semibold"
            >
              {t.login}
            </Link>
            <Link
              href="/admissions"
              className="flex-1 text-center py-2.5 bg-gold text-primary-900 rounded-full text-sm font-bold"
            >
              {t.registerShort}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
