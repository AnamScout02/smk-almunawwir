"use client";
import { useCallback, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Info, Loader2, QrCode, ShieldAlert, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { usePindaiKamera, idPerangkat } from "@/lib/pindai-kamera";
import { jalurHadirKegiatan } from "@/lib/qr-tujuan";
import { unlockScanAudio, playScanError, playScanInfo, playScanSuccess } from "@/lib/scan-beep";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

type Hasil = { jenis: "berhasil" | "info" | "gagal"; judul: string; isi: string };
const LABEL: Record<string, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Alpha" };

/** Halaman siswa: pindai QR absensi di gerbang/kelas dengan kamera HP → tercatat HADIR. */
export default function AbsenMandiri() {
  const [kameraAktif, setKameraAktif] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const kirim = useCallback(async (kode: string) => {
    if (mengirim) return;
    // QR PRESENSI KEGIATAN berisi alamat /hadir/<id>?t=… — bukan token absensi gerbang. Tanpa cabang
    // ini, QR kegiatan dikirim ke endpoint gerbang lalu ditolak dengan pesan yang menyesatkan
    // (laporan user 1 Oktober 2026: "tertulis barcode tidak di gerbang, jadi tidak ada yang bisa scan").
    const keKegiatan = jalurHadirKegiatan(kode);
    if (keKegiatan) { setKameraAktif(false); window.location.assign(keKegiatan); return; }
    setMengirim(true);
    const r = await fetch("/api/student/absen-mandiri", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode, perangkatId: idPerangkat() }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirim(false);
    if (r?.ok && d?.hasil === "DIBUAT") {
      playScanSuccess(); setKameraAktif(false);
      setHasil({ jenis: "berhasil", judul: "Absensi tercatat: Hadir", isi: `${d.siswa.nama} · ${d.siswa.kelas} · pukul ${d.jam} WIB` });
    } else if (r?.ok && d?.hasil === "SUDAH_ADA") {
      playScanInfo(); setKameraAktif(false);
      setHasil({ jenis: "info", judul: `Sudah tercatat hari ini: ${LABEL[d.status] ?? d.status}`, isi: "Absensi Anda hari ini sudah ada, tidak diubah. Hubungi wali kelas bila statusnya keliru." });
    } else {
      playScanError();
      setHasil({ jenis: "gagal", judul: "Belum tercatat", isi: d?.error ?? "Koneksi terputus. Coba pindai lagi." });
    }
  }, [mengirim]);

  const { videoRef, status } = usePindaiKamera({ aktif: kameraAktif, onKode: kirim });

  const gaya = {
    berhasil: { kotak: "bg-emerald-50 border-emerald-200", ikon: <CheckCircle2 size={28} className="text-emerald-600" />, judul: "text-emerald-800", isi: "text-emerald-700" },
    info: { kotak: "bg-blue-50 border-blue-200", ikon: <Info size={28} className="text-blue-600" />, judul: "text-blue-800", isi: "text-blue-700" },
    gagal: { kotak: "bg-red-50 border-red-200", ikon: <XCircle size={28} className="text-red-600" />, judul: "text-red-800", isi: "text-red-700" },
  } as const;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<QrCode size={22} />} title="Absen Mandiri" description="Pindai QR absensi di gerbang atau di kelas memakai kamera HP" />

      <div className="max-w-md mx-auto space-y-4">
        {hasil && (
          <div className={`rounded-2xl border p-4 flex items-start gap-3 ${gaya[hasil.jenis].kotak}`}>
            {gaya[hasil.jenis].ikon}
            <div><p className={`font-heading font-bold ${gaya[hasil.jenis].judul}`}>{hasil.judul}</p><p className={`text-sm mt-0.5 ${gaya[hasil.jenis].isi}`}>{hasil.isi}</p></div>
          </div>
        )}

        {status === "perlu-https" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold text-amber-800">Kamera hanya bisa dibuka lewat alamat aman</p>
              <a href={`${ALAMAT_APLIKASI}/dashboard/student/absen-mandiri`} className="font-semibold underline break-all">Buka {ALAMAT_APLIKASI.replace(/^https:\/\//, "")}</a>
            </div>
          </div>
        ) : kameraAktif ? (
          <div className="page-card overflow-hidden">
            <div className="relative bg-black aspect-square max-w-full">
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-[18%] border-4 border-gold rounded-3xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              {(status === "meminta-izin" || mengirim) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white gap-2 text-sm">
                  <Loader2 size={18} className="animate-spin" /> {mengirim ? "Memeriksa QR…" : "Membuka kamera…"}
                </div>
              )}
              {(status === "ditolak" || status === "galat" || status === "tidak-didukung") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-sm text-center p-6 gap-2">
                  <CameraOff size={28} />
                  {status === "ditolak" ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser lalu coba lagi." : "Kamera tidak bisa dibuka di perangkat ini."}
                </div>
              )}
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">Arahkan kamera ke QR di layar sampai terbaca otomatis.</p>
              <button type="button" onClick={() => setKameraAktif(false)} className="btn-modal-cancel">Tutup</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => { unlockScanAudio(); setHasil(null); setKameraAktif(true); }}
            className="btn-modal-save w-full py-4 text-base">
            <Camera size={20} /> {hasil ? "Pindai Lagi" : "Buka Kamera & Pindai"}
          </button>
        )}

        <div className="panel p-4 text-sm text-gray-600 space-y-1.5">
          <p className="font-semibold text-primary-900">Cara absen mandiri</p>
          <p>1. Datang ke gerbang atau kelas, cari layar QR absensi.</p>
          <p>2. Ketuk tombol di atas dan arahkan kamera ke QR.</p>
          <p>3. QR berganti tiap 30 detik — foto QR yang dikirim teman tidak akan diterima.</p>
          <p className="text-xs text-gray-400 pt-1">Setiap pindaian dicatat beserta perangkatnya. Satu HP yang dipakai beberapa siswa akan terlihat oleh wali kelas.</p>
        </div>
      </div>
    </div>
  );
}
