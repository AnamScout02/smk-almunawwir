export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import { bacaPemeliharaan } from "@/lib/pemeliharaan";

export const metadata = { title: "Sedang Pemeliharaan", robots: { index: false } };

const TEKS = {
  id: {
    judul: "Situs Sedang Dalam Pemeliharaan",
    bawaan: "Kami sedang melakukan perbaikan dan pembaruan sistem agar layanan semakin baik. Mohon maaf atas ketidaknyamanannya — silakan kembali beberapa saat lagi.",
    perkiraan: "Perkiraan selesai", sejak: "Sejak", muat: "Coba Lagi", masuk: "Masuk sebagai Superadmin",
    pratinjau: "Pratinjau — mode pemeliharaan sedang MATI, pengguna lain tidak melihat halaman ini.",
  },
  en: {
    judul: "Site Under Maintenance",
    bawaan: "We are performing system maintenance and updates to improve our services. Sorry for the inconvenience — please check back shortly.",
    perkiraan: "Estimated completion", sejak: "Since", muat: "Try Again", masuk: "Sign in as Superadmin",
    pratinjau: "Preview — maintenance mode is OFF, other users do not see this page.",
  },
};

/** Halaman yang tampil bagi semua pengguna (kecuali Superadmin) saat mode pemeliharaan menyala — `proxy.ts` mengalihkan
 *  setiap permintaan ke sini (`?dari=` = halaman asal, dipakai tombol "Coba Lagi"). Dibuka saat mode MATI → kembali ke
 *  halaman asal, kecuali `?pratinjau=1` dari halaman pengaturan. */
export default async function PemeliharaanPage({ searchParams }: { searchParams: Promise<{ pratinjau?: string; dari?: string }> }) {
  const [keadaan, s, lang, sp] = await Promise.all([
    bacaPemeliharaan(), getSettings(["logo.emblem", "school.name"]), getLang(), searchParams,
  ]);
  const pratinjau = sp.pratinjau === "1";
  // Hanya jalur di situs ini (diawali satu "/") — bukan pengalihan bebas ke situs lain.
  const kembali = sp.dari && /^\/(?![\/\\])/.test(sp.dari) ? sp.dari : "/";
  if (!keadaan.aktif && !pratinjau) redirect(kembali);
  const t = TEKS[lang] ?? TEKS.id;
  const sejak = keadaan.mulai
    ? new Date(keadaan.mulai).toLocaleString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
    : null;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", filter: "invert(1)", opacity: 0.07 }} />
      <div className="relative w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo dari pengaturan */}
        <img src={s["logo.emblem"] || "/images/logo-emblem.png"} alt="" className="mx-auto mb-6 h-20 w-20 rounded-full object-contain ring-4 ring-gold/60" />
        <div className="panel p-6 sm:p-8">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Wrench size={22} />
          </span>
          <h1 className="font-heading text-xl font-bold text-primary-900">{t.judul}</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">{s["school.name"] || "SMK Al Munawwir IIBS"}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-600">{keadaan.pesan.trim() || t.bawaan}</p>
          {(keadaan.sampai.trim() || sejak) && (
            <div className="mt-5 space-y-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
              {keadaan.sampai.trim() && <p><span className="text-gray-500">{t.perkiraan}:</span> <strong className="text-primary-900">{keadaan.sampai}</strong></p>}
              {sejak && <p className="text-xs text-gray-400">{t.sejak} {sejak} WIB</p>}
            </div>
          )}
          {pratinjau && !keadaan.aktif && <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">{t.pratinjau}</p>}
          {/* Tautan biasa (bukan tombol klien): halaman ini harus tetap jalan walau sebagian situs sedang diperbarui. */}
          <a href={kembali} className="btn-modal-save mt-6 w-full">{t.muat}</a>
        </div>
        <Link href="/login" className="mt-5 inline-block text-xs text-white/50 hover:text-white/80">{t.masuk}</Link>
      </div>
    </main>
  );
}
