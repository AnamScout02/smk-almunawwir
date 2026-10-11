"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Loader2, Pencil, Save, ShieldCheck, Unlink } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { salinTeks } from "@/lib/salin-teks";

interface Ekskul { id: string; nama: string; jenis: string; anggota: number; jadwalRutin: string | null; hariRutin: number[]; bukaDaftar: boolean; kuota: number | null; deskripsi: string | null; pembinaAkun: string[]; pembinaLuar: string | null; pembinaKontak: string | null; adaTautan: boolean }
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const wa = (no: string) => { const d = no.replace(/\D/g, ""); return d.startsWith("0") ? `62${d.slice(1)}` : d; };

/** PEMBINA & TAUTAN — khusus koordinator: jenis kegiatan (ekstra/intra), pembina dari luar sekolah, dan tautan absensinya.
 *  Pembina yang guru/staf sekolah diatur lewat jabatan "Pembina <nama ekskul>" di menu Jabatan — bukan di sini. */
export default function PembinaEkstraManager() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<{ kelola: boolean; ekskul: Ekskul[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [ubah, setUbah] = useState<Ekskul | null>(null);
  const [isi, setIsi] = useState({ jenis: "EKSTRA", pembinaNama: "", pembinaKontak: "", jadwalRutin: "", hariRutin: [] as number[], bukaDaftar: true, kuota: "", deskripsi: "" });
  const [sibuk, setSibuk] = useState("");
  const [tautan, setTautan] = useState<{ ekskul: Ekskul; url: string } | null>(null);

  const muat = useCallback(() => {
    fetch("/api/ekstra/ringkasan", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat."); else setD(j); })
      .catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!ubah) return;
    setSibuk("simpan");
    const r = await fetch(`/api/ekstra/${ubah.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) }).catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error((await r?.json().catch(() => null))?.error ?? "Gagal menyimpan."); return; }
    toast.success("Tersimpan."); setUbah(null); muat();
  }
  async function buatTautan(e: Ekskul) {
    if (e.adaTautan && !(await confirm(`Buat tautan baru untuk ${e.nama}? Tautan lama langsung tidak berlaku.`))) return;
    setSibuk(e.id);
    const r = await fetch(`/api/ekstra/${e.id}/tautan`, { method: "POST" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok || !j?.url) { toast.error(j?.error ?? "Tautan gagal dibuat."); return; }
    setTautan({ ekskul: e, url: j.url }); muat();
  }
  async function cabut(e: Ekskul) {
    if (!(await confirm(`Cabut tautan pembina ${e.nama}? Pembina tidak bisa lagi mengabsen lewat tautan itu.`))) return;
    setSibuk(e.id);
    const r = await fetch(`/api/ekstra/${e.id}/tautan`, { method: "DELETE" }).catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error("Gagal mencabut tautan."); return; }
    toast.success("Tautan dicabut."); muat();
  }

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div>;
  if (!d.kelola) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><PageHeader icon={<ShieldCheck size={22} />} title="Pembina & Tautan" /><p className="py-10 text-center text-sm text-gray-400">Halaman ini khusus Koordinator Ekstrakurikuler.</p></div>;
  const pesan = tautan ? `Assalamu'alaikum. Berikut tautan absensi ${tautan.ekskul.nama} SMK Al-Munawwir IIBS. Buka setiap selesai latihan untuk mengisi kehadiran, kegiatan, dan foto:\n${tautan.url}\nMohon tautan ini tidak dibagikan ke orang lain.` : "";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldCheck size={22} />} title="Pembina & Tautan" description="Pembina tiap ekstrakurikuler dan tautan absensi untuk pembina dari luar sekolah" />
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Pembina yang guru atau staf sekolah cukup diberi jabatan <b>&ldquo;Pembina [nama ekskul]&rdquo;</b> di menu Jabatan — ia masuk dengan akunnya sendiri.
          Pembina dari <b>luar sekolah</b> tidak diberi akun: buatkan tautan di sini lalu kirim lewat WhatsApp. Lewat tautan itu ia hanya bisa mengisi absensi, kegiatan, dan foto <b>hari itu</b> untuk ekskulnya.
        </div>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Kegiatan</th><th>Pembina (akun sekolah)</th><th>Pembina luar sekolah</th><th>Jadwal rutin</th><th>Tautan absensi</th><th className="text-right">Aksi</th></tr></thead>
              <tbody>
                {d.ekskul.map((e, i) => (
                  <tr key={e.id}>
                    <td className="angka text-gray-400">{i + 1}</td>
                    <td><span className="font-semibold text-primary-900">{e.nama}</span><span className="block text-xs text-gray-400">{e.jenis === "INTRA" ? "Organisasi intra" : "Ekstrakurikuler"} · <span className="angka">{e.anggota}</span> anggota</span></td>
                    <td className="text-sm">{e.pembinaAkun.join(", ") || <span className="text-gray-400">—</span>}</td>
                    <td className="text-sm">{e.pembinaLuar ? <>{e.pembinaLuar}{e.pembinaKontak && <span className="angka block text-xs text-gray-400">{e.pembinaKontak}</span>}</> : <span className="text-gray-400">—</span>}</td>
                    <td className="text-sm text-gray-600">{e.jadwalRutin || <span className="text-gray-400">—</span>}{e.hariRutin?.length > 0 && <span className="block text-xs text-gray-400">Pengingat: {e.hariRutin.map(h => HARI[h]).join(", ")}</span>}</td>
                    <td>{e.adaTautan ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Aktif</span> : <span className="status-badge bg-gray-50 text-gray-500 border-gray-200">Belum ada</span>}</td>
                    <td><div className="flex justify-end gap-1.5">
                      <button type="button" title="Ubah keterangan" onClick={() => { setUbah(e); setIsi({ jenis: e.jenis, pembinaNama: e.pembinaLuar ?? "", pembinaKontak: e.pembinaKontak ?? "", jadwalRutin: e.jadwalRutin ?? "", hariRutin: e.hariRutin ?? [], bukaDaftar: e.bukaDaftar !== false, kuota: e.kuota ? String(e.kuota) : "", deskripsi: e.deskripsi ?? "" }); }} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button type="button" disabled={sibuk === e.id} onClick={() => buatTautan(e)} className="btn-modal-cancel btn-teks px-3 text-xs">{sibuk === e.id ? <Loader2 className="animate-spin" /> : <Link2 />} {e.adaTautan ? "Tautan baru" : "Buat tautan"}</button>
                      {e.adaTautan && <button type="button" title="Cabut tautan" disabled={sibuk === e.id} onClick={() => cabut(e)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Unlink size={14} /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.ekskul.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada ekstrakurikuler. Tambahkan di menu Ekskul & Anggota.</p>}
        </div>
      </div>

      <Modal open={!!ubah} onClose={() => !sibuk && setUbah(null)} title="Keterangan Kegiatan" description={ubah?.nama} size="lg" scrollBody
        footer={<>
          <button type="button" onClick={() => setUbah(null)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpan} disabled={sibuk === "simpan"} className="btn-modal-save flex-1">{sibuk === "simpan" ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Jenis</label>
            <Select value={isi.jenis} onChange={v => setIsi(s => ({ ...s, jenis: v }))} options={[{ value: "EKSTRA", label: "Ekstrakurikuler" }, { value: "INTRA", label: "Organisasi intra (mis. OSIS)" }]} />
            <p className="mt-1 text-xs text-gray-500">Hanya penanda di portal ini. Di rapor, keikutsertaan siswa tetap tercantum pada tabel kegiatan ekstrakurikuler.</p></div>
          <div><label className="label-field" htmlFor="pe-nama">Pembina dari luar sekolah</label><input id="pe-nama" className="input-field" maxLength={120} value={isi.pembinaNama} onChange={e => setIsi(s => ({ ...s, pembinaNama: e.target.value }))} placeholder="Kosongkan bila pembinanya guru/staf sekolah" /></div>
          <div><label className="label-field" htmlFor="pe-kontak">Nomor WhatsApp pembina</label><input id="pe-kontak" className="input-field" inputMode="tel" maxLength={40} value={isi.pembinaKontak} onChange={e => setIsi(s => ({ ...s, pembinaKontak: e.target.value }))} placeholder="08…" /></div>
          <div><label className="label-field" htmlFor="pe-jadwal">Jadwal rutin</label><input id="pe-jadwal" className="input-field" maxLength={200} value={isi.jadwalRutin} onChange={e => setIsi(s => ({ ...s, jadwalRutin: e.target.value }))} placeholder="mis. Jumat 14.00–16.00, lapangan" /></div>
          <div><p className="label-field">Hari latihan rutin</p>
            <div className="flex flex-wrap gap-1.5">
              {HARI.map((h, i) => (
                <button key={h} type="button" aria-pressed={isi.hariRutin.includes(i)} onClick={() => setIsi(s => ({ ...s, hariRutin: s.hariRutin.includes(i) ? s.hariRutin.filter(x => x !== i) : [...s.hariRutin, i] }))}
                  className={`sentuh rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${isi.hariRutin.includes(i) ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{h}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Dipakai pengingat: bila hari latihan lewat tanpa absensi, koordinator dan pembina dikabari. Kosongkan bila jadwalnya tidak tetap.</p></div>
          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-primary-900"><input type="checkbox" checked={isi.bukaDaftar} onChange={e => setIsi(s => ({ ...s, bukaDaftar: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" /> Menerima pendaftaran dari siswa</label>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><label className="label-field" htmlFor="pe-kuota">Kuota anggota</label><input id="pe-kuota" className="input-field" inputMode="numeric" maxLength={4} value={isi.kuota} onChange={e => setIsi(s => ({ ...s, kuota: e.target.value.replace(/\D/g, "") }))} placeholder="Tanpa batas" /></div>
              <div className="sm:col-span-2"><label className="label-field" htmlFor="pe-desk">Keterangan untuk siswa</label><input id="pe-desk" className="input-field" maxLength={400} value={isi.deskripsi} onChange={e => setIsi(s => ({ ...s, deskripsi: e.target.value }))} placeholder="mis. Latihan dasar kepramukaan, terbuka untuk semua kelas" /></div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!tautan} onClose={() => setTautan(null)} title="Tautan Absensi Pembina" description={tautan?.ekskul.nama}
        footer={<button type="button" onClick={() => setTautan(null)} className="btn-modal-cancel flex-1">Tutup</button>}>
        {tautan && (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Tautan ini hanya ditampilkan <b>sekali</b>. Salin atau kirim sekarang; kalau hilang, buat tautan baru.</p>
            <p className="break-all rounded-xl border border-gray-100 bg-[#f5f6fa] px-3 py-2 text-sm text-primary-900">{tautan.url}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-modal-cancel flex-1" onClick={async () => { const ok = await salinTeks(tautan.url); if (ok) toast.success("Tautan disalin."); else toast.error("Gagal menyalin — salin manual dari kotak di atas."); }}><Copy /> Salin tautan</button>
              <a className="btn-modal-save flex-1" target="_blank" rel="noreferrer" href={`https://wa.me/${tautan.ekskul.pembinaKontak ? wa(tautan.ekskul.pembinaKontak) : ""}?text=${encodeURIComponent(pesan)}`}>Kirim lewat WhatsApp</a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
