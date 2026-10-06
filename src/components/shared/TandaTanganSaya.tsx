"use client";
import { useCallback, useEffect, useState } from "react";
import { PenLine, Signature, Trash2 } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import PenyuntingTtd from "@/components/shared/PenyuntingTtd";

type Data = { boleh: boolean; ada: boolean; diperbarui: string | null; userId: string };

/** Kartu "Tanda Tangan Saya" di Profil guru & staf (src/lib/ttd.ts). Tidak tampil untuk siswa/orang tua. */
export default function TandaTanganSaya() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [ubah, setUbah] = useState(false);
  const [versi, setVersi] = useState(0);

  const muat = useCallback(() => {
    fetch("/api/ttd/saya", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => d && setData(d)).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  if (!data?.boleh) return null;

  async function hapus() {
    if (!await confirm("Hapus tanda tangan? Dokumen yang dicetak sesudahnya kembali berisi ruang kosong / tanda ✓.")) return;
    const r = await fetch("/api/ttd/saya", { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Tanda tangan dihapus"); muat(); } else toast.error("Gagal menghapus.");
  }

  return (
    <div className="panel p-6">
      <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2"><Signature size={18} /> Tanda Tangan Saya</h3>
      <p className="mt-1 text-sm text-gray-500">
        Dipakai otomatis di daftar hadir rapat, berita acara &amp; daftar hadir ujian (saat menjadi pengawas), dan rapor (wali kelas,
        setelah nilai dikunci). Tanda tangan disimpan tertutup dan hanya muncul di dokumen cetak.
      </p>

      {ubah || !data.ada ? (
        <div className="mt-4">
          <PenyuntingTtd endpoint="/api/ttd/saya" onBatal={data.ada ? () => setUbah(false) : undefined}
            onSelesai={() => { toast.success("Tanda tangan tersimpan"); setUbah(false); setVersi(v => v + 1); muat(); }} />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-28 flex-1 items-center justify-center rounded-xl border border-gray-100 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- gambar pribadi, tanpa pengoptimal */}
            <img src={`/api/ttd/${data.userId}?v=${versi}`} alt="Tanda tangan saya" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-2 sm:flex-col">
            <button type="button" onClick={() => setUbah(true)} className="btn-modal-cancel btn-teks"><PenLine /> Ganti</button>
            <button type="button" onClick={hapus} className="btn-modal-cancel btn-teks"><Trash2 /> Hapus</button>
          </div>
        </div>
      )}
      {data.diperbarui && !ubah && (
        <p className="mt-2 text-xs text-gray-400">Diperbarui {new Date(data.diperbarui).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</p>
      )}
    </div>
  );
}
