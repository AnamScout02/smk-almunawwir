"use client";
import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, BookOpen, GraduationCap, ClipboardList } from "lucide-react";
import { useState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const roles = [
  {
    key: "admin",
    label: "Admin / Kepsek",
    icon: ShieldCheck,
    desc: "Kelola seluruh data sekolah",
    color: "text-primary-700",
    bg: "bg-primary-50 border-primary-200",
    activeBg: "bg-primary-700 border-primary-700",
  },
  {
    key: "tas",
    label: "TAS",
    icon: ClipboardList,
    desc: "Administrasi & buku induk",
    color: "text-gold",
    bg: "bg-amber-50 border-amber-200",
    activeBg: "bg-amber-600 border-amber-600",
  },
  {
    key: "guru",
    label: "Guru",
    icon: BookOpen,
    desc: "Input nilai & absensi",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    activeBg: "bg-emerald-700 border-emerald-700",
  },
  {
    key: "siswa",
    label: "Siswa",
    icon: GraduationCap,
    desc: "Lihat rapor & jadwal",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    activeBg: "bg-blue-700 border-blue-700",
  },
] as const;

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [showPass, setShowPass] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const selectedInfo = roles.find(r => r.key === selectedRole);

  return (
    <div className="min-h-screen flex">
      {/* Sisi kiri — Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute top-20 right-10 w-64 h-64 rounded-full border-8 border-gold/20 opacity-50" />
        <div className="absolute bottom-20 left-10 w-40 h-40 rounded-full border-4 border-gold/10 opacity-40" />
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />

        <div className="relative text-white text-center max-w-sm">
          <div className="flex justify-center mb-6">
            <Image
              src="/images/logo-emblem.png"
              alt="SMK Al-Munawwir IIBS"
              width={110}
              height={110}
              className="rounded-full object-contain"
              priority
            />
          </div>
          <p className="font-arabic text-gold text-3xl mb-3">اقْرَأْ بِاسْمِ رَبِّكَ</p>
          <h2 className="font-heading text-3xl font-bold mb-3">SMK Al-Munawwir</h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            International Islamic Boarding School — Portal Akademik untuk Guru & Siswa
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { v: "1.200+", l: "Siswa" },
              { v: "50+", l: "Guru" },
              { v: "5", l: "Jurusan" },
            ].map((s) => (
              <div key={s.l} className="bg-white/10 rounded-xl py-3">
                <div className="text-gold font-bold font-heading">{s.v}</div>
                <div className="text-white/60 text-xs mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sisi kanan — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-cream">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Image src="/images/logo-emblem.png" alt="Logo" width={36} height={36} className="rounded-full object-contain" />
            <span className="font-heading font-bold text-primary-900">Al-Munawwir IIBS</span>
          </div>

          <h1 className="font-heading text-3xl font-bold text-navy mb-1">Selamat Datang</h1>
          <p className="text-gray-500 mb-6 text-sm">
            {selectedInfo ? `Masuk sebagai ${selectedInfo.label} — ${selectedInfo.desc}` : "Pilih peran Anda untuk masuk"}
          </p>

          {/* Pilihan Role */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {roles.map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.key;
              return (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => setSelectedRole(isActive ? null : role.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    isActive
                      ? `${role.activeBg} text-white`
                      : `${role.bg} ${role.color} hover:scale-[1.03]`
                  }`}
                >
                  <Icon size={20} className={isActive ? "text-white" : ""} />
                  <span className={`text-xs font-semibold leading-tight ${isActive ? "text-white" : ""}`}>
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>

          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="email@smkalmunawwiriibs.sch.id"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full !rounded-xl disabled:opacity-60 text-base"
            >
              {pending ? "Memproses..." : selectedInfo ? `Masuk sebagai ${selectedInfo.label}` : "Masuk"}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm text-gray-500">
            <p>Lupa password? Hubungi admin sekolah.</p>
            <p>
              Belum punya akun?{" "}
              <Link href="/admissions" className="text-primary-700 font-semibold hover:text-gold transition-colors">
                Daftar di sini
              </Link>
            </p>
            <Link href="/" className="block text-gray-400 hover:text-gray-600 transition-colors">
              ← Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
