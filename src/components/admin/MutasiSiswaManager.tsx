"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, LogOut, LogIn, ListChecks, Search, CheckCircle2, CircleDashed, ExternalLink, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

type Kelas = { id: string; name: string; grade: number; majorId: string };
type Baris = { id: string; nama: string; kelas: string | null; arah: "KELUAR" | "MASUK"; status: string; tanggal: string; lain: string; sisaManual: number };
type Butir = { kunci: string; label: string; beres: boolean; ket?: string; href?: string; manual?: boolean };
type Periksa = { arah: "KELUAR" | "MASUK" | null; butir: Butir[]; nama: string; kelas: string | null; status: string };
type Calon = { id: string; nis: string; nama: string; kelas: string | null };
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** MUTASI SISWA SATU PINTU (9 Okt 2026) — satu formulir untuk pindah/keluar dan pindah masuk; sistem mengerjakan semua yang
 *  bisa dikerjakan sendiri (status, Buku Induk, Buku Mutasi, surat bernomor, akun) lalu menampilkan DAFTAR PERIKSA berisi
 *  sisanya (Dapodik, berkas, perpustakaan, PKL). */
export default function MutasiSiswaManager() {
  const toast = useToast();
  const [d, setD] = useState<{ kelas: Kelas[]; terbaru: Baris[] } | null>(null);
  const [tab, setTab] = useState<"daftar" | "keluar" | "masuk">("daftar");
  const [sibuk, setSibuk] = useState(false);
  const [periksa, setPeriksa] = useState<{ id: string; data: Periksa | null } | null>(null);
  // keluar
  const [cari, setCari] = useState("");
  const [calon, setCalon] = useState<Calon[]>([]);
  const [pilih, setPilih] = useState<Calon | null>(null);
  const [k, setK] = useState({ jenis: "PINDAH", tanggal: hariIni(), tujuan: "", alasan: "", buatSurat: true });
  // masuk
  const kosong = { nama: "", gender: "", classId: "", nisn: "", birthPlace: "", birthDate: "", address: "", parentName: "", parentPhone: "", asal: "", kelasAsal: "", nomorSuratAsal: "", alasan: "", tanggal: hariIni(), buatSurat: false };
  const [m, setM] = useState(kosong);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [hasil, setHasil] = useState<{ nis: string; email: string } | null>(null);

  const muat = useCallback(() => {
    fetch("/api/admin/mutasi-siswa").then(r => r.json()).then(x => { if (x.error) toast.error(x.error); else setD(x); }).catch(() => toast.error("Gagal memuat data mutasi."));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (cari.trim().length < 2 || pilih) { setCalon([]); return; }
    const t = setTimeout(() => { fetch(`/api/admin/mutasi-siswa?cari=${encodeURIComponent(cari.trim())}`).then(r => r.json()).then(x => setCalon(x.siswa ?? [])).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [cari, pilih]);

  const bukaPeriksa = useCallback((id: string) => {
    setPeriksa({ id, data: null });
    fetch(`/api/admin/mutasi-siswa?periksa=${id}`).then(r => r.json()).then(x => setPeriksa(x.error ? null : { id, data: x })).catch(() => setPeriksa(null));
  }, []);
  async function kirim(body: Record<string, unknown>) {
    setSibuk(true); setGalat({});
    try {
      const r = await fetch("/api/admin/mutasi-siswa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setGalat(j.kolom ?? {}); toast.error(j.error ?? "Gagal menyimpan mutasi."); return null; }
      return j as { studentId: string; nis?: string; email?: string; surat?: { nomor: string } | null };
    } catch { toast.error("Gagal menyimpan mutasi."); return null; } finally { setSibuk(false); }
  }
  async function simpanKeluar() {
    if (!pilih) { toast.error("Pilih siswanya dulu."); return; }
    const j = await kirim({ arah: "KELUAR", studentId: pilih.id, ...k });
    if (!j) return;
    toast.success(`Mutasi keluar ${pilih.nama} tercatat${j.surat ? ` — surat ${j.surat.nomor}` : ""}.`);
    setPilih(null); setCari(""); setK({ jenis: "PINDAH", tanggal: hariIni(), tujuan: "", alasan: "", buatSurat: true }); setTab("daftar"); muat(); bukaPeriksa(j.studentId);
  }
  async function simpanMasuk() {
    const j = await kirim({ arah: "MASUK", ...m });
    if (!j) return;
    toast.success(`${m.nama} terdaftar — NIS ${j.nis}.`);
    setHasil({ nis: j.nis ?? "", email: j.email ?? "" }); setM(kosong); setTab("daftar"); muat(); bukaPeriksa(j.studentId);
  }
  async function centang(b: Butir) {
    if (!periksa?.data) return;
    const baru = periksa.data.butir.filter(x => x.manual && (x.kunci === b.kunci ? !x.beres : x.beres)).map(x => x.kunci);
    setPeriksa(p => (p?.data ? { ...p, data: { ...p.data, butir: p.data.butir.map(x => (x.kunci === b.kunci && x.manual ? { ...x, beres: !x.beres } : x)) } } : p));
    const r = await fetch("/api/admin/mutasi-siswa", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: periksa.id, centang: baru }) }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menyimpan centang."); bukaPeriksa(periksa.id); } else muat();
  }

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const keluar = d.terbaru.filter(x => x.arah === "KELUAR"), masuk = d.terbaru.filter(x => x.arah === "MASUK");
  const isi = (kunci: keyof typeof m) => (e: { target: { value: string } }) => setM(s => ({ ...s, [kunci]: e.target.value }));
  const salah = (kunci: string) => galat[kunci] && <p className="mt-1 text-xs text-red-600">{galat[kunci]}</p>;
  const TABS: [typeof tab, string][] = [["daftar", "Daftar & periksa"], ["keluar", "Pindah / keluar"], ["masuk", "Pindah masuk"]];
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ArrowLeftRight size={22} />} title="Mutasi Siswa" description="Satu formulir untuk siswa pindah, keluar, dan pindah masuk — lengkap dengan daftar periksanya" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={keluar.length} label="Pindah / keluar (setahun terakhir)" icon={LogOut} color="amber" />
          <StatTile value={masuk.length} label="Pindah masuk (setahun terakhir)" icon={LogIn} color="emerald" />
          <StatTile value={d.terbaru.filter(x => x.sisaManual > 0).length} label="Masih ada langkah belum dicentang" icon={ListChecks} color="red" sorot={d.terbaru.some(x => x.sisaManual > 0)} />
        </div>
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {TABS.map(([v, l]) => <button key={v} type="button" onClick={() => setTab(v)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === v ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>)}
          </div>
        </div>
        {hasil && tab === "daftar" && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Akun siswa baru: NIS <span className="angka font-semibold">{hasil.nis}</span> · masuk dengan <span className="font-semibold">{hasil.email}</span> dan sandi bawaan sekolah.</p>}

        {tab === "daftar" && (
          <div className="panel overflow-hidden">
            {d.terbaru.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada mutasi dalam setahun terakhir.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Siswa</th><th>Mutasi</th><th>Tanggal</th><th>Dari / ke</th><th className="text-right">Daftar periksa</th></tr></thead>
                  <tbody>{d.terbaru.map((x, i) => (
                    <tr key={x.id}>
                      <td className="angka">{i + 1}</td>
                      <td><span className="font-medium text-primary-900">{x.nama}</span><span className="block text-xs text-gray-400">{x.kelas ?? "—"}</span></td>
                      <td><span className={`status-badge ${x.arah === "MASUK" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{x.arah === "MASUK" ? "Masuk" : x.status === "PINDAH" ? "Pindah" : "Keluar"}</span></td>
                      <td className="angka whitespace-nowrap text-gray-600">{tgl(x.tanggal)}</td>
                      <td className="text-gray-600">{x.lain || "—"}</td>
                      <td><div className="flex justify-end"><button type="button" className="btn-modal-cancel btn-teks px-3 text-xs" onClick={() => bukaPeriksa(x.id)}><ListChecks size={14} /> {x.sisaManual ? `${x.sisaManual} belum` : "Lengkap"}</button></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "keluar" && (
          <div className="panel max-w-2xl space-y-4 p-5">
            <div className="relative">
              <label className="label-field">Siswa</label>
              {pilih ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium text-primary-900">{pilih.nama} <span className="font-normal text-gray-500">· {pilih.kelas ?? "tanpa kelas"} · {pilih.nis}</span></span>
                  <button type="button" className="shrink-0 text-xs font-semibold text-primary-700 hover:underline" onClick={() => { setPilih(null); setCari(""); }}>Ganti</button>
                </div>
              ) : (
                <>
                  <div className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Ketik nama, NIS, atau NISN siswa aktif" /></div>
                  {calon.length > 0 && <ul className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">{calon.map(c => <li key={c.id}><button type="button" className="sentuh block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => setPilih(c)}>{c.nama} <span className="text-xs text-gray-400">· {c.kelas ?? "tanpa kelas"} · {c.nis}</span></button></li>)}</ul>}
                </>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label-field">Jenis</label><Select value={k.jenis} onChange={v => setK(s => ({ ...s, jenis: v }))} options={[{ value: "PINDAH", label: "Pindah ke sekolah lain" }, { value: "KELUAR", label: "Keluar / berhenti" }]} /></div>
              <div><label className="label-field">Tanggal</label><DatePicker value={k.tanggal} onChange={v => setK(s => ({ ...s, tanggal: v }))} /></div>
            </div>
            {k.jenis === "PINDAH" && <div><label className="label-field">Sekolah tujuan</label><input className="input-field" value={k.tujuan} onChange={e => setK(s => ({ ...s, tujuan: e.target.value }))} placeholder="Mis. SMK Negeri 1 Banyuwangi" /></div>}
            <div><label className="label-field">Alasan</label><textarea className="input-field" rows={2} value={k.alasan} onChange={e => setK(s => ({ ...s, alasan: e.target.value }))} placeholder="Mis. mengikuti orang tua pindah tugas" /></div>
            {k.jenis === "PINDAH" && <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1" checked={k.buatSurat} onChange={e => setK(s => ({ ...s, buatSurat: e.target.checked }))} /> Buat Surat Keterangan Pindah sekarang (nomor dari agenda surat TU, bisa dirapikan di Persuratan)</label>}
            <div className="rounded-xl bg-[#f5f6fa] px-4 py-3 text-xs text-gray-600">Yang dikerjakan sistem saat disimpan: status siswa, tanggal & alasan di Buku Induk, otomatis masuk Buku Mutasi, surat pindah bernomor, dan akun siswa dikeluarkan dari semua perangkat. Sisanya muncul di daftar periksa.</div>
            <div className="flex justify-end"><button type="button" className="btn-awas" disabled={sibuk} onClick={simpanKeluar}>{sibuk ? <Loader2 size={14} className="animate-spin" /> : <Save size={16} />} Catat Mutasi Keluar</button></div>
          </div>
        )}

        {tab === "masuk" && (
          <div className="panel max-w-3xl space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label-field">Nama lengkap</label><input className="input-field" value={m.nama} onChange={isi("nama")} />{salah("nama")}</div>
              <div><label className="label-field">Jenis kelamin</label><Select value={m.gender} onChange={v => setM(s => ({ ...s, gender: v }))} placeholder="Pilih" options={[{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }]} />{salah("gender")}</div>
              <div><label className="label-field">Masuk ke kelas</label><Select value={m.classId} onChange={v => setM(s => ({ ...s, classId: v }))} placeholder="Pilih kelas" options={d.kelas.map(c => ({ value: c.id, label: c.name }))} />{salah("classId")}</div>
              <div><label className="label-field">Tanggal diterima</label><DatePicker value={m.tanggal} onChange={v => setM(s => ({ ...s, tanggal: v }))} /></div>
              <div><label className="label-field">Sekolah asal</label><input className="input-field" value={m.asal} onChange={isi("asal")} placeholder="Mis. SMK PGRI 2 Genteng" />{salah("asal")}</div>
              <div><label className="label-field">Kelas di sekolah asal</label><input className="input-field" value={m.kelasAsal} onChange={isi("kelasAsal")} placeholder="Mis. XI TKJ 2" /></div>
              <div><label className="label-field">Nomor surat pindah dari sekolah asal</label><input className="input-field" value={m.nomorSuratAsal} onChange={isi("nomorSuratAsal")} /></div>
              <div><label className="label-field">NISN</label><input className="input-field" inputMode="numeric" value={m.nisn} onChange={e => setM(s => ({ ...s, nisn: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="10 angka" />{salah("nisn")}</div>
              <div><label className="label-field">Tempat lahir</label><input className="input-field" value={m.birthPlace} onChange={isi("birthPlace")} /></div>
              <div><label className="label-field">Tanggal lahir</label><DatePicker value={m.birthDate} onChange={v => setM(s => ({ ...s, birthDate: v }))} /></div>
              <div><label className="label-field">Nama orang tua / wali</label><input className="input-field" value={m.parentName} onChange={isi("parentName")} /></div>
              <div><label className="label-field">Nomor HP orang tua</label><input className="input-field" inputMode="tel" value={m.parentPhone} onChange={isi("parentPhone")} /></div>
            </div>
            <div><label className="label-field">Alamat</label><textarea className="input-field" rows={2} value={m.address} onChange={isi("address")} /></div>
            <div><label className="label-field">Alasan pindah ke sekolah ini</label><input className="input-field" value={m.alasan} onChange={isi("alasan")} /></div>
            <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1" checked={m.buatSurat} onChange={e => setM(s => ({ ...s, buatSurat: e.target.checked }))} /> Buat Surat Kesediaan Menerima untuk sekolah asal</label>
            <div className="rounded-xl bg-[#f5f6fa] px-4 py-3 text-xs text-gray-600">Yang dikerjakan sistem saat disimpan: akun & NIS baru (urutan resmi sekolah), kelas, data pindahan di Buku Induk, otomatis masuk Buku Mutasi. Data lain dilengkapi kemudian di Buku Induk.</div>
            <div className="flex justify-end"><button type="button" className="btn-modal-save" disabled={sibuk} onClick={simpanMasuk}>{sibuk ? <Loader2 size={14} className="animate-spin" /> : <Save size={16} />} Daftarkan Siswa Pindahan</button></div>
          </div>
        )}
      </div>

      <Modal open={!!periksa} onClose={() => setPeriksa(null)} size="lg" scrollBody title="Daftar Periksa Mutasi" description={periksa?.data ? `${periksa.data.nama} · ${periksa.data.kelas ?? "tanpa kelas"}` : ""}
        footer={<button type="button" className="btn-modal-cancel" onClick={() => setPeriksa(null)}>Tutup</button>}>
        {!periksa?.data ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : periksa.data.butir.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Siswa ini tidak tercatat sebagai mutasi.</p> : (
          <>
            <p className="mb-3 text-sm text-gray-600"><span className="angka font-semibold text-primary-900">{periksa.data.butir.filter(b => b.beres).length}</span> dari <span className="angka">{periksa.data.butir.length}</span> langkah beres. Yang bertanda kotak dicentang petugas; sisanya dibaca dari data.</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {periksa.data.butir.map(b => (
                <li key={b.kunci} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {b.manual ? <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={b.beres} onChange={() => centang(b)} aria-label={b.label} />
                    : b.beres ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleDashed size={18} className="mt-0.5 shrink-0 text-amber-600" />}
                  <span className="min-w-0 flex-1"><span className={b.beres ? "text-gray-700" : "font-medium text-primary-900"}>{b.label}</span>{b.ket && <span className={`block text-xs ${b.beres ? "text-gray-400" : "text-amber-700"}`}>{b.ket}</span>}</span>
                  {b.href && <a href={b.href} className="shrink-0 text-primary-700 hover:text-primary-900" title="Buka"><ExternalLink size={16} /></a>}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
