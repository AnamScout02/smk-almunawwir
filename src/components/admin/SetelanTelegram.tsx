"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Send, Trash2 } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Data = { adaToken: boolean; bot: string; alamatWebhook: string; pegawai: number; webhook: { url: string; galat: string; tertunda: number } | null; tertaut: { nama: string; peran: string; aktif: boolean; sejak: string }[] };

/** Panel BOT TELEGRAM di halaman Notifikasi (khusus Superadmin): memasang token dari BotFather, melihat siapa yang sudah
 *  menautkan, dan mengirim pesan uji. Token tidak pernah ditampilkan kembali. */
export default function SetelanTelegram() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [token, setToken] = useState("");
  const [sibuk, setSibuk] = useState("");
  const muat = useCallback(() => { fetch("/api/admin/telegram", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(x => x && setD(x)).catch(() => {}); }, []);
  useEffect(() => { muat(); }, [muat]);
  if (!d) return null;

  async function kirim(isi: Record<string, unknown>, tanda: string, berhasil: string) {
    setSibuk(tanda);
    const r = await fetch("/api/admin/telegram", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(j?.error ?? "Gagal."); return; }
    toast.success(berhasil); setToken(""); muat();
  }
  return (
    <div className="page-card">
      <div className="page-card-header">
        <div className="flex items-center gap-2"><Send size={16} className="text-primary-700" /><h3 className="font-heading font-semibold text-primary-900">Bot Telegram untuk Guru & Staf</h3></div>
        <span className="text-xs text-gray-400">{d.adaToken ? `@${d.bot} · ${d.tertaut.length} dari ${d.pegawai} akun terhubung` : "belum dipasang"}</span>
      </div>
      <div className="space-y-4 p-5 text-sm text-gray-600">
        <p>Kabar yang masuk kotak notifikasi guru, staf, dan admin ikut dikirim ke Telegram orangnya — gratis. Tiap orang menautkan sendiri dari menu Profil. Galat server dan peringatan situs mati dikirim ke Superadmin yang menautkan.</p>
        {!d.adaToken && (
          <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-500">
            <li>Di Telegram, buka <span className="font-semibold">@BotFather</span>, kirim <span className="font-mono">/newbot</span>, beri nama (mis. &quot;Kabar SMK Al-Munawwir&quot;) dan nama pengguna berakhiran &quot;bot&quot;.</li>
            <li>Salin token yang diberikan (bentuknya angka:huruf) ke kotak di bawah, lalu Simpan.</li>
          </ol>
        )}
        <div className="baris-alat items-end">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="token-telegram" className="label-field">{d.adaToken ? "Ganti token bot (kosongkan bila tidak diganti)" : "Token bot dari BotFather"}</label>
            <input id="token-telegram" type="password" autoComplete="off" className="input-field" value={token} onChange={e => setToken(e.target.value)} placeholder="123456789:AA…" />
          </div>
          <div className="alat-aksi alat-teks">
            <button type="button" disabled={!token.trim() || !!sibuk} onClick={() => kirim({ token }, "simpan", "Bot terpasang.")} className="btn-modal-save">{sibuk === "simpan" ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
            {d.adaToken && <button type="button" disabled={!!sibuk} onClick={() => kirim({ uji: true }, "uji", "Pesan uji terkirim ke Telegram Anda.")} className="btn-modal-cancel">{sibuk === "uji" ? <Loader2 className="animate-spin" /> : <Send />} Kirim Uji ke Saya</button>}
            {d.adaToken && <button type="button" disabled={!!sibuk} onClick={async () => { if (await confirm("Hapus token bot? Semua kabar lewat Telegram berhenti; tautan tiap orang tetap tersimpan.")) kirim({ hapus: true }, "hapus", "Token dihapus."); }} className="btn-hapus"><Trash2 /> Hapus Token</button>}
          </div>
        </div>
        {d.adaToken && d.webhook && d.webhook.url !== d.alamatWebhook && <p className="text-xs text-red-600">Alamat penerima di Telegram tidak menunjuk ke situs ini — simpan ulang tokennya.</p>}
        {d.adaToken && d.webhook?.galat && <p className="text-xs text-amber-700">Telegram melaporkan: {d.webhook.galat}</p>}
        {d.tertaut.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Nama</th><th>Peran</th><th>Terhubung sejak</th><th>Keadaan</th></tr></thead>
              <tbody>{d.tertaut.map((t, i) => (
                <tr key={`${t.nama}-${t.sejak}`}><td className="angka">{i + 1}</td><td className="font-semibold text-primary-900">{t.nama}</td><td>{t.peran === "TEACHER" ? "Guru" : t.peran === "TAS" ? "Staf" : "Admin"}</td>
                  <td className="angka whitespace-nowrap">{new Date(t.sejak).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td>{t.aktif ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Aktif</span> : <span className="status-badge bg-gray-50 text-gray-600 border-gray-200">Dijeda</span>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
