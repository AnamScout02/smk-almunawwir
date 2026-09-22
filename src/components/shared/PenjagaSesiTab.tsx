"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LogIn, RefreshCw, UserCog } from "lucide-react";

/** PENJAGA SESI ANTAR-TAB.
 *
 * Cookie sesi dipakai bersama semua tab satu browser. Kalau di tab B seseorang login sebagai akun
 * lain (atau admin "Masuk Sebagai"), tab A masih MENAMPILKAN data akun lama, tapi setiap simpan
 * yang ditekan di sana akan tercatat atas nama akun BARU. Di komputer TU/lab yang dipakai
 * bergantian ini sungguh terjadi. Komponen ini mendeteksinya dan menutup layar dengan peringatan
 * sampai halaman dimuat ulang.
 *
 * Deteksi: saat tab kembali difokus, tiap 60 detik, dan seketika lewat BroadcastChannel ketika
 * tab lain memuat halaman dengan akun berbeda. Hanya aktif di area yang butuh login. */

const JALUR = ["/dashboard", "/pusat-ujian", "/ujian-online"];
const KANAL = "smk-sesi";

type Identitas = { userId: string | null; nama: string | null };

export default function PenjagaSesiTab() {
  const path = usePathname() ?? "";
  const aktif = JALUR.some(j => path.startsWith(j));
  const [dasar, setDasar] = useState<Identitas | null>(null);
  const [berubah, setBerubah] = useState<Identitas | null>(null);
  const kanal = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!aktif || typeof BroadcastChannel === "undefined") return;
    kanal.current = new BroadcastChannel(KANAL);
    return () => { kanal.current?.close(); kanal.current = null; };
  }, [aktif]);

  // Patokan = akun saat halaman ini dirender; diperbarui tiap berpindah halaman di tab ini.
  useEffect(() => {
    if (!aktif) return;
    let batal = false;
    fetch("/api/auth/sesi", { cache: "no-store" })
      .then(r => r.json())
      .then((d: Identitas) => {
        if (batal) return;
        setDasar(d);
        setBerubah(null);
        kanal.current?.postMessage({ userId: d.userId });
      })
      .catch(() => {});
    return () => { batal = true; };
  }, [aktif, path]);

  useEffect(() => {
    if (!aktif || !dasar) return;
    let jalan = true;
    const cek = () => {
      fetch("/api/auth/sesi", { cache: "no-store" })
        .then(r => r.json())
        .then((d: Identitas) => { if (jalan && d.userId !== dasar.userId) setBerubah(d); })
        .catch(() => {});
    };
    const onPesan = (e: MessageEvent) => { if (e.data?.userId !== dasar.userId) cek(); };
    const onTampil = () => { if (!document.hidden) cek(); };
    kanal.current?.addEventListener("message", onPesan);
    window.addEventListener("focus", cek);
    document.addEventListener("visibilitychange", onTampil);
    const t = setInterval(cek, 60_000);
    return () => {
      jalan = false;
      kanal.current?.removeEventListener("message", onPesan);
      window.removeEventListener("focus", cek);
      document.removeEventListener("visibilitychange", onTampil);
      clearInterval(t);
    };
  }, [aktif, dasar]);

  if (!aktif || !berubah) return null;
  const keluar = !berubah.userId;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-primary-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3.5">
          <UserCog size={26} className="text-amber-600" />
        </div>
        <h2 className="font-heading font-bold text-primary-900 text-lg">
          {keluar ? "Sesi di browser ini sudah berakhir" : "Akun di tab ini sudah berganti"}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {keluar
            ? <>Akun <strong>{dasar?.nama}</strong> sudah keluar (di tab lain atau dikeluarkan dari perangkat lain). Masuk lagi untuk melanjutkan.</>
            : <>Tab ini menampilkan data <strong>{dasar?.nama}</strong>, tetapi browser sekarang masuk sebagai <strong>{berubah.nama}</strong>. Muat ulang supaya tidak menyimpan data atas nama akun yang salah.</>}
        </p>
        <button
          onClick={() => { window.location.href = keluar ? "/login" : window.location.pathname + window.location.search; }}
          className="btn-modal-save w-full mt-5">
          {keluar ? <LogIn size={16} /> : <RefreshCw size={16} />} {keluar ? "Buka Halaman Login" : "Muat Ulang Halaman"}
        </button>
      </div>
    </div>
  );
}
