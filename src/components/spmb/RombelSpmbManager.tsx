"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Loader2, RefreshCw, Check, AlertTriangle, Minus, Plus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { MAKS_BAWAAN, bagiRombel, jumlahKelas, ringkasKelas, urutNama, type KelasRencana, type SiswaRombel } from "@/lib/bagi-rombel";

type Jurusan = { id: string; kode: string; nama: string; siswa: (SiswaRombel & { nis: string })[]; kelas: { id: string; nama: string; isi: number }[] };

/** PEMBAGIAN ROMBEL KELAS X (7 Okt 2026): sistem menyusun rencana (maks per kelas, rata, seimbang putra/putri &
 *  asal sekolah), panitia boleh memindah siswa & mengganti nama kelas, lalu MENYETUJUI per jurusan. */
export default function RombelSpmbManager() {
  const [data, setData] = useState<{ jurusan: Jurusan[]; tanpaJurusan: number } | null>(null);
  const [galat, setGalat] = useState("");
  const [maks, setMaks] = useState(MAKS_BAWAAN);
  const muat = useCallback(() => {
    fetch("/api/spmb/rombel", { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (r.ok) setData(x); else setGalat(x?.error ?? "Gagal memuat.");
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Pembagian Rombel"
        description="Siswa baru dari SPMB dibagi ke kelas X — rata per jurusan, seimbang putra/putri & asal sekolah, lalu disetujui panitia" />
      {galat ? <EmptyState icon={LayoutGrid} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : data.jurusan.length === 0 ? (
        <EmptyState icon={Check} title="Tidak ada siswa baru tanpa kelas"
          description="Siswa baru muncul di sini setelah dimasukkan ke Buku Induk lewat menu Jadi Siswa (tanpa memilih rombel)." />
      ) : (
        <div className="space-y-6">
          <div className="panel space-y-3 p-5">
            <div className="baris-alat items-end">
              <div className="alat-saring w-40">
                <label className="label-field">Maksimal per kelas</label>
                <input className="input-field angka" inputMode="numeric" value={maks}
                  onChange={e => setMaks(Math.max(1, Math.min(60, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Jumlah kelas = jumlah siswa ÷ {maks}, dibulatkan ke atas, lalu dibagi rata (mis. 50 siswa → 2 kelas × 25). Putra/putri dan asal sekolah
              disebar merata. Nama di tiap kelas tersusun abjad — itulah urutan absennya. Rombel yang disetujui juga mengisi isian Rombel di Buku Induk.
            </p>
            <p className="text-sm text-amber-700">
              Kelas X yang masih berisi angkatan berjalan tidak bisa dipakai sebelum <Link href="/dashboard/admin/kenaikan-kelas" className="font-semibold underline">Kenaikan Kelas</Link> dijalankan.
              Rencana tetap bisa disusun dan diperiksa sekarang.
            </p>
            {data.tanpaJurusan > 0 && <p className="text-sm text-red-600">{data.tanpaJurusan} siswa baru belum punya jurusan — lengkapi di Buku Induk.</p>}
          </div>
          {data.jurusan.map(j => <BagianJurusan key={`${j.id}-${maks}`} j={j} maks={maks} onSelesai={muat} />)}
        </div>
      )}
    </div>
  );
}

function BagianJurusan({ j, maks, onSelesai }: { j: Jurusan; maks: number; onSelesai: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [k, setK] = useState(() => jumlahKelas(j.siswa.length, maks));
  const [rencana, setRencana] = useState<KelasRencana[]>(() => bagiRombel(j.siswa, jumlahKelas(j.siswa.length, maks), `X ${j.kode}`));
  const [sibuk, setSibuk] = useState(false);
  const susunUlang = (n: number) => { setK(n); setRencana(bagiRombel(j.siswa, n, `X ${j.kode}`)); };

  // Angkatan berjalan masih di kelas X jurusan ini = Kenaikan Kelas belum dijalankan (siswa baru akan ikut naik ke XI).
  const angkatanLama = j.kelas.reduce((a, x) => a + x.isi, 0);
  const lebih = rencana.filter(x => x.siswa.length > maks);
  const namaKembar = new Set(rencana.map(x => x.nama.trim().toUpperCase())).size !== rencana.length;

  function pindah(id: string, dari: number, ke: number) {
    setRencana(r => r.map((x, i) => {
      if (i === dari) return { ...x, siswa: x.siswa.filter(s => s.id !== id) };
      if (i === ke) return { ...x, siswa: [...x.siswa, r[dari].siswa.find(s => s.id === id)!].sort(urutNama) };
      return x;
    }));
  }

  async function setujui() {
    const ringkas = rencana.map(x => `${x.nama.trim()}: ${x.siswa.length} siswa`).join("\n");
    if (!(await confirm(`Setujui pembagian rombel ${j.kode}?\n\n${ringkas}\n\nSiswa langsung masuk kelas tersebut (absen, jadwal, rapor). Kelas yang belum ada akan dibuat.`))) return;
    setSibuk(true);
    const r = await fetch("/api/spmb/rombel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ majorId: j.id, kelas: rencana.map(x => ({ nama: x.nama.trim(), siswaIds: x.siswa.map(s => s.id) })) }),
    }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(`${x.jumlah} siswa ${j.kode} sudah masuk rombel`); onSelesai(); } else toast.error(x?.error ?? "Gagal menyimpan");
  }

  return (
    <div className="panel overflow-hidden">
      <div className="panel-kepala flex-wrap gap-3">
        <div>
          <p className="panel-judul">{j.kode} — {j.nama}</p>
          <p className="text-xs text-gray-500"><span className="angka">{j.siswa.length}</span> siswa baru · {k} kelas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1">
            <button type="button" title="Kurangi kelas" disabled={k <= 1} onClick={() => susunUlang(k - 1)} className="sentuh rounded-lg p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><Minus size={15} /></button>
            <span className="angka w-16 text-center text-sm font-semibold text-navy">{k} kelas</span>
            <button type="button" title="Tambah kelas" disabled={k >= j.siswa.length} onClick={() => susunUlang(k + 1)} className="sentuh rounded-lg p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><Plus size={15} /></button>
          </div>
          <button type="button" onClick={() => susunUlang(k)} className="btn-modal-cancel btn-teks"><RefreshCw size={16} /> Susun Ulang</button>
          <button type="button" disabled={sibuk || angkatanLama > 0 || namaKembar || rencana.some(x => !x.nama.trim())} onClick={setujui} className="btn-modal-save btn-teks">
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Setujui {j.kode}
          </button>
        </div>
      </div>

      {(angkatanLama > 0 || lebih.length > 0 || namaKembar) && (
        <div className="space-y-1 border-b border-gray-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          {angkatanLama > 0 && (
            <p><AlertTriangle size={14} className="mr-1 inline" />Kelas X {j.kode} masih berisi {angkatanLama} siswa angkatan berjalan
              ({j.kelas.filter(x => x.isi).map(x => `${x.nama} ${x.isi}`).join(", ")}). Rencana bisa diperiksa sekarang, tetapi baru bisa disetujui
              setelah Kenaikan Kelas — kalau tidak, siswa baru ikut dinaikkan ke kelas XI.</p>
          )}
          {lebih.map(x => <p key={x.nama}><AlertTriangle size={14} className="mr-1 inline" />{x.nama} berisi {x.siswa.length} siswa, melebihi batas {maks}.</p>)}
          {namaKembar && <p><AlertTriangle size={14} className="mr-1 inline" />Ada nama kelas yang kembar.</p>}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 p-5 ${rencana.length > 1 ? "md:grid-cols-2" : ""} ${rencana.length > 2 ? "xl:grid-cols-3" : ""}`}>
        {rencana.map((x, i) => {
          const r = ringkasKelas(x);
          return (
            <div key={i} className="min-w-0 rounded-xl border border-gray-100">
              <div className="space-y-2 border-b border-gray-100 bg-[#f5f6fa] p-3">
                <input className="input-field font-semibold" value={x.nama} aria-label="Nama kelas"
                  onChange={e => setRencana(rr => rr.map((y, n) => n === i ? { ...y, nama: e.target.value } : y))} />
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="status-badge bg-primary-50 text-primary-700 border-primary-100 angka">{r.jumlah} siswa</span>
                  <span className="status-badge bg-blue-50 text-blue-700 border-blue-200 angka">Putra {r.L}</span>
                  <span className="status-badge bg-pink-50 text-pink-700 border-pink-200 angka">Putri {r.P}</span>
                </div>
                {r.sekolahTerbanyak.length > 0 && (
                  <p className="text-xs text-gray-500">Asal terbanyak: {r.sekolahTerbanyak.map(s => `${s.nama} (${s.n})`).join(", ")}</p>
                )}
              </div>
              <ol className="max-h-[28rem] divide-y divide-gray-50 overflow-y-auto">
                {x.siswa.map((s, no) => (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="angka w-6 shrink-0 text-xs text-gray-400">{no + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-700" title={s.sekolah ?? ""}>{s.nama}</span>
                    <span className={`shrink-0 text-xs ${s.jk === "P" ? "text-pink-600" : "text-blue-600"}`}>{s.jk === "?" ? "–" : s.jk}</span>
                    {rencana.length > 1 && (
                      <span className="flex shrink-0 gap-0.5">
                        {rencana.map((_, ke) => ke !== i && (
                          <button key={ke} type="button" title={`Pindah ke ${rencana[ke].nama}`} onClick={() => pindah(s.id, i, ke)}
                            className="angka rounded-md border border-gray-200 px-1.5 text-xs text-gray-500 hover:border-primary-300 hover:text-primary-700">→{ke + 1}</button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
