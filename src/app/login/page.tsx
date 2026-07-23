"use client";
import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, BookOpen, GraduationCap, ClipboardList, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const roles = {
  id: [
    { key: "admin", label: "Admin", subLabel: "Kepsek", icon: ShieldCheck, desc: "Kelola seluruh data", gradient: "from-primary-800 to-primary-900", ring: "ring-primary-500", activeBg: "bg-primary-700", chipColor: "bg-primary-100 text-primary-700" },
    { key: "tas", label: "TAS", subLabel: "Tata Usaha", icon: ClipboardList, desc: "Administrasi sekolah", gradient: "from-amber-600 to-amber-800", ring: "ring-amber-400", activeBg: "bg-amber-600", chipColor: "bg-amber-100 text-amber-700" },
    { key: "guru", label: "Guru", subLabel: "Pendidik", icon: BookOpen, desc: "Nilai & absensi", gradient: "from-emerald-600 to-emerald-800", ring: "ring-emerald-400", activeBg: "bg-emerald-700", chipColor: "bg-emerald-100 text-emerald-700" },
    { key: "siswa", label: "Siswa", subLabel: "Santri", icon: GraduationCap, desc: "Rapor & jadwal", gradient: "from-blue-600 to-blue-800", ring: "ring-blue-400", activeBg: "bg-blue-700", chipColor: "bg-blue-100 text-blue-700" },
  ],
  en: [
    { key: "admin", label: "Admin", subLabel: "Principal", icon: ShieldCheck, desc: "Manage all data", gradient: "from-primary-800 to-primary-900", ring: "ring-primary-500", activeBg: "bg-primary-700", chipColor: "bg-primary-100 text-primary-700" },
    { key: "tas", label: "Staff", subLabel: "Administration", icon: ClipboardList, desc: "School administration", gradient: "from-amber-600 to-amber-800", ring: "ring-amber-400", activeBg: "bg-amber-600", chipColor: "bg-amber-100 text-amber-700" },
    { key: "guru", label: "Teacher", subLabel: "Educator", icon: BookOpen, desc: "Grades & attendance", gradient: "from-emerald-600 to-emerald-800", ring: "ring-emerald-400", activeBg: "bg-emerald-700", chipColor: "bg-emerald-100 text-emerald-700" },
    { key: "siswa", label: "Student", subLabel: "Santri", icon: GraduationCap, desc: "Report card & schedule", gradient: "from-blue-600 to-blue-800", ring: "ring-blue-400", activeBg: "bg-blue-700", chipColor: "bg-blue-100 text-blue-700" },
  ],
} as const;

const ui = {
  id: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Portal Akademik",
    schoolName: "SMK Al Munawwir",
    tagline: "International Islamic Boarding School — Singojuruh, Banyuwangi",
    stats: [
      { value: "1.200+", label: "Siswa Aktif" },
      { value: "50+", label: "Tenaga Pendidik" },
      { value: "5", label: "Konsentrasi" },
    ],
    accredited: "NPSN 69896523 · Terakreditasi",
    welcome: "Selamat Datang",
    signInAs: (label: string, sub: string) => <span>Masuk sebagai <span className="font-semibold text-primary-700">{label} — {sub}</span></span>,
    choosePrompt: "Pilih peran Anda untuk memulai",
    email: "Email",
    password: "Password",
    processing: "Memproses...",
    signInAsBtn: (label: string) => `Masuk sebagai ${label}`,
    signInPortal: "Masuk ke Portal",
    or: "atau",
    noAccount: "Belum punya akun?",
    registerSpmb: "Daftar SPMB",
    backHome: "← Kembali ke Beranda",
    footerNote: "Akses portal hanya untuk warga SMK Al Munawwir IIBS. Jika lupa password, hubungi admin sekolah.",
  },
  en: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Academic Portal",
    schoolName: "SMK Al Munawwir",
    tagline: "International Islamic Boarding School — Singojuruh, Banyuwangi",
    stats: [
      { value: "1,200+", label: "Active Students" },
      { value: "50+", label: "Educators" },
      { value: "5", label: "Majors" },
    ],
    accredited: "NPSN 69896523 · Accredited",
    welcome: "Welcome",
    signInAs: (label: string, sub: string) => <span>Signing in as <span className="font-semibold text-primary-700">{label} — {sub}</span></span>,
    choosePrompt: "Choose your role to get started",
    email: "Email",
    password: "Password",
    processing: "Processing...",
    signInAsBtn: (label: string) => `Sign In as ${label}`,
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

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [showPass, setShowPass] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [lang, setLang] = useState<"id" | "en">("id");
  const [students, setStudents] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved === "en") setLang("en");
  }, []);

  useEffect(() => {
    fetch("/api/settings/stats").then(r => r.json()).then(d => { if (d.students) setStudents(d.students); }).catch(() => {});
  }, []);

  const t = ui[lang];
  const roleList = roles[lang];
  const selectedInfo = roleList.find(r => r.key === selectedRole);
  const stats = students ? [{ ...t.stats[0], value: `${students}+` }, t.stats[1], t.stats[2]] : t.stats;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Kiri: Branding Panel ── */}
      <div className="relative lg:w-[52%] flex items-center justify-center p-10 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 30%, #1B2B6B 60%, #0F1A45 100%)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 12s ease infinite",
        }}>

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
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl opacity-30"
                style={{ background: "radial-gradient(circle, rgba(232,160,32,0.8) 0%, transparent 70%)", animation: "pulseGold 3s ease-in-out infinite" }} />
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

          {/* School name */}
          <div className="mb-2">
            <p className="text-white/50 text-xs tracking-widest uppercase font-semibold mb-1">{t.portalLabel}</p>
            <h1 className="font-heading text-2xl font-bold text-white">{t.schoolName}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="h-px flex-1 max-w-12 bg-gradient-to-r from-transparent to-gold/50" />
              <span className="text-gold text-xs font-bold tracking-widest">IIBS</span>
              <div className="h-px flex-1 max-w-12 bg-gradient-to-l from-transparent to-gold/50" />
            </div>
          </div>

          <p className="text-white/50 text-sm leading-relaxed mb-10 max-w-xs mx-auto">
            {t.tagline}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ value, label }) => (
              <div key={label}
                className="rounded-2xl py-4 text-center border border-white/10"
                style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}>
                <p className="font-heading font-bold text-xl text-gold">{value}</p>
                <p className="text-white/50 text-xs mt-0.5 leading-tight">{label}</p>
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
      <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-cream relative"
        style={{ backgroundImage: "radial-gradient(circle, rgba(15,26,69,0.04) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }}>

        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-900 via-gold to-primary-900" />

        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <Image src="/images/logo-full.png" alt="SMK Al Munawwir IIBS" width={200} height={50} className="h-10 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-bold text-navy mb-1">{t.welcome}</h2>
            <p className="text-gray-400 text-sm">
              {selectedInfo
                ? t.signInAs(selectedInfo.label, selectedInfo.subLabel)
                : t.choosePrompt}
            </p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-4 gap-2.5 mb-8">
            {roleList.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.key;
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => setSelectedRole(isActive ? null : role.key)}
                  className={`relative flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all duration-200 overflow-hidden text-center ${
                    isActive
                      ? `border-transparent text-white shadow-lg scale-[1.03]`
                      : `border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:bg-primary-50/50 hover:scale-[1.01]`
                  }`}
                  style={isActive ? {
                    background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
                  } : {}}
                >
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient}`} />
                  )}
                  {isActive && (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold" />
                  )}
                  <div className="relative z-10">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-1 ${
                      isActive ? "bg-white/20" : role.chipColor
                    }`}>
                      <Icon size={18} className={isActive ? "text-white" : ""} />
                    </div>
                    <p className={`text-xs font-bold leading-tight ${isActive ? "text-white" : "text-navy"}`}>{role.label}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${isActive ? "text-white/70" : "text-gray-400"}`}>{role.subLabel}</p>
                  </div>
                </button>
              );
            })}
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
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                  <Mail size={16} className="text-gray-400" />
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
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                  <Lock size={16} className="text-gray-400" />
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
              className="w-full flex items-center justify-center gap-2.5 bg-primary-900 hover:bg-primary-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-sm transition-all duration-200 shadow-lg shadow-primary-900/20 hover:shadow-primary-900/30 hover:-translate-y-0.5 mt-2"
            >
              {pending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {pending ? t.processing : selectedInfo ? t.signInAsBtn(selectedInfo.label) : t.signInPortal}
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
  );
}
