"use client";
import { useSorotBaris } from "@/lib/cari-awal";
import { useCallback, useEffect, useState } from "react";
import { Forward, Loader2, FileText, Inbox, Send, Archive, PenLine, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import PenyuntingTtd from "@/components/shared/PenyuntingTtd";
import { useToast } from "@/components/shared/ToastProvider";

type Surat = { id: string; nomor: string; tanggal: string; pihak: string; perihal: string; keterangan: string | null; fileUrl: string | null };
type Disposisi = { id: string; tanggal: string; tujuan: string[]; instruksi: string; sifat: string; status: string; tindakLanjut: string | null; batasWaktu: string | null; dariNama?: string | null; surat: Surat };
type Data = { pimpinan: boolean; punyaTtd: boolean; nama: string; menunggu: Surat[]; riwayat: Disposisi[]; untukSaya: Disposisi[]; tujuan: { jabatan: string[]; pegawai: string[] } };

const SIFAT = [{ value: "BIASA", label: "Biasa" }, { value: "SEGERA", label: "Segera" }, { value: "SANGAT_SEGERA", label: "Sangat segera" }, { value: "RAHASIA", label: "Rahasia" }];
const STATUS: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Belum ditindaklanjuti", kelas: "bg-red-50 text-red-600 border-red-200" },
  DIPROSES: { label: "Sedang diproses", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const CEPAT = ["Mohon ditindaklanjuti.", "Untuk diketahui.", "Mohon dihadiri dan dilaporkan hasilnya.", "Koordinasikan dengan pihak terkait.", "Siapkan jawaban / bahan."];
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const gambar = (u: string | null) => !!u && /\.(jpe?g|png|webp)$/i.test(u);

function Pindaian({ s }: { s: Surat }) {
  if (!s.fileUrl) return <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">Surat ini dicatat tanpa pindaian.</p>;
  return gambar(s.fileUrl)
    // eslint-disable-next-line @next/next/no-img-element
    ? <a href={s.fileUrl} target="_blank" rel="noreferrer"><img src={s.fileUrl} alt={`Pindaian surat ${s.perihal}`} className="max-h-[60dvh] w-full rounded-xl border border-gray-200 object-contain" /></a>
    : <a href={s.fileUrl} target="_blank" rel="noreferrer" className="btn-modal-cancel"><ExternalLink size={16} /> Buka berkas surat</a>;
}

/** DISPOSISI SURAT DARI HP (9 Okt 2026) — pimpinan membaca pindaian, memilih tujuan, menulis instruksi, dan menandatangani
 *  di layar; penerima melaporkan tindak lanjutnya di halaman yang sama. Dipakai portal guru & admin (cakupan dari server). */
export default function DisposisiSuratHp() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"menunggu" | "saya" | "riwayat">("saya");
  const [buka, setBuka] = useState<Surat | null>(null);
  const [f, setF] = useState({ tujuan: [] as string[], instruksi: "", sifat: "BIASA", batasWaktu: "", tandaTangani: true });
  const [orang, setOrang] = useState("");
  const [gambarTtd, setGambarTtd] = useState(false);
  const [tindak, setTindak] = useState<Disposisi | null>(null);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback((awal = false) => {
    fetch("/api/disposisi-surat").then(r => r.json()).then((x: Data & { error?: string }) => {
      if (x.error) { toast.error(x.error); return; }
      setD(x); if (awal) setTab(x.pimpinan && x.menunggu.length ? "menunggu" : "saya");
    }).catch(() => toast.error("Gagal memuat disposisi."));
  }, [toast]);
  useEffect(() => { muat(true); }, [muat]);
  useSorotBaris();

  function mulai(s: Surat) { setBuka(s); setF({ tujuan: [], instruksi: "", sifat: "BIASA", batasWaktu: "", tandaTangani: true }); setOrang(""); setGambarTtd(false); }
  const alih = (t: string) => setF(s => ({ ...s, tujuan: s.tujuan.includes(t) ? s.tujuan.filter(x => x !== t) : [...s.tujuan, t] }));
  async function kirim(arsip = false) {
    if (!buka) return;
    setSibuk(true);
    const body = arsip ? { suratId: buka.id, tujuan: ["Arsip"], instruksi: "Cukup diketahui, untuk diarsipkan.", sifat: "BIASA", tandaTangani: f.tandaTangani && !!d?.punyaTtd }
      : { suratId: buka.id, ...f, batasWaktu: f.batasWaktu || null, tandaTangani: f.tandaTangani && !!d?.punyaTtd };
    const r = await fetch("/api/disposisi-surat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan disposisi."); return; }
    toast.success(arsip ? "Surat diarsipkan." : "Disposisi terkirim ke yang dituju."); setBuka(null); muat();
  }
  async function lapor(status: "DIPROSES" | "SELESAI") {
    if (!tindak) return;
    setSibuk(true);
    const r = await fetch(`/api/disposisi-surat/${tindak.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, tindakLanjut: catatan }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan."); return; }
    toast.success("Tindak lanjut tersimpan."); setTindak(null); setCatatan(""); muat();
  }

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const belumSaya = d.untukSaya.filter(x => x.status !== "SELESAI").length;
  const tabs = [...(d.pimpinan ? [["menunggu", `Menunggu disposisi (${d.menunggu.length})`]] : []), ["saya", `Untuk saya (${belumSaya})`], ...(d.pimpinan ? [["riwayat", "Disposisi saya"]] : [])] as [typeof tab, string][];
  const daftar = tab === "saya" ? d.untukSaya : d.riwayat;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Forward size={22} />} title="Disposisi Surat" description={d.pimpinan ? "Baca surat masuk, tulis disposisi, dan tanda tangani dari HP" : "Disposisi pimpinan yang ditujukan kepada Anda"} />
      <div className="space-y-6">
        <div className={`kisi-kartu ${d.pimpinan ? "kisi-kartu-3" : ""}`}>
          {d.pimpinan && <StatTile value={d.menunggu.length} label="Surat menunggu disposisi" icon={Inbox} color="amber" sorot={d.menunggu.length > 0} />}
          <StatTile value={belumSaya} label="Disposisi untuk saya belum selesai" icon={Clock} color="blue" sorot={belumSaya > 0} />
          <StatTile value={d.untukSaya.length - belumSaya} label="Sudah saya selesaikan" icon={CheckCircle2} color="emerald" />
        </div>
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>)}
          </div>
        </div>

        {tab === "menunggu" ? (
          d.menunggu.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada surat masuk yang menunggu disposisi.</p> : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {d.menunggu.map(s => (
                <li key={s.id} data-baris={s.id} className="panel flex min-w-0 flex-col gap-2 p-4">
                  <p className="text-xs text-gray-400"><span className="angka">{tgl(s.tanggal)}</span> · {s.nomor}</p>
                  <p className="font-semibold text-primary-900">{s.perihal}</p>
                  <p className="text-sm text-gray-600">Dari {s.pihak}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400"><FileText size={14} /> {s.fileUrl ? "ada pindaian" : "tanpa pindaian"}</span>
                    <button type="button" className="btn-modal-save" onClick={() => mulai(s)}><PenLine size={16} /> Disposisi</button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : daftar.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{tab === "saya" ? "Belum ada disposisi yang ditujukan kepada Anda." : "Anda belum menulis disposisi dari halaman ini."}</p> : (
          <ul className="space-y-4">
            {daftar.map(x => (
              <li key={x.id} data-baris={x.id} className="panel min-w-0 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`status-badge ${STATUS[x.status]?.kelas ?? ""}`}>{STATUS[x.status]?.label ?? x.status}</span>
                  {x.sifat !== "BIASA" && <span className="status-badge bg-red-50 text-red-600 border-red-200">{SIFAT.find(s => s.value === x.sifat)?.label}</span>}
                  {x.batasWaktu && <span className="angka text-xs text-amber-700">batas {tgl(x.batasWaktu)}</span>}
                  <span className="angka ml-auto text-xs text-gray-400">{tgl(x.tanggal)}</span>
                </div>
                <p className="mt-2 font-semibold text-primary-900">{x.surat.perihal}</p>
                <p className="text-sm text-gray-500">Dari {x.surat.pihak} · {x.surat.nomor}{x.dariNama ? ` · disposisi ${x.dariNama}` : ""}</p>
                <p className="mt-2 whitespace-pre-line rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">{x.instruksi}</p>
                <p className="mt-1 text-xs text-gray-500">Kepada: {x.tujuan.join(", ")}</p>
                {x.tindakLanjut && <p className="mt-2 whitespace-pre-line text-sm text-gray-600"><span className="font-medium">Tindak lanjut:</span> {x.tindakLanjut}</p>}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {x.surat.fileUrl && <a href={x.surat.fileUrl} target="_blank" rel="noreferrer" className="btn-modal-cancel px-3 text-xs"><ExternalLink size={14} /> Lihat surat</a>}
                  {tab === "saya" && x.status !== "SELESAI" && <button type="button" className="btn-modal-save px-3 text-xs" onClick={() => { setTindak(x); setCatatan(""); }}><Send size={14} /> Laporkan tindak lanjut</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!buka} onClose={() => setBuka(null)} size="lg" scrollBody title="Disposisi Surat" description={buka ? `${buka.pihak} · ${buka.nomor}` : ""}
        footer={<><button type="button" className="btn-modal-cancel" disabled={sibuk} onClick={() => kirim(true)}><Archive size={16} /> Cukup Arsipkan</button><button type="button" className="btn-modal-save" disabled={sibuk || gambarTtd} onClick={() => kirim()}>{sibuk ? <Loader2 size={14} className="animate-spin" /> : <Send size={16} />} Kirim Disposisi</button></>}>
        {buka && (
          <div className="space-y-4">
            <div><p className="font-semibold text-primary-900">{buka.perihal}</p>{buka.keterangan && <p className="mt-1 text-sm text-gray-500">{buka.keterangan}</p>}</div>
            <Pindaian s={buka} />
            <div>
              <label className="label-field">Diteruskan kepada</label>
              <div className="flex flex-wrap gap-1.5">
                {d.tujuan.jabatan.map(t => <button key={t} type="button" onClick={() => alih(t)} aria-pressed={f.tujuan.includes(t)} className={`sentuh rounded-lg border px-3 py-1.5 text-sm transition ${f.tujuan.includes(t) ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{t}</button>)}
              </div>
              <div className="mt-2"><Select value={orang} onChange={v => { if (v && !f.tujuan.includes(v)) alih(v); setOrang(""); }} placeholder="Atau pilih nama guru / staf…" options={d.tujuan.pegawai.map(p => ({ value: p, label: p }))} /></div>
              {f.tujuan.filter(t => !d.tujuan.jabatan.includes(t)).length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{f.tujuan.filter(t => !d.tujuan.jabatan.includes(t)).map(t => <button key={t} type="button" onClick={() => alih(t)} className="status-badge bg-primary-50 text-primary-700 border-primary-100" title="Ketuk untuk melepas">{t} ×</button>)}</p>}
            </div>
            <div>
              <label className="label-field">Instruksi</label>
              <div className="mb-2 flex flex-wrap gap-1.5">{CEPAT.map(c => <button key={c} type="button" onClick={() => setF(s => ({ ...s, instruksi: s.instruksi ? `${s.instruksi} ${c}` : c }))} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">{c}</button>)}</div>
              <textarea className="input-field" rows={3} value={f.instruksi} onChange={e => setF(s => ({ ...s, instruksi: e.target.value }))} placeholder="Apa yang harus dilakukan" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Sifat</label><Select value={f.sifat} onChange={v => setF(s => ({ ...s, sifat: v }))} options={SIFAT} /></div>
              <div><label className="label-field">Batas waktu (boleh kosong)</label><DatePicker value={f.batasWaktu} onChange={v => setF(s => ({ ...s, batasWaktu: v }))} /></div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3">
              {d.punyaTtd ? (
                <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1" checked={f.tandaTangani} onChange={e => setF(s => ({ ...s, tandaTangani: e.target.checked }))} /><span>Bubuhkan tanda tangan saya ({d.nama}) pada lembar disposisi.<button type="button" className="ml-2 text-primary-700 hover:underline" onClick={() => setGambarTtd(v => !v)}>{gambarTtd ? "Batal mengganti" : "Ganti tanda tangan"}</button></span></label>
              ) : !gambarTtd ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600"><span>Tanda tangan Anda belum tersimpan. Lembar disposisi akan tercetak tanpa tanda tangan.</span><button type="button" className="btn-modal-cancel px-3 text-xs" onClick={() => setGambarTtd(true)}><PenLine size={14} /> Tanda tangani di layar</button></div>
              ) : null}
              {gambarTtd && <div className="mt-3"><PenyuntingTtd endpoint="/api/ttd/saya" onBatal={() => setGambarTtd(false)} onSelesai={() => { setGambarTtd(false); setF(s => ({ ...s, tandaTangani: true })); muat(); toast.success("Tanda tangan tersimpan."); }} /></div>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!tindak} onClose={() => setTindak(null)} title="Tindak Lanjut Disposisi" description={tindak?.surat.perihal ?? ""}
        footer={<><button type="button" className="btn-modal-cancel" disabled={sibuk} onClick={() => lapor("DIPROSES")}>Sedang Diproses</button><button type="button" className="btn-modal-save" disabled={sibuk} onClick={() => lapor("SELESAI")}>{sibuk && <Loader2 size={14} className="animate-spin" />} Selesai</button></>}>
        <p className="mb-3 whitespace-pre-line rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">{tindak?.instruksi}</p>
        <label className="label-field">Apa yang sudah dilakukan</label>
        <textarea className="input-field" rows={4} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Wajib diisi bila selesai; boleh kosong bila masih diproses" />
      </Modal>
    </div>
  );
}
