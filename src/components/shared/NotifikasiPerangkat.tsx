"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, Send, ShieldAlert, Smartphone } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { aktifkanPush, kirimUjiPush, matikanPush, statusPush, type StatusPush } from "@/lib/push-client";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** Kartu "Notifikasi di Perangkat Ini" di halaman Profil semua portal (id="notifikasi", ditautkan dari menu
 * Akun HP). Menyalakan/mematikan Web Push untuk browser yang sedang dipakai. */
export default function NotifikasiPerangkat() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusPush>("memeriksa");
  const [sibuk, setSibuk] = useState<"aktif" | "mati" | "uji" | null>(null);

  const periksa = useCallback(() => { statusPush().then(setStatus).catch(() => setStatus("tidak-didukung")); }, []);
  useEffect(() => { periksa(); }, [periksa]);

  async function nyalakan() {
    setSibuk("aktif");
    const r = await aktifkanPush().catch(() => ({ ok: false, pesan: "Browser menolak berlangganan notifikasi." }));
    setSibuk(null);
    if (r.ok) toast.success("Notifikasi aktif di perangkat ini.");
    else toast.error(r.pesan ?? "Gagal mengaktifkan notifikasi.");
    periksa();
  }
  async function matikan() {
    setSibuk("mati");
    await matikanPush();
    setSibuk(null);
    toast.success("Notifikasi dimatikan di perangkat ini.");
    periksa();
  }
  async function uji() {
    setSibuk("uji");
    const r = await kirimUjiPush();
    setSibuk(null);
    if (r.ok) toast.success(r.pesan); else toast.error(r.pesan);
  }

  return (
    <div id="notifikasi" className="page-card scroll-mt-24">
      <div className="page-card-header">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary-700" />
          <h3 className="font-heading font-semibold text-primary-900">Notifikasi di Perangkat Ini</h3>
        </div>
        {status === "aktif" && (
          <span className="px-2 py-0.5 rounded-full border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">Aktif</span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-500 leading-relaxed">
          Pengingat dan kabar penting muncul di HP atau laptop walau aplikasi sedang ditutup — misalnya absensi yang
          belum diisi, ujian dimulai, tugas baru, atau catatan kehadiran dan kedisiplinan anak.
        </p>

        {status === "memeriksa" && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Memeriksa perangkat…</div>}

        {status === "perlu-https" && (
          <Pemberitahuan ikon={ShieldAlert} judul="Buka lewat alamat aman (HTTPS)">
            Browser hanya mengizinkan notifikasi dari alamat aman.{" "}
            <a href={`${ALAMAT_APLIKASI}/login`} className="font-semibold underline">Buka {ALAMAT_APLIKASI.replace(/^https:\/\//, "")}</a>
          </Pemberitahuan>
        )}
        {status === "perlu-pasang-ios" && (
          <Pemberitahuan ikon={Smartphone} judul="Di iPhone/iPad, pasang aplikasinya dulu">
            Notifikasi di iPhone hanya berfungsi dari aplikasi di layar utama.{" "}
            <Link href="/pasang-aplikasi" className="font-semibold underline">Lihat cara memasang</Link>, lalu buka aplikasinya dan aktifkan dari halaman ini.
          </Pemberitahuan>
        )}
        {status === "tidak-didukung" && (
          <Pemberitahuan ikon={BellOff} judul="Browser ini belum mendukung notifikasi">
            Gunakan Google Chrome, Microsoft Edge, atau Firefox versi terbaru.
          </Pemberitahuan>
        )}
        {status === "ditolak" && (
          <Pemberitahuan ikon={BellOff} judul="Izin notifikasi diblokir">
            Buka pengaturan situs di browser (ikon gembok di bilah alamat) → Notifikasi → Izinkan, lalu muat ulang halaman.
          </Pemberitahuan>
        )}

        {(status === "belum" || status === "aktif") && (
          <div className="flex flex-wrap gap-2">
            {status === "belum" ? (
              <button type="button" onClick={nyalakan} disabled={!!sibuk} className="btn-modal-save">
                {sibuk === "aktif" ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Aktifkan Notifikasi
              </button>
            ) : (
              <>
                <button type="button" onClick={uji} disabled={!!sibuk} className="btn-modal-save">
                  {sibuk === "uji" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim Notifikasi Uji
                </button>
                <button type="button" onClick={matikan} disabled={!!sibuk} className="btn-modal-cancel">
                  {sibuk === "mati" ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />} Matikan
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Pemberitahuan({ ikon: Ikon, judul, children }: { ikon: typeof Bell; judul: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <Ikon size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-700 leading-relaxed">
        <p className="font-semibold text-amber-800">{judul}</p>
        {children}
      </div>
    </div>
  );
}
