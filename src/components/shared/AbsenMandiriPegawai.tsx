"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Camera, CameraOff, CheckCircle2, IdCard, Info, Loader2, QrCode, ShieldAlert, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { usePindaiKamera } from "@/lib/pindai-kamera";
import { unlockScanAudio, playScanError, playScanInfo, playScanSuccess } from "@/lib/scan-beep";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

type Hasil = { jenis: "berhasil" | "info" | "gagal"; judul: string; isi: string };
const STATUS: Record<string, string> = { IZIN: "Izin", SAKIT: "Sakit", DINAS_LUAR: "Dinas luar", CUTI: "Cuti", HADIR: "Hadir", ALPHA: "Alpha" };

/** PRESENSI MANDIRI PEGAWAI (18 Sep 2026) — guru & staf memindai QR absensi yang sama dengan siswa.
 * Pindaian pertama = jam masuk, pindaian berikutnya (≥60 menit) = jam pulang. Status yang sudah
 * ditetapkan TU (izin/sakit/dinas luar/cuti) tidak pernah tertimpa. */
export default function AbsenMandiriPegawai({ basePath }: { basePath: string }) {
  const [kameraAktif, setKameraAktif] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);

  const kirim = useCallback(async (kode: string) => {
    if (mengirim) return;
    setMengirim(true);
    const r = await fetch("/api/pegawai/absen-mandiri", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirim(false);
    if (r?.ok && (d?.hasil === "MASUK" || d?.hasil === "PULANG")) {
      playScanSuccess(); setKameraAktif(false);
      setHasil({ jenis: "berhasil", judul: d.hasil === "MASUK" ? `Jam masuk tercatat ${d.jam} WIB` : `Jam pulang tercatat ${d.jam} WIB`, isi: `${d.nama} — terima kasih.` });
    } else if (r?.ok && d?.hasil === "SUDAH_ADA") {
      playScanInfo(); setKameraAktif(false);
      setHasil({ jenis: "info", judul: "Sudah tercatat hari ini", isi: `Jam masuk ${d.jamMasuk ?? "—"}${d.jamPulang ? `, jam pulang ${d.jamPulang}` : ", jam pulang bisa dipindai minimal 60 menit setelah jam masuk"}.` });
    } else if (r?.ok && d?.hasil === "TERKUNCI") {
      playScanInfo(); setKameraAktif(false);
      setHasil({ jenis: "info", judul: `Hari ini tercatat ${STATUS[d.status] ?? d.status}`, isi: "Status itu diisi Tata Usaha dan tidak diubah oleh pindaian. Hubungi TU bila keliru." });
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
      <PageHeader icon={<QrCode size={22} />} title="Presensi Mandiri" description="Pindai QR absensi di gerbang — pindaian pertama jam masuk, berikutnya jam pulang" />

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
              <a href={`${ALAMAT_APLIKASI}${basePath}/absen-mandiri`} className="font-semibold underline break-all">Buka {ALAMAT_APLIKASI.replace(/^https:\/\//, "")}</a>
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
          <button type="button" onClick={() => { unlockScanAudio(); setHasil(null); setKameraAktif(true); }} className="btn-modal-save w-full py-4 text-base">
            <Camera size={20} /> {hasil ? "Pindai Lagi" : "Buka Kamera & Pindai"}
          </button>
        )}

        <div className="panel p-4 text-sm text-gray-600 space-y-1.5">
          <p className="font-semibold text-primary-900">Tiga cara presensi pegawai</p>
          <p>1. <strong>Pindai QR</strong> di gerbang dengan HP sendiri (halaman ini).</p>
          <p>2. <strong>Tempelkan kartu pegawai</strong> di stasiun pindai — petugas piket memindai kartu Anda.</p>
          <p>3. <strong>Diisi Tata Usaha</strong> di menu Presensi Pegawai (izin, sakit, dinas luar, cuti).</p>
          <Link href="/kartu-identitas" className="inline-flex items-center gap-1.5 pt-1 text-primary-700 font-semibold hover:underline">
            <IdCard size={15} /> Lihat kartu identitas digital saya
          </Link>
        </div>
      </div>
    </div>
  );
}
