"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, NotebookPen, Printer, Save, Sparkles, Wand2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import {
  BATAS_PILIHAN, NILAI_SIKAP_DINIYAH, PILIHAN_SOSIAL, PILIHAN_SPIRITUAL, PREDIKAT_SIKAP,
  kalimatSosial, kalimatSpiritual, type PilihanSikap,
} from "@/lib/rapor-sikap";
import TombolKembali from "@/components/shared/TombolKembali";

interface BarisIsian {
  id: string; nis: string; nama: string;
  sikapSpiritual: string; sikapSosial: string; akhlak: string; kerajinan: string; kerapian: string; keputusan: string;
  pilihan: PilihanSikap;
}
interface DataIsian { kelas: string; grade: number; kelasXII: boolean; genap: boolean; disahkan: boolean; siswa: BarisIsian[] }
type Tab = "sikap" | "diniyah" | "keputusan";
type KunciSosial = "sangatBaik" | "baik" | "kurang" | "mulai";

const DINIYAH_SINGKAT: Record<string, string> = { "Sangat Baik": "SB", Baik: "B", Cukup: "C", Kurang: "K" };

/** ISIAN RAPOR WALI KELAS (22 September 2026) — padanan lembar NILAI SIKAP, sikap Diniyah (D1: Kelakuan/Kerajinan/Kerapian),
 * dan pilihan Naik/Tinggal makro rapor sekolah. Kalimat deskripsi dirangkai otomatis dari pilihan (src/lib/rapor-sikap.ts);
 * tanpa pilihan, rapor memakai kalimat baku makro. Tersimpan di CatatanWaliKelas lewat /api/rapor/isian-wali. */
export default function IsianRaporWali({ classId, semester, kembaliHref, cetakHref }: { classId: string; semester: string; kembaliHref: string; cetakHref: string }) {
  const toast = useToast();
  const [data, setData] = useState<DataIsian | null>(null);
  const [baris, setBaris] = useState<BarisIsian[]>([]);
  const [galat, setGalat] = useState("");
  const [tab, setTab] = useState<Tab>("sikap");
  const [ubah, setUbah] = useState(false);
  const [simpan, setSimpan] = useState(false);
  const [perilaku, setPerilaku] = useState<{ id: string; aspek: "spiritual" | "sosial" } | null>(null);

  useEffect(() => {
    fetch(`/api/rapor/isian-wali?classId=${encodeURIComponent(classId)}&semester=${encodeURIComponent(semester)}`, { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Gagal memuat."); return d as DataIsian; })
      .then(d => { setData(d); setBaris(d.siswa); })
      .catch(e => setGalat(e instanceof Error ? e.message : "Gagal memuat."));
  }, [classId, semester]);

  useEffect(() => {
    if (!ubah) return;
    const cegah = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [ubah]);

  const kunci = !!data?.disahkan;
  const set = (id: string, ubahan: Partial<BarisIsian>) => { setBaris(bs => bs.map(b => (b.id === id ? { ...b, ...ubahan } : b))); setUbah(true); };
  const isiKosong = (kolom: keyof BarisIsian, nilai: string) => { setBaris(bs => bs.map(b => (b[kolom] ? b : { ...b, [kolom]: nilai }))); setUbah(true); };

  async function simpanSemua() {
    setSimpan(true);
    const r = await fetch("/api/rapor/isian-wali", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, semester, siswa: baris }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpan(false);
    if (!r?.ok) { toast.error(d?.error ?? "Isian rapor gagal disimpan."); return; }
    setUbah(false);
    toast.success(`Isian rapor ${d?.jumlah ?? baris.length} siswa tersimpan.`);
  }

  const ringkas = useMemo(() => ({
    sikap: baris.filter(b => !b.sikapSpiritual || !b.sikapSosial).length,
    diniyah: baris.filter(b => !b.akhlak || !b.kerajinan || !b.kerapian).length,
  }), [baris]);

  const opsiKeputusan = data?.kelasXII
    ? [{ value: "LULUS", label: "Lulus" }, { value: "TIDAK_LULUS", label: "Tidak Lulus" }]
    : [{ value: "NAIK", label: "Naik" }, { value: "TINGGAL", label: "Tinggal" }];
  const bawaanKeputusan = data?.kelasXII ? "LULUS" : "NAIK";

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><p className="error-msg">{galat}</p></div>;
  if (!data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  const tabs: { k: Tab; label: string; sisa?: number }[] = [
    { k: "sikap", label: "Sikap", sisa: ringkas.sikap },
    { k: "diniyah", label: "Sikap Diniyah", sisa: ringkas.diniyah },
    ...(data.genap ? [{ k: "keputusan" as Tab, label: data.kelasXII ? "Kelulusan" : "Kenaikan Kelas" }] : []),
  ];
  const aktif = perilaku ? baris.find(b => b.id === perilaku.id) ?? null : null;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<NotebookPen size={22} />} title="Isian Rapor Wali Kelas"
        description={`${data.kelas} · Semester ${semester} — sikap, sikap Diniyah${data.genap ? ", dan keputusan akhir tahun" : ""}`} />

      <div className="baris-alat mb-5">
        <div className="alat-tab flex gap-1 border border-gray-100 bg-white rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5 ${tab === t.k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {t.label}
              {!!t.sisa && <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] ${tab === t.k ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{t.sisa}</span>}
            </button>
          ))}
        </div>
        <div className="alat-aksi">
          <TombolKembali href={kembaliHref} />
          <Link href={cetakHref} className="btn-modal-cancel btn-teks"><Printer size={15} /> Cetak Rapor</Link>
          {!kunci && (
            <button type="button" onClick={simpanSemua} disabled={simpan || !ubah} className="btn-modal-save">
              {simpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
            </button>
          )}
        </div>
      </div>

      {kunci && <p className="error-msg mb-4">Rapor semester ini sudah disahkan Kepala Sekolah — isian hanya bisa dibaca.</p>}
      {ubah && !kunci && <p className="mb-4 text-sm text-amber-700">Ada perubahan yang belum disimpan.</p>}

      {baris.length === 0 ? (
        <EmptyState icon={NotebookPen} title="Belum ada siswa aktif" description="Isian rapor muncul untuk siswa aktif di kelas ini." />
      ) : tab === "sikap" ? (
        <div className="panel overflow-hidden">
          <div className="panel-kepala flex-wrap gap-2">
            <p className="text-sm text-gray-600 min-w-0 flex-1 basis-64">Predikat sikap spiritual & sosial. <b>Perilaku</b> menonjol mengubah kalimat deskripsi; tanpa pilihan, rapor memakai kalimat baku.</p>
            {!kunci && (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => { isiKosong("sikapSpiritual", "B"); isiKosong("sikapSosial", "B"); }}><Wand2 size={14} /> Kosong → B</button>
                <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => { isiKosong("sikapSpiritual", "SB"); isiKosong("sikapSosial", "SB"); }}><Wand2 size={14} /> Kosong → SB</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Nama Siswa</th><th>Sikap Spiritual</th><th>Sikap Sosial</th></tr></thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={b.id}>
                    <td className="angka">{i + 1}</td>
                    <td className="min-w-[11rem]"><p className="font-medium text-primary-900">{b.nama}</p><p className="text-xs text-gray-500">{b.nis}</p></td>
                    {(["spiritual", "sosial"] as const).map(aspek => {
                      const kolom = aspek === "spiritual" ? "sikapSpiritual" : "sikapSosial";
                      const kalimat = aspek === "spiritual" ? kalimatSpiritual(b.pilihan.spiritual) : kalimatSosial(b.pilihan.sosial);
                      const jumlah = aspek === "spiritual"
                        ? (b.pilihan.spiritual?.selalu?.length ?? 0) + (b.pilihan.spiritual?.mulai?.length ?? 0)
                        : ["sangatBaik", "baik", "kurang", "mulai"].reduce((a, k) => a + ((b.pilihan.sosial?.[k as KunciSosial] as number[] | undefined)?.length ?? 0), 0);
                      return (
                        <td key={aspek} className="min-w-[15rem]">
                          <Pilih4 nilai={b[kolom]} mati={kunci} pilihan={PREDIKAT_SIKAP.map(p => ({ value: p.value, label: p.value, title: p.label }))}
                            onChange={v => set(b.id, { [kolom]: v } as Partial<BarisIsian>)} />
                          <p className="mt-1.5 text-xs text-gray-500 line-clamp-2" title={kalimat}>{kalimat}</p>
                          <button type="button" onClick={() => setPerilaku({ id: b.id, aspek })} className="mt-0.5 text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1">
                            <Sparkles size={12} /> Perilaku{jumlah ? ` (${jumlah} dipilih)` : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "diniyah" ? (
        <div className="panel overflow-hidden">
          <div className="panel-kepala flex-wrap gap-2">
            <p className="text-sm text-gray-600 min-w-0 flex-1 basis-64">Kelakuan (الأخلاق), Kerajinan (الاجتهاد), dan Kerapian (الترتيب) di Rapor Diniyah.</p>
            {!kunci && (
              <button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => { isiKosong("akhlak", "Baik"); isiKosong("kerajinan", "Baik"); isiKosong("kerapian", "Baik"); }}>
                <Wand2 size={14} /> Kosong → Baik
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Nama Siswa</th><th>Kelakuan</th><th>Kerajinan</th><th>Kerapian</th></tr></thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={b.id}>
                    <td className="angka">{i + 1}</td>
                    <td className="min-w-[11rem]"><p className="font-medium text-primary-900">{b.nama}</p><p className="text-xs text-gray-500">{b.nis}</p></td>
                    {(["akhlak", "kerajinan", "kerapian"] as const).map(k => (
                      <td key={k}>
                        <Pilih4 nilai={b[k]} mati={kunci} pilihan={NILAI_SIKAP_DINIYAH.map(n => ({ value: n, label: DINIYAH_SINGKAT[n], title: n }))}
                          onChange={v => set(b.id, { [k]: v } as Partial<BarisIsian>)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">SB = Sangat Baik · B = Baik · C = Cukup · K = Kurang (dicetak lengkap di rapor).</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="panel-kepala">
            <p className="text-sm text-gray-600">
              {data.kelasXII ? "Kelulusan" : "Kenaikan kelas"} berdasarkan hasil semester 1 dan 2. Yang belum dipilih dicetak <b>{data.kelasXII ? "LULUS" : "NAIK KE KELAS"}</b>.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Nama Siswa</th><th>Keputusan</th></tr></thead>
              <tbody>
                {baris.map((b, i) => (
                  <tr key={b.id}>
                    <td className="angka">{i + 1}</td>
                    <td className="min-w-[11rem]"><p className="font-medium text-primary-900">{b.nama}</p><p className="text-xs text-gray-500">{b.nis}</p></td>
                    <td><Pilih4 nilai={b.keputusan || bawaanKeputusan} mati={kunci} pilihan={opsiKeputusan.map(o => ({ ...o, title: o.label }))} lebar onChange={v => set(b.id, { keputusan: v })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!aktif && !!perilaku} onClose={() => setPerilaku(null)} size="lg" scrollBody
        title={`Perilaku ${perilaku?.aspek === "spiritual" ? "Spiritual" : "Sosial"} — ${aktif?.nama ?? ""}`}
        description="Pilihan yang sama tidak bisa masuk dua kelompok"
        footer={<>
          {!kunci && aktif && perilaku && (
            <button type="button" className="btn-modal-cancel" onClick={() => {
              const salin = aktif.pilihan[perilaku.aspek];
              setBaris(bs => bs.map(b => (b.id === aktif.id || jumlahPilihan(b.pilihan[perilaku.aspek]) ? b : { ...b, pilihan: { ...b.pilihan, [perilaku.aspek]: salin } })));
              setUbah(true);
              toast.success("Pilihan diterapkan ke siswa yang belum diisi.");
            }}>Terapkan ke yang belum diisi</button>
          )}
          <button type="button" className="btn-modal-save" onClick={() => setPerilaku(null)}>Selesai</button>
        </>}>
        {aktif && perilaku && (
          <PilihPerilaku aspek={perilaku.aspek} pilihan={aktif.pilihan} mati={kunci}
            onChange={p => set(aktif.id, { pilihan: p })} />
        )}
      </Modal>
    </div>
  );
}

function jumlahPilihan(x: object | undefined) {
  return Object.values(x ?? {}).reduce((a: number, v) => a + (Array.isArray(v) ? v.length : 0), 0);
}

function Pilih4({ nilai, pilihan, onChange, mati, lebar }: {
  nilai: string; pilihan: { value: string; label: string; title: string }[]; onChange: (v: string) => void; mati?: boolean; lebar?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="radiogroup">
      {pilihan.map(p => (
        <button key={p.value} type="button" role="radio" aria-checked={nilai === p.value} title={p.title} disabled={mati}
          onClick={() => onChange(nilai === p.value ? "" : p.value)}
          className={`sentuh ${lebar ? "px-3" : "w-9"} h-8 rounded-md text-xs font-bold transition disabled:cursor-not-allowed ${nilai === p.value ? "bg-primary-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function PilihPerilaku({ aspek, pilihan, onChange, mati }: { aspek: "spiritual" | "sosial"; pilihan: PilihanSikap; onChange: (p: PilihanSikap) => void; mati: boolean }) {
  const daftar = aspek === "spiritual" ? PILIHAN_SPIRITUAL : PILIHAN_SOSIAL;
  const kelompok: { k: string; label: string; maks: number }[] = aspek === "spiritual"
    ? [{ k: "selalu", label: "Selalu dilakukan", maks: BATAS_PILIHAN.selalu }, { k: "mulai", label: "Mulai dilakukan", maks: BATAS_PILIHAN.mulai }]
    : [
      { k: "sangatBaik", label: "Sangat Baik", maks: BATAS_PILIHAN.sangatBaik }, { k: "baik", label: "Baik", maks: BATAS_PILIHAN.baik },
      { k: "kurang", label: "Kurang", maks: BATAS_PILIHAN.kurang }, { k: "mulai", label: "Mulai meningkat", maks: BATAS_PILIHAN.mulaiSosial },
    ];
  const isi = (pilihan[aspek] ?? {}) as Record<string, number[] | string | undefined>;
  const nomor = (k: string) => (Array.isArray(isi[k]) ? (isi[k] as number[]) : []);

  function tukar(k: string, n: number) {
    const baru: Record<string, number[] | string | undefined> = { ...isi };
    const ada = nomor(k).includes(n);
    for (const g of kelompok) baru[g.k] = nomor(g.k).filter(x => x !== n); // satu perilaku hanya di satu kelompok
    if (!ada) {
      const g = kelompok.find(x => x.k === k)!;
      baru[k] = [...(baru[k] as number[]), n].slice(-g.maks);
    }
    onChange({ ...pilihan, [aspek]: baru } as PilihanSikap);
  }
  const kalimat = aspek === "spiritual" ? kalimatSpiritual(pilihan.spiritual) : kalimatSosial(pilihan.sosial);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="label-kecil text-blue-700 mb-1">Kalimat di rapor</p>
        <p className="text-sm text-blue-900">{kalimat}</p>
      </div>
      {kelompok.map(g => (
        <div key={g.k}>
          <p className="text-sm font-semibold text-primary-900 mb-1.5">{g.label} <span className="font-normal text-gray-500">— maks {g.maks} ({nomor(g.k).length} dipilih)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {daftar.map((teks, i) => {
              const n = i + 1, dipilih = nomor(g.k).includes(n);
              return (
                <button key={n} type="button" disabled={mati} onClick={() => tukar(g.k, n)}
                  className={`sentuh rounded-full border px-3 py-1.5 text-xs text-left transition disabled:cursor-not-allowed ${dipilih ? "border-primary-700 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-primary-300"}`}>
                  {teks}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {aspek === "sosial" && (
        <div>
          <label className="label-field" htmlFor="catatan-sosial">Catatan tambahan (opsional, ditambahkan di akhir kalimat)</label>
          <input id="catatan-sosial" className="input-field" maxLength={300} disabled={mati} value={pilihan.sosial?.catatan ?? ""}
            onChange={e => onChange({ ...pilihan, sosial: { ...(pilihan.sosial ?? {}), catatan: e.target.value } })} />
        </div>
      )}
    </div>
  );
}
