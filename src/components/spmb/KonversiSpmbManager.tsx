"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

interface Pendaftar { id: string; nama: string; jurusanPilihan: string; majorId: string | null; jurusanKode: string | null; siapNis: boolean; nisn: string | null; sekolahAsal: string | null; daftarUlang: boolean; bayarTerverifikasi: boolean }
interface Data { sudahDikonversi: number; kelas: { id: string; name: string; majorId: string }[]; pendaftar: Pendaftar[] }
interface Hasil { nama: string; nis?: string; email?: string; galat?: string }

/** KONVERSI SPMB → BUKU INDUK (17 Sep 2026): pendaftar diterima menjadi siswa (akun + NIS + data awal) dengan satu klik. */
export default function KonversiSpmbManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [kelasPer, setKelasPer] = useState<Record<string, string>>({});
  const tahunIni = new Date(Date.now() + 7 * 3600_000).getUTCFullYear();
  const [tahun, setTahun] = useState(String(tahunIni));
  const [tanggal, setTanggal] = useState(`${tahunIni}-07-01`);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil[] | null>(null);
  const muat = useCallback(() => {
    fetch("/api/spmb/konversi", { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else { setD(x); setPilih(new Set(x.pendaftar.filter((p: Pendaftar) => p.siapNis).map((p: Pendaftar) => p.id))); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const jurusanDipilih = useMemo(() => [...new Map((d?.pendaftar ?? []).filter(p => pilih.has(p.id) && p.majorId).map(p => [p.majorId!, p.jurusanKode!])).entries()], [d, pilih]);
  async function konversi() {
    setSibuk(true);
    const r = await fetch("/api/spmb/konversi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...pilih], kelasPerJurusan: kelasPer, enrollYear: Number(tahun), tanggalDiterima: tanggal }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal."); return; }
    toast.success(`${x.jumlah} siswa masuk Buku Induk.`);
    setHasil(x.hasil); muat();
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserPlus size={22} />} title="SPMB → Buku Induk" description={d ? `${d.pendaftar.length} pendaftar diterima belum masuk Buku Induk · ${d.sudahDikonversi} sudah dikonversi` : "Jadikan pendaftar yang diterima sebagai siswa"} />
      {galat ? <EmptyState icon={UserPlus} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : d.pendaftar.length === 0 ? <EmptyState icon={CheckCircle2} title="Tidak ada yang perlu dikonversi" description="Semua pendaftar berstatus Diterima sudah masuk Buku Induk." /> : (
        <div className="space-y-5">
          <div className="panel p-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label htmlFor="tahun-angkatan" className="label-field">Tahun Angkatan</label><input id="tahun-angkatan" type="number" className="input-field" value={tahun} onChange={e => setTahun(e.target.value)} /></div>
              <div><label className="label-field">Tanggal Diterima</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
            </div>
            {jurusanDipilih.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {jurusanDipilih.map(([mid, kode]) => (
                  <div key={mid}><label className="label-field">Kelas X untuk {kode} (opsional)</label>
                    <Select value={kelasPer[mid] ?? ""} onChange={v => setKelasPer(p => ({ ...p, [mid]: v }))} options={[{ value: "", label: "Belum ditentukan" }, ...d.kelas.filter(k => k.majorId === mid).map(k => ({ value: k.id, label: k.name }))]} /></div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">NIS dibuat otomatis mengikuti urutan Buku Induk; login = NIS tanpa simbol @smkalmunawwir.sch.id dengan sandi bawaan. Data orang tua, alamat lengkap, dan dokumen dilengkapi TU di Buku Induk (nomor WhatsApp pendaftar disimpan sebagai HP siswa).</p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={sibuk || !pilih.size} onClick={konversi} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <UserPlus />} Masukkan {pilih.size} Pendaftar ke Buku Induk</button>
            </div>
          </div>
          <div className="panel overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th className="w-10"><input type="checkbox" aria-label="Pilih semua" checked={pilih.size === d.pendaftar.filter(p => p.siapNis).length && pilih.size > 0} onChange={e => setPilih(new Set(e.target.checked ? d.pendaftar.filter(p => p.siapNis).map(p => p.id) : []))} className="h-4 w-4 rounded border-gray-300" /></th>
                <th>Nama</th><th>Jurusan</th><th className="hidden md:table-cell">Asal sekolah</th><th className="hidden md:table-cell">Daftar ulang</th>
              </tr></thead>
              <tbody>{d.pendaftar.map(p => (
                <tr key={p.id}>
                  <td><input type="checkbox" disabled={!p.siapNis} aria-label={`Pilih ${p.nama}`} checked={pilih.has(p.id)} onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} className="h-4 w-4 rounded border-gray-300" /></td>
                  <td className="font-semibold text-primary-900">{p.nama}{p.nisn && <span className="block text-xs font-normal text-gray-500">NISN {p.nisn}</span>}</td>
                  <td className="text-sm">{p.jurusanKode ?? <span className="text-red-600">{p.jurusanPilihan} (tidak dikenali)</span>}{p.jurusanKode && !p.siapNis && <span className="block text-xs text-red-600">Kode Jurusan (NIS) belum diisi</span>}</td>
                  <td className="hidden md:table-cell text-xs text-gray-600">{p.sekolahAsal ?? "—"}</td>
                  <td className="hidden md:table-cell text-xs">{p.daftarUlang ? (p.bayarTerverifikasi ? "Selesai" : "Menunggu verifikasi bayar") : <span className="text-amber-700">Belum</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      <Modal open={!!hasil} onClose={() => setHasil(null)} title="Hasil konversi" size="lg" scrollBody footer={<button type="button" onClick={() => setHasil(null)} className="btn-modal-save">Selesai</button>}>
        {hasil && (
          <table className="data-table">
            <thead><tr><th>Nama</th><th>NIS</th><th>Login</th></tr></thead>
            <tbody>{hasil.map((h, i) => (
              <tr key={i}><td>{h.nama}</td>{h.galat ? <td colSpan={2} className="text-red-600 text-xs">{h.galat}</td> : <><td className="angka text-xs">{h.nis}</td><td className="text-xs">{h.email}</td></>}</tr>
            ))}</tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
