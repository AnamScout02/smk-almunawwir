"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, DoorOpen, Loader2, PackageCheck, Plus, Search, Settings2, Undo2, X, Download
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { FormPinjam } from "@/components/sarpras/LayananSarprasManager";
import { KONDISI, STATUS_PINJAM, rentang } from "@/components/sarpras/sarpras-umum";

interface Pinjam {
  id: string; jenis: string; ruang: string | null; jumlah: number; peminjamNama: string; keperluan: string; mulai: string; selesai: string;
  status: string; lingkup: string; catatan: string | null; kondisiKembali: string | null; diputuskanOleh: string | null; asset: { name: string; location: string | null } | null;
}
interface Data { akses: { penuh: boolean; lab: boolean }; daftar: Pinjam[]; aset: { id: string; name: string; category: string; location: string | null; quantity: number }[]; ruang: string[] }

/** KELOLA PEMINJAMAN & PEMESANAN RUANG — Wakasek Sarpras/TU (semua) & Kepala Lab (lingkup lab). */
export default function PeminjamanSarprasManager({ lingkupLab = false }: { lingkupLab?: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [saring, setSaring] = useState("AKTIF");
  const [cari, setCari] = useState("");
  const [kembali, setKembali] = useState<Pinjam | null>(null);
  const [kondisi, setKondisi] = useState("BAIK");
  const [catatan, setCatatan] = useState("");
  const [bukaRuang, setBukaRuang] = useState(false);
  const [tambahan, setTambahan] = useState("");
  const [bukaAju, setBukaAju] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/sarpras/peminjaman?semua=1", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else if (!d.akses?.lab) setGalat("Khusus pengelola Sarpras/Lab."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function aksi(p: Pinjam, nama: string, tambahanBody: Record<string, unknown> = {}) {
    setSibuk(true);
    const r = await fetch(`/api/sarpras/peminjaman/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: nama, ...tambahanBody }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.status === 409 && d?.bentrok && data?.akses.penuh) {
      if (await confirm(`${d.error} Tetap setujui?`)) return aksi(p, nama, { ...tambahanBody, abaikanBentrok: true });
      return false;
    }
    if (!r?.ok) { toast.error(d?.error ?? "Gagal."); return false; }
    toast.success("Tersimpan."); muat();
    return true;
  }
  async function bukaPengaturanRuang() {
    const d = await fetch("/api/sarpras/ruang", { cache: "no-store" }).then(r => r.json()).catch(() => null);
    setTambahan((d?.tambahan ?? []).join("\n")); setBukaRuang(true);
  }
  async function simpanRuang() {
    const r = await fetch("/api/sarpras/ruang", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tambahan: tambahan.split("\n") }) }).catch(() => null);
    if (r?.ok) { toast.success("Daftar ruang diperbarui."); setBukaRuang(false); muat(); } else toast.error("Gagal menyimpan.");
  }

  const q = cari.toLowerCase();
  const daftar = (data?.daftar ?? []).filter(p =>
    (saring === "SEMUA" || (saring === "AKTIF" ? ["MENUNGGU", "DISETUJUI", "DIPINJAM"].includes(p.status) : p.status === saring))
    && (!q || `${p.peminjamNama} ${p.keperluan} ${p.ruang ?? ""} ${p.asset?.name ?? ""}`.toLowerCase().includes(q)));
  const hal = usePaginasi(daftar, 30, `${saring}|${cari}`);
  const menunggu = (data?.daftar ?? []).filter(p => p.status === "MENUNGGU").length;
  const telat = (data?.daftar ?? []).filter(p => p.status === "DIPINJAM" && new Date(p.selesai) < new Date()).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarClock size={22} />} title={lingkupLab ? "Peminjaman Lab" : "Peminjaman & Pemesanan Ruang"}
        description={data ? `${menunggu} menunggu persetujuan${telat ? ` · ${telat} melewati waktu kembali` : ""}` : "Setujui permohonan, serahkan barang, dan catat pengembalian"} />
      {galat ? <EmptyState icon={CalendarClock} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari peminjam, ruang, barang…" className="input-field pl-10" /></div>
            <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[
              { value: "AKTIF", label: "Berjalan" }, { value: "MENUNGGU", label: "Menunggu" }, { value: "DIPINJAM", label: "Sedang dipakai" },
              { value: "DIKEMBALIKAN", label: "Selesai" }, { value: "DITOLAK", label: "Ditolak" }, { value: "SEMUA", label: "Semua" },
            ]} /></div>
            <div className="alat-aksi">
              {data.akses.penuh && !lingkupLab && <button type="button" onClick={bukaPengaturanRuang} className="btn-modal-cancel btn-teks"><Settings2 /> Daftar Ruang</button>}
              {data.akses.penuh && <a href="/api/admin/ekspor/sarpras-peminjaman" className="btn-modal-cancel"><Download /> Unduh Excel</a>}
              <button type="button" onClick={() => setBukaAju(true)} className="btn-modal-save btn-teks"><Plus /> Pinjam / Pesan Ruang</button>
            </div>
          </div>
          {daftar.length === 0 ? <EmptyState icon={CalendarClock} title="Tidak ada permohonan" description="Permohonan dari guru & staf lewat menu Layanan Sarpras tampil di sini." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Barang / ruang</th><th>Peminjam</th><th className="hidden md:table-cell">Waktu</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {hal.potongan.map(p => {
                    const lewat = p.status === "DIPINJAM" && new Date(p.selesai) < new Date();
                    return (
                      <tr key={p.id}>
                        <td className="min-w-[10rem]">
                          <p className="font-semibold text-primary-900">{p.jenis === "RUANG" ? <><DoorOpen size={13} className="mr-1 inline" />{p.ruang}</> : `${p.asset?.name ?? "Barang"}${p.jumlah > 1 ? ` × ${p.jumlah}` : ""}`}</p>
                          <p className="text-xs text-gray-500 md:hidden">{rentang(p.mulai, p.selesai)}</p>
                          {p.lingkup === "LAB" && !lingkupLab && <span className="text-xs text-purple-700">Lab</span>}
                        </td>
                        <td className="min-w-[10rem]"><p className="text-sm text-gray-800">{p.peminjamNama}</p><p className="text-xs text-gray-500">{p.keperluan}</p></td>
                        <td className="hidden md:table-cell text-xs whitespace-nowrap text-gray-600">{rentang(p.mulai, p.selesai)}</td>
                        <td>
                          <span className={`status-badge ${lewat ? "bg-red-50 text-red-600 border-red-200" : STATUS_PINJAM[p.status]?.kelas}`}>{lewat ? "Terlambat kembali" : STATUS_PINJAM[p.status]?.label}</span>
                          {p.kondisiKembali && p.kondisiKembali !== "BAIK" && <p className="mt-1 text-xs text-red-600">Kembali {KONDISI[p.kondisiKembali]?.toLowerCase()}</p>}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="alat-aksi justify-end">
                            {p.status === "MENUNGGU" && <>
                              <button type="button" disabled={sibuk} onClick={() => aksi(p, "setujui")} className="btn-modal-save btn-teks px-2.5 text-xs"><Check /> Setujui</button>
                              <button type="button" disabled={sibuk} onClick={async () => { if (await confirm("Tolak permohonan ini?")) aksi(p, "tolak"); }} className="btn-modal-cancel px-2.5 text-xs"><X /> Tolak</button>
                            </>}
                            {p.status === "DISETUJUI" && p.jenis === "BARANG" && <button type="button" disabled={sibuk} onClick={() => aksi(p, "serahkan")} className="btn-modal-save btn-teks px-2.5 text-xs"><PackageCheck /> Serahkan</button>}
                            {(p.status === "DIPINJAM" || (p.status === "DISETUJUI" && p.jenis === "RUANG")) && (
                              <button type="button" disabled={sibuk} onClick={() => { setKembali(p); setKondisi("BAIK"); setCatatan(""); }} className="btn-modal-cancel px-2.5 text-xs"><Undo2 /> {p.jenis === "RUANG" ? "Selesai" : "Kembali"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Paginasi hal={hal} satuan="permohonan" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}

      <Modal open={!!kembali} onClose={() => setKembali(null)} title={kembali?.jenis === "RUANG" ? "Pemakaian ruang selesai" : "Catat pengembalian"} description={kembali ? `${kembali.peminjamNama} · ${kembali.ruang ?? kembali.asset?.name}` : undefined}
        footer={<>
          <button type="button" onClick={() => setKembali(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={async () => { if (kembali && await aksi(kembali, "kembalikan", { kondisi, catatan })) setKembali(null); }} className="btn-modal-save"><Check /> Simpan</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Kondisi {kembali?.jenis === "RUANG" ? "ruang/perlengkapan" : "barang"}</label><Select value={kondisi} onChange={setKondisi} options={Object.entries(KONDISI).map(([value, label]) => ({ value, label }))} /></div>
          {kondisi !== "BAIK" && <p className="text-xs text-amber-700">Kondisi rusak otomatis dicatat sebagai laporan kerusakan{kembali?.jenis === "BARANG" ? " dan kondisi barang di inventaris ikut diperbarui" : ""}.</p>}
          <div><label htmlFor="catatan-kembali" className="label-field">Catatan</label><input id="catatan-kembali" className="input-field" maxLength={300} value={catatan} onChange={e => setCatatan(e.target.value)} /></div>
        </div>
      </Modal>

      <Modal open={bukaRuang} onClose={() => setBukaRuang(false)} title="Daftar ruang untuk pemesanan"
        footer={<><button type="button" onClick={() => setBukaRuang(false)} className="btn-modal-cancel">Batal</button><button type="button" onClick={simpanRuang} className="btn-modal-save"><Check /> Simpan</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Ruang di Jadwal Pelajaran dan Ruang Ujian sudah otomatis masuk. Tambahkan ruang lain (satu per baris):</p>
          <textarea rows={8} className="input-field" value={tambahan} onChange={e => setTambahan(e.target.value)} placeholder={"Aula\nMasjid\nLapangan\nRuang Rapat"} aria-label="Ruang tambahan" />
          <p className="text-xs text-gray-500">Saat ini: {data?.ruang.length ?? 0} ruang.</p>
        </div>
      </Modal>

      <FormPinjam buka={bukaAju} tutup={() => setBukaAju(false)} aset={data?.aset ?? []} ruang={data?.ruang ?? []} selesai={muat} />
    </div>
  );
}
