"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCheck, Loader2, Search, ExternalLink, CircleCheck, CircleX } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";

type Baris = {
  id: string; nomor: string | null; fullName: string; chosenMajor: string; phone: string; skorAkhir: number | null;
  buktiPembayaranUrl: string | null; daftarUlangConfirmedAt: string | null; paymentVerified: boolean;
  studentId: string | null; dikonversiPada: string | null; gelombang: { id: string; nama: string } | null;
};

export default function DaftarUlangSpmbManager() {
  const toast = useToast();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [data, setData] = useState<Baris[]>([]);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("semua");

  const muat = useCallback(async () => {
    const d = await fetch("/api/spmb/daftar-ulang").then(r => r.json()).catch(() => null);
    if (Array.isArray(d)) setData(d);
  }, []);
  useEffect(() => { muat().finally(() => setMemuat(false)); }, [muat]);

  async function sahkan(b: Baris, lunas: boolean) {
    setSibuk(b.id);
    const r = await fetch("/api/spmb/daftar-ulang", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, paymentVerified: lunas }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (r?.ok) { toast.success(lunas ? "Daftar ulang disahkan" : "Pengesahan dibatalkan"); await muat(); }
    else toast.error(d?.error ?? "Gagal menyimpan");
  }

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data.filter(b => {
      if (saring === "lunas" && !b.paymentVerified) return false;
      if (saring === "belum" && b.paymentVerified) return false;
      if (saring === "siswa" && !b.studentId) return false;
      if (!q) return true;
      return b.fullName.toLowerCase().includes(q) || (b.nomor ?? "").toLowerCase().includes(q) || b.phone.includes(q);
    });
  }, [data, cari, saring]);

  const hal = usePaginasi(tersaring, 50, `${cari}|${saring}`);
  const lunas = data.filter(b => b.paymentVerified).length;
  const jadiSiswa = data.filter(b => b.studentId).length;

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCheck size={22} />} title="Daftar Ulang"
        description="Calon yang diterima — pengesahan pembayaran daftar ulang sebelum dijadikan siswa" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={data.length} label="Diterima" ikon="hadir" color="emerald" />
          <StatTile value={lunas} label="Sudah daftar ulang" ikon="lunas" color="blue" />
          <StatTile value={jadiSiswa} label="Sudah jadi siswa" ikon="siswa" color="primary" />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari nama, nomor pendaftaran, atau nomor HP..." />
          </div>
          <div className="alat-saring">
            <Select value={saring} onChange={setSaring} options={[
              { value: "semua", label: "Semua" },
              { value: "belum", label: "Belum daftar ulang" },
              { value: "lunas", label: "Sudah daftar ulang" },
              { value: "siswa", label: "Sudah jadi siswa" },
            ]} />
          </div>
        </div>

        {tersaring.length === 0 ? (
          <div className="panel p-5">
            <p className="py-10 text-center text-sm text-gray-400">
              {data.length === 0 ? "Belum ada pendaftar berstatus diterima." : "Tidak ada yang cocok dengan saringan."}
            </p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr>
                  <th className="w-10">No</th><th>Pendaftar</th><th>Jurusan</th><th>Gelombang</th>
                  <th>Bukti bayar</th><th>Daftar ulang</th><th>Siswa</th><th className="text-right">Aksi</th>
                </tr></thead>
                <tbody>
                  {hal.potongan.map((b, i) => (
                    <tr key={b.id}>
                      <td className="angka">{hal.awal + i}</td>
                      <td>
                        <p className="font-medium text-primary-900">{b.fullName}</p>
                        <p className="angka text-xs text-gray-400">{b.nomor ?? "—"} · {b.phone}</p>
                      </td>
                      <td className="text-gray-500">{b.chosenMajor}</td>
                      <td className="text-gray-500">{b.gelombang?.nama ?? "—"}</td>
                      <td>
                        {b.buktiPembayaranUrl ? (
                          <a href={b.buktiPembayaranUrl} target="_blank" rel="noopener"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 underline">
                            <ExternalLink size={13} /> Lihat
                          </a>
                        ) : <span className="text-sm text-gray-400">Belum ada</span>}
                      </td>
                      <td>
                        <span className={`status-badge ${b.paymentVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {b.paymentVerified ? "Sah" : "Belum"}
                        </span>
                        {b.daftarUlangConfirmedAt && (
                          <span className="angka block text-xs text-gray-400">
                            {new Date(b.daftarUlangConfirmedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </td>
                      <td>
                        {b.studentId
                          ? <span className="status-badge border-blue-200 bg-blue-50 text-blue-700">Sudah</span>
                          : <span className="text-sm text-gray-400">—</span>}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <button type="button" disabled={sibuk === b.id} onClick={() => sahkan(b, !b.paymentVerified)}
                            className={b.paymentVerified ? "btn-modal-cancel px-3 text-xs" : "btn-modal-save px-3 text-xs"}>
                            {sibuk === b.id ? <Loader2 size={13} className="animate-spin" />
                              : b.paymentVerified ? <CircleX size={13} /> : <CircleCheck size={13} />}
                            {b.paymentVerified ? "Batalkan" : "Sahkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginasi hal={hal} satuan="pendaftar" className="border-t border-gray-100" />
          </div>
        )}

        <p className="text-sm text-gray-400">
          Setelah daftar ulang sah, calon dijadikan siswa lewat menu <span className="font-medium">Jadi Siswa</span> —
          di situ datanya masuk ke Buku Induk dan akunnya dibuat.
        </p>
      </div>
    </div>
  );
}
