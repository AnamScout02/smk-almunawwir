"use client";
import { useCallback, useEffect, useState } from "react";
import { UsersRound, Loader2, Plus, Trash2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Data = {
  bolehAtur: boolean;
  otomatis: { userId: string; nama: string; jabatan: string[] }[];
  anggota: { userId: string; nama: string; email: string; ket: string | null }[];
  calon: { id: string; nama: string; ket: string | null }[];
};

/** Panitia SPMB (7 Okt 2026): daftar siapa saja yang bisa mengelola Pusat SPMB + tambah/keluarkan anggota. */
export default function PanitiaSpmbManager({ api = "/api/spmb/panitia", nama = "SPMB", otomatis }: { api?: string; nama?: string; otomatis?: string } = {}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [pilih, setPilih] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => fetch(api).then(r => r.json()).then(x => { if (!x.error) setD(x); }).catch(() => {}), [api]);
  useEffect(() => { muat(); }, [muat]);

  async function tambah() {
    if (!pilih) return;
    setSibuk(true);
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: pilih }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success("Anggota panitia ditambahkan"); setPilih(""); muat(); } else toast.error(x?.error ?? "Gagal menambahkan");
  }
  async function keluarkan(userId: string, n: string) {
    if (!(await confirm(`Keluarkan ${n} dari panitia ${nama}? Akunnya tidak bisa membuka Pusat ${nama} lagi.`))) return;
    const r = await fetch(`${api}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success(`${n} dikeluarkan`); muat(); } else toast.error("Gagal mengeluarkan");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UsersRound size={22} />} title={`Panitia ${nama}`} description={`Akun yang bisa membuka dan mengelola Pusat ${nama}`} />
      {!d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            {otomatis ?? <>Otomatis panitia: Admin, staf berjabatan Tenaga Administrasi Sekolah, dan guru pemegang jabatan Kepala Sekolah, Wakil Kepala
            Kesiswaan, Wakil Kepala Humas, Operator Sekolah, atau Koordinator Tim Branding &amp; Publikasi.</>} Guru atau staf lain cukup ditambahkan
            di bawah — tanpa perlu diberi jabatan. Menu Pusat {nama} langsung muncul di portal mereka.
          </p>

          {d.bolehAtur && (
            <div className="panel p-5">
              <p className="panel-judul mb-3">Tambah anggota panitia</p>
              <div className="baris-alat items-end">
                <div className="alat-saring min-w-[16rem] flex-1">
                  <Select value={pilih} onChange={setPilih} placeholder="Pilih guru / staf..."
                    options={d.calon.map(c => ({ value: c.id, label: c.ket ? `${c.nama} — ${c.ket}` : c.nama }))} />
                </div>
                <div className="alat-aksi">
                  <button type="button" disabled={!pilih || sibuk} onClick={tambah} className="btn-modal-save btn-teks">
                    {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambahkan
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Anggota tambahan ({d.anggota.length})</p></div>
            {d.anggota.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada anggota tambahan.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Nama</th><th>Keterangan</th>{d.bolehAtur && <th className="text-right">Aksi</th>}</tr></thead>
                  <tbody>
                    {d.anggota.map((a, i) => (
                      <tr key={a.userId}>
                        <td className="angka">{i + 1}</td>
                        <td><p className="font-medium text-primary-900">{a.nama}</p><p className="text-xs text-gray-400">{a.email}</p></td>
                        <td className="text-sm text-gray-600">{a.ket || "—"}</td>
                        {d.bolehAtur && (
                          <td className="text-right">
                            <button type="button" title="Keluarkan" onClick={() => keluarkan(a.userId, a.nama)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul"><ShieldCheck size={15} className="mr-1 inline" />Otomatis lewat jabatan ({d.otomatis.length})</p></div>
            {d.otomatis.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada guru pemegang jabatan panitia.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Nama</th><th>Jabatan</th></tr></thead>
                  <tbody>
                    {d.otomatis.map((a, i) => (
                      <tr key={a.userId}><td className="angka">{i + 1}</td><td className="font-medium text-primary-900">{a.nama}</td><td className="text-sm text-gray-600">{a.jabatan.join(", ")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Jabatan diatur di menu Jabatan (Data Siswa & Guru). Untuk mengeluarkan mereka dari panitia, cabut jabatannya di sana.</p>
          </div>
        </div>
      )}
    </div>
  );
}
