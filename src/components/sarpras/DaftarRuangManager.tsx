"use client";
import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, Plus, Trash2, Search, Info, Pencil, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Data { ruang: string[]; tambahan?: string[] }

/** DAFTAR RUANG — SATU tempat mendaftarkan ruangan sekolah (25 September 2026, permintaan user:
 * "tambahkan ruang harusnya ada 1 tempat saja … dan itu bisa digunakan untuk ujian maupun TV").
 *
 * Sebelumnya nama ruang bisa lahir dari tiga tempat berbeda — kolom Ruang di Jadwal Pelajaran, Ruang Ujian, dan
 * ruang tambahan Sarpras — sehingga petugas bingung harus menambah di mana, dan satu ruangan bisa tertulis dua
 * versi ("Lab TKJ" vs "LAB TKJ"). Halaman ini menjadikannya satu pintu:
 *
 * - Ruang yang SUDAH terpakai di Jadwal Pelajaran atau terdaftar sebagai Ruang Ujian tetap ikut tampil (dan
 *   tidak bisa dihapus dari sini) — sumbernya memang modul itu, dan menghapusnya di sini akan merusak jadwal.
 * - Ruang yang belum ada di mana pun (Aula, Masjid, Ruang Rapat, Lapangan …) ditambahkan di sini.
 * - Seluruh modul lain — pemesanan ruang, Papan & TV, penempatan ruang ujian — membaca daftar yang sama. */
export default function DaftarRuangManager() {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [baru, setBaru] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [sunting, setSunting] = useState<{ lama: string; baru: string } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const muat = useCallback(() => fetch("/api/sarpras/ruang", { cache: "no-store" })
    .then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) setGalat(d?.error || "Gagal memuat"); else { setData(d); setGalat(""); }
    })
    .catch(() => setGalat("Gagal memuat")), []);

  useEffect(() => { muat(); }, [muat]);

  const simpanTambahan = async (daftar: string[]) => {
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/ruang", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tambahan: daftar }),
      });
      if (!r.ok) { const d = await r.json().catch(() => null); toast.error(d?.error || "Gagal menyimpan"); return false; }
      await muat();
      return true;
    } finally { setSibuk(false); }
  };

  const tambah = async () => {
    const nama = baru.trim();
    if (!nama || !data) return;
    if (data.ruang.some(r => r.toLowerCase() === nama.toLowerCase())) { toast.warning("Ruang dengan nama itu sudah ada."); return; }
    if (await simpanTambahan([...(data.tambahan ?? []), nama])) { setBaru(""); toast.success(`Ruang "${nama}" ditambahkan`); }
  };

  /* Nama ruang tersimpan di beberapa modul sekaligus; server yang mengganti semuanya dalam satu transaksi
     (lihat PATCH /api/sarpras/ruang). Di sini cukup mengirim nama lama & barunya. */
  const simpanNama = async () => {
    if (!sunting || !sunting.baru.trim() || sunting.baru.trim() === sunting.lama) { setSunting(null); return; }
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/ruang", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lama: sunting.lama, baru: sunting.baru.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal mengubah nama"); return; }
      const ikut = [d?.jadwal && `${d.jadwal} jadwal`, d?.ujian && `${d.ujian} ruang ujian`, d?.layar && `${d.layar} TV`, d?.pinjam && `${d.pinjam} pemesanan`].filter(Boolean).join(", ");
      toast.success(ikut ? `Nama ruang diubah — ikut terbarui di ${ikut}` : "Nama ruang diubah");
      setSunting(null); await muat();
    } finally { setSibuk(false); }
  };

  const hapus = async (nama: string) => {
    if (!data?.tambahan) return;
    if (!await confirm(`Hapus ruang "${nama}" dari daftar? Pemesanan atau layar yang sudah memakainya tidak ikut terhapus.`)) return;
    if (await simpanTambahan(data.tambahan.filter(t => t !== nama))) toast.success("Ruang dihapus");
  };

  if (!data && !galat) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{galat}</div>;

  const tambahan = data.tambahan ?? [];
  const q = cari.trim().toLowerCase();
  const tersaring = data.ruang.filter(r => !q || r.toLowerCase().includes(q));
  const bolehKelola = data.tambahan !== undefined;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<DoorOpen size={22} />} title="Daftar Ruang"
        description="Satu daftar ruangan sekolah — dipakai pemesanan ruang, penempatan ruang ujian, dan Papan & TV" />

      <div className="mb-5 flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info size={18} className="shrink-0 text-blue-600" />
        <span>
          <b>Semua nama ruang diubah dari sini.</b> Mengganti nama akan ikut memperbarui Jadwal Pelajaran, Ruang Ujian,
          Papan &amp; TV, dan pemesanan ruang sekaligus — jadi satu ruangan tidak pernah punya dua ejaan.
          Ruang yang berasal dari Jadwal atau Ruang Ujian tetap tidak bisa <i>dihapus</i> di sini (menghapusnya akan
          merusak jadwal); yang ditambahkan di sini adalah ruang di luar keduanya, misalnya Aula, Masjid, atau Lapangan.
        </span>
      </div>

      {bolehKelola && (
        <div className="baris-alat mb-5">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari ruang..." className="input-field pl-10" />
          </div>
          <div className="alat-saring">
            <input value={baru} onChange={e => setBaru(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") tambah(); }}
              placeholder="Nama ruang baru — mis. Aula" className="input-field" />
          </div>
          <div className="alat-aksi">
            <button type="button" disabled={sibuk || !baru.trim()} onClick={tambah} className="btn-modal-save"><Plus /> Tambah ruang</button>
          </div>
        </div>
      )}

      <Modal open={!!sunting} onClose={() => setSunting(null)} title="Ubah nama ruang" size="md"
        footer={<>
          <button type="button" onClick={() => setSunting(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || !sunting?.baru.trim()} onClick={simpanNama} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan
          </button>
        </>}>
        {sunting && (
          <div className="space-y-3">
            <div>
              <label className="label-field">Nama ruang</label>
              <input value={sunting.baru} autoFocus onChange={e => setSunting({ ...sunting, baru: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") simpanNama(); }} className="input-field" />
            </div>
            <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
              Nama <b>{sunting.lama}</b> akan diganti di <b>seluruh modul sekaligus</b> — Jadwal Pelajaran, Ruang Ujian,
              Papan &amp; TV, dan pemesanan ruang. Kalau salah satu gagal, tidak ada yang berubah.
            </p>
          </div>
        )}
      </Modal>

      <div className="panel overflow-hidden">
        {tersaring.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Belum ada ruang" description="Tambahkan ruang pertama lewat kotak di atas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Nama ruang</th><th>Sumber</th><th></th></tr></thead>
              <tbody>
                {tersaring.map(r => {
                  const milikSini = tambahan.includes(r);
                  return (
                    <tr key={r}>
                      <td className="font-medium text-primary-900">{r}</td>
                      <td>
                        <span className={`status-badge ${milikSini ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          {milikSini ? "Ditambahkan di sini" : "Jadwal / Ruang Ujian"}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {bolehKelola && (
                          <button onClick={() => setSunting({ lama: r, baru: r })} title="Ubah nama"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        )}
                        {bolehKelola && milikSini && (
                          <button onClick={() => hapus(r)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
