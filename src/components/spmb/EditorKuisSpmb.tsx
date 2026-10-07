"use client";
import { useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import type { SoalBank } from "@/lib/kuis-jurusan";

type Kirim = (url: string, method: string, body?: unknown) => Promise<boolean>;
type Toast = { success: (m: string) => void; error: (m: string) => void };
type Jurusan = { id: string; name: string; code: string };

function bacaBank(teks: string | undefined): SoalBank[] {
  try { const v = JSON.parse(teks || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}

/** Bank soal Kuis Minat Jurusan (6 Okt 2026). Satu soal = satu situasi umum; tiap kolom jurusan = pilihan jawaban
 *  yang mengarah ke jurusan itu (kosong = jurusan itu tidak muncul di soal ini). Di situs tampil N soal ACAK. */
export default function EditorKuisSpmb({ setelan, jurusan, sibuk, kirim, toast }: {
  setelan: Record<string, string>; jurusan: Jurusan[]; sibuk: boolean; kirim: Kirim; toast: Toast;
}) {
  const confirm = useConfirm();
  const [bank, setBank] = useState<SoalBank[]>(() => bacaBank(setelan["spmb.kuis"]));
  const [jumlah, setJumlah] = useState(setelan["spmb.kuisJumlah"] || "8");
  const teksPilihan = (s: SoalBank, kode: string) => s.pilihan.find(p => p.kode === kode)?.teks ?? "";
  const ubahPilihan = (i: number, kode: string, teks: string) => setBank(b => b.map((s, k) => k !== i ? s : {
    ...s, pilihan: [...s.pilihan.filter(p => p.kode !== kode), ...(teks ? [{ kode, teks }] : [])],
  }));
  const cakupan = jurusan.map(j => ({ ...j, n: bank.filter(s => teksPilihan(s, j.code).trim()).length }));

  async function simpan() {
    const bersih = bank.map(s => ({ ...s, tanya: s.tanya.trim(), pilihan: s.pilihan.map(p => ({ ...p, teks: p.teks.trim() })).filter(p => p.teks) }))
      .filter(s => s.tanya && s.pilihan.length >= 2);
    if (await kirim("/api/spmb/pengaturan", "PUT", { "spmb.kuis": JSON.stringify(bersih), "spmb.kuisJumlah": String(Math.max(3, Math.min(20, Number(jumlah) || 8))) })) {
      toast.success(`Bank soal tersimpan (${bersih.length} soal)`);
    }
  }

  return (
    <>
      <div className="panel space-y-4 p-5">
        <div>
          <p className="panel-judul">Bank soal Kuis Minat Jurusan</p>
          <p className="text-sm text-gray-500">
            Tulis soal berupa situasi umum, lalu isi satu pilihan jawaban untuk tiap jurusan. Setiap kali calon membuka kuis,
            soal diambil ACAK dari bank ini dan urutan pilihannya juga diacak. Kolom jurusan yang dikosongkan berarti jurusan itu
            tidak muncul di soal tersebut. Bank kosong = kuis memakai soal otomatis dari data jurusan.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="label-field">Soal per kuis</label>
            <input className="input-field angka" inputMode="numeric" value={jumlah} onChange={e => setJumlah(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-gray-500">Total {bank.length} soal ·</span>
            {cakupan.map(j => (
              <span key={j.code} className={`status-badge ${j.n >= 10 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                {j.code}: {j.n} pilihan
              </span>
            ))}
          </div>
        </div>
      </div>

      {bank.map((s, i) => (
        <div key={s.id} className="panel space-y-3 p-5">
          <div className="flex items-start gap-2">
            <span className="angka mt-2.5 w-6 shrink-0 text-sm text-gray-400">{i + 1}.</span>
            <input className="input-field flex-1 font-medium" value={s.tanya} placeholder="Kalau ada waktu luang, kamu paling suka…"
              onChange={e => setBank(b => b.map((x, k) => (k === i ? { ...x, tanya: e.target.value } : x)))} />
            <button type="button" title="Hapus" onClick={async () => { if (await confirm("Hapus soal ini?")) setBank(b => b.filter((_, k) => k !== i)); }}
              className="mt-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
          <div className="grid grid-cols-1 gap-2 pl-8 md:grid-cols-2">
            {jurusan.map(j => (
              <div key={j.code} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-semibold text-primary-700">{j.code}</span>
                <input className="input-field flex-1" value={teksPilihan(s, j.code)} placeholder={`Pilihan yang mengarah ke ${j.name}`}
                  onChange={e => ubahPilihan(i, j.code, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => setBank(b => [...b, { id: `k${Date.now().toString(36)}`, tanya: "", pilihan: [] }])} className="btn-modal-cancel btn-teks">
          <Plus size={16} /> Tambah Soal
        </button>
        <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
        </button>
      </div>
    </>
  );
}
