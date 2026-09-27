"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Hammer, Loader2, Plus, Send, Wrench, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import ImageUpload from "@/components/admin/ImageUpload";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PRIORITAS, STATUS_PINJAM, STATUS_RUSAK, WaktuPilih, hariIniWib, keIso, rentang, tgl } from "@/components/sarpras/sarpras-umum";

interface Aset { id: string; name: string; category: string; location: string | null; quantity: number }
interface Laporan { id: string; judul: string | null; lokasi: string | null; description: string; status: string; prioritas: string; reportDate: string; repairNotes: string | null; fotoUrl: string | null; asset: { name: string } | null }
interface Pinjam { id: string; jenis: string; ruang: string | null; jumlah: number; keperluan: string; mulai: string; selesai: string; status: string; catatan: string | null; diputuskanOleh: string | null; asset: { name: string } | null }

/** Formulir lapor kerusakan — juga dipakai halaman detail aset (aset sudah terpilih). */
export function FormLaporKerusakan({ buka, tutup, aset, asetTetap, selesai }: {
  buka: boolean; tutup: () => void; aset: Aset[]; asetTetap?: Aset | null; selesai: () => void;
}) {
  const toast = useToast();
  const kosong = { assetId: asetTetap?.id ?? "", judul: "", lokasi: asetTetap?.location ?? "", description: "", prioritas: "SEDANG", fotoUrl: "" };
  const [f, setF] = useState(kosong);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => { if (buka) setF({ assetId: asetTetap?.id ?? "", judul: "", lokasi: asetTetap?.location ?? "", description: "", prioritas: "SEDANG", fotoUrl: "" }); }, [buka, asetTetap]);
  async function kirim() {
    setSibuk(true);
    const r = await fetch("/api/sarpras/kerusakan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal mengirim."); return; }
    toast.success("Laporan terkirim ke pengelola Sarpras.");
    tutup(); selesai();
  }
  const terpilih = aset.find(a => a.id === f.assetId);
  return (
    <Modal open={buka} onClose={() => !sibuk && tutup()} title="Lapor kerusakan" size="lg" scrollBody
      footer={<>
        <button type="button" onClick={tutup} disabled={sibuk} className="btn-modal-cancel">Batal</button>
        <button type="button" onClick={kirim} disabled={sibuk || f.description.trim().length < 5 || (!f.assetId && (!f.judul.trim() || !f.lokasi.trim()))} className="btn-modal-save">
          {sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim Laporan
        </button>
      </>}>
      <div className="space-y-4">
        {asetTetap ? (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm"><span className="font-semibold text-primary-900">{asetTetap.name}</span> <span className="text-gray-500">· {asetTetap.location ?? asetTetap.category}</span></p>
        ) : (
          <>
            <div>
              <label className="label-field">Barang terdaftar (opsional)</label>
              <Select value={f.assetId} onChange={v => { const a = aset.find(x => x.id === v); setF(p => ({ ...p, assetId: v, lokasi: a?.location ?? p.lokasi })); }}
                placeholder="Pilih bila barangnya ada di inventaris"
                options={[{ value: "", label: "— Tidak ada di daftar —" }, ...aset.map(a => ({ value: a.id, label: `${a.name}${a.location ? ` — ${a.location}` : ""}` }))]} />
            </div>
            {!terpilih && (
              <div>
                <label htmlFor="judul-rusak" className="label-field">Barang/fasilitas yang rusak *</label>
                <input id="judul-rusak" className="input-field" maxLength={150} value={f.judul} onChange={e => setF(p => ({ ...p, judul: e.target.value }))} placeholder="mis. Proyektor, kran air, kipas angin, atap bocor" />
              </div>
            )}
            <div>
              <label htmlFor="lokasi-rusak" className="label-field">Lokasi {terpilih ? "" : "*"}</label>
              <input id="lokasi-rusak" className="input-field" maxLength={150} value={f.lokasi} onChange={e => setF(p => ({ ...p, lokasi: e.target.value }))} placeholder="mis. Kelas XI TKJ 1, Lab Komputer 2, toilet putra lantai 2" />
            </div>
          </>
        )}
        <div>
          <label htmlFor="uraian-rusak" className="label-field">Uraian kerusakan *</label>
          <textarea id="uraian-rusak" rows={4} maxLength={2000} className="input-field" value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} placeholder="Apa yang rusak dan sejak kapan" />
        </div>
        <div>
          <label className="label-field">Tingkat kepentingan</label>
          <Select value={f.prioritas} onChange={v => setF(p => ({ ...p, prioritas: v }))} options={Object.entries(PRIORITAS).map(([value, label]) => ({ value, label }))} />
        </div>
        <ImageUpload value={f.fotoUrl} onChange={v => setF(p => ({ ...p, fotoUrl: v }))} folder="sarpras" label="Foto kerusakan (opsional)" hint="JPG/PNG/WEBP maks. 5MB — dari kamera HP juga bisa" />
      </div>
    </Modal>
  );
}

/** Formulir pinjam barang / pesan ruang — dipakai halaman ini & detail aset. */
export function FormPinjam({ buka, tutup, aset, ruang, asetTetap, selesai }: {
  buka: boolean; tutup: () => void; aset: Aset[]; ruang: string[]; asetTetap?: Aset | null; selesai: () => void;
}) {
  const toast = useToast();
  const awal = () => ({ jenis: asetTetap ? "BARANG" : "RUANG", ruang: "", assetId: asetTetap?.id ?? "", jumlah: "1", keperluan: "", tMulai: hariIniWib(), jMulai: "07:00", tSelesai: hariIniWib(), jSelesai: "09:00", catatan: "" });
  const [f, setF] = useState(awal);
  const [sibuk, setSibuk] = useState(false);
  const [pakai, setPakai] = useState<{ mulai: string; selesai: string; peminjamNama: string; keperluan: string; status: string }[] | null>(null);
  useEffect(() => { if (buka) { setF(awal()); setPakai(null); } }, [buka]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!buka || f.jenis !== "RUANG" || !f.ruang) { setPakai(null); return; }
    const dari = keIso(f.tMulai, "00:00"), sampai = new Date(new Date(keIso(f.tMulai, "00:00")).getTime() + 7 * 86400000).toISOString();
    fetch(`/api/sarpras/peminjaman?ruang=${encodeURIComponent(f.ruang)}&dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`, { cache: "no-store" })
      .then(r => r.json()).then(d => setPakai(d.pakai ?? [])).catch(() => setPakai(null));
  }, [buka, f.jenis, f.ruang, f.tMulai]);
  async function kirim() {
    setSibuk(true);
    const body = { jenis: f.jenis, ruang: f.ruang, assetId: f.assetId, jumlah: Number(f.jumlah), keperluan: f.keperluan, catatan: f.catatan, mulai: keIso(f.tMulai, f.jMulai), selesai: keIso(f.tSelesai, f.jSelesai) };
    const r = await fetch("/api/sarpras/peminjaman", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal mengirim."); return; }
    toast.success("Permohonan terkirim — tunggu persetujuan pengelola.");
    tutup(); selesai();
  }
  const barang = aset.find(a => a.id === f.assetId);
  return (
    <Modal open={buka} onClose={() => !sibuk && tutup()} title={f.jenis === "RUANG" ? "Pesan ruang" : "Pinjam barang"} size="lg" scrollBody
      footer={<>
        <button type="button" onClick={tutup} disabled={sibuk} className="btn-modal-cancel">Batal</button>
        <button type="button" onClick={kirim} disabled={sibuk || f.keperluan.trim().length < 3 || (f.jenis === "RUANG" ? !f.ruang : !f.assetId)} className="btn-modal-save">
          {sibuk ? <Loader2 className="animate-spin" /> : <Send />} Ajukan
        </button>
      </>}>
      <div className="space-y-4">
        {!asetTetap && (
          <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
            {[["RUANG", "Pesan ruang"], ["BARANG", "Pinjam barang"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setF(p => ({ ...p, jenis: k }))}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${f.jenis === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
        )}
        {f.jenis === "RUANG" ? (
          <div><label className="label-field">Ruang *</label><Select value={f.ruang} onChange={v => setF(p => ({ ...p, ruang: v }))} placeholder="Pilih ruang" options={ruang.map(r => ({ value: r, label: r }))} /></div>
        ) : asetTetap ? (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm"><span className="font-semibold text-primary-900">{asetTetap.name}</span> <span className="text-gray-500">· {asetTetap.quantity} unit</span></p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
            <div><label className="label-field">Barang *</label><Select value={f.assetId} onChange={v => setF(p => ({ ...p, assetId: v }))} placeholder="Pilih barang" options={aset.map(a => ({ value: a.id, label: `${a.name} (${a.quantity})${a.location ? ` — ${a.location}` : ""}` }))} /></div>
            <div><label htmlFor="jumlah-pinjam" className="label-field">Jumlah</label><input id="jumlah-pinjam" type="number" min={1} max={barang?.quantity ?? 99} className="input-field" value={f.jumlah} onChange={e => setF(p => ({ ...p, jumlah: e.target.value }))} /></div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WaktuPilih id="jam-mulai" label="Mulai" tanggal={f.tMulai} jam={f.jMulai} onTanggal={v => setF(p => ({ ...p, tMulai: v, tSelesai: p.tSelesai < v ? v : p.tSelesai }))} onJam={v => setF(p => ({ ...p, jMulai: v }))} />
          <WaktuPilih id="jam-selesai" label="Selesai" tanggal={f.tSelesai} jam={f.jSelesai} onTanggal={v => setF(p => ({ ...p, tSelesai: v }))} onJam={v => setF(p => ({ ...p, jSelesai: v }))} />
        </div>
        {pakai && (
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-xs font-semibold text-gray-600">Pemakaian {f.ruang} 7 hari ke depan</p>
            {pakai.length === 0 ? <p className="mt-1 text-sm text-emerald-700">Belum ada pemesanan lain.</p> : (
              <ul className="mt-1 space-y-1 text-xs text-gray-600">
                {pakai.map((p, i) => <li key={i}>{rentang(p.mulai, p.selesai)} · {p.peminjamNama} — {p.keperluan} <span className="text-gray-400">({STATUS_PINJAM[p.status]?.label})</span></li>)}
              </ul>
            )}
            <p className="mt-1 text-xs text-gray-400">Jadwal pelajaran di ruang itu juga diperiksa saat mengajukan.</p>
          </div>
        )}
        <div>
          <label htmlFor="keperluan-pinjam" className="label-field">Keperluan *</label>
          <input id="keperluan-pinjam" className="input-field" maxLength={300} value={f.keperluan} onChange={e => setF(p => ({ ...p, keperluan: e.target.value }))} placeholder="mis. Rapat MGMP, praktik XII TKJ, lomba" />
        </div>
        <div>
          <label htmlFor="catatan-pinjam" className="label-field">Catatan (opsional)</label>
          <input id="catatan-pinjam" className="input-field" maxLength={300} value={f.catatan} onChange={e => setF(p => ({ ...p, catatan: e.target.value }))} placeholder="mis. perlu sound system" />
        </div>
      </div>
    </Modal>
  );
}

/** LAYANAN SARPRAS (semua guru & staf, 17 Sep 2026): lapor kerusakan berfoto dan pinjam barang / pesan ruang. */
export default function LayananSarprasManager() {
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<"rusak" | "pinjam">("rusak");
  const [laporan, setLaporan] = useState<Laporan[] | null>(null);
  const [pinjam, setPinjam] = useState<{ daftar: Pinjam[]; aset: Aset[]; ruang: string[] } | null>(null);
  const [bukaRusak, setBukaRusak] = useState(false);
  const [bukaPinjam, setBukaPinjam] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/sarpras/kerusakan", { cache: "no-store" }).then(r => r.json()).then(d => setLaporan(d.daftar ?? [])).catch(() => setLaporan([]));
    fetch("/api/sarpras/peminjaman", { cache: "no-store" }).then(r => r.json()).then(d => setPinjam({ daftar: d.daftar ?? [], aset: d.aset ?? [], ruang: d.ruang ?? [] })).catch(() => setPinjam({ daftar: [], aset: [], ruang: [] }));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function batal(p: Pinjam) {
    if (!(await confirm("Batalkan permohonan ini?"))) return;
    const r = await fetch(`/api/sarpras/peminjaman/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "batal" }) }).catch(() => null);
    if (r?.ok) { toast.success("Permohonan dibatalkan."); muat(); } else toast.error("Gagal membatalkan.");
  }

  const aset = useMemo(() => pinjam?.aset ?? [], [pinjam]);
  const memuat = !laporan || !pinjam;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wrench size={22} />} title="Layanan Sarpras" description="Laporkan kerusakan fasilitas, pinjam barang, atau pesan ruang" />
      <div className="baris-alat mb-5">
        <div className="alat-tab flex gap-1 rounded-xl border border-gray-100 bg-white p-1">
          {([["rusak", "Laporan Kerusakan"], ["pinjam", "Peminjaman & Ruang"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
        <div className="alat-aksi">
          <button type="button" onClick={() => setBukaRusak(true)} className="btn-modal-cancel btn-teks"><Hammer /> Lapor Kerusakan</button>
          <button type="button" onClick={() => setBukaPinjam(true)} className="btn-modal-save btn-teks"><Plus /> Pinjam / Pesan Ruang</button>
        </div>
      </div>
      {memuat ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : tab === "rusak" ? (
          laporan.length === 0 ? <EmptyState icon={Hammer} title="Belum ada laporan" description="Laporan kerusakan yang Anda kirim beserta perkembangannya tampil di sini." /> : (
            <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
              {laporan.map(l => (
                <li key={l.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary-900">{l.asset?.name ?? l.judul}</p>
                    {l.lokasi && <span className="text-xs text-gray-500">· {l.lokasi}</span>}
                    <span className={`status-badge ${STATUS_RUSAK[l.status]?.kelas}`}>{STATUS_RUSAK[l.status]?.label ?? l.status}</span>
                    {l.prioritas === "TINGGI" && <span className="status-badge bg-red-50 text-red-600 border-red-200">Mendesak</span>}
                    <span className="ml-auto text-xs text-gray-500">{tgl(l.reportDate)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{l.description}</p>
                  {l.repairNotes && <p className="mt-1 text-xs text-emerald-800">Tindak lanjut: {l.repairNotes}</p>}
                  {l.fotoUrl && <a href={l.fotoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-primary-700 hover:underline">Lihat foto</a>}
                </li>
              ))}
            </ul></div>
          )
        ) : (
          pinjam.daftar.length === 0 ? <EmptyState icon={CalendarClock} title="Belum ada permohonan" description="Pesan ruang (aula, lab, kelas) atau pinjam barang (proyektor, sound system) lewat tombol di atas." /> : (
            <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
              {pinjam.daftar.map(p => (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary-900">{p.jenis === "RUANG" ? `Ruang ${p.ruang}` : `${p.asset?.name ?? "Barang"}${p.jumlah > 1 ? ` × ${p.jumlah}` : ""}`}</p>
                    <span className={`status-badge ${STATUS_PINJAM[p.status]?.kelas}`}>{STATUS_PINJAM[p.status]?.label ?? p.status}</span>
                    <span className="ml-auto text-xs text-gray-500">{rentang(p.mulai, p.selesai)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{p.keperluan}</p>
                  {(p.catatan || p.diputuskanOleh) && <p className="mt-1 text-xs text-gray-500">{p.catatan}{p.diputuskanOleh ? ` — ${p.diputuskanOleh}` : ""}</p>}
                  {["MENUNGGU", "DISETUJUI"].includes(p.status) && (
                    <button type="button" onClick={() => batal(p)} className="btn-modal-cancel mt-2 px-3 text-xs"><X /> Batalkan</button>
                  )}
                </li>
              ))}
            </ul></div>
          )
        )}
      <FormLaporKerusakan buka={bukaRusak} tutup={() => setBukaRusak(false)} aset={aset} selesai={muat} />
      <FormPinjam buka={bukaPinjam} tutup={() => setBukaPinjam(false)} aset={aset} ruang={pinjam?.ruang ?? []} selesai={muat} />
    </div>
  );
}

