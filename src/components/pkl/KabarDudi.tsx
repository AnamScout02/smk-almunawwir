"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Loader2, Search, Check } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { BarisKembali } from "@/components/shared/TombolKembali";

type Dudi = { id: string; name: string; contactPerson: string | null; contactPhone: string | null; aktif: boolean; terisi: number };
const nomor = (s: string | null) => { const d = (s ?? "").replace(/\D/g, "").replace(/^0/, "62"); return /^62\d{8,13}$/.test(d) ? d : ""; };
const BAWAAN = "Assalamu'alaikum {narahubung}. Kami dari SMK Al-Munawwir IIBS, terkait siswa PKL di {nama} ({jumlah} siswa). ";

/** KABAR MASSAL KE DUDI (9 Okt 2026) — satu pesan, tombol WhatsApp per DUDI yang DITEKAN PETUGAS (situs tidak mengirim apa pun;
 *  pola yang sama dengan ajakan tracer, CLAUDE.md #135). "Sudah dikabari" hanya penanda di peramban petugas. */
export default function KabarDudi() {
  const [d, setD] = useState<Dudi[] | null>(null);
  const [pesan, setPesan] = useState(BAWAAN);
  const [cari, setCari] = useState("");
  const [hanyaAda, setHanyaAda] = useState(true);
  const [sudah, setSudah] = useState<Set<string>>(new Set());
  useEffect(() => { fetch("/api/pkl/dudi").then(r => r.json()).then(x => setD(x.dudi ?? [])).catch(() => setD([])); }, []);
  const isi = (x: Dudi) => pesan.replaceAll("{nama}", x.name).replaceAll("{narahubung}", x.contactPerson || "Bapak/Ibu").replaceAll("{jumlah}", String(x.terisi));
  const q = cari.trim().toLowerCase();
  const tampil = (d ?? []).filter(x => x.aktif && (!hanyaAda || x.terisi > 0) && (!q || x.name.toLowerCase().includes(q)));
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MessageCircle size={22} />} title="Kabar ke DUDI" description="Satu pesan untuk banyak DUDI, dikirim lewat WhatsApp Anda sendiri" />
      <BarisKembali href="/pusat-pkl/dudi" />
      <div className="space-y-6">
        <div className="panel p-5">
          <label className="label-field">Isi pesan</label>
          <textarea className="input-field" rows={4} value={pesan} onChange={e => setPesan(e.target.value)} />
          <p className="mt-2 text-xs text-gray-500">Terisi sendiri per DUDI: <code>{"{nama}"}</code> nama DUDI, <code>{"{narahubung}"}</code> nama narahubung, <code>{"{jumlah}"}</code> jumlah siswa yang sedang PKL di sana.</p>
        </div>
        <div className="baris-alat">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari DUDI" /></div>
          <label className="alat-saring flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={hanyaAda} onChange={e => setHanyaAda(e.target.checked)} /> Hanya DUDI yang sedang ditempati siswa</label>
        </div>
        <div className="panel overflow-hidden">
          {!d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            : tampil.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada DUDI pada saringan ini.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>DUDI</th><th>Narahubung</th><th className="text-right">Siswa</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>{tampil.map((x, i) => {
                    const n = nomor(x.contactPhone);
                    return (
                      <tr key={x.id}>
                        <td className="angka">{i + 1}</td>
                        <td className="font-medium text-primary-900">{x.name}</td>
                        <td className="text-gray-600">{x.contactPerson || "—"}<span className="angka block text-xs text-gray-400">{x.contactPhone || "nomor belum diisi"}</span></td>
                        <td className="angka text-right">{x.terisi}</td>
                        <td><div className="flex items-center justify-end gap-2">
                          {sudah.has(x.id) && <span className="flex items-center gap-1 text-xs text-emerald-700"><Check size={14} /> dibuka</span>}
                          {n ? <a href={`https://wa.me/${n}?text=${encodeURIComponent(isi(x))}`} target="_blank" rel="noreferrer" onClick={() => setSudah(s => new Set(s).add(x.id))} className="btn-modal-save px-3 text-xs"><MessageCircle size={14} /> WhatsApp</a>
                            : <span className="text-xs text-gray-400">nomor WA tidak sah</span>}
                        </div></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
