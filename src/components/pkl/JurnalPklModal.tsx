"use client";
import { useEffect, useState } from "react";
import { Calendar, Loader2, MessageSquare } from "lucide-react";
import Modal from "@/components/admin/Modal";
import LencanaFotoJurnal from "@/components/pkl/LencanaFotoJurnal";
import { tglPkl } from "@/lib/pkl-label";

type Entri = { id: string; date: string; activity: string; photoUrl: string | null; teacherNote: string | null; fotoTerverifikasi: boolean; fotoWaktu: string | null; kompetensi: string[]; lat: number | null; lng: number | null };

/** Jurnal harian satu siswa PKL untuk Humas — membaca, membuka foto, dan menulis catatan untuk siswa. */
export default function JurnalPklModal({ studentId, nama, tempat, onTutup }: { studentId: string; nama: string; tempat: string | null; onTutup: () => void }) {
  const [entri, setEntri] = useState<Entri[] | null>(null);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/admin/internships/${studentId}/journal`).then(r => r.json()).then(d => {
      const daftar: Entri[] = d.journal ?? [];
      setEntri(daftar);
      setCatatan(Object.fromEntries(daftar.map(e => [e.id, e.teacherNote ?? ""])));
    }).catch(() => setEntri([]));
  }, [studentId]);
  async function simpan(id: string) {
    setMenyimpan(id);
    await fetch(`/api/admin/internships/${studentId}/journal/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherNote: catatan[id] || "" }) }).catch(() => null);
    setMenyimpan(null);
  }
  return (
    <Modal open onClose={onTutup} size="lg" scrollBody title="Jurnal Harian PKL" description={`${nama}${tempat ? ` — ${tempat}` : ""}`}>
      {!entri ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : entri.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Siswa belum mengisi jurnal harian.</p>
      ) : (
        <>
          {entri.map(e => (
            <div key={e.id} className="flex gap-3 rounded-xl border border-gray-100 p-3">
              {e.photoUrl && (
                <a href={e.photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photoUrl} alt="" className="h-20 w-20 rounded-lg border border-gray-100 object-cover" />
                </a>
              )}
              <div className="min-w-0 flex-1">
                <p className="angka mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><Calendar size={12} /> {tglPkl(e.date)}</span>
                  <LencanaFotoJurnal ada={!!e.photoUrl} terverifikasi={e.fotoTerverifikasi} waktu={e.fotoWaktu} lokasi={e.lat != null} />
                  {e.lat != null && e.lng != null && <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-700 hover:underline">lihat lokasi</a>}
                </p>
                <p className="text-sm text-gray-700">{e.activity}</p>
                {e.kompetensi.length > 0 && <p className="mt-1 text-xs text-gray-500">Kompetensi: {e.kompetensi.join(", ")}</p>}
                <div className="mt-2 flex gap-2">
                  <input value={catatan[e.id] ?? ""} onChange={x => setCatatan(c => ({ ...c, [e.id]: x.target.value }))} placeholder="Catatan untuk siswa..." className="input-field" />
                  <button type="button" onClick={() => simpan(e.id)} disabled={menyimpan === e.id} className="btn-modal-cancel shrink-0">
                    {menyimpan === e.id ? <Loader2 className="animate-spin" /> : <MessageSquare />} Simpan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
