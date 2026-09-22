"use client";
import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Globe, ChevronDown, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

const navLinks = {
  id: [
    { name: "Beranda", href: "/" },
    { name: "Tentang", href: "/about" },
    { name: "Program", href: "/programs" },
    { name: "Berita", href: "/news" },
    { name: "Agenda", href: "/agenda" },
    { name: "Galeri", href: "/gallery" },
    { name: "Alumni", href: "/alumni" },
    { name: "Kontak", href: "/contact" },
  ],
  en: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Programs", href: "/programs" },
    { name: "News", href: "/news" },
    { name: "Agenda", href: "/agenda" },
    { name: "Gallery", href: "/gallery" },
    { name: "Alumni", href: "/alumni" },
    { name: "Contact", href: "/contact" },
  ],
};

const serviceLinks = {
  id: [
    { name: "Fasilitas", href: "/facilities" },
    { name: "Ekstrakurikuler", href: "/extracurricular" },
    { name: "Tracer Study Alumni", href: "/tracer-study" },
    { name: "Cek Kelulusan", href: "/cek-kelulusan" },
    { name: "Daftar Ulang PPDB", href: "/daftar-ulang" },
  ],
  en: [
    { name: "Facilities", href: "/facilities" },
    { name: "Extracurricular", href: "/extracurricular" },
    { name: "Alumni Tracer Study", href: "/tracer-study" },
    { name: "Graduation Status", href: "/cek-kelulusan" },
    { name: "Re-registration", href: "/daftar-ulang" },
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
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  // Bahasa SELALU dari server (cookie `lang`). Tidak diganti duluan di klien: dulu menu langsung berganti sementara isi
  // halaman baru menyusul 1–2 detik kemudian, sehingga halaman sempat tampil campur dua bahasa (temuan user 15 Sep 2026).
  const lang = langAwal;
  const [gantiBahasa, mulaiGanti] = useTransition();
  const servicesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const links = navLinks[lang];
  const t = ui[lang];

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
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat" }}
        />
      )}
      <nav className="container-custom flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
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

        {/* Desktop Menu */}
        <ul className="hidden lg:flex items-center gap-7">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`relative font-medium text-sm transition-colors hover:text-gold pb-1 ${
                  active ? "text-gold" : isDark ? "text-white/90" : "text-navy"
                }`}
              >
                {link.name}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full bg-gold" />
                )}
              </Link>
            </li>
            );
          })}

          {/* Layanan dropdown */}
          <li
            className="relative"
            onMouseEnter={() => {
              if (servicesTimeout.current) clearTimeout(servicesTimeout.current);
              setServicesOpen(true);
            }}
            onMouseLeave={() => {
              servicesTimeout.current = setTimeout(() => setServicesOpen(false), 150);
            }}
          >
            <button
              type="button"
              onClick={() => setServicesOpen(o => !o)}
              className={`flex items-center gap-1 font-medium text-sm transition-colors hover:text-gold pb-1 ${
                serviceLinks[lang].some(l => isActive(l.href)) ? "text-gold" : isDark ? "text-white/90" : "text-navy"
              }`}
            >
              {t.services}
              <ChevronDown size={14} className={`transition-transform ${servicesOpen ? "rotate-180" : ""}`} />
            </button>
            {servicesOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-56 z-50">
                <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1.5">
                  {serviceLinks[lang].map(link => (
                    <Link key={link.href} href={link.href} onClick={() => setServicesOpen(false)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary-700 ${isActive(link.href) ? "text-gold" : "text-navy"}`}>
                      {link.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </li>
        </ul>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
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
          <Link href="/admissions" className="btn-gold !py-2 !px-5 text-sm">
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
          {links.map((link) => {
            const active = isActive(link.href);
            return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between py-3 font-medium border-b border-gray-100 last:border-0 hover:text-gold transition-colors ${
                active ? "text-gold" : "text-navy"
              }`}
            >
              {link.name}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
            </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileServicesOpen(o => !o)}
            className={`w-full flex items-center justify-between py-3 font-medium border-b border-gray-100 hover:text-gold transition-colors ${
              serviceLinks[lang].some(l => isActive(l.href)) ? "text-gold" : "text-navy"
            }`}
          >
            {t.services}
            <ChevronDown size={16} className={`transition-transform ${mobileServicesOpen ? "rotate-180" : ""}`} />
          </button>
          {mobileServicesOpen && (
            <div className="pl-3 border-b border-gray-100">
              {serviceLinks[lang].map(link => {
                const active = isActive(link.href);
                return (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
                    className={`flex items-center justify-between py-2.5 text-sm font-medium hover:text-gold transition-colors ${active ? "text-gold" : "text-gray-600"}`}>
                    {link.name}
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                  </Link>
                );
              })}
            </div>
          )}

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
