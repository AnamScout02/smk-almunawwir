"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, Laptop, MessageCircle, ShieldAlert, Smartphone, Tablet } from "lucide-react";
import { bisaDipasang, langganPasang, pasangSekarang, sudahTerpasang } from "@/lib/pasang-pwa";
import { salinTeks } from "@/lib/salin-teks";
import type { Lang } from "@/lib/lang";

type Perangkat = "android" | "ios" | "laptop";

const IKON: Record<Perangkat, typeof Smartphone> = { android: Smartphone, ios: Tablet, laptop: Laptop };

const TEKS = {
  id: {
    petunjuk: {
      android: { judul: "HP Android", langkah: [
        "Buka tautan ini di Google Chrome. Kalau terbuka dari WhatsApp, ketuk menu ⋮ lalu pilih \"Buka di Chrome\".",
        "Ketuk tombol Pasang Aplikasi di halaman ini — atau menu ⋮ → \"Instal aplikasi\" / \"Tambahkan ke layar utama\".",
        "Ikon logo sekolah muncul di layar utama. Buka dari sana seperti aplikasi biasa.",
      ] },
      ios: { judul: "iPhone / iPad", langkah: [
        "Buka tautan ini di Safari. Kalau terbuka dari WhatsApp, ketuk ikon kompas/⋯ lalu \"Buka di Safari\".",
        "Ketuk tombol Bagikan (kotak dengan panah ke atas) di bawah atau atas layar.",
        "Gulir, pilih \"Tambahkan ke Layar Utama\", lalu ketuk Tambah.",
      ] },
      laptop: { judul: "Laptop / Komputer", langkah: [
        "Buka tautan ini di Google Chrome atau Microsoft Edge.",
        "Klik tombol Pasang Aplikasi di halaman ini — atau ikon pasang (layar dengan panah) di ujung kanan bilah alamat.",
        "Aplikasi terbuka di jendela sendiri dan tersedia di menu Start / Launchpad / desktop.",
      ] },
    } as Record<Perangkat, { judul: string; langkah: string[] }>,
    httpJudul: "Halaman ini dibuka lewat alamat biasa (HTTP)", httpIsi: "Browser hanya mengizinkan pemasangan aplikasi dari alamat aman (HTTPS).", buka: "Buka",
    terpasangJudul: "Aplikasi sudah terpasang di perangkat ini",
    terpasangIsi: "Buka dari ikon logo sekolah di layar utama, login, lalu ketuk Aktifkan Notifikasi di bagian atas dashboard supaya pengingat masuk ke HP. Bagikan tautan di samping ke rekan lain.",
    pasangJudul: "Pasang di perangkat ini", pasangIsi: "Ukurannya kecil dan selalu versi terbaru — tidak perlu diperbarui manual.", tombolPasang: "Pasang Aplikasi",
    pilihPerangkat: "Pilih perangkat", bagikanJudul: "Bagikan ke warga sekolah", bagikanIsi: "Kirim tautan ini ke grup WhatsApp guru, siswa, atau orang tua.",
    kirimWa: "Kirim ke WhatsApp", tersalin: "Tautan tersalin", salin: "Salin tautan", bagikanLain: "Bagikan lewat aplikasi lain",
    qrAlt: "QR tautan pemasangan aplikasi", qrIsi: "Pindai dengan kamera HP untuk membuka halaman ini. Cocok dicetak di poster/mading.",
    judulBagikan: "Aplikasi SMK Al Munawwir IIBS",
    pesanWa: (t: string) => `Pasang aplikasi SMK Al Munawwir IIBS di HP/laptop (portal guru, siswa & orang tua): ${t}`,
  },
  en: {
    petunjuk: {
      android: { judul: "Android Phone", langkah: [
        "Open this link in Google Chrome. If it opened from WhatsApp, tap the ⋮ menu and choose \"Open in Chrome\".",
        "Tap the Install App button on this page — or menu ⋮ → \"Install app\" / \"Add to Home screen\".",
        "The school logo icon appears on your home screen. Open it from there like any other app.",
      ] },
      ios: { judul: "iPhone / iPad", langkah: [
        "Open this link in Safari. If it opened from WhatsApp, tap the compass/⋯ icon and choose \"Open in Safari\".",
        "Tap the Share button (a box with an upward arrow) at the bottom or top of the screen.",
        "Scroll, choose \"Add to Home Screen\", then tap Add.",
      ] },
      laptop: { judul: "Laptop / Computer", langkah: [
        "Open this link in Google Chrome or Microsoft Edge.",
        "Click the Install App button on this page — or the install icon (a screen with an arrow) at the right end of the address bar.",
        "The app opens in its own window and is available in the Start menu / Launchpad / desktop.",
      ] },
    } as Record<Perangkat, { judul: string; langkah: string[] }>,
    httpJudul: "This page was opened through a regular address (HTTP)", httpIsi: "Browsers only allow installing the app from a secure address (HTTPS).", buka: "Open",
    terpasangJudul: "The app is already installed on this device",
    terpasangIsi: "Open it from the school logo icon on your home screen, log in, then tap Enable Notifications at the top of the dashboard so reminders reach your phone. Share the link beside this with others.",
    pasangJudul: "Install on this device", pasangIsi: "It is small and always up to date — no manual updates needed.", tombolPasang: "Install App",
    pilihPerangkat: "Choose device", bagikanJudul: "Share with the school community", bagikanIsi: "Send this link to the teacher, student, or parent WhatsApp groups.",
    kirimWa: "Send to WhatsApp", tersalin: "Link copied", salin: "Copy link", bagikanLain: "Share via another app",
    qrAlt: "QR code for the app installation link", qrIsi: "Scan with a phone camera to open this page. Great for printing on posters and notice boards.",
    judulBagikan: "SMK Al Munawwir IIBS App",
    pesanWa: (t: string) => `Install the SMK Al Munawwir IIBS app on your phone/laptop (teacher, student & parent portals): ${t}`,
  },
};

export default function PasangAplikasiPanel({ tautan, alamatAman, lewatHttps, qr, lang = "id" }: {
  tautan: string; alamatAman: string; lewatHttps: boolean; qr: string | null; lang?: Lang;
}) {
  const c = TEKS[lang];
  const [perangkat, setPerangkat] = useState<Perangkat>("android");
  const [tersedia, setTersedia] = useState(false);
  const [terpasang, setTerpasang] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [bisaBagikan, setBisaBagikan] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPerangkat(ios ? "ios" : /Android/i.test(ua) ? "android" : "laptop");
    setBisaBagikan(typeof navigator.share === "function");
    const perbarui = () => { setTersedia(bisaDipasang()); setTerpasang(sudahTerpasang()); };
    perbarui();
    return langganPasang(perbarui);
  }, []);

  const pesanWa = c.pesanWa(tautan);

  async function salin() {
    const ok = await salinTeks(tautan);
    setTersalin(ok);
    if (ok) setTimeout(() => setTersalin(false), 2500);
  }

  const petunjuk = c.petunjuk[perangkat];

  return (
    <div className="grid gap-6 md:grid-cols-5">
      <div className="md:col-span-3 space-y-6">
        {!lewatHttps && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 leading-relaxed">
              <p className="font-semibold text-amber-800">{c.httpJudul}</p>
              {c.httpIsi}
              <a href={tautan} className="mt-2 flex items-center gap-1.5 font-semibold text-amber-800 underline break-all">
                <ExternalLink size={14} className="shrink-0" /> {c.buka} {alamatAman.replace(/^https:\/\//, "")}
              </a>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {terpasang ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-heading font-bold text-primary-900">{c.terpasangJudul}</p>
                <p className="text-sm text-gray-500 mt-1">{c.terpasangIsi}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="font-heading font-bold text-primary-900 text-lg">{c.pasangJudul}</p>
              <p className="text-sm text-gray-500 mt-1">{c.pasangIsi}</p>
              {tersedia && (
                <button type="button" onClick={() => pasangSekarang().then(() => setTerpasang(sudahTerpasang()))}
                  className="btn-modal-save mt-4 inline-flex items-center gap-2">
                  <Download size={16} /> {c.tombolPasang}
                </button>
              )}
            </>
          )}

          <div className="mt-6">
            <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={c.pilihPerangkat}>
              {(Object.keys(IKON) as Perangkat[]).map(p => {
                const Ikon = IKON[p];
                const aktif = p === perangkat;
                return (
                  <button key={p} type="button" role="tab" aria-selected={aktif} onClick={() => setPerangkat(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${aktif ? "bg-primary-700 border-primary-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <Ikon size={15} /> {c.petunjuk[p].judul}
                  </button>
                );
              })}
            </div>
            <ol className="space-y-3">
              {petunjuk.langkah.map((l, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                  <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-700 font-bold text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{l}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="font-heading font-bold text-primary-900">{c.bagikanJudul}</p>
          <p className="text-sm text-gray-500 mt-1">{c.bagikanIsi}</p>
          <p className="mt-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs font-mono text-gray-700 break-all">{tautan}</p>
          <div className="mt-3 grid gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(pesanWa)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
              <MessageCircle size={16} /> {c.kirimWa}
            </a>
            <button type="button" onClick={salin} className="btn-modal-cancel flex items-center justify-center gap-2">
              {tersalin ? <><CheckCircle2 size={16} className="text-emerald-600" /> {c.tersalin}</> : <><Copy size={16} /> {c.salin}</>}
            </button>
            {bisaBagikan && (
              <button type="button" onClick={() => navigator.share({ title: c.judulBagikan, text: pesanWa }).catch(() => {})}
                className="btn-modal-cancel flex items-center justify-center gap-2">
                <ExternalLink size={16} /> {c.bagikanLain}
              </button>
            )}
          </div>
        </div>

        {qr && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={c.qrAlt} width={180} height={180} className="mx-auto" />
            <p className="text-sm text-gray-500 mt-2">{c.qrIsi}</p>
          </div>
        )}
      </div>
    </div>
  );
}
