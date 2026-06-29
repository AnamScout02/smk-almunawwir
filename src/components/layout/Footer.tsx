import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";

export default async function Footer() {
  const lang = await getLang();
  const tr = t(lang);
  const s = await getSettings(["logo.full", "logo.full_white", "islamic.footer_arabic", "contact.phone", "contact.email", "contact.address", "contact.hours_main", "contact.hours_friday"]);
  const logoFull = s["logo.full"];
  const logoWhite = s["logo.full_white"];
  const footerArabic = s["islamic.footer_arabic"];

  return (
    <footer className="bg-primary-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "200px 200px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      <div className="h-1 bg-gradient-to-r from-primary-700 via-gold to-primary-700 relative" />

      <div className="container-custom py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-5">
              {logoWhite ? (
                <div className="mb-2">
                  <Image
                    src={logoWhite}
                    alt="SMK Al-Munawwir IIBS"
                    width={200}
                    height={56}
                    className="object-contain h-14 w-auto"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="bg-white rounded-xl px-4 py-3 inline-block mb-2">
                  <Image
                    src={logoFull}
                    alt="SMK Al-Munawwir IIBS"
                    width={200}
                    height={56}
                    className="object-contain h-14 w-auto"
                    unoptimized
                  />
                </div>
              )}
              <p className="text-gold text-xs font-medium mt-1">NPSN 69896523</p>
            </div>
            {footerArabic && <p className="font-arabic text-gold text-xl mb-3">{footerArabic}</p>}
            <p className="text-white/70 text-sm leading-relaxed mb-5">
              {tr.footer_school_desc}
            </p>
            <div className="text-white/40 text-xs mb-4">
              Yayasan Islam Al Munawwir Makshum
            </div>
            <div className="flex gap-3 flex-wrap">
              <a href="https://www.instagram.com/smkalmunawwiriibs" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-gold/20 flex items-center justify-center transition" title="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/@SMKAl-MunawwirIIBS" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-gold/20 flex items-center justify-center transition" title="YouTube">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a href="https://www.facebook.com/smkalmunawwiriibs" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-gold/20 flex items-center justify-center transition" title="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@smk.almunawwiriibs" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-gold/20 flex items-center justify-center transition" title="TikTok">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-gold mb-5">{tr.footer_nav}</h4>
            <ul className="space-y-2.5">
              {tr.footer_links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/70 hover:text-gold transition-colors text-sm">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className="font-heading font-semibold text-gold mb-5">{tr.footer_majors}</h4>
            <ul className="space-y-2.5">
              {tr.footer_programs.map((p) => (
                <li key={p} className="text-white/70 text-sm">{p}</li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold text-gold mb-5">{tr.footer_contact}</h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-sm text-white/70">
                <MapPin size={16} className="text-gold shrink-0 mt-0.5" />
                <span>{s["contact.address"]}</span>
              </li>
              <li className="flex gap-3 text-sm text-white/70">
                <Phone size={16} className="text-gold shrink-0" />
                <span>{s["contact.phone"]}</span>
              </li>
              <li className="flex gap-3 text-sm text-white/70">
                <Mail size={16} className="text-gold shrink-0" />
                <span>{s["contact.email"]}</span>
              </li>
            </ul>

            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-white/50 mb-2">{tr.footer_hours_title}</p>
              <p className="text-sm text-white/80">{s["contact.hours_main"]}</p>
              <p className="text-sm text-white/80">{s["contact.hours_friday"]}</p>
              <p className="text-sm text-white/50 mt-1">{tr.footer_hours_closed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 relative">
        <div className="container-custom py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-white/50 text-sm">
            © 2025 SMK Al-Munawwir IIBS. {tr.footer_copyright}
          </p>
          <p className="text-white/30 text-xs">
            Developed by{" "}
            <a
              href="https://wa.me/6283135851605"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold/60 hover:text-gold transition-colors"
            >
              TechnoFix
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
