"use client";
import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Power, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Keadaan = { aktif: boolean; pesan: string; sampai: string; mulai: string | null; sedangUjian: number };

/** Pengaturan mode pemeliharaan (src/lib/pemeliharaan.ts). Menyala = semua pengguna selain Superadmin dialihkan ke
 *  /pemeliharaan; Superadmin tetap bisa memakai seluruh situs. */
export default function PemeliharaanManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [k, setK] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState("");
  const [sampai, setSampai] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/admin/pemeliharaan", { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: Keadaan | null) => { if (d) { setK(d); setPesan(d.pesan); setSampai(d.sampai); } })
      .catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpan(aktif: boolean) {
    setSibuk(true);
    const r = await fetch("/api/admin/pemeliharaan", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktif, pesan, sampai }),
    }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyimpan."); return; }
    toast.success(aktif === k?.aktif ? "Pesan tersimpan" : aktif ? "Mode pemeliharaan MENYALA" : "Mode pemeliharaan dimatikan — situs kembali normal");
    muat();
  }

  async function nyalakan() {
    const ujian = k?.sedangUjian ?? 0;
    const peringatan = ujian > 0
      ? `PERHATIAN: ${ujian} siswa sedang mengerjakan ujian saat ini — ujian mereka akan terputus. `
      : "";
    if (!await confirm(`${peringatan}Nyalakan mode pemeliharaan? Semua guru, staf, siswa, orang tua, dan pengunjung situs akan melihat halaman pemeliharaan. Hanya Superadmin yang tetap bisa memakai situs.`)) return;
    simpan(true);
  }
  async function matikan() {
    if (!await confirm("Matikan mode pemeliharaan? Situs langsung terbuka kembali untuk semua pengguna.")) return;
    simpan(false);
  }

  if (!k) return <div className="flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const sejak = k.mulai ? new Date(k.mulai).toLocaleString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : null;

  return (
    <div className="space-y-6">
      <div className={`panel p-5 sm:p-6 ${k.aktif ? "border-amber-300 ring-2 ring-amber-200" : ""}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${k.aktif ? "bg-amber-500 text-white" : "bg-emerald-50 text-emerald-600"}`}>
              <Power size={22} />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold text-primary-900">
                {k.aktif ? "Pemeliharaan MENYALA" : "Situs berjalan normal"}
              </p>
              <p className="text-sm text-gray-500">
                {k.aktif ? `Pengguna selain Superadmin melihat halaman pemeliharaan${sejak ? ` sejak ${sejak} WIB` : ""}.` : "Semua pengguna bisa memakai situs seperti biasa."}
              </p>
            </div>
          </div>
          {k.aktif
            ? <button type="button" onClick={matikan} disabled={sibuk} className="btn-modal-save btn-teks">{sibuk ? <Loader2 className="animate-spin" /> : <Power />} Matikan Pemeliharaan</button>
            : <button type="button" onClick={nyalakan} disabled={sibuk} className="btn-awas btn-teks">{sibuk ? <Loader2 className="animate-spin" /> : <Power />} Nyalakan Pemeliharaan</button>}
        </div>
        {k.sedangUjian > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span><strong className="angka">{k.sedangUjian}</strong> siswa sedang mengerjakan ujian. Menyalakan pemeliharaan sekarang akan memutus ujian mereka.</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        <div className="panel p-5 sm:p-6 xl:col-span-7 space-y-4">
          <h3 className="font-heading font-semibold text-primary-900">Isi halaman pemeliharaan</h3>
          <div>
            <label className="label-field">Pesan untuk pengguna</label>
            <textarea value={pesan} onChange={e => setPesan(e.target.value)} rows={4} maxLength={1000} className="input-field"
              placeholder="Kosongkan untuk memakai pesan bawaan: “Kami sedang melakukan perbaikan dan pembaruan sistem…”" />
          </div>
          <div>
            <label className="label-field">Perkiraan selesai</label>
            <input value={sampai} onChange={e => setSampai(e.target.value)} maxLength={120} className="input-field"
              placeholder="mis. pukul 21.00 WIB, atau Senin pagi" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <a href="/pemeliharaan?pratinjau=1" className="btn-modal-cancel btn-teks"><Eye /> Pratinjau</a>
            <button type="button" onClick={() => simpan(k.aktif)} disabled={sibuk} className="btn-modal-save"><Save /> Simpan Pesan</button>
          </div>
        </div>

        <div className="panel p-5 sm:p-6 xl:col-span-5 text-sm text-gray-600 space-y-3">
          <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2"><ShieldCheck size={16} /> Siapa yang terdampak</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Ditutup:</strong> guru, staf TU, siswa, orang tua, bendahara, dan pengunjung situs publik (termasuk aplikasi MyAlwis).</li>
            <li><strong>Tetap bisa:</strong> Superadmin — termasuk saat &quot;Masuk Sebagai&quot; akun lain untuk memeriksa tampilannya.</li>
            <li><strong>Tetap terbuka:</strong> halaman Masuk (supaya Superadmin bisa login) dan papan TV kelas (bel sekolah di TV tetap berbunyi).</li>
            <li>Pengguna yang sedang membuka situs ikut dialihkan begitu membuka halaman berikutnya; perubahan berlaku dalam beberapa detik.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
