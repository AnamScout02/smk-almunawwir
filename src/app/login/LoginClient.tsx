"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, KeyRound, Smartphone, UserPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { login, verifyLoginTotp, type LoginState } from "@/app/actions/auth";

const ui = {
  id: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Portal Akademik Terpadu",
    title: "Masuk Portal",
    signInPrompt: "Masuk dengan akun sekolah untuk membuka portal guru, siswa, orang tua, dan staf.",
    badge: "Akses resmi warga sekolah",
    email: "Email",
    emailPh: "nama@smkalmunawwiriibs.sch.id",
    password: "Password",
    showPassword: "Tampilkan password",
    hidePassword: "Sembunyikan password",
    processing: "Memproses...",
    signInPortal: "Masuk",
    totpHint: "Masukkan kode dari aplikasi authenticator (atau salah satu kode cadangan).",
    totpLabel: "Kode 2FA",
    totpSubmit: "Verifikasi & Masuk",
    noAccount: "Calon siswa baru?",
    registerSpmb: "Daftar SPMB",
    installApp: "Pasang aplikasi di HP / laptop",
    footerNote: "Akses portal hanya untuk warga SMK Al Munawwir IIBS. Lupa password? Hubungi admin sekolah.",
    remember: "Ingat saya di perangkat ini",
    rememberHint: "Tetap masuk 30 hari. Jangan dicentang di komputer lab/TU yang dipakai bergantian.",
  },
  en: {
    iqra: "Iqra' Bismi Rabbik",
    portalLabel: "Integrated Academic Portal",
    title: "Portal Sign In",
    signInPrompt: "Sign in with your school account to open the teacher, student, parent, and staff portals.",
    badge: "Official school member access",
    email: "Email",
    emailPh: "name@smkalmunawwiriibs.sch.id",
    password: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    processing: "Processing...",
    signInPortal: "Sign In",
    totpHint: "Enter the code from your authenticator app (or one of your backup codes).",
    totpLabel: "2FA Code",
    totpSubmit: "Verify & Sign In",
    noAccount: "New student applicant?",
    registerSpmb: "Register (SPMB)",
    installApp: "Install the app on your phone / laptop",
    footerNote: "Portal access is for SMK Al Munawwir IIBS members only. Forgot your password? Contact the school admin.",
    remember: "Remember me on this device",
    rememberHint: "Stay signed in for 30 days. Leave unchecked on shared lab/office computers.",
  },
} as const;

const IKON_ISIAN = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within/isian:text-primary-700";
const TOMBOL = "sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60";

/** Isi halaman Masuk — disederhanakan mengikuti halaman Cek Kelulusan (permintaan user 15 Sep 2026: "bagian birunya
 * tidak banyak"): navbar situs (dari page.tsx) → pita biru ringkas → satu kartu formulir putih di latar krem.
 * Ayat & keterangannya dari Konten Halaman (islamic.login_arabic / islamic.login_label, dibaca page.tsx — CLAUDE.md #39);
 * bahasa dari cookie `lang`. Isian memakai `.input-field` (16px di HP, lihat globals.css) supaya iPhone tidak memperbesar layar. */
export default function LoginClient({ ayat, keteranganAyat, lang = "id" }: { ayat: string; keteranganAyat: string; lang?: "id" | "en" }) {
  // Setelah menekan Keluar: lepas langganan notifikasi push perangkat ini, supaya komputer/HP yang dipakai
  // bergantian tidak terus menerima notifikasi akun sebelumnya.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("keluar") !== "1") return;
    import("@/lib/push-client").then(m => m.matikanPush()).catch(() => {});
    window.history.replaceState(null, "", "/login");
  }, []);

  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [totpState, totpAction, totpPending] = useActionState<LoginState, FormData>(verifyLoginTotp, undefined);
  // Login admin dgn 2FA aktif jadi 2 langkah: password dulu (state.needsTotp jadi true), baru
  // kode TOTP. Tetap di langkah 2 selama totpState sudah pernah terisi (termasuk kalau kode
  // salah — totpState.error), bukan cuma sekali cek state.needsTotp saja.
  const showTotpStep = !!state?.needsTotp || totpState !== undefined;
  const [showPass, setShowPass] = useState(false);

  const t = ui[lang];
  const galat = showTotpStep ? totpState?.error : state?.error;

  return (
    <main className="min-h-dvh bg-cream">
      {/* ── Pita biru ringkas (seperti Cek Kelulusan, sengaja lebih pendek: ±25% tinggi layar — permintaan user) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700 pb-7 pt-20 text-white sm:pb-9 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="container-custom relative text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold sm:text-sm">{t.portalLabel}</span>
          <h1 className="judul-seimbang mt-1.5 font-heading text-3xl font-bold md:text-4xl">{t.title}</h1>
          <p className="judul-seimbang mx-auto mt-1.5 max-w-lg text-sm text-white/70 sm:text-base">{t.signInPrompt}</p>
        </div>
      </section>

      {/* ── Kartu formulir ── */}
      <section className="px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <div className="masuk-halus rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
            {/* Ayat pembuka dari Konten Halaman (islamic.login_arabic / _label) — dipindah dari pita biru supaya pita tetap pendek. */}
            {ayat && (
              <div className="mb-5 border-b border-gray-100 pb-4 text-center">
                <p className="font-arabic text-2xl text-primary-700" style={{ lineHeight: 2 }} lang="ar" dir="rtl">{ayat}</p>
                <p className="text-xs uppercase tracking-widest text-gold-dark">{keteranganAyat || t.iqra}</p>
              </div>
            )}
            <p className="mb-5 flex items-center gap-2 text-xs font-semibold text-primary-700">
              <ShieldCheck size={15} className="text-gold-dark" aria-hidden="true" /> {t.badge}
            </p>

            {galat && (
              <p role="alert" className="error-msg mb-4">{galat}</p>
            )}

            {showTotpStep ? (
              /* Langkah 2 — kode 2FA (khusus admin yang sudah mengaktifkan TOTP) */
              <form action={totpAction} className="space-y-4">
                <p className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">{t.totpHint}</p>
                <div>
                  <label htmlFor="kode-2fa" className="label-field">{t.totpLabel}</label>
                  <div className="group/isian relative">
                    <KeyRound size={16} className={IKON_ISIAN} aria-hidden="true" />
                    <input id="kode-2fa" name="code" type="text" inputMode="text" autoComplete="one-time-code" autoFocus required
                      placeholder="123456" className="input-field pl-10 tracking-widest" />
                  </div>
                </div>
                <button type="submit" disabled={totpPending} className={TOMBOL}>
                  {totpPending ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                  {totpPending ? t.processing : t.totpSubmit}
                </button>
              </form>
            ) : (
              /* Langkah 1 — email + password */
              <form action={action} className="space-y-4">
                <div>
                  <label htmlFor="email-masuk" className="label-field">{t.email}</label>
                  <div className="group/isian relative">
                    <Mail size={16} className={IKON_ISIAN} aria-hidden="true" />
                    <input id="email-masuk" name="email" type="email" required autoComplete="username" inputMode="email"
                      placeholder={t.emailPh} className="input-field pl-10" />
                  </div>
                </div>

                <div>
                  <label htmlFor="password-masuk" className="label-field">{t.password}</label>
                  <div className="group/isian relative">
                    <Lock size={16} className={IKON_ISIAN} aria-hidden="true" />
                    <input id="password-masuk" name="password" type={showPass ? "text" : "password"} required autoComplete="current-password"
                      placeholder="••••••••" className="input-field pl-10 pr-12" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? t.hidePassword : t.showPassword} aria-pressed={showPass}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-gold">
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* "Ingat saya" — tidak dicentang (bawaan): sesi hilang saat browser ditutup / 8 jam tanpa
                    aktivitas. Dicentang: 30 hari. Lihat src/lib/session.ts. */}
                <label className="flex cursor-pointer select-none items-start gap-3">
                  <input type="checkbox" name="ingat" className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary-700" />
                  <span className="text-sm leading-snug text-gray-700">
                    {t.remember}
                    <span className="mt-0.5 block text-xs text-gray-500">{t.rememberHint}</span>
                  </span>
                </label>

                <button type="submit" disabled={pending} className={TOMBOL}>
                  {pending ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                  {pending ? t.processing : t.signInPortal}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 text-sm">
            <p className="text-gray-500">
              {t.noAccount}{" "}
              <Link href="/admissions" className="inline-flex items-center gap-1 font-semibold text-primary-700 transition-colors hover:text-gold-dark">
                <UserPlus size={14} aria-hidden="true" /> {t.registerSpmb}
              </Link>
            </p>
            <Link href="/pasang-aplikasi" className="sentuh inline-flex items-center gap-1.5 font-semibold text-primary-700 transition-colors hover:text-gold-dark">
              <Smartphone size={14} aria-hidden="true" /> {t.installApp}
            </Link>
          </div>

          <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-gray-500">{t.footerNote}</p>
        </div>
      </section>
    </main>
  );
}
