"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Wand2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";
import { saranSingkatan } from "@/lib/singkatan-mapel";

interface Baris { nama: string; kategori: string; singkatan: string; jumlah: number; urut: number }

/** FORM SINGKATAN MAPEL (22 September 2026) — satu isian per nama mapel (berlaku semua tingkat & jurusan bernama sama).
 * Singkatan tampil di kepala kolom DKN & leger Rekap Nilai; kosong = nama lengkap. Saran otomatis hanya mengisi kotak. */
export default function FormSingkatanMapel({ open, onClose, onTersimpan }: { open: boolean; onClose: () => void; onTersimpan?: () => void }) {
  const toast = useToast();
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [asli, setAsli] = useState<Record<string, string>>({});
  const [simpan, setSimpan] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/subjects/singkatan", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { const m: Baris[] = Array.isArray(d.mapel) ? d.mapel : []; setBaris(m); setAsli(Object.fromEntries(m.map(x => [x.nama, x.singkatan]))); })
      .catch(() => setBaris([]));
  }, [open]);

  const grup = useMemo(() => {
    const g = new Map<string, Baris[]>();
    for (const b of baris ?? []) g.set(b.kategori || "Lainnya", [...(g.get(b.kategori || "Lainnya") ?? []), b]);
    return [...g.entries()];
  }, [baris]);
  const berubah = (baris ?? []).filter(b => b.singkatan.trim() !== (asli[b.nama] ?? "").trim());
  const kosong = (baris ?? []).filter(b => !b.singkatan.trim()).length;

  async function simpanSemua() {
    if (!berubah.length) { onClose(); return; }
    setSimpan(true);
    const r = await fetch("/api/admin/subjects/singkatan", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daftar: berubah.map(b => ({ nama: b.nama, singkatan: b.singkatan })) }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpan(false);
    if (!r?.ok) { toast.error(d?.error ?? "Singkatan gagal disimpan."); return; }
    toast.success(`Singkatan ${d?.mapel ?? berubah.length} mapel tersimpan.`);
    onTersimpan?.();
    onClose();
  }

  return (
    <Modal open={open} onClose={() => !simpan && onClose()} size="xl" scrollBody title="Singkatan Mata Pelajaran"
      description="Tampil di kepala kolom DKN & leger — satu isian berlaku untuk semua tingkat"
      headerActions={baris && kosong > 0 ? (
        <button type="button" className="btn-modal-cancel px-3 text-xs"
          onClick={() => setBaris(bs => bs?.map(b => (b.singkatan.trim() ? b : { ...b, singkatan: saranSingkatan(b.nama) })) ?? null)}>
          <Wand2 size={14} /> Isi yang kosong dengan saran
        </button>
      ) : undefined}
      footer={<>
        <button type="button" onClick={onClose} disabled={simpan} className="btn-modal-cancel">Batal</button>
        <button type="button" onClick={simpanSemua} disabled={simpan || !baris} className="btn-modal-save">
          {simpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan{berubah.length ? ` (${berubah.length})` : ""}
        </button>
      </>}>
      {!baris ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          {grup.map(([kategori, xs]) => (
            <div key={kategori}>
              <p className="label-kecil text-gray-500 mb-2">{kategori}</p>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {xs.map(b => (
                  <div key={b.nama} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                    <label htmlFor={`sgk-${b.nama}`} className="min-w-0 flex-1 basis-56 text-sm text-primary-900">
                      {b.nama} {b.jumlah > 1 && <span className="text-xs text-gray-400">· {b.jumlah} tingkat/jurusan</span>}
                    </label>
                    <input id={`sgk-${b.nama}`} value={b.singkatan} maxLength={16} placeholder={saranSingkatan(b.nama)}
                      onChange={e => setBaris(bs => bs?.map(x => (x.nama === b.nama ? { ...x, singkatan: e.target.value } : x)) ?? null)}
                      className={`input-field w-36 font-semibold ${b.singkatan.trim() !== (asli[b.nama] ?? "").trim() ? "border-amber-300 bg-amber-50" : ""}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
