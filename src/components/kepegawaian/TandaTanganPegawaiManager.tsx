"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useEffect, useMemo, useState } from "react";
import { Loader2, PenLine, Search, Trash2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import PenyuntingTtd from "@/components/shared/PenyuntingTtd";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { usePaginasi } from "@/lib/use-paginasi";

type Baris = { id: string; nama: string; peran: string; nip: string | null; ada: boolean; diperbarui: string | null };
const PERAN: Record<string, string> = { ADMIN: "Admin", TAS: "Staf TU", TEACHER: "Guru" };

/** Halaman TU: lihat siapa yang sudah/belum punya TTD, unggahkan/ganti/hapus atas nama pegawai (src/lib/ttd.ts). */
export default function TandaTanganPegawaiManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [daftar, setDaftar] = useState<Baris[] | null>(null);
  const [cari, setCari] = useState("");
  useCariAwal(setCari);
  const [saring, setSaring] = useState<"semua" | "belum" | "sudah">("semua");
  const [edit, setEdit] = useState<Baris | null>(null);
  const [versi, setVersi] = useState(0);

  const muat = () => fetch("/api/admin/ttd", { cache: "no-store" }).then(r => (r.ok ? r.json() : null))
    .then(d => setDaftar(d?.daftar ?? [])).catch(() => setDaftar([]));
  useEffect(() => { muat(); }, []);

  const tersaring = useMemo(() => (daftar ?? []).filter(b =>
    (saring === "semua" || (saring === "sudah") === b.ada) &&
    (!cari || `${b.nama} ${b.nip ?? ""}`.toLowerCase().includes(cari.toLowerCase()))), [daftar, cari, saring]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}`);

  async function hapus(b: Baris) {
    if (!await confirm(`Hapus tanda tangan ${b.nama}?`)) return;
    const r = await fetch(`/api/admin/ttd/${b.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Tanda tangan dihapus"); muat(); } else toast.error("Gagal menghapus.");
  }

  if (!daftar) return <div className="flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const sudah = daftar.filter(b => b.ada).length;

  return (
    <div className="space-y-6">
      <div className="kisi-kartu kisi-kartu-3">
        <StatTile value={daftar.length} label="Guru & staf" ikon="guru" color="primary" />
        <StatTile value={sudah} label="Sudah punya tanda tangan" ikon="centang" color="emerald" />
        <StatTile value={daftar.length - sudah} label="Belum punya tanda tangan" ikon="peringatan" color="amber" sorot={daftar.length - sudah > 0} />
      </div>

      <div className="baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau NIP..." className="input-field pl-10" />
        </div>
        <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {([["semua", "Semua"], ["belum", "Belum"], ["sudah", "Sudah"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSaring(k)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saring === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="w-10">No</th><th>Nama</th><th>Peran</th><th>Tanda Tangan</th><th className="text-right">Aksi</th></tr></thead>
            <tbody>
              {hal.potongan.map((b, i) => (
                <tr key={b.id}>
                  <td className="angka">{hal.awal + i}</td>
                  <td><p className="font-semibold text-primary-900">{b.nama}</p>{b.nip && <p className="text-xs text-gray-500">{b.nip}</p>}</td>
                  <td>{PERAN[b.peran] ?? b.peran}</td>
                  <td>
                    {b.ada
                      // eslint-disable-next-line @next/next/no-img-element -- gambar pribadi, tanpa pengoptimal
                      ? <img src={`/api/ttd/${b.id}?v=${versi}`} alt={`TTD ${b.nama}`} className="h-10 max-w-[140px] object-contain" loading="lazy" />
                      : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum ada</span>}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEdit(b)} title={b.ada ? "Ganti" : "Unggah"}
                        className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><PenLine size={14} /></button>
                      {b.ada && <button type="button" onClick={() => hapus(b)} title="Hapus"
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tersaring.length && <p className="py-10 text-center text-sm text-gray-400">Tidak ada pegawai yang cocok.</p>}
        </div>
        <Paginasi hal={hal} satuan="pegawai" className="border-t border-gray-100" />
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Tanda Tangan ${edit.nama}` : ""} size="lg"
        description="Gambar langsung atau unggah scan tanda tangan basah. Latar putih otomatis dihapus.">
        {edit && <PenyuntingTtd key={edit.id} endpoint={`/api/admin/ttd/${edit.id}`} onBatal={() => setEdit(null)}
          onSelesai={() => { toast.success("Tanda tangan tersimpan"); setEdit(null); setVersi(v => v + 1); muat(); }} />}
      </Modal>
    </div>
  );
}
