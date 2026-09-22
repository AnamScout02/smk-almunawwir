"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Loader2, ShieldAlert, Smartphone, X } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import KotakNotifikasiTombol from "@/components/shared/KotakNotifikasiTombol";
import PencarianCepat from "@/components/shared/PencarianCepat";
import { aktifkanPush, statusPush, type StatusPush } from "@/lib/push-client";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

const KUNCI_NANTI = "notifikasi-ajakan-nanti";

/** Dipasang SEKALI di tiap layout dashboard, tepat sebelum isi halaman:
 *   1. AJAKAN AKTIFKAN NOTIFIKASI — satu ketuk; "Nanti" hanya menyembunyikan untuk sesi browser ini, muncul lagi
 *      di kunjungan berikutnya selama belum aktif.
 *   2. Lonceng kotak notifikasi melayang (desktop). Di mobile lonceng ada di bar atas tiap portal.
 * PITA "TUGAS HARI INI" DIHAPUS (15 Sep 2026, temuan user: isinya sama persis dengan kotak notifikasi → dobel dan
 * memakan ruang di HP). Pengingat absensi/piket/jurnal cukup di kotak notifikasi; yang tugasnya sudah dikerjakan otomatis
 * ditandai dibaca lewat /api/notifikasi/ringkas, yang tetap dipanggil di sini setiap berpindah halaman.
 * `dorongTopbar` sudah TIDAK dipakai sejak ajakan dipindah ke pojok bawah (18 September 2026) —
 * propnya dipertahankan agar pemanggil lama tidak perlu diubah. */
export default function PusatNotifikasiPortal({ dorongTopbar = false, tindakan = [] }: { dorongTopbar?: boolean; tindakan?: { label: string; count: number; href: string }[] }) {
  void dorongTopbar;
  const toast = useToast();
  const path = usePathname();
  const [status, setStatus] = useState<StatusPush>("memeriksa");
  const [nanti, setNanti] = useState(true);
  const [mengaktifkan, setMengaktifkan] = useState(false);

  // Menandai pengingat yang tugasnya sudah selesai sebagai dibaca, supaya angka di lonceng ikut turun.
  const segarkan = useCallback(() => { fetch("/api/notifikasi/ringkas").catch(() => {}); }, []);

  useEffect(() => { segarkan(); }, [segarkan, path]);
  useEffect(() => {
    const t = setInterval(segarkan, 5 * 60_000);
    const saatTampil = () => { if (document.visibilityState === "visible") segarkan(); };
    document.addEventListener("visibilitychange", saatTampil);
    statusPush().then(setStatus).catch(() => setStatus("tidak-didukung"));
    // Dibaca di luar badan efek (microtask) — memanggil setState langsung di dalam efek memicu
    // render bertingkat dan ditandai lint React.
    queueMicrotask(() => {
      try { setNanti(sessionStorage.getItem(KUNCI_NANTI) === "1"); } catch { setNanti(false); }
    });
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", saatTampil); };
  }, [segarkan]);

  async function aktifkan() {
    setMengaktifkan(true);
    const r = await aktifkanPush().catch(() => ({ ok: false, pesan: "Browser menolak berlangganan notifikasi." }));
    setMengaktifkan(false);
    if (r.ok) toast.success("Notifikasi aktif di perangkat ini."); else toast.error(r.pesan ?? "Gagal mengaktifkan notifikasi.");
    statusPush().then(setStatus).catch(() => {});
  }
  function tundaAjakan() {
    setNanti(true);
    try { sessionStorage.setItem(KUNCI_NANTI, "1"); } catch { /* sesi saja */ }
  }

  const tampilAjakan = !nanti && (status === "belum" || status === "perlu-https" || status === "perlu-pasang-ios");

  return (
    <>
      <KotakNotifikasiTombol variant="melayang" tindakan={tindakan} />
      {/* Pencarian cepat lintas modul (Ctrl+K) — tombol melayang di layar lebar, menu Akun di HP. */}
      <PencarianCepat />
      {/* Ajakan aktifkan notifikasi TIDAK lagi di atas header (temuan user 18 September 2026:
          "kenapa harus di atas header? malah mengganggu tampilan") — sekarang kartu kecil melayang
          di pojok bawah, di atas bottom navbar pada HP, dan bisa ditutup. */}
      {tampilAjakan && (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[24rem] lg:bottom-24 print:hidden">
          <div className="panel flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50 px-4 py-3 shadow-panel-naik">
            {status === "perlu-https" ? <ShieldAlert size={18} className="shrink-0 text-blue-600" /> : status === "perlu-pasang-ios" ? <Smartphone size={18} className="shrink-0 text-blue-600" /> : <BellRing size={18} className="shrink-0 text-blue-600" />}
            <p className="min-w-[10rem] flex-1 text-sm text-blue-800">
              {status === "belum" && <><strong>Aktifkan notifikasi</strong> supaya pengingat & kabar penting tetap muncul.</>}
              {status === "perlu-https" && <><strong>Perlu alamat aman.</strong> Buka {ALAMAT_APLIKASI.replace(/^https:\/\//, "")} untuk mengaktifkan.</>}
              {status === "perlu-pasang-ios" && <><strong>Di iPhone/iPad,</strong> pasang aplikasi ke layar utama dulu.</>}
            </p>
            <div className="alat-aksi alat-teks">
              {status === "belum" && (
                <button type="button" onClick={aktifkan} disabled={mengaktifkan} className="btn-modal-save">
                  {mengaktifkan ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />} Aktifkan
                </button>
              )}
              {status === "perlu-https" && <a href={`${ALAMAT_APLIKASI}${path}`} className="btn-modal-save">Buka</a>}
              {status === "perlu-pasang-ios" && <Link href="/pasang-aplikasi" className="btn-modal-save">Cara pasang</Link>}
              <button type="button" onClick={tundaAjakan} title="Tutup" className="rounded-lg p-1.5 text-blue-700 hover:bg-white/60"><X size={15} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
