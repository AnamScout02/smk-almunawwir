"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardPen, History, Loader2, Printer, Save, Send, Settings2, Sparkles, Undo2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import StatusForm from "@/components/rapor/StatusForm";
import { hitungSiswa, type EntriRiwayatWali, type NilaiSiswaForm, type PengaturanForm } from "@/lib/rapor-form";
import TombolKembali from "@/components/shared/TombolKembali";

interface Siswa { id: string; nis: string; nisn: string | null; jk: string | null; nama: string }
interface Akses { peran: "GURU" | "WALI" | "PENGELOLA" | "PEMANTAU"; bolehUbah: boolean; bolehKembalikan: boolean }
interface DataForm {
  kelas: { id: string; nama: string; grade: number; wali: string | null };
  mapel: { nama: string; kategori: string | null; namaArab: string | null };
  guru: string | null; semester: string; pengaturan: PengaturanForm; nilai: Record<string, NilaiSiswaForm>;
  status: string; dikirimAt: string | null; dikirimOleh: string | null; catatanWali: string | null;
  diubahAt: string | null; diubahOleh: string | null; siswa: Siswa[]; akses: Akses; terkunci?: string | null;
  riwayatWali?: EntriRiwayatWali[];
}
type Tab = "tp" | "lm" | "ujian" | "hasil" | "diniyah";
type Kolom = { id: string; judul: string; sub?: string; biner?: boolean; get: (n: NilaiSiswaForm) => number | null | undefined; set: (n: NilaiSiswaForm, v: number | null) => NilaiSiswaForm };

const angka = (s: string, maks = 100): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.min(maks, Math.max(0, Math.round(n * 100) / 100)) : null;
};
const tampilAngka = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** LEMBAR ISIAN FORM NILAI RAPOR — satu kelas × mapel × semester. Rumus persis makro (src/lib/rapor-form.ts), dihitung langsung
 * di layar. Nyaman seperti lembar kerja: Enter/↑↓ pindah baris, tempel blok nilai dari Excel, simpan otomatis. */
export default function FormNilaiRaporEditor({ classId, subject, semester, kembali, basePath }: {
  classId: string; subject: string; semester: string; kembali: () => void; basePath: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<DataForm | null>(null);
  const [galat, setGalat] = useState("");
  const [pengaturan, setPengaturan] = useState<PengaturanForm | null>(null);
  const [nilai, setNilai] = useState<Record<string, NilaiSiswaForm>>({});
  const [tab, setTab] = useState<Tab>("lm");
  const [simpan, setSimpan] = useState<"tersimpan" | "berubah" | "menyimpan" | "gagal">("tersimpan");
  const [sibuk, setSibuk] = useState("");
  const [bukaAtur, setBukaAtur] = useState(false);
  const [kembalikan, setKembalikan] = useState<string | null>(null);
  const kotor = useRef(false);

  const muat = useCallback(() => {
    const q = new URLSearchParams({ classId, subject, semester });
    fetch(`/api/rapor/form/isi?${q}`, { cache: "no-store" }).then(r => r.json()).then((d: DataForm & { error?: string }) => {
      if (d.error) { setGalat(d.error); return; }
      setData(d); setPengaturan(d.pengaturan); setNilai(d.nilai ?? {}); kotor.current = false; setSimpan("tersimpan");
      setTab(d.pengaturan.jenis === "DINIYAH" ? "diniyah" : "lm");
      setBukaAtur(d.status === "BELUM" && d.akses.bolehUbah && d.akses.peran !== "WALI");
    }).catch(() => setGalat("Koneksi bermasalah."));
  }, [classId, subject, semester]);
  useEffect(() => { queueMicrotask(muat); }, [muat]);

  // Guru: selama belum dikirim. Wali kelas: SETELAH dikirim (perubahan tercatat & terlihat guru). Admin/TAS: kapan pun.
  const bolehUbah = !!data && data.akses.bolehUbah && (
    data.akses.peran === "PENGELOLA" ? true : data.akses.peran === "WALI" ? data.status === "DIKIRIM" : data.status !== "DIKIRIM");
  const [lihatRiwayat, setLihatRiwayat] = useState(false);

  const simpanSekarang = useCallback(async (diam = false) => {
    if (!pengaturan || !bolehUbah) return false;
    setSimpan("menyimpan");
    const r = await fetch("/api/rapor/form/isi", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, subject, semester, pengaturan, nilai }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { setSimpan("gagal"); if (!diam) toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    kotor.current = false; setSimpan("tersimpan");
    setData(x => (x ? { ...x, status: x.status === "BELUM" ? "DRAF" : x.status, diubahAt: d.disimpan, ...(d.riwayatWali ? { riwayatWali: d.riwayatWali } : {}) } : x));
    return true;
  }, [bolehUbah, classId, nilai, pengaturan, semester, subject, toast]);

  // Simpan otomatis 1,5 detik setelah berhenti mengetik.
  useEffect(() => {
    if (!kotor.current || !bolehUbah) return;
    const t = setTimeout(() => { void simpanSekarang(true); }, 1500);
    return () => clearTimeout(t);
  }, [nilai, pengaturan, bolehUbah, simpanSekarang]);

  const ubahNilai = (sid: string, f: (n: NilaiSiswaForm) => NilaiSiswaForm) => {
    kotor.current = true; setSimpan("berubah");
    setNilai(x => ({ ...x, [sid]: f(x[sid] ?? {}) }));
  };
  const ubahAtur = (patch: Partial<PengaturanForm>) => { kotor.current = true; setSimpan("berubah"); setPengaturan(p => (p ? { ...p, ...patch } : p)); };

  const hasil = useMemo(() => {
    const m = new Map<string, ReturnType<typeof hitungSiswa>>();
    if (!pengaturan || !data) return m;
    for (const s of data.siswa) m.set(s.id, hitungSiswa(pengaturan, nilai[s.id] ?? {}, s.nama));
    return m;
  }, [pengaturan, nilai, data]);

  const tpAktif = pengaturan?.tp.filter(t => t.teks.trim()) ?? [];
  const lmAktif = pengaturan?.lm.filter(l => l.teks.trim()) ?? [];

  const kolom: Kolom[] = useMemo(() => {
    if (!pengaturan) return [];
    if (tab === "tp") return tpAktif.flatMap(t => [
      { id: `${t.kode}-k`, judul: t.kode, sub: "KKTP", biner: true, get: n => n.tp?.[t.kode]?.kktp, set: (n, v) => ({ ...n, tp: { ...n.tp, [t.kode]: { ...n.tp?.[t.kode], kktp: v } } }) },
      { id: `${t.kode}-t`, judul: t.kode, sub: "Tampil", biner: true, get: n => n.tp?.[t.kode]?.tampil, set: (n, v) => ({ ...n, tp: { ...n.tp, [t.kode]: { ...n.tp?.[t.kode], tampil: v } } }) },
    ] as Kolom[]);
    if (tab === "lm") return lmAktif.flatMap(l => [
      { id: `${l.kode}-tes`, judul: l.kode, sub: "Tes", get: n => n.lm?.[l.kode]?.tes, set: (n, v) => ({ ...n, lm: { ...n.lm, [l.kode]: { ...n.lm?.[l.kode], tes: v } } }) },
      { id: `${l.kode}-non`, judul: l.kode, sub: "Non Tes", get: n => n.lm?.[l.kode]?.nonTes, set: (n, v) => ({ ...n, lm: { ...n.lm, [l.kode]: { ...n.lm?.[l.kode], nonTes: v } } }) },
    ] as Kolom[]);
    if (tab === "ujian") return [
      { id: "sts", judul: "STS", sub: "nilai asli", get: n => n.sts, set: (n, v) => ({ ...n, sts: v }) },
      { id: "sasTes", judul: "SAS", sub: "Tes", get: n => n.sasTes, set: (n, v) => ({ ...n, sasTes: v }) },
      { id: "sasNon", judul: "SAS", sub: "Non Tes", get: n => n.sasNonTes, set: (n, v) => ({ ...n, sasNonTes: v }) },
    ];
    if (tab === "diniyah") return [
      { id: "p", judul: "Pengetahuan", sub: "درجة المعرفة", get: n => n.pengetahuan, set: (n, v) => ({ ...n, pengetahuan: v }) },
      { id: "q", judul: "Penerapan", sub: "درجة التطبيق", get: n => n.penerapan, set: (n, v) => ({ ...n, penerapan: v }) },
    ];
    return [];
  }, [tab, pengaturan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigasi sel & tempel dari Excel.
  const fokus = (r: number, c: number) => (document.querySelector(`[data-sel="${r}:${c}"]`) as HTMLElement | null)?.focus();
  const tekanTombol = (e: KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); fokus(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); fokus(r - 1, c); }
  };
  const tempel = (e: ClipboardEvent, r0: number, c0: number) => {
    const teks = e.clipboardData.getData("text/plain");
    if (!data || !/[\t\n]/.test(teks.trim())) return; // satu nilai → biarkan tempel biasa
    e.preventDefault();
    const baris = teks.replace(/\r/g, "").replace(/\n$/, "").split("\n").map(b => b.split("\t"));
    let n = 0;
    kotor.current = true; setSimpan("berubah");
    setNilai(x => {
      const baru = { ...x };
      baris.forEach((isi, i) => {
        const s = data.siswa[r0 + i];
        if (!s) return;
        isi.forEach((sel, j) => {
          const k = kolom[c0 + j];
          if (!k) return;
          baru[s.id] = k.set(baru[s.id] ?? {}, angka(sel, k.biner ? 1 : 100)); n++;
        });
      });
      return baru;
    });
    toast.success(`${n} sel ditempel dari lembar kerja.`);
  };

  async function isiOtomatis() {
    if (!pengaturan || !data) return;
    setSibuk("usulan");
    const q = new URLSearchParams({ classId, subject, semester });
    const r = await fetch(`/api/rapor/form/usulan?${q}`).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) return toast.error(d?.error ?? "Gagal mengambil data.");
    // Hanya mengisi yang MASIH KOSONG — isian guru tidak pernah ditimpa.
    const isiTeks = (lama: PengaturanForm["tp"], baru: PengaturanForm["tp"]) => lama.map((t, i) => (t.teks.trim() ? t : { ...t, teks: baru[i]?.teks ?? "" }));
    ubahAtur({ tp: isiTeks(pengaturan.tp, d.tp), lm: isiTeks(pengaturan.lm, d.lm) });
    setNilai(x => {
      const hasilGabung = { ...x };
      for (const [sid, u] of Object.entries(d.nilai as Record<string, NilaiSiswaForm>)) {
        const a = { ...(hasilGabung[sid] ?? {}) };
        const pakai = <T,>(lama: T | null | undefined, baru: T | null | undefined) => ((lama === null || lama === undefined) && baru !== null && baru !== undefined ? baru : lama);
        a.tp = { ...a.tp }; for (const [k, v] of Object.entries(u.tp ?? {})) a.tp[k] = { kktp: pakai(a.tp[k]?.kktp, v.kktp), tampil: pakai(a.tp[k]?.tampil, v.tampil) };
        a.lm = { ...a.lm }; for (const [k, v] of Object.entries(u.lm ?? {})) a.lm[k] = { tes: pakai(a.lm[k]?.tes, v.tes), nonTes: pakai(a.lm[k]?.nonTes, v.nonTes) };
        a.sts = pakai(a.sts, u.sts); a.sasTes = pakai(a.sasTes, u.sasTes);
        a.pengetahuan = pakai(a.pengetahuan, u.pengetahuan); a.penerapan = pakai(a.penerapan, u.penerapan);
        hasilGabung[sid] = a;
      }
      return hasilGabung;
    });
    kotor.current = true;
    toast.success(`Terisi dari ${d.sumber.materi} materi Jurnal (${d.sumber.jurnal} catatan nilai) dan ${d.sumber.cbt} hasil CBT. Isian yang sudah ada tidak diubah.`);
  }

  async function aksi(jenis: "kirim" | "tarik" | "kembalikan", alasan?: string) {
    if (jenis === "kirim") {
      if (kotor.current && !(await simpanSekarang())) return;
      const kosong = data!.siswa.filter(s => hasil.get(s.id)?.hpa === null && pengaturan?.jenis !== "DINIYAH").length;
      const pesan = kosong ? `${kosong} siswa belum punya nilai akhir (Lingkup Materi belum diisi). Tetap kirim ke wali kelas?` : "Kirim nilai ini ke wali kelas? Setelah terkirim, form tidak bisa diubah kecuali ditarik kembali.";
      if (!(await confirm(pesan))) return;
    }
    setSibuk(jenis);
    const r = await fetch("/api/rapor/form/isi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId, subject, semester, aksi: jenis, alasan }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) return toast.error(d?.error ?? "Gagal.");
    toast.success(d.pesan); setKembalikan(null); muat();
  }

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><Alert variant="error" title="Form tidak bisa dibuka">{galat}</Alert><button onClick={kembali} className="btn-modal-cancel mt-4"><ArrowLeft /> Kembali</button></div>;
  if (!data || !pengaturan) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  const diniyah = pengaturan.jenis === "DINIYAH";
  const totalBobot = pengaturan.bobot.rph + pengaturan.bobot.sts + pengaturan.bobot.sasTes + pengaturan.bobot.sasNonTes;
  const labelSimpan = simpan === "menyimpan" ? "Menyimpan…" : simpan === "berubah" ? "Ada perubahan…" : simpan === "gagal" ? "Gagal tersimpan" : data.diubahAt ? `Tersimpan ${new Date(data.diubahAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "Belum ada isian";
  const q = new URLSearchParams({ classId, subject, semester }).toString();

  const TABS: [Tab, string][] = diniyah ? [["diniyah", "Nilai Diniyah"]] : [["lm", `Sumatif LM (${lmAktif.length})`], ["tp", `Formatif TP (${tpAktif.length})`], ["ujian", "STS & SAS"], ["hasil", "Hasil & Deskripsi"]];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardPen size={22} />} title={`${data.mapel.nama} — ${data.kelas.nama}`}
        description={`${semester} · Guru: ${data.guru ?? "-"} · Wali kelas: ${data.kelas.wali ?? "-"}`} />

      <div className="baris-alat mb-5">
        <div className="alat-saring flex items-center gap-2 text-sm"><StatusForm status={data.status} dikembalikan={!!data.catatanWali && data.status === "DRAF"} />
          <span className={`text-xs ${simpan === "gagal" ? "text-red-600 font-semibold" : "text-gray-500"}`}>{labelSimpan}</span></div>
        <div className="alat-aksi alat-teks">
          <TombolKembali onClick={kembali} />
          {pengaturan.katrol && !diniyah && <Link href={`${basePath}/katrol?${q}`} className="btn-modal-cancel"><Printer /> Form Katrol</Link>}
          {bolehUbah && <button type="button" onClick={() => setBukaAtur(true)} className="btn-modal-cancel"><Settings2 /> TP, LM & Bobot</button>}
          {bolehUbah && <button type="button" onClick={isiOtomatis} disabled={!!sibuk} className="btn-modal-cancel">{sibuk === "usulan" ? <Loader2 className="animate-spin" /> : <Sparkles />} Isi dari Jurnal & CBT</button>}
          {bolehUbah && <button type="button" onClick={() => simpanSekarang()} disabled={simpan === "menyimpan"} className="btn-modal-cancel"><Save /> Simpan</button>}
          {bolehUbah && data.status !== "DIKIRIM" && <button type="button" onClick={() => aksi("kirim")} disabled={!!sibuk} className="btn-modal-save">{sibuk === "kirim" ? <Loader2 className="animate-spin" /> : <Send />} Kirim ke Wali Kelas</button>}
          {data.status === "DIKIRIM" && data.akses.bolehUbah && data.akses.peran === "GURU" && <button type="button" onClick={() => aksi("tarik")} disabled={!!sibuk} className="btn-modal-cancel"><Undo2 /> Tarik untuk Diubah</button>}
          {data.status === "DIKIRIM" && data.akses.bolehKembalikan && <button type="button" onClick={() => setKembalikan("")} className="btn-hapus"><Undo2 /> Kembalikan ke Guru</button>}
        </div>
      </div>

      {data.terkunci && <Alert variant="info" title="Nilai kelas dikunci wali kelas" className="mb-4">{data.terkunci}</Alert>}
      {data.catatanWali && data.status === "DRAF" && (
        <Alert variant="warning" title="Dikembalikan wali kelas" className="mb-4">{data.catatanWali}</Alert>
      )}
      {data.status === "DIKIRIM" && data.akses.peran === "WALI" && bolehUbah && (
        <Alert variant="info" title="Anda bisa membetulkan nilai ini sebagai wali kelas" className="mb-4">
          Setiap perubahan disimpan otomatis dan tercatat (nilai lama → baru) — guru mapel ({data.guru ?? "-"}) melihat catatannya.
          Bila lebih baik gurunya sendiri yang memperbaiki, pakai Kembalikan ke Guru.
        </Alert>
      )}
      {!!data.riwayatWali?.length && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <button type="button" onClick={() => setLihatRiwayat(v => !v)} className="flex w-full items-center gap-2 text-left font-semibold">
            <History size={16} className="shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              Diubah setelah dikirim: {data.riwayatWali.length} kali, terakhir oleh {data.riwayatWali[data.riwayatWali.length - 1].oleh}{" "}
              {new Date(data.riwayatWali[data.riwayatWali.length - 1].pada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <span className="text-xs font-normal underline">{lihatRiwayat ? "Tutup" : "Lihat rincian"}</span>
          </button>
          {lihatRiwayat && (
            <div className="mt-3 space-y-3">
              {[...data.riwayatWali].reverse().map((e, i) => (
                <div key={`${e.pada}-${i}`}>
                  <p className="text-xs font-semibold">{e.oleh} · {new Date(e.pada).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {Object.entries(e.ubah).map(([k, u]) => (
                      <li key={k}>{u.label}: <span className="line-through text-amber-700/70">{u.dari ?? "kosong"}</span> → <b>{u.ke ?? "kosong"}</b></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {data.status === "DIKIRIM" && (
        <Alert variant="success" title="Sudah dikirim ke wali kelas" className="mb-4">
          Dikirim {data.dikirimOleh ? `oleh ${data.dikirimOleh} ` : ""}{data.dikirimAt ? new Date(data.dikirimAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) : ""}. Nilai ini dipakai rapor kelas.
        </Alert>
      )}
      {!diniyah && !lmAktif.length && (
        <Alert variant="info" title="Tulis dulu Lingkup Materi & Tujuan Pembelajaran" className="mb-4">
          Buka <b>TP, LM & Bobot</b>, atau tekan <b>Isi dari Jurnal &amp; CBT</b> — materi Jurnal Mengajar semester ini dipakai sebagai LM/TP,
          nilainya sebagai nilai LM, dan hasil CBT STS/SAS sebagai nilai STS/SAS. Isian yang sudah ada tidak ditimpa.
        </Alert>
      )}

      <div className="alat-tab flex gap-1 border border-gray-100 bg-white rounded-xl p-1 mb-3 w-fit max-w-full overflow-x-auto">
        {TABS.map(([t, l]) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${tab === t ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center">No</th>
                <th className="min-w-[11rem]">Nama / NIS</th>
                {tab === "hasil" ? (<>
                  <th className="text-center">RPH</th><th className="text-center">STS</th><th className="text-center">SAS</th>
                  <th className="text-center">HPA</th><th className="text-center">PRE</th>
                  <th className="min-w-[16rem] normal-case">Deskripsi Formatif</th><th className="min-w-[16rem] normal-case">Deskripsi Sumatif</th>
                </>) : kolom.map(k => (
                  <th key={k.id} className="text-center min-w-[4.5rem] normal-case" title={(tab === "tp" ? tpAktif : lmAktif).find(x => k.id.startsWith(x.kode + "-"))?.teks}>
                    <span className="block">{k.judul}</span><span className="block text-xs font-medium opacity-70">{k.sub}</span>
                  </th>
                ))}
                {tab === "lm" && <th className="text-center">RPH</th>}
                {tab === "diniyah" && <th className="text-center">Jumlah</th>}
              </tr>
            </thead>
            <tbody>
              {data.siswa.map((s, r) => {
                const n = nilai[s.id] ?? {};
                const h = hasil.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="text-center angka">{r + 1}</td>
                    <td><span className="block font-medium text-gray-800 leading-snug">{s.nama}</span><span className="block text-xs text-gray-400 angka">{s.nis}</span></td>
                    {tab === "hasil" ? (<>
                      <td className="text-center angka">{h?.rph ?? "—"}</td>
                      <td className="text-center angka">{tampilAngka(n.sts) || "—"}</td>
                      <td className="text-center angka">{tampilAngka(n.sasTes) || "—"}</td>
                      <td className="text-center angka font-bold text-primary-900">{h?.hpa ?? "—"}{pengaturan.katrol && h?.hpaAsli !== null && h?.hpaAsli !== h?.hpa && <span className="block text-xs font-normal text-gray-400">asli {h?.hpaAsli}</span>}</td>
                      <td className="text-center"><span className={`font-bold ${h?.predikat === "D" ? "text-red-600" : "text-gray-800"}`}>{h?.predikat ?? "—"}</span></td>
                      <td className="text-xs text-gray-600 align-top">{h?.deskFormatif || <span className="text-gray-300">—</span>}</td>
                      <td className="text-xs text-gray-600 align-top">{h?.deskSumatif || <span className="text-gray-300">—</span>}</td>
                    </>) : kolom.map((k, c) => (
                      <td key={k.id} className="text-center p-1">
                        {k.biner ? (
                          <button type="button" data-sel={`${r}:${c}`} disabled={!bolehUbah} onKeyDown={e => tekanTombol(e, r, c)}
                            onClick={() => ubahNilai(s.id, x => k.set(x, k.get(x) === 1 ? 0 : k.get(x) === 0 ? null : 1))}
                            className={`h-9 w-11 rounded-lg border text-sm font-bold transition ${k.get(n) === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-700" : k.get(n) === 0 ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-200 text-gray-300"} ${bolehUbah ? "hover:border-primary-300" : "cursor-default"}`}>
                            {k.get(n) === 1 ? "1" : k.get(n) === 0 ? "0" : "·"}
                          </button>
                        ) : (
                          <input data-sel={`${r}:${c}`} inputMode="decimal" disabled={!bolehUbah} value={tampilAngka(k.get(n))}
                            onChange={e => ubahNilai(s.id, x => k.set(x, angka(e.target.value)))}
                            onKeyDown={e => tekanTombol(e, r, c)} onPaste={e => tempel(e, r, c)} onFocus={e => e.target.select()}
                            className="h-9 w-16 rounded-lg border border-gray-200 bg-white px-1.5 text-center text-sm angka focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-600" />
                        )}
                      </td>
                    ))}
                    {tab === "lm" && <td className="text-center angka font-semibold text-primary-900">{h?.rph ?? "—"}</td>}
                    {tab === "diniyah" && <td className="text-center angka font-semibold text-primary-900">{(n.pengetahuan ?? 0) + (n.penerapan ?? 0) || "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {tab === "tp" ? "Klik sel: 1 = memenuhi KKTP / ditampilkan, 0 = tidak, · = kosong. Deskripsi formatif memuat TP yang KKTP 1 dan Tampil 1." :
          tab === "hasil" ? `HPA = (RPH×${pengaturan.bobot.rph} + STS×${pengaturan.bobot.sts} + SAS Tes×${pengaturan.bobot.sasTes} + SAS Non Tes×${pengaturan.bobot.sasNonTes}) ÷ ${totalBobot}. Predikat: >89 A · >79 B · >69 C · selainnya D.${pengaturan.katrol ? ` Dikatrol (KKM ${pengaturan.kkm}): nilai LM & SAS = KKM + nilai × (100 − KKM) ÷ 100; STS tetap asli.` : ""}` :
          "Enter / ↑ ↓ untuk pindah baris. Blok nilai dari Excel bisa langsung ditempel (Ctrl+V) mulai sel yang dipilih. Siswa yang tidak mengikuti tes diisi 0, jangan dikosongkan."}
      </p>

      {/* PENGATURAN: TP, LM, bobot, KKM, katrol */}
      <Modal open={bukaAtur} onClose={() => setBukaAtur(false)} title="Tujuan Pembelajaran, Lingkup Materi & Bobot" size="xl" scrollBody
        footer={<button type="button" onClick={() => setBukaAtur(false)} className="btn-modal-save"><CheckCircle2 /> Selesai</button>}>
        <div className="space-y-5">
          {!diniyah && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(["tp", "lm"] as const).map(jenis => (
                <div key={jenis} className="min-w-0">
                  <p className="font-heading font-bold text-primary-900 mb-2">{jenis === "tp" ? "Tujuan Pembelajaran (formatif)" : "Lingkup Materi (sumatif)"}</p>
                  <div className="space-y-1.5">
                    {pengaturan[jenis].map((t, i) => (
                      <div key={t.kode} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs font-bold text-gray-500">{t.kode}</span>
                        <input value={t.teks} disabled={!bolehUbah} maxLength={300}
                          onChange={e => ubahAtur({ [jenis]: pengaturan[jenis].map((x, k) => (k === i ? { ...x, teks: e.target.value } : x)) })}
                          placeholder={jenis === "tp" ? "Ringkasan tujuan pembelajaran" : "Ringkasan lingkup materi"} className="input-field flex-1 py-1.5" />
                        <span className={`w-8 shrink-0 text-right text-xs angka ${t.teks.length > 60 ? "text-amber-600" : "text-gray-400"}`}>{t.teks.length || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div><label className="label-field">KKM</label><input type="number" min={0} max={100} disabled={!bolehUbah} value={pengaturan.kkm} onChange={e => ubahAtur({ kkm: Number(e.target.value) || 0 })} className="input-field w-full" /></div>
            {!diniyah && (["rph", "sts", "sasTes", "sasNonTes"] as const).map(k => (
              <div key={k}><label className="label-field">Bobot {k === "rph" ? "RPH" : k === "sts" ? "STS" : k === "sasTes" ? "SAS Tes" : "SAS Non Tes"}</label>
                <input type="number" min={0} max={100} disabled={!bolehUbah} value={pengaturan.bobot[k]} onChange={e => ubahAtur({ bobot: { ...pengaturan.bobot, [k]: Number(e.target.value) || 0 } })} className="input-field w-full" /></div>
            ))}
          </div>
          {!diniyah && totalBobot !== 100 && <p className="text-xs text-amber-700">Jumlah bobot {totalBobot} — nilai akhir tetap dibagi jumlah bobot (seperti makro), tetapi lazimnya 100.</p>}
          {!diniyah && (
            <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
              <input type="checkbox" checked={pengaturan.katrol} disabled={!bolehUbah} onChange={e => ubahAtur({ katrol: e.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-700" />
              <span><b>Pakai nilai katrol</b> (Form Katrol sekolah): nilai LM &amp; SAS diubah menjadi KKM + nilai × (100 − KKM) ÷ 100 sebelum dihitung.
                STS <b>tetap nilai asli</b>. Nilai asli tetap tersimpan dan tercetak di Form Katrol.</span>
            </label>
          )}
        </div>
      </Modal>

      <Modal open={kembalikan !== null} onClose={() => setKembalikan(null)} title="Kembalikan ke Guru Mapel" description="Form kembali ke draf dan guru bisa memperbaikinya" size="md"
        footer={<>
          <button type="button" onClick={() => setKembalikan(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={() => aksi("kembalikan", kembalikan ?? "")} disabled={!!sibuk} className="btn-hapus"><Undo2 /> Kembalikan</button>
        </>}>
        <label htmlFor="alasan-kembali" className="label-field">Yang perlu diperbaiki</label>
        <textarea id="alasan-kembali" value={kembalikan ?? ""} onChange={e => setKembalikan(e.target.value)} rows={3} className="input-field w-full" placeholder="mis. Nilai SAS belum diisi untuk 3 siswa" />
      </Modal>
    </div>
  );
}
