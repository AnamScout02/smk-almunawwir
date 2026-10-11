"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

/** WAJIB GANTI SANDI AWAL (11 Okt 2026). Semua akun baru dibuat dengan sandi awal yang SAMA; begitu seseorang masuk
 *  memakainya, portal menampilkan jendela ini dan tidak bisa ditutup sampai sandinya diganti.
 *  Sengaja TIDAK tampil di halaman pengerjaan ujian (/ujian-online) — siswa yang masuk hanya untuk ujian tidak boleh
 *  tertahan; jendelanya muncul saat ia membuka portalnya. Ini mempersempit masa sandi awal berlaku, bukan pengaman
 *  mutlak: orang lain yang lebih dulu masuk dengan sandi awal tetap bisa — karena itu kartu aktivasi dibagikan langsung. */
export default function GantiSandiWajib() {
  const jalur = usePathname() ?? "";
  const toast = useToast();
  const [wajib, setWajib] = useState(false);
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const diPortal = /^\/(dashboard|pusat-|perpustakaan|kartu-identitas)/.test(jalur);

  useEffect(() => {
    if (!diPortal) return;
    try { if (sessionStorage.getItem("sandi-awal-aman") === "1") return; } catch { /* abaikan */ }
    fetch("/api/profile/password", { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.wajib) setWajib(true); else if (d) { try { sessionStorage.setItem("sandi-awal-aman", "1"); } catch { /* abaikan */ } }
    }).catch(() => {});
  }, [diPortal]);

  async function simpan() {
    setGalat("");
    if (baru.length < 8) { setGalat("Sandi baru minimal 8 huruf atau angka."); return; }
    if (baru !== ulang) { setGalat("Ketikan ulang sandi tidak sama."); return; }
    setSibuk(true);
    const r = await fetch("/api/profile/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: baru }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { setGalat(d?.error ?? "Gagal menyimpan. Periksa sambungan lalu coba lagi."); return; }
    try { sessionStorage.setItem("sandi-awal-aman", "1"); } catch { /* abaikan */ }
    toast.success("Sandi baru tersimpan. Pakai sandi ini saat masuk berikutnya.");
    setWajib(false);
  }

  if (!wajib || !diPortal) return null;
  return (
    <Modal open onClose={() => {}} title="Ganti Sandi Dulu" description="Anda masuk dengan sandi awal dari sekolah"
      footer={<button type="button" onClick={simpan} disabled={sibuk} className="btn-modal-save flex-1">{sibuk ? <Loader2 className="animate-spin" /> : <KeyRound />} Simpan sandi baru</button>}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Sandi awal sama untuk semua akun baru, jadi orang lain bisa menebaknya. Buat sandi milik Anda sendiri sebelum melanjutkan.</p>
        <div><label className="label-field" htmlFor="gsw-baru">Sandi baru</label><input id="gsw-baru" type="password" autoComplete="new-password" className="input-field" value={baru} onChange={e => setBaru(e.target.value)} /></div>
        <div><label className="label-field" htmlFor="gsw-ulang">Ketik ulang sandi baru</label><input id="gsw-ulang" type="password" autoComplete="new-password" className="input-field" value={ulang} onChange={e => setUlang(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void simpan(); }} /></div>
        {galat && <p className="error-msg" role="alert">{galat}</p>}
        <p className="text-xs text-gray-500">Minimal 8 huruf atau angka. Lupa sandi nanti? Minta wali kelas atau Tata Usaha mengatur ulang.</p>
      </div>
    </Modal>
  );
}
