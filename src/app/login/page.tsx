"use client";
import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck, Users, UserCheck, BookOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const ui = {
  id: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Portal Akademik Terpadu",
    schoolName: "SMK Al Munawwir IIBS",
    tagline: "International Islamic Boarding School — Singojuruh, Banyuwangi",
    statLabels: ["Siswa Aktif", "Tenaga Pendidik", "Konsentrasi"],
    accredited: "NPSN 69896523 · Terakreditasi",
    badge: "Akses Resmi Warga Sekolah",
    welcome: "Selamat Datang",
    signInPrompt: "Masuk ke akun Anda untuk melanjutkan",
    email: "Email",
    password: "Password",
    processing: "Memproses...",
    signInPortal: "Masuk ke Portal",
    or: "atau",
    noAccount: "Belum punya akun?",
    registerSpmb: "Daftar SPMB",
    backHome: "← Kembali ke Beranda",
    footerNote: "Akses portal hanya untuk warga SMK Al Munawwir IIBS. Jika lupa password, hubungi admin sekolah.",
  },
  en: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Integrated Academic Portal",
    schoolName: "SMK Al Munawwir IIBS",
    tagline: "International Islamic Boarding School — Singojuruh, Banyuwangi",
    statLabels: ["Active Students", "Educators", "Majors"],
    accredited: "NPSN 69896523 · Accredited",
    badge: "Official School Member Access",
    welcome: "Welcome",
    signInPrompt: "Sign in to your account to continue",
    email: "Email",
    password: "Password",
    processing: "Processing...",
    signInPortal: "Sign In to Portal",
    or: "or",
    noAccount: "Don't have an account?",
    registerSpmb: "Register (SPMB)",
    backHome: "← Back to Home",
    footerNote: "Portal access is for SMK Al Munawwir IIBS members only. If you forgot your password, contact the school admin.",
  },
} as const;

const PARTICLES = [
  { w: 6,  h: 6,  l: 12, delay: 0,   dur: 14 },
  { w: 4,  h: 4,  l: 28, delay: 2,   dur: 18 },
  { w: 8,  h: 8,  l: 45, delay: 5,   dur: 12 },
  { w: 5,  h: 5,  l: 63, delay: 1,   dur: 20 },
  { w: 3,  h: 3,  l: 78, delay: 7,   dur: 16 },
  { w: 7,  h: 7,  l: 90, delay: 3,   dur: 22 },
];

const STAT_ICONS = [Users, UserCheck, BookOpen];

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [showPass, setShowPass] = useState(false);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [liveStats, setLiveStats] = useState<{ students: number; teachers: number; majors: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "en") setLang("en");
  }, []);

  useEffect(() => {
    fetch("/api/settings/stats").then(r => r.json()).then(d => setLiveStats(d)).catch(() => {});
  }, []);

  const t = ui[lang];
  // Angka nyata dari database (bukan teks statis) — lihat /api/settings/stats. Placeholder "—"
  // dulu selama fetch berjalan, biar tidak sempat menampilkan angka yang salah/mengarang.
  const statValues = liveStats
    ? [`${liveStats.students}+`, `${liveStats.teachers}+`, `${liveStats.majors}`]
    : ["—", "—", "—"];
  const stats = t.statLabels.map((label, i) => ({ label, value: statValues[i], Icon: STAT_ICONS[i] }));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:items-stretch">

      {/* ── Kiri: Branding Panel ── */}
      <div className="relative lg:w-[54%] flex items-center justify-center p-10 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #060915 0%, #0A1030 22%, #0F1A45 45%, #241540 70%, #0A1030 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 14s ease infinite",
        }}>

        {/* Aurora glow kedua — campuran emas & ungu, bikin lebih hidup dari gradient polos */}
        <div className="absolute -top-1/3 left-1/4 w-[36rem] h-[36rem] rounded-full pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,160,32,0.16) 0%, transparent 65%)" }} />
        <div className="absolute -bottom-1/3 -right-1/4 w-[30rem] h-[30rem] rounded-full pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99,60,180,0.22) 0%, transparent 65%)" }} />

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />

        {/* Diagonal grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(232,160,32,1) 0px, rgba(232,160,32,1) 1px, transparent 1px, transparent 28px)" }}
        />

        {/* Floating orbs */}
        <div className="absolute top-16 right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(232,160,32,0.15) 0%, transparent 70%)", animation: "float 8s ease-in-out infinite" }} />
        <div className="absolute bottom-24 left-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(27,43,107,0.6) 0%, transparent 70%)", animation: "float 12s ease-in-out infinite reverse" }} />
        <div className="absolute top-1/2 -right-12 w-40 h-40 rounded-full border border-gold/10 pointer-events-none"
          style={{ animation: "rotateOrb 20s linear infinite" }} />

        {/* Cincin dekorasi tambahan */}
        <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full border border-gold/10 pointer-events-none"
          style={{ animation: "floatRing 13s ease-in-out infinite" }} />
        <div className="absolute bottom-10 right-0 w-44 h-44 rounded-full border border-white/8 pointer-events-none"
          style={{ animation: "floatRing 10s ease-in-out infinite reverse" }} />

        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <div key={i} className="absolute bottom-0 pointer-events-none rounded-full"
            style={{
              width: p.w, height: p.h,
              left: `${p.l}%`,
              background: i % 2 === 0 ? "rgba(232,160,32,0.7)" : "rgba(255,255,255,0.4)",
              animation: `floatParticle ${p.dur}s ease-in infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 text-white text-center max-w-sm w-full">
          {/* Logo dengan cincin dekorasi berputar pelan — kesan "seal" resmi */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-40"
                style={{ background: "radial-gradient(circle, rgba(232,160,32,0.8) 0%, transparent 70%)", animation: "pulseGold 3s ease-in-out infinite" }} />
              <div className="absolute inset-0 rounded-full border border-dashed border-gold/25"
                style={{ animation: "rotateOrb 30s linear infinite" }} />
              <div className="absolute inset-3 rounded-full border border-white/10" />
              <Image
                src="/images/logo-full-white.png"
                alt="SMK Al Munawwir IIBS"
                width={280}
                height={66}
                className="object-contain relative z-10 drop-shadow-2xl h-16 w-auto mx-auto"
                priority
                unoptimized
              />
            </div>
          </div>

          {/* Arabic */}
          <p className="font-arabic text-gold text-4xl mb-2" style={{ lineHeight: 2 }}>اقْرَأْ بِاسْمِ رَبِّكَ</p>
          <p className="text-gold/60 text-xs font-medium tracking-widest uppercase mb-6">{t.iqra}</p>

          {/* School name — SATU baris, tidak boleh terpecah di mana pun (whitespace-nowrap). */}
          <div className="mb-2">
            <p className="text-white/50 text-xs tracking-widest uppercase font-semibold mb-1">{t.portalLabel}</p>
            <h1 className="font-heading text-[1.7rem] font-bold text-white whitespace-nowrap">{t.schoolName}</h1>
            <div className="h-px w-16 mx-auto mt-2.5 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          </div>

          <p className="text-white/50 text-sm leading-relaxed mb-9 max-w-xs mx-auto">
            {t.tagline}
          </p>

          {/* Stats — dengan ikon supaya lebih hidup */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ value, label, Icon }) => (
              <div key={label}
                className="group rounded-2xl py-4 px-2 text-center border border-white/10 hover:border-gold/30 transition-colors duration-300"
                style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <Icon size={16} className="mx-auto mb-1.5 text-gold/70 group-hover:text-gold transition-colors" />
                <p className="font-heading font-bold text-xl text-gold">{value}</p>
                <p className="text-white/50 text-[0.68rem] mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-10 flex items-center justify-center gap-2 text-white/25 text-xs">
            <Sparkles size={11} />
            <span>{t.accredited}</span>
          </div>
        </div>
      </div>

      {/* ── Kanan: Form Panel ── */}
      {/* overflow VISIBLE (bukan hidden) — sengaja, supaya kartu form bisa menjorok/"melayang"
          menutupi sebagian batas panel kiri di layar besar (lihat -ml- di wrapper kartu). */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-cream relative">

        {/* Radial glow halus + sedikit pattern, gantikan dot-grid polos */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(27,43,107,0.05) 0%, transparent 55%), radial-gradient(ellipse at 90% 90%, rgba(232,160,32,0.06) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(15,26,69,0.035) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />

        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-900 via-gold to-primary-900 z-10" />

        <div className="relative w-full max-w-md lg:-ml-16 xl:-ml-24 z-10">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <Image src="/images/logo-full.png" alt="SMK Al Munawwir IIBS" width={200} height={50} className="h-10 w-auto object-contain" />
          </div>

          {/* Kartu form "melayang" — sedikit menjorok ke panel kiri di layar besar, dengan bayangan
              tebal + border tipis emas, supaya kesan lebih premium dibanding cuma nempel rata. */}
          <div className="bg-white rounded-[1.75rem] shadow-2xl shadow-primary-900/20 border border-gold/15 p-7 md:p-10 relative">

            {/* Badge kecil di atas kartu */}
            <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-100 text-primary-700 text-[0.68rem] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full mb-5">
              <ShieldCheck size={12} className="text-gold" />
              {t.badge}
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h2 className="font-heading text-3xl font-bold text-navy mb-1">{t.welcome}</h2>
              <p className="text-gray-400 text-sm">{t.signInPrompt}</p>
              <div className="h-1 w-10 rounded-full bg-gradient-to-r from-gold to-primary-700 mt-3" />
            </div>

            {/* Error */}
            {state?.error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {state.error}
              </div>
            )}

            {/* Form */}
            <form action={action} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">{t.email}</label>
                <div className="relative group/field">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                    <Mail size={16} className="text-gray-400 group-focus-within/field:text-primary-700 transition-colors" />
                  </div>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="email@smkalmunawwiriibs.sch.id"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm focus:border-primary-500 focus:ring-3 focus:ring-primary-100 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy mb-2">{t.password}</label>
                <div className="relative group/field">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                    <Lock size={16} className="text-gray-400 group-focus-within/field:text-primary-700 transition-colors" />
                  </div>
                  <input
                    name="password"
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-white text-sm focus:border-primary-500 focus:ring-3 focus:ring-primary-100 outline-none transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-700 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="relative w-full overflow-hidden flex items-center justify-center gap-2.5 bg-primary-900 hover:bg-primary-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-sm transition-all duration-200 shadow-lg shadow-primary-900/25 hover:shadow-primary-900/40 hover:-translate-y-0.5 mt-2"
              >
                {/* Kilau tipis yang menyapu tombol — aksen "premium" tanpa berlebihan */}
                <span className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(110deg, transparent 30%, rgba(232,160,32,0.35) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 3.5s ease-in-out infinite",
                  }} />
                {pending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin relative z-10" />
                ) : (
                  <ArrowRight size={18} className="relative z-10" />
                )}
                <span className="relative z-10">{pending ? t.processing : t.signInPortal}</span>
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-gray-300 text-xs">{t.or}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Links */}
            <div className="space-y-3 text-center text-sm">
              <p className="text-gray-400">
                {t.noAccount}{" "}
                <Link href="/admissions" className="text-primary-700 font-semibold hover:text-gold transition-colors">
                  {t.registerSpmb}
                </Link>
              </p>
              <Link href="/" className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-primary-700 transition-colors text-xs">
                {t.backHome}
              </Link>
            </div>

            {/* Bottom note */}
            <div className="mt-8 p-4 rounded-2xl bg-primary-50 border border-primary-100">
              <p className="text-xs text-primary-700/70 text-center leading-relaxed">
                {t.footerNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
