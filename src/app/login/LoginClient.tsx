"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Loader2, KeyRound, Smartphone, UserPlus } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { login, verifyLoginTotp, type LoginState } from "@/app/actions/auth";
import { NAMA_APLIKASI } from "@/lib/aplikasi-ujian";

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
    kembaliBeranda: "Beranda",
    footerNote: "Akses portal hanya untuk warga SMK Al Munawwir IIBS. Lupa password? Hubungi admin sekolah.",
    remember: "Ingat saya di perangkat ini",
    rememberHint: "Tetap masuk 30 hari. Jangan dicentang di komputer lab/TU yang dipakai bergantian.",
    appTagline: "Portal Siswa · Guru · Orang Tua",
    appPrompt: "Gunakan email & password akun sekolah Anda.",
    appVersion: `${NAMA_APLIKASI} — aplikasi resmi SMK Al Munawwir IIBS`,
    rememberHintApp: "Tetap masuk 30 hari di HP ini. Hilangkan centang bila HP dipakai bergantian.",
    fitur: ["Jadwal, nilai & rapor", "Absensi, izin & perizinan online", "Ujian, perpustakaan & pengumuman"],
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
    kembaliBeranda: "Home",
    footerNote: "Portal access is for SMK Al Munawwir IIBS members only. Forgot your password? Contact the school admin.",
    remember: "Remember me on this device",
    rememberHint: "Stay signed in for 30 days. Leave unchecked on shared lab/office computers.",
    appTagline: "Students · Teachers · Parents Portal",
    appPrompt: "Use your school account email & password.",
    appVersion: `${NAMA_APLIKASI} — official SMK Al Munawwir IIBS app`,
    rememberHintApp: "Stay signed in for 30 days on this phone. Uncheck it if the phone is shared.",
    fitur: ["Schedules, grades & report cards", "Attendance & online leave requests", "Exams, library & announcements"],
  },
} as const;

const IKON_ISIAN = "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within/isian:text-primary-700";
const TOMBOL = "sentuh flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60";

/** Isi halaman Masuk. SATU tampilan untuk situs & aplikasi (23 September 2026 — permintaan user: halaman login
 * "benar-benar halaman login tanpa header" dan "benar-benar keren"): layar navy bergradien bermotif SMK, logo dalam
 * cincin emas + salam, lalu kartu putih berisi formulir (menempel ke bawah layar di HP, mengambang di layar lebar).
 * Ini MEMBALIK pola 15 September 2026 (navbar situs + pita biru pendek) — di situs, tautan kembali ke beranda, SPMB,
 * dan pasang aplikasi menggantikan fungsi navbar. Ayat & keterangannya dari Konten Halaman (islamic.login_arabic /
 * islamic.login_label, dibaca page.tsx — CLAUDE.md #39); bahasa dari cookie `lang`. Isian memakai `.input-field`
 * (16px di HP, lihat globals.css) supaya iPhone tidak memperbesar layar. */
export default function LoginClient({ ayat, keteranganAyat, lang = "id", modeAplikasi = false, logo }: {
  ayat: string; keteranganAyat: string; lang?: "id" | "en";
  /** Di aplikasi MyAlwis Mobile: tanpa tautan situs publik (beranda/SPMB/pasang aplikasi) & "ingat saya" tercentang. */
  modeAplikasi?: boolean; logo?: string;
}) {
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

  const isiFormulir = (
    <>
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
        <input type="checkbox" name="ingat" defaultChecked={modeAplikasi} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
        <span className="text-sm leading-snug text-gray-700">
          {t.remember}
          <span className="mt-0.5 block text-xs text-gray-500">{modeAplikasi ? t.rememberHintApp : t.rememberHint}</span>
        </span>
      </label>

      <button type="submit" disabled={pending} className={TOMBOL}>
        {pending ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
        {pending ? t.processing : t.signInPortal}
      </button>
    </form>
  )}
    </>
  );

  return (
    <TampilanMasuk logo={logo} ayat={ayat} keteranganAyat={keteranganAyat} t={t} lang={lang} aplikasi={modeAplikasi}>
      {isiFormulir}
    </TampilanMasuk>
  );
}

/** Bingkai halaman Masuk — DUA tata letak dari satu formulir (satu instans, supaya id isian tidak kembar):
 * • HP & tablet: gaya aplikasi bank acuan user (Livin'/BRImo) — navy di atas, kartu putih "naik" dari bawah.
 * • Layar lebar (lg+): terbagi dua kolom — kiri panel navy (logo, salam, identitas, ayat, ringkasan isi portal),
 *   kanan latar krem dengan kartu formulir di tengah. Versi tumpuk di layar lebar "terlihat aneh" seperti halaman HP
 *   yang dibesarkan (temuan user 23 Sep 2026), makanya dipisah di lg ke atas.
 * `aplikasi` hanya menentukan tautan situs publik & ruang aman (notch) — aplikasi selalu memakai tata letak HP. */
function TampilanMasuk({ logo, ayat, keteranganAyat, t, lang, aplikasi, children }: {
  logo?: string; ayat: string; keteranganAyat: string; t: (typeof ui)["id"] | (typeof ui)["en"];
  lang: "id" | "en"; aplikasi: boolean; children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden text-white sm:justify-center lg:flex-row lg:justify-start"
      style={{ background: "linear-gradient(160deg, #0A1030 0%, #0F1A45 45%, #1B2B6B 100%)" }} lang={lang}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] lg:opacity-[0.05]"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "150px 150px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute -left-28 top-44 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #3b5bdb 0%, transparent 70%)" }} />

      {/* Pengganti navbar di situs: satu tautan kembali ke beranda. */}
      {!aplikasi && (
        <Link href="/"
          className="sentuh absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white sm:left-6 sm:top-6">
          <ArrowLeft size={15} aria-hidden="true" /> {t.kembaliBeranda}
        </Link>
      )}

      <section className={`relative flex flex-col items-center px-6 text-center lg:min-h-dvh lg:w-[52%] lg:shrink-0 lg:items-start lg:justify-center lg:px-14 lg:pb-0 lg:pt-0 lg:text-left xl:px-20 ${aplikasi ? "" : "pb-16 pt-20 sm:pb-8 sm:pt-4"}`}
        style={aplikasi ? { paddingTop: "max(3.5rem, calc(env(safe-area-inset-top) + 2.25rem))", paddingBottom: "4.5rem" } : undefined}>
        <div className="masuk-halus relative">
          <span className="absolute -inset-3 rounded-full bg-gold/25 blur-2xl" aria-hidden="true" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white p-2.5 shadow-[0_14px_40px_rgba(232,160,32,0.35)] ring-4 ring-gold/80 ring-offset-4 ring-offset-[#0F1A45] sm:h-28 sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Logo SMK Al-Munawwir IIBS" className="h-full w-full object-contain" />
          </div>
        </div>
        <p className="masuk-halus mt-6 font-arabic text-xl text-gold-light lg:mt-7 lg:text-2xl" style={{ lineHeight: 1.9 }} dir="rtl" lang="ar">اَلسَّلَامُ عَلَيْكُمْ</p>
        <h1 className="masuk-halus font-heading text-[1.65rem] font-bold leading-tight tracking-tight lg:text-4xl xl:text-[2.6rem]">SMK Al-Munawwir IIBS</h1>
        <p className="masuk-halus mt-1.5 text-sm text-white/65 lg:mt-3 lg:text-base">{aplikasi ? t.appTagline : t.portalLabel}</p>

        {/* Hanya layar lebar: isi kolom kiri supaya tidak terasa kosong — ringkasan isi portal + ayat. */}
        <div className="masuk-halus mt-10 hidden w-full max-w-md lg:block">
          <ul className="space-y-2.5">
            {t.fitur.map(f => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" /> {f}
              </li>
            ))}
          </ul>
          {ayat && (
            <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
              <p className="font-arabic text-xl text-gold-light" style={{ lineHeight: 2 }} lang="ar" dir="rtl">{ayat}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/50">{keteranganAyat || t.iqra}</p>
            </div>
          )}
        </div>
      </section>

      {/* div (bukan section): section.bg-white diberi motif garis diagonal oleh globals.css — kartu ini harus polos. */}
      <div className="masuk-halus relative -mt-10 flex flex-1 flex-col rounded-t-[2rem] bg-white px-6 pb-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] pt-4 text-gray-900 shadow-[0_-16px_48px_rgba(10,16,48,0.45)] sm:mx-auto sm:mb-10 sm:mt-0 sm:w-[calc(100%-3rem)] sm:max-w-md sm:flex-none sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-7 sm:shadow-[0_28px_70px_rgba(10,16,48,0.5)] lg:m-0 lg:w-[48%] lg:max-w-none lg:flex-1 lg:items-center lg:justify-center lg:rounded-none lg:bg-cream lg:px-10 lg:py-12 lg:shadow-none">
        <span className="mx-auto h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" aria-hidden="true" />
        <div className="mx-auto w-full max-w-md lg:rounded-3xl lg:border lg:border-gray-100 lg:bg-white lg:p-9 lg:shadow-[0_18px_50px_rgba(15,26,69,0.10)]">
          <h2 className="mt-5 font-heading text-xl font-bold text-primary-900 sm:mt-0">{t.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{aplikasi ? t.appPrompt : t.signInPrompt}</p>
          <div className="mt-6">{children}</div>

          {ayat && (
            <div className="mt-8 border-t border-gray-100 pt-5 text-center lg:hidden">
              <p className="font-arabic text-xl text-primary-700" style={{ lineHeight: 2 }} lang="ar" dir="rtl">{ayat}</p>
              <p className="text-xs uppercase tracking-widest text-gold-dark">{keteranganAyat || t.iqra}</p>
            </div>
          )}

          {!aplikasi && (
            <div className="mt-6 flex flex-col items-center gap-1.5 border-t border-gray-100 pt-5 text-sm">
              <p className="text-gray-500">
                {t.noAccount}{" "}
                <Link href="/admissions" className="inline-flex items-center gap-1 font-semibold text-primary-700 transition-colors hover:text-gold-dark">
                  <UserPlus size={14} aria-hidden="true" /> {t.registerSpmb}
                </Link>
              </p>
              <Link href="/pasang-aplikasi" className="sentuh inline-flex items-center gap-1.5 font-semibold text-primary-700 transition-colors hover:text-gold-dark">
                <Smartphone size={14} aria-hidden="true" /> {t.installApp}
              </Link>
              <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-gray-500">{t.footerNote}</p>
            </div>
          )}

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
            <ShieldCheck size={13} className="text-gold-dark" aria-hidden="true" /> {aplikasi ? t.appVersion : t.badge}
          </p>
        </div>
      </div>
    </main>
  );
}
