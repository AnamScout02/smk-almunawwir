"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Fingerprint, Loader2, X } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { adaPenandaPasskey, daftarkanPasskey, passkeyDidukung } from "@/lib/passkey-klien";

const KUNCI_TUNDA = "tawaran-passkey-tunda";

/** TAWARAN "MASUK DENGAN SIDIK JARI DI HP INI?" (5 Oktober 2026) — muncul di dashboard SETELAH login dengan sandi,
 *  pada perangkat yang mendukung passkey tetapi belum mendaftarkannya. Satu ketukan + sidik jari = terdaftar, tanpa
 *  harus mencari kartu di Profil. Temuan user: tombol sidik jari di halaman login "kok malah begini" karena HP-nya
 *  belum pernah mendaftar — pendaftaran harus ditawarkan di saat yang tepat, bukan disembunyikan di Profil.
 *  "Nanti" = tidak ditawarkan lagi 14 hari. Hanya peran yang boleh passkey (server yang memutuskan lewat /api/passkey). */
export default function TawaranPasskey() {
  const jalur = usePathname() ?? "";
  const toast = useToast();
  const [tampil, setTampil] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!jalur.startsWith("/dashboard") || !passkeyDidukung() || adaPenandaPasskey()) return;
    try {
      if (Number(localStorage.getItem(KUNCI_TUNDA) ?? 0) > Date.now()) return;
      if (sessionStorage.getItem("tawaran-passkey-dicek") === "1") return; // sekali periksa per sesi peramban
      sessionStorage.setItem("tawaran-passkey-dicek", "1");
    } catch { return; }
    // HANYA HP/tablet yang punya pembaca sidik jari/wajah sendiri (10 Okt 2026, temuan user: tawaran ikut muncul di
    // desktop). `passkeyDidukung` hanya memeriksa adanya WebAuthn — semua peramban desktop lolos walau komputernya
    // tanpa sidik jari, dan komputer TU/lab dipakai bergantian (PIN Windows-nya diketahui banyak orang). Di komputer
    // pendaftaran tetap bisa dilakukan sengaja lewat Profil.
    const hp = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
    if (!hp) return;
    const cek = window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    Promise.resolve(cek ? cek.call(window.PublicKeyCredential) : false)
      .then(ada => (ada ? fetch("/api/passkey", { cache: "no-store" }) : null))
      .then(r => (r && r.ok ? r.json() : null))
      .then(d => { if (d?.boleh && d.domainAman) setTampil(true); })
      .catch(() => {});
  }, [jalur]);

  if (!tampil) return null;
  const tunda = () => {
    try { localStorage.setItem(KUNCI_TUNDA, String(Date.now() + 14 * 24 * 3600_000)); } catch { /* abaikan */ }
    setTampil(false);
  };
  async function aktifkan() {
    setSibuk(true);
    const galat = await daftarkanPasskey("");
    setSibuk(false);
    if (galat && galat !== "Perangkat ini sudah terdaftar.") { if (galat !== "Dibatalkan.") toast.error(galat); return; }
    toast.success("Aktif — lain kali cukup sidik jari / wajah untuk masuk di perangkat ini.");
    setTampil(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-6 print:hidden">
      <button type="button" onClick={tunda} aria-label="Nanti" className="absolute right-2 top-2 rounded-full p-1.5 text-gray-400 hover:bg-gray-50"><X size={16} /></button>
      <div className="flex items-start gap-3 pr-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white"><Fingerprint size={22} /></span>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-primary-900">Masuk dengan sidik jari di perangkat ini?</p>
          <p className="mt-1 text-xs text-gray-500">Lain kali tidak perlu mengetik email & sandi — cukup sidik jari, wajah, atau PIN layar.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={tunda} className="btn-modal-cancel flex-1">Nanti</button>
        <button type="button" onClick={aktifkan} disabled={sibuk} className="btn-modal-save flex-1">
          {sibuk ? <Loader2 className="animate-spin" /> : <Fingerprint />} Aktifkan
        </button>
      </div>
    </div>
  );
}
