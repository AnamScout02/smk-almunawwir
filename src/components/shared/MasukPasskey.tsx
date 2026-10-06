"use client";
import { useEffect, useRef, useState } from "react";
import { adaPenandaPasskey, pasangPenandaPasskey, passkeyDidukung } from "@/lib/passkey-klien";
import { Fingerprint, Loader2 } from "lucide-react";

const TEKS = {
  id: { atau: "atau", tombol: "Masuk dengan sidik jari / wajah", proses: "Menunggu perangkat…", batal: "Dibatalkan.", gagal: "Gagal masuk dengan passkey." },
  en: { atau: "or", tombol: "Sign in with fingerprint / face", proses: "Waiting for device…", batal: "Cancelled.", gagal: "Passkey sign-in failed." },
};

/** Tombol MASUK DENGAN PASSKEY di halaman /login (5 Oktober 2026, src/lib/passkey.ts). Hanya tampil bila peramban
 *  mendukung WebAuthn, halaman dibuka lewat HTTPS, DAN perangkat ini pernah mendaftarkan passkey (penanda di
 *  src/lib/passkey-klien.ts) — temuan user: di HP yang belum mendaftar, Android hanya memunculkan lembar "Login
 *  dengan cara lain" yang membingungkan. Di HP yang sudah mendaftar, sidik jari DIMINTA OTOMATIS begitu halaman
 *  terbuka (seperti aplikasi bank) — kecuali tepat setelah menekan Keluar, supaya keluar tidak langsung masuk lagi. */
export default function MasukPasskey({ lang }: { lang: "id" | "en" }) {
  const t = TEKS[lang];
  const [didukung, setDidukung] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const sudahOtomatis = useRef(false);
  useEffect(() => {
    const ok = passkeyDidukung() && adaPenandaPasskey();
    // Efek anak berjalan SEBELUM efek LoginClient yang menghapus ?keluar=1 dari alamat, jadi tandanya masih terbaca.
    let barusKeluar = new URLSearchParams(window.location.search).get("keluar") === "1";
    try {
      if (barusKeluar) sessionStorage.setItem("barusKeluar", "1");
      else barusKeluar = sessionStorage.getItem("barusKeluar") === "1";
    } catch { /* abaikan */ }
    queueMicrotask(() => {
      setDidukung(ok);
      if (ok && !barusKeluar && !sudahOtomatis.current) { sudahOtomatis.current = true; void masuk(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat halaman dibuka
  }, []);
  if (!didukung) return null;

  async function masuk() {
    setSibuk(true); setGalat("");
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const r1 = await fetch("/api/passkey/masuk", { cache: "no-store" });
      const opsi = await r1.json().catch(() => null);
      if (!r1.ok) { setGalat(opsi?.error || t.gagal); return; }
      const respons = await startAuthentication({ optionsJSON: opsi });
      const ingat = (document.querySelector('input[name="ingat"]') as HTMLInputElement | null)?.checked === true;
      const r2 = await fetch("/api/passkey/masuk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respons, ingat }),
      });
      const d = await r2.json().catch(() => null);
      if (!r2.ok || !d?.ke) {
        // Server tidak mengenali passkey perangkat ini (dihapus di Profil) → kunjungan berikutnya tombol tidak tampil.
        if (r2.status === 401) pasangPenandaPasskey(false);
        setGalat(d?.error || t.gagal); return;
      }
      pasangPenandaPasskey(true);
      try { sessionStorage.removeItem("barusKeluar"); } catch { /* abaikan */ }
      window.location.assign(d.ke);
    } catch (e) {
      // Pengguna menutup dialog sidik jari → NotAllowedError; itu bukan galat yang perlu ditakuti.
      setGalat(e instanceof Error && e.name === "NotAllowedError" ? t.batal : t.gagal);
    } finally { setSibuk(false); }
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />{t.atau}<span className="h-px flex-1 bg-gray-200" />
      </div>
      <button type="button" onClick={masuk} disabled={sibuk}
        className="sentuh flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-primary-900 transition-colors hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60">
        {sibuk ? <Loader2 size={17} className="animate-spin" /> : <Fingerprint size={18} />}
        {sibuk ? t.proses : t.tombol}
      </button>
      {galat && <p role="alert" className="mt-3 text-center text-sm text-red-600">{galat}</p>}
    </div>
  );
}
