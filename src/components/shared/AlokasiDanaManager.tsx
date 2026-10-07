"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy, Download, Loader2, Plus, Printer, Save, Trash2, Users, Wallet, PiggyBank, ArrowDownCircle, ArrowUpCircle, Calculator,
} from "lucide-react";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { DonatBagian } from "@/components/shared/GrafikRingkas";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import {
  hitungRencana, hitungRealisasi, formatRupiah, BELUM_DIALOKASIKAN,
  type AngkatanMasuk, type PosAlokasi, type Keringanan, type TransaksiMasuk,
} from "@/lib/alokasi-dana";

type Ringkas = { id: string; nama: string; tahunAjaran: string | null };
type Transaksi = TransaksiMasuk & { dicatatOleh: string };
type Rencana = {
  id: string; nama: string; tahunAjaran: string | null; bulan: number; posPenampung: string | null; catatan: string | null;
  angkatan: AngkatanMasuk[]; transaksi: Transaksi[];
};

/** Warna pos (urut) — token yang sudah ada di situs. */
const WARNA = ["#1B2B6B", "#E8A020", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b", "#ec4899"];
const ROMAWI: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };
const kunciBaru = () => `baru-${Date.now().toString(36)}-${Math.floor(performance.now())}`;

/** Isian rupiah: tampil berpemisah ribuan, disimpan sebagai angka. Di luar komponen induk (lihat ChangePasswordForm). */
function IsianRupiah({ nilai, ubah, label, kecil }: { nilai: number; ubah: (n: number) => void; label?: string; kecil?: boolean }) {
  return (
    <input inputMode="numeric" aria-label={label} value={nilai ? nilai.toLocaleString("id-ID") : ""} placeholder="0"
      onChange={e => ubah(Number(e.target.value.replace(/\D/g, "").slice(0, 13)) || 0)}
      className={`input-field angka text-right ${kecil ? "py-1.5" : ""}`} />
  );
}

function IsianAngka({ nilai, ubah, label, desimal }: { nilai: number; ubah: (n: number) => void; label?: string; desimal?: boolean }) {
  const [teks, setTeks] = useState(nilai ? String(nilai).replace(".", ",") : "");
  useEffect(() => { setTeks(t => (Number(t.replace(",", ".")) === nilai ? t : nilai ? String(nilai).replace(".", ",") : "")); }, [nilai]);
  return (
    <input inputMode={desimal ? "decimal" : "numeric"} aria-label={label} value={teks} placeholder="0"
      onChange={e => {
        const t = e.target.value.replace(desimal ? /[^\d,.]/g : /\D/g, "").replace(".", ",").slice(0, 8);
        setTeks(t); ubah(Number(t.replace(",", ".")) || 0);
      }}
      className="input-field angka text-right py-1.5" />
  );
}

export default function AlokasiDanaManager({ basePath }: { basePath: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [daftar, setDaftar] = useState<Ringkas[] | null>(null);
  const [siswaData, setSiswaData] = useState<Record<number, number>>({});
  const [taAktif, setTaAktif] = useState<string | null>(null);
  const [pilih, setPilih] = useState("");
  const [r, setR] = useState<Rencana | null>(null);
  const [kotor, setKotor] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [tab, setTab] = useState<"rencana" | "rekap" | "realisasi">("rencana");
  const [modalBaru, setModalBaru] = useState<null | { salinDari?: string }>(null);
  const [namaBaru, setNamaBaru] = useState("");

  const muatDaftar = useCallback(async (pilihId?: string) => {
    const d = await fetch("/api/alokasi-dana", { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (!d) { setDaftar([]); return; }
    setDaftar(d.daftar); setSiswaData(d.siswaPerTingkat ?? {}); setTaAktif(d.tahunAjaranAktif);
    setPilih(p => pilihId ?? (p && d.daftar.some((x: Ringkas) => x.id === p) ? p : d.daftar[0]?.id ?? ""));
  }, []);
  useEffect(() => { muatDaftar(); }, [muatDaftar]);

  const muatRencana = useCallback(async (id: string) => {
    if (!id) { setR(null); return; }
    const d = await fetch(`/api/alokasi-dana/${id}`, { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    if (d) { setR(d); setSiswaData(d.siswaPerTingkat ?? {}); setKotor(false); }
  }, []);
  useEffect(() => { muatRencana(pilih); }, [pilih, muatRencana]);

  // Peringatan meninggalkan halaman dengan perubahan belum disimpan.
  useEffect(() => {
    if (!kotor) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [kotor]);

  const hasil = useMemo(() => r ? hitungRencana(r.angkatan, { bulan: r.bulan, posPenampung: r.posPenampung }) : null, [r]);
  const realisasi = useMemo(() => r && hasil ? hitungRealisasi(hasil, r.transaksi) : null, [r, hasil]);
  const warnaPos = useMemo(() => {
    const m = new Map<string, string>();
    hasil?.rekap.forEach((p, i) => m.set(p.nama.trim().toLowerCase(), WARNA[i % WARNA.length]));
    return (nama: string) => m.get(nama.trim().toLowerCase()) ?? "#94a3b8";
  }, [hasil]);

  const ubah = (f: (x: Rencana) => Rencana) => { setR(x => (x ? f(x) : x)); setKotor(true); };
  const ubahAngkatan = (i: number, f: (a: AngkatanMasuk) => AngkatanMasuk) =>
    ubah(x => ({ ...x, angkatan: x.angkatan.map((a, j) => (j === i ? f(a) : a)) }));

  async function simpan() {
    if (!r) return;
    setSibuk(true);
    const res = await fetch(`/api/alokasi-dana/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...r, angkatan: r.angkatan.map(a => ({ ...a, id: a.id?.startsWith("baru-") ? undefined : a.id })) }),
    }).catch(() => null);
    setSibuk(false);
    if (!res?.ok) { toast.error("Gagal menyimpan."); return; }
    setR(await res.json()); setKotor(false); toast.success("Rencana tersimpan"); muatDaftar(r.id);
  }

  async function buatBaru() {
    setSibuk(true);
    const res = await fetch("/api/alokasi-dana", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: namaBaru, tahunAjaran: taAktif, salinDari: modalBaru?.salinDari }),
    }).catch(() => null);
    setSibuk(false);
    if (!res?.ok) { toast.error("Gagal membuat rencana."); return; }
    const { id } = await res.json();
    setModalBaru(null); setNamaBaru(""); toast.success(modalBaru?.salinDari ? "Rencana disalin" : "Rencana dibuat");
    await muatDaftar(id); setTab("rencana");
  }

  async function hapusRencana() {
    if (!r || !await confirm(`Hapus rencana "${r.nama}" beserta seluruh catatan uang masuk & pengeluarannya?`)) return;
    const res = await fetch(`/api/alokasi-dana/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) { toast.success("Rencana dihapus"); setPilih(""); muatDaftar(); } else toast.error("Gagal menghapus.");
  }

  async function gantiRencana(id: string) {
    if (kotor && !await confirm("Ada perubahan yang belum disimpan. Pindah rencana dan buang perubahan itu?")) return;
    setPilih(id);
  }

  function salinPosKeSemua(i: number) {
    ubah(x => ({ ...x, angkatan: x.angkatan.map(a => ({ ...a, pos: x.angkatan[i].pos.map(p => ({ ...p })) })) }));
    toast.success(`Pos ${r?.angkatan[i].nama} disalin ke semua angkatan`);
  }

  if (!daftar) return <div className="flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  const namaPos = hasil ? [...new Set(hasil.rekap.map(p => p.nama))] : [];

  return (
    <div className="space-y-6">
      {hasil && (
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={hasil.totalSiswa.toLocaleString("id-ID")} label={`Siswa · ${hasil.angkatan.length} angkatan`} icon={Users} color="primary" />
          <StatTile value={formatRupiah(hasil.pemasukanBulan)} label="Pemasukan per bulan" icon={Wallet} color="blue" size="md" />
          <StatTile value={formatRupiah(hasil.pemasukanTahun)} label={`Pemasukan setahun (${hasil.bulan} bulan)`} icon={Calculator} color="emerald" size="md" />
          <StatTile value={formatRupiah(realisasi?.saldo ?? 0)} label="Saldo realisasi" icon={PiggyBank} color="amber" size="md" />
        </div>
      )}

      <div className="baris-alat">
        <div className="alat-saring min-w-[14rem]">
          <Select value={pilih} onChange={gantiRencana} placeholder={daftar.length ? "Pilih rencana" : "Belum ada rencana"}
            options={daftar.map(d => ({ value: d.id, label: `${d.nama}${d.tahunAjaran ? ` · ${d.tahunAjaran}` : ""}` }))} />
        </div>
        <div className="alat-aksi">
          {r && <a href={`${basePath}/cetak?id=${r.id}`} className="btn-modal-cancel"><Printer /> Cetak</a>}
          {r && <a href={`/api/alokasi-dana/${r.id}/ekspor`} className="btn-modal-cancel"><Download /> Excel</a>}
          {r && <button type="button" onClick={() => { setNamaBaru(`${r.nama} (salinan)`); setModalBaru({ salinDari: r.id }); }} className="btn-modal-cancel"><Copy /> Salin</button>}
          <button type="button" onClick={() => { setNamaBaru(`Alokasi Dana ${taAktif ?? ""}`.trim()); setModalBaru({}); }} className="btn-modal-save"><Plus /> Rencana Baru</button>
        </div>
      </div>

      {!r ? (
        <div className="panel p-10 text-center">
          <Calculator size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 font-heading font-semibold text-primary-900">Belum ada rencana alokasi dana</p>
          <p className="mt-1 text-sm text-gray-500">Buat rencana baru — angkatan X, XI, dan XII langsung terisi jumlah siswa dari data sekolah.</p>
        </div>
      ) : (
        <>
          <div className="panel p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div><label className="label-field">Nama rencana</label>
              <input value={r.nama} onChange={e => ubah(x => ({ ...x, nama: e.target.value }))} className="input-field" /></div>
            <div><label className="label-field">Tahun ajaran</label>
              <input value={r.tahunAjaran ?? ""} onChange={e => ubah(x => ({ ...x, tahunAjaran: e.target.value }))} placeholder="2026/2027" className="input-field" /></div>
            <div><label className="label-field">Iuran dipungut (bulan per tahun)</label>
              <IsianAngka nilai={r.bulan} ubah={n => ubah(x => ({ ...x, bulan: Math.min(24, Math.max(1, n || 12)) }))} label="Jumlah bulan" /></div>
            <div><label className="label-field">Sisa pembulatan masuk ke pos</label>
              <Select value={r.posPenampung ?? ""} onChange={v => ubah(x => ({ ...x, posPenampung: v || null }))}
                options={[{ value: "", label: "Pos persen pertama tiap angkatan" }, ...namaPos.map(n => ({ value: n, label: n }))]} /></div>
          </div>

          <div className="baris-alat">
            <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
              {([["rencana", "Rencana per Angkatan"], ["rekap", "Rekap per Pos"], ["realisasi", "Realisasi & Saldo"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
              ))}
            </div>
            <div className="alat-aksi alat-teks">
              {kotor && <span className="self-center text-xs font-semibold text-amber-600">Belum disimpan</span>}
              <button type="button" onClick={hapusRencana} className="btn-modal-cancel"><Trash2 /> Hapus Rencana</button>
              <button type="button" onClick={simpan} disabled={sibuk || !kotor} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
            </div>
          </div>

          {tab === "rencana" && hasil && (
            <div className="space-y-6">
              {r.angkatan.map((a, i) => {
                const h = hasil.angkatan[i];
                const dataSiswa = a.tingkat ? siswaData[a.tingkat] : undefined;
                const pas = Math.abs(h.totalPersen - 100) < 0.005;
                return (
                  <div key={a.id ?? i} className="panel overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-4">
                      <input value={a.nama} onChange={e => ubahAngkatan(i, x => ({ ...x, nama: e.target.value }))} aria-label="Nama angkatan"
                        className="input-field max-w-[14rem] font-heading font-semibold" />
                      <div className="w-36">
                        <Select value={a.tingkat ? String(a.tingkat) : ""} onChange={v => ubahAngkatan(i, x => ({ ...x, tingkat: v ? Number(v) : null }))}
                          options={[{ value: "", label: "Tanpa tingkat" }, ...[10, 11, 12].map(t => ({ value: String(t), label: `Tingkat ${ROMAWI[t]}` }))]} />
                      </div>
                      <span className="ml-auto text-sm text-gray-500">Pemasukan <strong className="angka text-primary-900">{formatRupiah(h.pemasukanBulan)}</strong>/bulan · <strong className="angka text-primary-900">{formatRupiah(h.pemasukanTahun)}</strong>/tahun</span>
                      <button type="button" title="Hapus angkatan" onClick={async () => {
                        if (await confirm(`Hapus angkatan ${a.nama} dari rencana ini?`)) ubah(x => ({ ...x, angkatan: x.angkatan.filter((_, j) => j !== i) }));
                      }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
                      <div>
                        <label className="label-field">Jumlah siswa</label>
                        <IsianAngka nilai={a.jumlahSiswa} ubah={n => ubahAngkatan(i, x => ({ ...x, jumlahSiswa: n }))} label="Jumlah siswa" />
                        {dataSiswa !== undefined && dataSiswa !== a.jumlahSiswa && (
                          <button type="button" onClick={() => ubahAngkatan(i, x => ({ ...x, jumlahSiswa: dataSiswa }))}
                            className="mt-1 text-xs font-semibold text-primary-700 hover:underline">Pakai data sekolah: {dataSiswa} siswa aktif</button>
                        )}
                      </div>
                      <div>
                        <label className="label-field">Iuran per siswa per bulan</label>
                        <IsianRupiah nilai={a.iuran} ubah={n => ubahAngkatan(i, x => ({ ...x, iuran: n }))} label="Iuran per siswa" />
                      </div>
                      <div>
                        <label className="label-field">Siswa keringanan / beasiswa</label>
                        <div className="space-y-2">
                          {a.keringanan.map((k, ki) => (
                            <div key={ki} className="flex items-center gap-1.5">
                              <input value={k.label} onChange={e => ubahAngkatan(i, x => ({ ...x, keringanan: x.keringanan.map((y, j) => j === ki ? { ...y, label: e.target.value } : y) }))}
                                className="input-field py-1.5 min-w-0 flex-1" placeholder="Beasiswa" aria-label="Keterangan" />
                              <div className="w-16"><IsianAngka nilai={k.jumlah} ubah={n => ubahAngkatan(i, x => ({ ...x, keringanan: x.keringanan.map((y, j) => j === ki ? { ...y, jumlah: n } : y) }))} label="Jumlah siswa" /></div>
                              <div className="w-28"><IsianRupiah kecil nilai={k.iuran} ubah={n => ubahAngkatan(i, x => ({ ...x, keringanan: x.keringanan.map((y, j) => j === ki ? { ...y, iuran: n } : y) }))} label="Iuran khusus" /></div>
                              <button type="button" title="Hapus" onClick={() => ubahAngkatan(i, x => ({ ...x, keringanan: x.keringanan.filter((_, j) => j !== ki) }))}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => ubahAngkatan(i, x => ({ ...x, keringanan: [...x.keringanan, { label: "Beasiswa", jumlah: 1, iuran: 0 } as Keringanan] }))}
                            className="text-xs font-semibold text-primary-700 hover:underline">+ Tambah keringanan (jumlah siswa · iuran khusus)</button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr>
                          <th>Pos</th><th className="w-32">Alokasi</th><th className="w-28 text-right">Nilai</th>
                          <th className="text-right">Per siswa/bln</th><th className="text-right">Per bulan</th><th className="text-right">Per semester</th><th className="text-right">Per tahun</th><th className="w-10" />
                        </tr></thead>
                        <tbody>
                          {a.pos.map((p, pi) => {
                            const hp = h.pos[pi];
                            return (
                              <tr key={pi}>
                                <td><div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warnaPos(p.nama) }} aria-hidden />
                                  <input value={p.nama} onChange={e => ubahAngkatan(i, x => ({ ...x, pos: x.pos.map((y, j) => j === pi ? { ...y, nama: e.target.value } : y) }))}
                                    className="input-field py-1.5 min-w-[9rem]" placeholder="Nama pos" aria-label="Nama pos" />
                                </div></td>
                                <td><Select value={p.jenis} onChange={v => ubahAngkatan(i, x => ({ ...x, pos: x.pos.map((y, j) => j === pi ? { ...y, jenis: v as PosAlokasi["jenis"], nilai: 0 } : y) }))}
                                  options={[{ value: "PERSEN", label: "Persen" }, { value: "NOMINAL", label: "Rp/siswa" }]} /></td>
                                <td>{p.jenis === "PERSEN"
                                  ? <div className="flex items-center gap-1"><IsianAngka desimal nilai={p.nilai} ubah={n => ubahAngkatan(i, x => ({ ...x, pos: x.pos.map((y, j) => j === pi ? { ...y, nilai: n } : y) }))} label="Persen" /><span className="text-gray-400">%</span></div>
                                  : <IsianRupiah kecil nilai={p.nilai} ubah={n => ubahAngkatan(i, x => ({ ...x, pos: x.pos.map((y, j) => j === pi ? { ...y, nilai: n } : y) }))} label="Rupiah per siswa" />}</td>
                                <td className="text-right angka">{hp ? formatRupiah(hp.perSiswa) : "—"}</td>
                                <td className="text-right angka font-semibold text-primary-900">{hp ? formatRupiah(hp.perBulan) : "—"}{hp?.dapatSisaPembulatan ? <span className="block text-xs font-normal text-gray-400" title="Sisa pembulatan rupiah">+{hp.dapatSisaPembulatan} pembulatan</span> : null}</td>
                                <td className="text-right angka">{hp ? formatRupiah(hp.perSemester) : "—"}</td>
                                <td className="text-right angka">{hp ? formatRupiah(hp.perTahun) : "—"}</td>
                                <td><button type="button" title="Hapus pos" onClick={() => ubahAngkatan(i, x => ({ ...x, pos: x.pos.filter((_, j) => j !== pi) }))}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button></td>
                              </tr>
                            );
                          })}
                          {h.belumDialokasikan > 0 && (
                            <tr className="bg-amber-50/60">
                              <td colSpan={4} className="font-semibold text-amber-700">{BELUM_DIALOKASIKAN}</td>
                              <td className="text-right angka font-semibold text-amber-700">{formatRupiah(h.belumDialokasikan)}</td>
                              <td className="text-right angka text-amber-700">{formatRupiah(Math.round(h.belumDialokasikan * hasil.bulan / 2))}</td>
                              <td className="text-right angka text-amber-700">{formatRupiah(h.belumDialokasikan * hasil.bulan)}</td><td />
                            </tr>
                          )}
                          <tr className="font-semibold">
                            <td colSpan={4} className="text-primary-900">Total {a.nama}</td>
                            <td className="text-right angka text-primary-900">{formatRupiah(h.pemasukanBulan)}</td>
                            <td className="text-right angka">{formatRupiah(h.pemasukanSemester)}</td>
                            <td className="text-right angka">{formatRupiah(h.pemasukanTahun)}</td><td />
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 border-t border-gray-100 px-5 py-4">
                      {a.pos.some(p => p.jenis === "PERSEN") && (
                        <div>
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">Total persen</span>
                            <span className={`angka ${pas ? "text-emerald-600" : "text-amber-600"}`}>{h.totalPersen.toLocaleString("id-ID")}% {pas ? "✓" : "/ 100%"}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${pas ? "bg-emerald-500" : h.totalPersen > 100 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${Math.min(100, h.totalPersen)}%` }} />
                          </div>
                        </div>
                      )}
                      {h.peringatan.map(w => <p key={w} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{w}</p>)}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => ubahAngkatan(i, x => ({ ...x, pos: [...x.pos, { nama: "", jenis: "PERSEN", nilai: 0 }] }))} className="btn-modal-cancel btn-teks"><Plus /> Tambah Pos</button>
                        {r.angkatan.length > 1 && <button type="button" onClick={() => salinPosKeSemua(i)} className="btn-modal-cancel btn-teks"><Copy /> Pakai pos ini untuk semua angkatan</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn-modal-cancel btn-teks"
                onClick={() => ubah(x => ({ ...x, angkatan: [...x.angkatan, { id: kunciBaru(), nama: `Angkatan ${x.angkatan.length + 1}`, tingkat: null, jumlahSiswa: 0, iuran: 0, keringanan: [], pos: (x.angkatan[0]?.pos ?? []).map(p => ({ ...p })) }] }))}>
                <Plus /> Tambah Angkatan
              </button>
            </div>
          )}

          {tab === "rekap" && hasil && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
              <div className="panel overflow-hidden xl:col-span-8">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Pos</th>{hasil.angkatan.map((a, i) => <th key={a.id ?? i} className="text-right">{a.nama}<span className="block font-normal normal-case">per bulan</span></th>)}
                      <th className="text-right">Total / bulan</th><th className="text-right">Total / tahun</th><th className="text-right">Porsi</th></tr></thead>
                    <tbody>
                      {hasil.rekap.map(p => (
                        <tr key={p.nama}>
                          <td><span className="inline-flex items-center gap-2 font-semibold text-primary-900"><span className="h-2.5 w-2.5 rounded-full" style={{ background: warnaPos(p.nama) }} />{p.nama}</span></td>
                          {hasil.angkatan.map((a, i) => <td key={a.id ?? i} className="text-right angka">{p.perAngkatan[a.id ?? `#${i}`] ? formatRupiah(p.perAngkatan[a.id ?? `#${i}`]) : "—"}</td>)}
                          <td className="text-right angka font-semibold text-primary-900">{formatRupiah(p.perBulan)}</td>
                          <td className="text-right angka">{formatRupiah(p.perTahun)}</td>
                          <td className="text-right angka">{p.porsi.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</td>
                        </tr>
                      ))}
                      {hasil.belumDialokasikanBulan > 0 && (
                        <tr className="bg-amber-50/60 text-amber-700"><td className="font-semibold">{BELUM_DIALOKASIKAN}</td>
                          {hasil.angkatan.map((a, i) => <td key={a.id ?? i} className="text-right angka">{a.belumDialokasikan ? formatRupiah(a.belumDialokasikan) : "—"}</td>)}
                          <td className="text-right angka font-semibold">{formatRupiah(hasil.belumDialokasikanBulan)}</td><td className="text-right angka">{formatRupiah(hasil.belumDialokasikanBulan * hasil.bulan)}</td><td /></tr>
                      )}
                      <tr className="font-semibold"><td className="text-primary-900">TOTAL</td>
                        {hasil.angkatan.map((a, i) => <td key={a.id ?? i} className="text-right angka">{formatRupiah(a.pemasukanBulan)}</td>)}
                        <td className="text-right angka text-primary-900">{formatRupiah(hasil.pemasukanBulan)}</td><td className="text-right angka">{formatRupiah(hasil.pemasukanTahun)}</td><td className="text-right angka">100%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel p-5 xl:col-span-4">
                <DonatBagian judul="Komposisi dana per bulan" satuan="rupiah"
                  bagian={[...hasil.rekap.map(p => ({ label: p.nama, nilai: p.perBulan, warna: warnaPos(p.nama) })),
                    ...(hasil.belumDialokasikanBulan ? [{ label: BELUM_DIALOKASIKAN, nilai: hasil.belumDialokasikanBulan, warna: "#fbbf24" }] : [])]} />
              </div>
            </div>
          )}

          {tab === "realisasi" && hasil && realisasi && (
            <PanelRealisasi rencana={r} hasil={hasil} realisasi={realisasi} warnaPos={warnaPos} kotor={kotor}
              selesai={() => muatRencana(r.id)} />
          )}
        </>
      )}

      <Modal open={!!modalBaru} onClose={() => setModalBaru(null)} title={modalBaru?.salinDari ? "Salin Rencana" : "Rencana Alokasi Baru"} size="sm"
        description={modalBaru?.salinDari ? "Angkatan, iuran, dan pos ikut tersalin; catatan uang masuk & pengeluaran tidak." : "Angkatan X, XI, dan XII terisi otomatis dengan jumlah siswa aktif."}
        footer={<>
          <button type="button" onClick={() => setModalBaru(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={buatBaru} disabled={sibuk} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} {modalBaru?.salinDari ? "Salin" : "Buat"}</button>
        </>}>
        <label className="label-field">Nama rencana</label>
        <input value={namaBaru} onChange={e => setNamaBaru(e.target.value)} className="input-field" autoFocus />
      </Modal>
    </div>
  );
}

/** Tab Realisasi — DI LUAR komponen induk supaya isian tidak kehilangan fokus tiap ketikan. */
function PanelRealisasi({ rencana, hasil, realisasi, warnaPos, kotor, selesai }: {
  rencana: Rencana; hasil: NonNullable<ReturnType<typeof hitungRencana>>; realisasi: ReturnType<typeof hitungRealisasi>;
  warnaPos: (n: string) => string; kotor: boolean; selesai: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const [jenis, setJenis] = useState<"MASUK" | "KELUAR">("MASUK");
  const [angkatanId, setAngkatanId] = useState("");
  const [pos, setPos] = useState("");
  const [tanggal, setTanggal] = useState(hariIni);
  const [jumlah, setJumlah] = useState(0);
  const [ket, setKet] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const angkatanTersimpan = rencana.angkatan.filter(a => a.id && !a.id.startsWith("baru-"));
  const nama = new Map(rencana.angkatan.map(a => [a.id ?? "", a.nama]));
  const usulan = jenis === "MASUK" && angkatanId ? hasil.angkatan.find(a => a.id === angkatanId)?.pemasukanBulan : undefined;

  async function catat() {
    if (kotor) { toast.error("Simpan dulu perubahan rencana sebelum mencatat realisasi."); return; }
    setSibuk(true);
    const res = await fetch(`/api/alokasi-dana/${rencana.id}/transaksi`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jenis, angkatanId: jenis === "MASUK" ? angkatanId : angkatanId || null, pos, tanggal, jumlah, keterangan: ket }),
    }).catch(() => null);
    setSibuk(false);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(jenis === "MASUK" ? "Uang masuk tercatat & dibagi ke pos" : "Pengeluaran tercatat");
    setJumlah(0); setKet(""); selesai();
  }
  async function hapus(t: Transaksi) {
    if (!await confirm(`Hapus catatan ${t.jenis === "MASUK" ? "uang masuk" : "pengeluaran"} ${formatRupiah(t.jumlah)}?`)) return;
    const res = await fetch(`/api/alokasi-dana/${rencana.id}/transaksi/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) { toast.success("Catatan dihapus"); selesai(); } else toast.error("Gagal menghapus.");
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
      <div className="space-y-6 xl:col-span-8">
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Pos</th><th className="text-right">Anggaran / tahun</th><th className="text-right">Uang masuk</th><th className="text-right">Pengeluaran</th><th className="text-right">Saldo</th><th className="w-40">Terpakai</th></tr></thead>
              <tbody>
                {realisasi.pos.map(p => (
                  <tr key={p.nama}>
                    <td><span className="inline-flex items-center gap-2 font-semibold text-primary-900"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.nama === BELUM_DIALOKASIKAN ? "#fbbf24" : warnaPos(p.nama) }} />{p.nama}</span></td>
                    <td className="text-right angka">{p.anggaranTahun ? formatRupiah(p.anggaranTahun) : "—"}</td>
                    <td className="text-right angka">{formatRupiah(p.masuk)}</td>
                    <td className="text-right angka">{formatRupiah(p.keluar)}</td>
                    <td className={`text-right angka font-semibold ${p.saldo < 0 ? "text-red-600" : "text-primary-900"}`}>{formatRupiah(p.saldo)}</td>
                    <td>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${p.terpakai > 100 ? "bg-red-500" : p.terpakai > 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, p.terpakai)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 angka">{p.masuk ? `${p.terpakai.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "—"}</span>
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold"><td className="text-primary-900">TOTAL</td><td className="text-right angka">{formatRupiah(hasil.pemasukanTahun)}</td>
                  <td className="text-right angka">{formatRupiah(realisasi.totalMasuk)}</td><td className="text-right angka">{formatRupiah(realisasi.totalKeluar)}</td>
                  <td className="text-right angka text-primary-900">{formatRupiah(realisasi.saldo)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4"><h3 className="font-heading font-semibold text-primary-900">Catatan uang masuk & pengeluaran</h3></div>
          {!rencana.transaksi.length ? <p className="py-10 text-center text-sm text-gray-400">Belum ada catatan realisasi.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Angkatan / Pos</th><th className="text-right">Jumlah</th><th>Keterangan</th><th className="w-10" /></tr></thead>
                <tbody>
                  {rencana.transaksi.map(t => (
                    <tr key={t.id}>
                      <td className="angka whitespace-nowrap">{new Date(`${t.tanggal}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td>
                      <td>{t.jenis === "MASUK"
                        ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Masuk</span>
                        : <span className="status-badge bg-red-50 text-red-600 border-red-200">Keluar</span>}</td>
                      <td>{t.jenis === "MASUK" ? (t.angkatanId ? nama.get(t.angkatanId) ?? "—" : <span className="text-amber-600">Angkatan dihapus</span>) : t.pos}</td>
                      <td className="text-right angka font-semibold">{formatRupiah(t.jumlah)}</td>
                      <td className="text-sm text-gray-600">{t.keterangan}<span className="block text-xs text-gray-400">oleh {t.dicatatOleh}</span></td>
                      <td><button type="button" title="Hapus" onClick={() => hapus(t)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel p-5 space-y-4 xl:col-span-4">
        <h3 className="font-heading font-semibold text-primary-900">Catat realisasi</h3>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-100 bg-white p-1">
          {([["MASUK", "Uang Masuk", ArrowDownCircle], ["KELUAR", "Pengeluaran", ArrowUpCircle]] as const).map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setJenis(k)}
              className={`sentuh flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${jenis === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}><I size={15} /> {l}</button>
          ))}
        </div>
        {jenis === "MASUK" ? (
          <div><label className="label-field">Dari angkatan</label>
            <Select value={angkatanId} onChange={setAngkatanId} placeholder="Pilih angkatan" options={angkatanTersimpan.map(a => ({ value: a.id!, label: a.nama }))} />
            <p className="mt-1 text-xs text-gray-500">Dibagi otomatis ke pos angkatan itu sesuai porsi rencana.</p></div>
        ) : (
          <div><label className="label-field">Dari pos</label>
            <Select value={pos} onChange={setPos} placeholder="Pilih pos" options={hasil.rekap.map(p => ({ value: p.nama, label: p.nama }))} /></div>
        )}
        <div><label className="label-field">Tanggal</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
        <div><label className="label-field">Jumlah</label><IsianRupiah nilai={jumlah} ubah={setJumlah} label="Jumlah" />
          {usulan ? <button type="button" onClick={() => setJumlah(usulan)} className="mt-1 text-xs font-semibold text-primary-700 hover:underline">Isi target sebulan: {formatRupiah(usulan)}</button> : null}</div>
        <div><label className="label-field">Keterangan</label>
          <input value={ket} onChange={e => setKet(e.target.value)} maxLength={300} className="input-field" placeholder={jenis === "MASUK" ? "Iuran Oktober" : "Konsumsi rapat OSIS"} /></div>
        <button type="button" onClick={catat} disabled={sibuk || !jumlah || (jenis === "MASUK" ? !angkatanId : !pos)} className="btn-modal-save w-full">
          {sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Catat {jenis === "MASUK" ? "Uang Masuk" : "Pengeluaran"}
        </button>
        {kotor && <p className="text-xs text-amber-600">Simpan perubahan rencana dulu supaya pembagian memakai angka terbaru.</p>}
      </div>
    </div>
  );
}
