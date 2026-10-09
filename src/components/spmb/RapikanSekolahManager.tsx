"use client";
import { useCallback, useEffect, useState } from "react";
import { School, Loader2, Merge, Wand2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { kunciSekolah, type KelompokSekolah } from "@/lib/nama-sekolah";

type Data = { hak: { spmb: boolean; induk: boolean }; totalNama: number; kelompok: KelompokSekolah[] };

/** Rapikan nama sekolah asal (6 Okt 2026) — sistem menyarankan, panitia memutuskan (src/lib/nama-sekolah.ts).
 *  PASTI = penulisannya sama setelah dirapikan (kapital, singkatan, tanda hubung) → aman digabung sekaligus.
 *  MIRIP = dugaan salah ketik / berekor tempat → dicentang satu per satu oleh panitia. */
/** `awal` = tab pertama: "spmb" di Pusat SPMB, "induk" di halaman dashboard (8 Okt 2026 — fitur ini juga di luar SPMB). */
export default function RapikanSekolahManager({ awal = "spmb" }: { awal?: "spmb" | "induk" } = {}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [sumber, setSumber] = useState<"spmb" | "induk">(awal);
  const [d, setD] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    setMemuat(true);
    return fetch(`/api/spmb/sekolah-asal?sumber=${sumber}`).then(r => r.json())
      .then(x => { if (x?.kelompok) setD(x); else { setD(x?.hak ? { hak: x.hak, totalNama: 0, kelompok: [] } : null); } })
      .catch(() => {}).finally(() => setMemuat(false));
  }, [sumber]);
  useEffect(() => { muat(); }, [muat]);

  async function gabung(target: string, varian: string[], tanpaMuat = false) {
    const r = await fetch("/api/spmb/sekolah-asal", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sumber, target, varian }),
    }).catch(() => null);
    const x = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menggabungkan"); return 0; }
    if (!tanpaMuat) { toast.success(`${x.jumlah} data diseragamkan menjadi "${target}"`); await muat(); }
    return x.jumlah as number;
  }

  async function rapikanSemuaPasti() {
    const pasti = (d?.kelompok ?? []).filter(k => k.pasti);
    if (!pasti.length) return;
    if (!(await confirm(`Seragamkan ${pasti.length} kelompok yang PASTI sama (beda kapital/singkatan/tanda hubung saja)? Kelompok "mirip" tidak disentuh.`))) return;
    setSibuk(true);
    let total = 0;
    for (const k of pasti) total += await gabung(k.saran, k.varian.map(v => v.nama), true);
    setSibuk(false);
    toast.success(`${total} data diseragamkan`);
    muat();
  }

  const pasti = d?.kelompok.filter(k => k.pasti).length ?? 0;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<School size={22} />} title="Rapikan Nama Sekolah"
        description="Satukan penulisan sekolah asal yang sama — beda kapital, singkatan (SMPN / SMP Negeri), tanda hubung, atau salah ketik" />
      <div className="space-y-6">
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {([["spmb", "Pendaftar SPMB"], ["induk", "Buku Induk Siswa"]] as const).filter(([k]) => !d || d.hak[k]).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSumber(k)}
                className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${sumber === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
          {pasti > 0 && (
            <div className="alat-aksi">
              <button type="button" disabled={sibuk} onClick={rapikanSemuaPasti} className="btn-modal-save btn-teks">
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Rapikan {pasti} yang Pasti Sama
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500">
          <span className="status-badge mr-1 bg-emerald-50 text-emerald-700 border-emerald-200">Pasti sama</span> beda kapital, singkatan, atau tanda hubung saja.{" "}
          <span className="status-badge mx-1 bg-amber-50 text-amber-700 border-amber-200">Mirip</span> dugaan salah ketik atau berekor nama tempat — periksa dulu, centang yang memang sekolah yang sama.
          {sumber === "induk" && " Perubahan di Buku Induk mengubah data resmi siswa dan tercatat di log aktivitas."}
        </p>

        {memuat ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        ) : !d || d.kelompok.length === 0 ? (
          <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Semua nama sekolah asal sudah rapi.</p></div>
        ) : (
          <>
            <p className="text-sm text-gray-500">{d.totalNama} penulisan berbeda · {d.kelompok.length} kelompok perlu dirapikan</p>
            {d.kelompok.map(k => <KartuKelompok key={k.varian.map(v => v.nama).join("|")} k={k} gabung={gabung} />)}
          </>
        )}
      </div>
    </div>
  );
}

function KartuKelompok({ k, gabung }: { k: KelompokSekolah; gabung: (t: string, v: string[]) => Promise<number> }) {
  const kunciUtama = kunciSekolah(k.varian[0].nama);
  // Kelompok MIRIP: yang tercentang di awal hanya yang PASTI sama dengan penulisan terbanyak.
  const [pilih, setPilih] = useState<Set<string>>(() => new Set(k.varian.filter(v => k.pasti || kunciSekolah(v.nama) === kunciUtama).map(v => v.nama)));
  const [target, setTarget] = useState(k.saran);
  const [sibuk, setSibuk] = useState(false);
  const total = k.varian.filter(v => pilih.has(v.nama)).reduce((t, v) => t + v.jumlah, 0);
  return (
    <div className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`status-badge ${k.pasti ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{k.pasti ? "Pasti sama" : "Mirip"}</span>
        <span className="text-sm text-gray-500">{k.varian.length} penulisan · {k.varian.reduce((t, v) => t + v.jumlah, 0)} data</span>
      </div>
      <ul className="space-y-1.5">
        {k.varian.map(v => (
          <li key={v.nama}>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={pilih.has(v.nama)}
                onChange={e => setPilih(p => { const n = new Set(p); if (e.target.checked) n.add(v.nama); else n.delete(v.nama); return n; })} />
              <span className="min-w-0 flex-1">{v.nama}</span>
              <span className="angka text-xs text-gray-400">{v.jumlah}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
        <div className="min-w-[14rem] flex-1">
          <label className="label-field">Nama yang benar</label>
          <input className="input-field" value={target} onChange={e => setTarget(e.target.value)} />
        </div>
        <button type="button" disabled={sibuk || pilih.size === 0 || !target.trim()} className="btn-modal-save btn-teks"
          onClick={async () => { setSibuk(true); await gabung(target, [...pilih]); setSibuk(false); }}>
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Merge size={16} />} Gabungkan ({total} data)
        </button>
      </div>
    </div>
  );
}
