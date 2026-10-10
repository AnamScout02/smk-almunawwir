"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Unlink } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Data = { tersedia: boolean; bot: string; tautan: string | null; tertaut: { nama: string | null; aktif: boolean; createdAt: string } | null };

/** Kartu TELEGRAM di halaman Profil guru/staf/admin (10 Oktober 2026, src/lib/telegram.ts): kabar yang masuk kotak
 *  notifikasi ikut dikirim ke Telegram. Tidak tampil sama sekali selama bot belum dipasang Superadmin. */
export default function TelegramSaya() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [menunggu, setMenunggu] = useState(false);
  const muat = useCallback(() => fetch("/api/telegram/saya", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(x => { if (x) setD(x); return x as Data | null; }).catch(() => null), []);
  useEffect(() => { muat(); }, [muat]);
  // Setelah tombol ditekan, orangnya pindah ke Telegram — halaman ini memeriksa tiap 3 detik (maks 2 menit) sampai tertaut.
  useEffect(() => {
    if (!menunggu) return;
    let n = 0;
    const t = setInterval(async () => { const x = await muat(); if (x?.tertaut) { setMenunggu(false); toast.success("Telegram terhubung."); } else if (++n > 40) setMenunggu(false); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menunggu]);
  if (!d?.tersedia) return null;

  async function ubah(aktif: boolean) {
    setSibuk(true);
    await fetch("/api/telegram/saya", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktif }) }).catch(() => null);
    await muat(); setSibuk(false);
  }
  async function putus() {
    if (!await confirm("Lepas Telegram dari akun ini? Kabar sekolah tidak lagi dikirim ke Telegram Anda.")) return;
    setSibuk(true);
    await fetch("/api/telegram/saya", { method: "DELETE" }).catch(() => null);
    await muat(); setSibuk(false);
  }
  return (
    <div className="panel mt-6">
      <div className="panel-kepala"><p className="panel-judul"><span className="panel-ikon"><Send size={15} /></span>Kabar lewat Telegram</p></div>
      <div className="panel-isi space-y-3 text-sm text-gray-600">
        {d.tertaut ? (
          <>
            <p>Terhubung{d.tertaut.nama ? <> ke <span className="font-semibold text-primary-900">{d.tertaut.nama}</span></> : null}. Disposisi, pengingat, dan pengumuman untuk Anda juga dikirim ke Telegram.</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.tertaut.aktif} disabled={sibuk} onChange={e => ubah(e.target.checked)} /> Kirim kabar ke Telegram</label>
            <button type="button" onClick={putus} disabled={sibuk} className="btn-modal-cancel btn-teks">{sibuk ? <Loader2 className="animate-spin" /> : <Unlink />} Lepas Telegram</button>
          </>
        ) : (
          <>
            <p>Terima kabar sekolah (disposisi, pengingat jurnal & absensi, pengumuman) di Telegram — berguna bila aplikasi MyAlwis belum terpasang atau notifikasinya tidak muncul.</p>
            {d.tautan && <a href={d.tautan} target="_blank" rel="noopener noreferrer" onClick={() => setMenunggu(true)} className="btn-modal-save btn-teks"><Send /> Hubungkan Telegram</a>}
            <p className="text-xs text-gray-500">{menunggu ? "Menunggu Anda menekan Mulai / Start di Telegram…" : `Telegram akan terbuka di bot @${d.bot}; tekan Mulai / Start di sana. Tautan berlaku 15 menit.`}</p>
          </>
        )}
      </div>
    </div>
  );
}
