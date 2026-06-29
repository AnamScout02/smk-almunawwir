"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Globe } from "lucide-react";
import { useRouter } from "next/navigation";

const navLinks = {
  id: [
    { name: "Beranda", href: "/" },
    { name: "Tentang", href: "/about" },
    { name: "Program", href: "/programs" },
    { name: "Berita", href: "/news" },
    { name: "Galeri", href: "/gallery" },
    { name: "Kontak", href: "/contact" },
  ],
  en: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Programs", href: "/programs" },
    { name: "News", href: "/news" },
    { name: "Gallery", href: "/gallery" },
    { name: "Contact", href: "/contact" },
  ],
};

const ui = {
  id: { login: "Masuk", register: "Daftar Sekarang", registerShort: "Daftar" },
  en: { login: "Login", register: "Register Now", registerShort: "Register" },
};

interface NavbarProps {
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [logoEmblem, setLogoEmblem] = useState("/images/logo-emblem.png");
  const [logoFull, setLogoFull] = useState("/images/logo-full.png");
  const [logoFullWhite, setLogoFullWhite] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "en") setLang("en");
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/settings/logos")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.emblem) setLogoEmblem(data.emblem);
        if (data?.full) setLogoFull(data.full);
        if (data?.fullWhite) setLogoFullWhite(data.fullWhite);
      })
      .catch(() => {});
  }, []);

  function toggleLang() {
    const next = lang === "id" ? "en" : "id";
    setLang(next);
    localStorage.setItem("lang", next);
    document.cookie = `lang=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  const isDark = transparent && !scrolled;
  const links = navLinks[lang];
  const t = ui[lang];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-400 ${
        scrolled || !transparent
          ? "bg-white/95 backdrop-blur-md shadow-sm py-3"
          : "bg-gradient-to-b from-black/50 to-transparent py-5"
      }`}
    >
      <nav className="container-custom flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          {isDark ? (
            logoFullWhite ? (
              <Image
                src={logoFullWhite}
                alt="SMK Al-Munawwir IIBS"
                width={180}
                height={50}
                style={{ height: "3rem", width: "auto", objectFit: "contain" }}
                priority
                unoptimized
              />
            ) : (
              <>
                <Image
                  src={logoEmblem}
                  alt="SMK Al-Munawwir IIBS"
                  width={44}
                  height={44}
                  className="rounded-full object-contain"
                  priority
                  unoptimized
                />
                <div>
                  <span className="font-heading font-bold text-lg leading-tight block text-white">Al-Munawwir</span>
                  <span className="text-xs font-medium text-gold/90">IIBS</span>
                </div>
              </>
            )
          ) : (
            <Image
              src={logoFull}
              alt="SMK Al-Munawwir IIBS"
              width={180}
              height={50}
              className="object-contain h-12 w-auto"
              priority
              unoptimized
            />
          )}
        </Link>

        {/* Desktop Menu */}
        <ul className="hidden lg:flex items-center gap-7">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`font-medium text-sm transition-colors hover:text-gold ${
                  isDark ? "text-white/90" : "text-navy"
                }`}
              >
                {link.name}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              isDark
                ? "border-white/30 text-white/80 hover:bg-white/10"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
            title={lang === "id" ? "Switch to English" : "Ganti ke Indonesia"}
          >
            <Globe size={12} />
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
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition ${
              isDark ? "border-white/30 text-white/80" : "border-gray-200 text-gray-500"
            }`}
          >
            <Globe size={11} />
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
          open ? "max-h-96" : "max-h-0"
        }`}
      >
        <div className="bg-white border-t border-gray-100 px-6 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-navy font-medium border-b border-gray-100 last:border-0 hover:text-gold transition-colors"
            >
              {link.name}
            </Link>
          ))}
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
