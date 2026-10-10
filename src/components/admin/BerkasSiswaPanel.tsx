"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { kecilkanFoto } from "@/lib/olah-foto";
import { DARI_SPMB, JENIS_BERKAS_SISWA, labelBerkasSiswa } from "@/lib/berkas-siswa-jenis";

type Berkas = { id: string; jenis: string; keterangan: string | null; mime: string; ukuran: number; diunggahOleh: string; createdAt: string };
type Spmb = { nomor: string | null; ijazahUrl: string | null; kkUrl: string | null; ktpWaliUrl: string | null; fotoUrl: string | null; dokumenLainUrl: string | null } | null;
const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** BERKAS SISWA DIGITAL — map dokumen satu siswa di Profil Siswa: tiap jenis menunjukkan ada/belum, bisa dibuka, dan
 *  (untuk TU/Operator Sekolah) diunggah dari berkas atau kamera HP. Foto dikecilkan di peramban sebelum dikirim. */
export default function BerkasSiswaPanel({ studentId }: { studentId: string }) {
  const [berkas, setBerkas] = useState<Berkas[]>([]), [spmb, setSpmb] = useState<Spmb>(null), [kelola, setKelola] = useState(false);
  const [memuat, setMemuat] = useState(true), [sibuk, setSibuk] = useState(false);
  const [jenis, setJenis] = useState(""), [ket, setKet] = useState("");
  const berkasRef = useRef<HTMLInputElement>(null), kameraRef = useRef<HTMLInputElement>(null);
  const toast = useToast(), confirm = useConfirm();

  const muat = useCallback(() => {
    fetch(`/api/admin/berkas-siswa?studentId=${studentId}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setBerkas(d.berkas ?? []); setSpmb(d.spmb ?? null); setKelola(!!d.kelola); })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, [studentId]);
  useEffect(() => { muat(); }, [muat]);

  const unggah = async (asal: File | undefined) => {
    if (!asal) return;
    if (!jenis) { toast.error("Pilih jenis berkas dulu."); return; }
    setSibuk(true);
    try {
      const file = asal.type.startsWith("image/") ? (await kecilkanFoto(asal)).file : asal;
      const f = new FormData(); f.set("studentId", studentId); f.set("jenis", jenis); f.set("keterangan", ket); f.set("file", file);
      const r = await fetch("/api/admin/berkas-siswa", { method: "POST", body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(j.error || "Gagal mengunggah."); else { toast.success(`${labelBerkasSiswa(jenis)} tersimpan.`); setKet(""); muat(); }
    } catch { toast.error("Gagal mengunggah."); }
    finally { setSibuk(false); if (berkasRef.current) berkasRef.current.value = ""; if (kameraRef.current) kameraRef.current.value = ""; }
  };
  const hapus = async (b: Berkas) => {
    if (!(await confirm(`Hapus berkas ${labelBerkasSiswa(b.jenis)} ini? Berkasnya ikut terhapus dari server.`))) return;
    fetch(`/api/berkas-siswa/${b.id}`, { method: "DELETE" })
      .then(r => { if (r.ok) { toast.success("Berkas dihapus."); muat(); } else toast.error("Gagal menghapus."); })
      .catch(() => toast.error("Gagal menghapus."));
  };

  if (memuat) return <div className="flex justify-center py-10 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const lain = spmb?.dokumenLainUrl;
  return (
    <>
      <ul className="divide-y divide-gray-100">
        {JENIS_BERKAS_SISWA.map(j => {
          const milik = berkas.filter(b => b.jenis === j.kunci);
          const kolom = DARI_SPMB[j.kunci], dariSpmb = kolom ? spmb?.[kolom] : j.kunci === "LAINNYA" ? lain : null;
          if (!milik.length && !dariSpmb && !j.pokok) return null;
          return (
            <li key={j.kunci} className="px-5 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-medium text-primary-900">{j.label}</span>
                {!milik.length && !dariSpmb && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">belum ada</span>}
              </div>
              {dariSpmb && <p className="mt-1 flex items-center gap-2 text-xs text-gray-500"><span className="min-w-0 flex-1 truncate">dari pendaftaran SPMB{spmb?.nomor ? ` ${spmb.nomor}` : ""}</span><a href={dariSpmb} className="panel-tautan">Buka</a></p>}
              {milik.map(b => (
                <p key={b.id} className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="min-w-0 flex-1 truncate">{b.keterangan ? `${b.keterangan} · ` : ""}{b.mime === "application/pdf" ? "PDF" : "foto"} {kb(b.ukuran)} · {tgl(b.createdAt)} · {b.diunggahOleh}</span>
                  <a href={`/api/berkas-siswa/${b.id}`} className="panel-tautan">Buka</a>
                  {kelola && (
                    <button type="button" onClick={() => hapus(b)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                      <Trash2 size={14} />
                    </button>
                  )}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
      {kelola && (
        <div className="space-y-2 border-t border-gray-100 px-5 py-4">
          <p className="label-kecil">Tambah berkas</p>
          <Select value={jenis} onChange={setJenis} placeholder="Jenis berkas…" options={JENIS_BERKAS_SISWA.map(j => ({ value: j.kunci, label: j.label }))} />
          <input value={ket} onChange={e => setKet(e.target.value)} maxLength={120} placeholder="Keterangan (opsional), mis. KK terbaru 2026" className="input-field" />
          <input ref={berkasRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => unggah(e.target.files?.[0])} />
          <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => unggah(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={sibuk} onClick={() => berkasRef.current?.click()} className="btn-modal-save btn-teks">
              {sibuk ? <Loader2 className="animate-spin" /> : <Upload />} Pilih berkas
            </button>
            <button type="button" disabled={sibuk} onClick={() => kameraRef.current?.click()} className="btn-modal-cancel btn-teks lg:hidden">
              <Camera /> Foto dari kamera
            </button>
          </div>
          <p className="text-xs text-gray-500">Foto (JPG/PNG) atau PDF, paling besar 6 MB. Foto dikecilkan otomatis sebelum dikirim.</p>
        </div>
      )}
    </>
  );
}
