export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/site-settings";
import FormTamuPublik from "@/components/shared/FormTamuPublik";

export const metadata = { title: "Buku Tamu — SMK Al Munawwir IIBS" };

const NAVY_GRADIENT = "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)";

/** Halaman publik Buku Tamu — dibuka tamu dengan memindai QR di meja depan, TANPA login.
 *
 * Sengaja berdiri sendiri (tidak memakai Navbar/Footer situs): tamu yang baru memindai sebaiknya
 * langsung melihat formulirnya, bukan menu sekolah. Tapi RASA-nya tetap satu tema dengan situs —
 * kepala navy bergradien 3-stop + motif SMK + aksen emas, sama seperti kop dokumen cetak dan
 * header dashboard (penyesuaian atas permintaan user 13 September 2026). */
export default async function Page() {
  const settings = await getSettings(["school.name", "logo.emblem", "logo.full_white"])
    .catch(() => ({} as Record<string, string>));

  return (
    <main className="min-h-dvh bg-cream flex flex-col">
      {/* Kepala navy — gaya yang sama dengan kop dokumen & header dashboard */}
      <header className="relative overflow-hidden text-center px-5 pt-9 pb-16" style={{ background: NAVY_GRADIENT }}>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", filter: "invert(1)" }} />
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #3b5bdb 0%, transparent 70%)" }} />

        <div className="relative max-w-xl mx-auto">
          {settings["logo.full_white"] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings["logo.full_white"]} alt="SMK Al Munawwir IIBS" className="mx-auto h-11 w-auto object-contain" />
          ) : settings["logo.emblem"] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings["logo.emblem"]} alt="SMK Al Munawwir IIBS" className="mx-auto h-14 w-auto object-contain" />
          ) : null}

          <h1 className="font-heading font-bold text-white text-2xl uppercase tracking-[0.14em] mt-5">Buku Tamu</h1>
          <div className="mx-auto mt-2 h-[3px] w-20 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent 0%, #F5C842 50%, transparent 100%)" }} />
          <p className="font-heading font-semibold text-gold text-xs uppercase tracking-[0.1em] mt-2">
            {settings["school.name"] || "SMK Al Munawwir IIBS"}
          </p>
          <p className="text-white/70 text-sm mt-3 leading-relaxed">
            Selamat datang di sekolah kami.<br />Mohon isi data kunjungan Anda pada formulir di bawah ini.
          </p>
        </div>
      </header>

      {/* Kartu formulir sengaja menindih kepala navy — pola kartu yang sama dengan dashboard */}
      {/* `relative` WAJIB di pembungkus ini. Kartu formulir sengaja menindih kepala navy lewat
          `-mt-10`, tapi kepala itu `position: relative` sedangkan kartunya tidak — elemen
          ber-position selalu digambar DI ATAS elemen biasa, berapa pun urutannya di DOM. Akibatnya
          10 baris teratas kartu (termasuk label "Jenis Tamu") tertutup navy dan tidak terlihat
          sama sekali. */}
      <div className="relative flex-1 px-4 pb-10">
        <div className="max-w-xl mx-auto -mt-10">
          <div className="bg-white rounded-2xl border border-primary-100 shadow-lg p-5 sm:p-6">
            <FormTamuPublik />
          </div>
          <p className="text-center text-xs text-gray-400 mt-5">
            © {new Date().getFullYear()} {settings["school.name"] || "SMK Al Munawwir IIBS"}
          </p>
        </div>
      </div>
    </main>
  );
}
