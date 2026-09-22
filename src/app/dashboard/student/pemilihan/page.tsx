"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Vote } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

interface Calon { id: string; nomor: number; ketua: string; wakil: string | null; kelas: string | null; foto: string | null; visi: string; misi: string }
interface Pemilihan { id: string; judul: string; mulai: string; selesai: string; status: string; calon: Calon[]; sudahMemilih: string | null }
const waktu = (d: string) => new Date(d).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** PEMILIHAN OSIS — halaman siswa (17 Sep 2026). Satu siswa satu suara; pilihan dirahasiakan. */
export default function PemilihanSiswaPage() {
  const toast = useToast();
  const [data, setData] = useState<Pemilihan[] | null>(null);
  const [pilih, setPilih] = useState<{ p: Pemilihan; c: Calon } | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/student/pemilihan", { cache: "no-store" }).then(r => r.json()).then(d => setData(Array.isArray(d) ? d : [])).catch(() => setData([]));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim() {
    if (!pilih) return;
    setMengirim(true);
    const r = await fetch("/api/student/pemilihan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pemilihanId: pilih.p.id, calonId: pilih.c.id }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirim(false);
    if (!r?.ok) { toast.error(d?.error ?? "Suara gagal dikirim."); return; }
    toast.success("Terima kasih, suaramu sudah tercatat.");
    setPilih(null); muat();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Vote size={22} />} title="Pemilihan OSIS" description="Gunakan hak pilihmu — satu siswa satu suara, pilihanmu dirahasiakan" />
      {!data ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : data.length === 0 ? <EmptyState icon={Vote} title="Belum ada pemilihan" description="Pemilihan OSIS yang dibuka untuk kelasmu akan tampil di sini." />
        : data.map(p => (
          <div key={p.id} className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-bold text-primary-900">{p.judul}</h2>
              <span className="text-xs text-gray-500">{waktu(p.mulai)} – {waktu(p.selesai)} WIB</span>
            </div>
            {p.sudahMemilih ? (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={16} /> Kamu sudah memilih pada {waktu(p.sudahMemilih)}. Terima kasih!</p>
            ) : p.status !== "BUKA" ? (
              <p className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">{p.status === "BELUM_MULAI" ? "Pemilihan belum dimulai." : "Pemilihan sudah ditutup."}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {p.calon.map(c => (
                <div key={c.id} className="panel overflow-hidden flex flex-col">
                  <div className="relative aspect-[4/3] bg-primary-50">
                    {c.foto
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.foto} alt={`Calon nomor ${c.nomor}`} className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-5xl font-bold text-primary-100">{c.nomor}</div>}
                    <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-900 font-heading text-lg font-bold text-white">{c.nomor}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-heading font-bold text-primary-900">{c.ketua}{c.wakil ? ` & ${c.wakil}` : ""}</p>
                    {c.kelas && <p className="text-xs text-gray-500">{c.kelas}</p>}
                    <p className="mt-2 text-sm text-gray-700"><strong>Visi:</strong> {c.visi}</p>
                    {c.misi && <ul className="mt-1 list-disc pl-5 text-sm text-gray-600">{c.misi.split("\n").filter(Boolean).map((m, i) => <li key={i}>{m}</li>)}</ul>}
                    {p.status === "BUKA" && !p.sudahMemilih && (
                      <button type="button" onClick={() => setPilih({ p, c })} className="btn-modal-save mt-4 w-full"><Vote size={15} /> Pilih Nomor {c.nomor}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      <Modal open={!!pilih} onClose={() => !mengirim && setPilih(null)} title="Konfirmasi pilihan"
        footer={<><button type="button" onClick={() => setPilih(null)} disabled={mengirim} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={kirim} disabled={mengirim} className="btn-modal-save">{mengirim ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Ya, kirim suara</button></>}>
        {pilih && <p className="text-sm text-gray-700">Kamu memilih <strong>nomor {pilih.c.nomor} — {pilih.c.ketua}{pilih.c.wakil ? ` & ${pilih.c.wakil}` : ""}</strong>. Suara tidak bisa diubah setelah dikirim.</p>}
      </Modal>
    </div>
  );
}
