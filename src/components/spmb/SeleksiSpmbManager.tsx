"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListChecks, Loader2, Save, Search, TriangleAlert } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import {
  LABEL_TINGKAT, PERINGKAT_PRESTASI, TINGKAT_PRESTASI, nilaiPrestasi, type BobotPrestasi,
} from "@/lib/spmb-konten";

type Komponen = { id: string; nama: string; jenis: string; bobot: number; nilaiMaks: number };
type NilaiBaris = { komponenId: string; nilai: number | null; lulus: boolean | null; tingkat: string | null; peringkat: string | null; catatan: string | null };
type Pendaftar = {
  id: string; nomor: string | null; fullName: string; chosenMajor: string; jalur: string; status: string;
  nisn: string | null; previousSchool: string | null; nilaiSpmb: NilaiBaris[];
  skor: number | null; gugur: boolean; lengkap: boolean; terisi: number; jumlahAngka: number; peringkat: number | null;
};
type Gelombang = { id: string; nama: string; urutan: number; kuota: { kode: string; nama: string; kuota: number }[] };

/** Satu sel yang diubah panitia: hanya yang berubah dikirim ke server. */
type Ubahan = Record<string, { nilai?: string; lulus?: boolean | null; tingkat?: string; peringkat?: string; catatan?: string }>;
const kunci = (a: string, k: string) => `${a}|${k}`;

export default function SeleksiSpmbManager() {
  const toast = useToast();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [komponen, setKomponen] = useState<Komponen[]>([]);
  const [pendaftar, setPendaftar] = useState<Pendaftar[]>([]);
  const [gelombang, setGelombang] = useState<Gelombang[]>([]);
  const [bobotPrestasi, setBobotPrestasi] = useState<BobotPrestasi>({});
  const [pilihGelombang, setPilihGelombang] = useState("");
  const [pilihJurusan, setPilihJurusan] = useState("");
  const [cari, setCari] = useState("");
  const [ubahan, setUbahan] = useState<Ubahan>({});

  const muat = useCallback(async (gelombangId: string, jurusan: string) => {
    const q = new URLSearchParams();
    if (gelombangId) q.set("gelombangId", gelombangId);
    if (jurusan) q.set("jurusan", jurusan);
    const d = await fetch(`/api/spmb/seleksi?${q}`).then(r => r.json()).catch(() => null);
    if (d && !d.error) {
      setKomponen(d.komponen ?? []);
      setPendaftar(d.pendaftar ?? []);
      setGelombang(d.gelombang ?? []);
      setBobotPrestasi(d.bobotPrestasi ?? {});
    }
    setUbahan({});
  }, []);

  useEffect(() => { muat(pilihGelombang, pilihJurusan).finally(() => setMemuat(false)); }, [muat, pilihGelombang, pilihJurusan]);

  const daftarJurusan = useMemo(() => {
    const set = new Set(pendaftar.map(p => p.chosenMajor).filter(Boolean));
    return [...set].sort();
  }, [pendaftar]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return pendaftar;
    return pendaftar.filter(p =>
      p.fullName.toLowerCase().includes(q) || (p.nomor ?? "").toLowerCase().includes(q) || (p.nisn ?? "").includes(q));
  }, [pendaftar, cari]);

  const hal = usePaginasi(tersaring, 50, `${cari}|${pilihGelombang}|${pilihJurusan}`);

  function nilaiSel(p: Pendaftar, k: Komponen) {
    const u = ubahan[kunci(p.id, k.id)];
    if (u?.nilai !== undefined) return u.nilai;
    const n = p.nilaiSpmb.find(x => x.komponenId === k.id);
    return n?.nilai === null || n?.nilai === undefined ? "" : String(n.nilai);
  }
  function lulusSel(p: Pendaftar, k: Komponen): boolean | null {
    const u = ubahan[kunci(p.id, k.id)];
    if (u?.lulus !== undefined) return u.lulus;
    return p.nilaiSpmb.find(x => x.komponenId === k.id)?.lulus ?? null;
  }
  function prestasiSel(p: Pendaftar, k: Komponen) {
    const u = ubahan[kunci(p.id, k.id)];
    const n = p.nilaiSpmb.find(x => x.komponenId === k.id);
    return {
      tingkat: u?.tingkat ?? n?.tingkat ?? "",
      peringkat: u?.peringkat ?? n?.peringkat ?? "",
    };
  }

  async function simpan() {
    const isi = Object.entries(ubahan).map(([key, v]) => {
      const [admissionId, komponenId] = key.split("|");
      return {
        admissionId, komponenId,
        nilai: v.nilai === "" ? null : v.nilai,
        lulus: v.lulus ?? null,
        tingkat: v.tingkat ?? "", peringkat: v.peringkat ?? "",
        catatan: v.catatan,
      };
    });
    if (!isi.length) { toast.info("Belum ada nilai yang diubah"); return; }
    setSibuk(true);
    const r = await fetch("/api/spmb/seleksi", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nilai: isi }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(`Nilai ${d?.pendaftar ?? 0} pendaftar tersimpan`); await muat(pilihGelombang, pilihJurusan); }
    else toast.error(d?.error ?? "Gagal menyimpan");
  }

  const kuotaPilihan = useMemo(() => {
    const g = gelombang.find(x => x.id === pilihGelombang);
    if (!g) return null;
    return g.kuota;
  }, [gelombang, pilihGelombang]);

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ListChecks size={22} />} title="Seleksi & Nilai"
        description="Isi nilai tiap komponen — skor berbobot dan peringkat per jurusan dihitung otomatis" />

      <div className="space-y-6">
        {komponen.length === 0 ? (
          <div className="panel p-5">
            <p className="flex items-start gap-2 py-10 text-center text-sm text-amber-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              Belum ada komponen penilaian aktif. Buat dulu di <span className="font-medium">Pengaturan SPMB → Komponen Nilai</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="baris-alat">
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)}
                  placeholder="Cari nama, nomor pendaftaran, atau NISN..." />
              </div>
              <div className="alat-saring">
                <Select value={pilihGelombang} onChange={setPilihGelombang}
                  options={[{ value: "", label: "Semua gelombang" }, ...gelombang.map(g => ({ value: g.id, label: g.nama }))]} />
              </div>
              <div className="alat-saring">
                <Select value={pilihJurusan} onChange={setPilihJurusan}
                  options={[{ value: "", label: "Semua jurusan" }, ...daftarJurusan.map(j => ({ value: j, label: j }))]} />
              </div>
              <div className="alat-aksi">
                <button type="button" disabled={sibuk || !Object.keys(ubahan).length} onClick={simpan} className="btn-modal-save">
                  {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Nilai
                </button>
              </div>
            </div>

            {kuotaPilihan && kuotaPilihan.length > 0 && (
              <div className="panel p-4">
                <p className="label-kecil mb-2 text-gray-500">Kuota gelombang ini</p>
                <div className="flex flex-wrap gap-2">
                  {kuotaPilihan.map(k => {
                    const terisi = pendaftar.filter(p => p.chosenMajor === k.kode || p.chosenMajor === k.nama).length;
                    return (
                      <span key={k.kode} className="status-badge border-primary-100 bg-primary-50 text-primary-700">
                        {k.nama}: <span className="angka font-semibold">{terisi}/{k.kuota}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {tersaring.length === 0 ? (
              <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar yang cocok.</p></div>
            ) : (
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-10">No</th>
                        <th>Pendaftar</th>
                        <th>Jurusan</th>
                        {komponen.map(k => (
                          <th key={k.id} className="text-right">
                            {k.nama}
                            <span className="block font-normal normal-case tracking-normal opacity-60">
                              {k.jenis === "ANGKA" ? `maks ${k.nilaiMaks} · bobot ${k.bobot}`
                                : k.jenis === "PRESTASI" ? `sertifikat · bobot ${k.bobot}`
                                : "lulus/tidak"}
                            </span>
                          </th>
                        ))}
                        <th className="text-right">Skor</th>
                        <th className="text-right">Peringkat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hal.potongan.map((p, i) => (
                        <tr key={p.id} className={p.gugur ? "bg-red-50/40" : undefined}>
                          <td className="angka">{hal.awal + i}</td>
                          <td>
                            <p className="font-medium text-primary-900">{p.fullName}</p>
                            <p className="angka text-xs text-gray-400">{p.nomor ?? "—"}{p.nisn ? ` · ${p.nisn}` : ""}</p>
                          </td>
                          <td className="text-gray-500">{p.chosenMajor}</td>
                          {komponen.map(k => (
                            <td key={k.id} className="text-right">
                              {k.jenis === "ANGKA" ? (
                                <input type="number" min={0} max={k.nilaiMaks} value={nilaiSel(p, k)}
                                  onChange={e => setUbahan({ ...ubahan, [kunci(p.id, k.id)]: { ...ubahan[kunci(p.id, k.id)], nilai: e.target.value } })}
                                  className="input-field w-20 py-1.5 text-right" />
                              ) : k.jenis === "PRESTASI" ? (
                                (() => {
                                  const pr = prestasiSel(p, k);
                                  const nilai = nilaiPrestasi(bobotPrestasi, pr.tingkat, pr.peringkat);
                                  return (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Select value={pr.tingkat}
                                        onChange={v => setUbahan({ ...ubahan, [kunci(p.id, k.id)]: { ...ubahan[kunci(p.id, k.id)], tingkat: v } })}
                                        options={[{ value: "", label: "— tingkat —" }, ...TINGKAT_PRESTASI.map(t => ({ value: t, label: LABEL_TINGKAT[t] }))]} />
                                      <Select value={pr.peringkat}
                                        onChange={v => setUbahan({ ...ubahan, [kunci(p.id, k.id)]: { ...ubahan[kunci(p.id, k.id)], peringkat: v } })}
                                        options={[{ value: "", label: "—" }, ...PERINGKAT_PRESTASI.map(x => ({ value: x, label: `Juara ${x}` }))]} />
                                      <span className="angka w-10 text-right text-sm font-semibold text-primary-900">
                                        {pr.tingkat && pr.peringkat ? nilai : "—"}
                                      </span>
                                    </div>
                                  );
                                })()
                              ) : (
                                <Select value={lulusSel(p, k) === null ? "" : lulusSel(p, k) ? "ya" : "tidak"}
                                  onChange={v => setUbahan({ ...ubahan, [kunci(p.id, k.id)]: { ...ubahan[kunci(p.id, k.id)], lulus: v === "" ? null : v === "ya" } })}
                                  options={[{ value: "", label: "—" }, { value: "ya", label: "Lulus" }, { value: "tidak", label: "Tidak" }]} />
                              )}
                            </td>
                          ))}
                          <td className="angka text-right font-semibold text-primary-900">
                            {p.gugur ? <span className="text-red-600">Gugur</span> : p.skor === null ? "—" : p.skor.toFixed(2)}
                            {!p.gugur && p.skor !== null && !p.lengkap && (
                              <span className="block text-xs font-normal text-amber-600">{p.terisi}/{p.jumlahAngka} dinilai</span>
                            )}
                          </td>
                          <td className="angka text-right">{p.peringkat ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginasi hal={hal} satuan="pendaftar" className="border-t border-gray-100" />
              </div>
            )}

            <p className="text-sm text-gray-400">
              Skor memakai bobot tiap komponen dan dinormalkan terhadap komponen yang sudah dinilai, jadi pendaftar yang
              satu komponennya belum diisi tidak langsung jatuh ke bawah. Peringkat diberikan hanya kepada yang tidak
              gugur dan sudah punya nilai.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
