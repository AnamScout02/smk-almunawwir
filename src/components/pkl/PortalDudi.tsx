"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, CheckCircle2, ChevronDown, Signature, ClipboardCheck, TriangleAlert, Send, UserRound } from "lucide-react";
import Select from "@/components/admin/Select";
import LencanaFotoJurnal from "@/components/pkl/LencanaFotoJurnal";

type Jurnal = { id: string; date: string; activity: string; photoUrl: string | null; fotoTerverifikasi: boolean; kompetensi: string[] };
type Siswa = {
  id: string; nama: string; kelas: string; jurusan: string; posisi: string; mulai: string; selesai: string; status: string; guru: string | null;
  presensiHariIni: string; rekap: Record<string, number>; jurnal: Jurnal[]; nilai: Record<string, number> | null; rata: number | null; catatan: string | null; penilai: string | null;
};
type Data = { dudi: string; sekolah: string; hariIni: string; aspek: { kunci: string; label: string }[]; jenisLaporan: Record<string, string>; siswa: Siswa[] };

const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STATUS = [
  { v: "HADIR", label: "Hadir", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { v: "IZIN", label: "Izin", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  { v: "SAKIT", label: "Sakit", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  { v: "ALPHA", label: "Tanpa kabar", kelas: "bg-red-50 text-red-600 border-red-200" },
];
const KUNCI_NAMA = "portal-dudi-nama";

/** PORTAL INDUSTRI (9 Okt 2026) — halaman pembimbing industri tanpa akun. Nama pengisi diminta sekali (disimpan di
 *  perangkat itu) dan ikut tercatat pada presensi, paraf jurnal, nilai, dan laporan. */
export default function PortalDudi({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [nama, setNama] = useState("");
  const [namaSiap, setNamaSiap] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const url = `/api/portal-dudi/${encodeURIComponent(token)}`;

  const muat = useCallback(() => {
    return fetch(url, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) { setGalat(x?.error ?? "Tautan tidak berlaku."); return; }
      setD(x);
    }).catch(() => setGalat("Gagal memuat. Periksa koneksi internet."));
  }, [url]);
  useEffect(() => {
    try { const n = localStorage.getItem(KUNCI_NAMA); if (n) { setNama(n); setNamaSiap(true); } } catch { /* mode privat */ }
    muat();
  }, [muat]);

  async function kirim(body: Record<string, unknown>, teksOk: string): Promise<boolean> {
    setSibuk(true); setPesan(null);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, nama }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { setPesan({ jenis: "ok", teks: teksOk }); await muat(); return true; }
    setPesan({ jenis: "galat", teks: x?.error ?? "Gagal menyimpan. Coba lagi." });
    return false;
  }

  if (galat) return <Kulit><p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{galat}</p></Kulit>;
  if (!d) return <Kulit><div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div></Kulit>;

  if (!namaSiap) return (
    <Kulit judul={d.dudi} sub={d.sekolah}>
      <div className="panel p-5">
        <p className="font-heading font-semibold text-primary-900">Siapa yang mengisi?</p>
        <p className="mt-1 text-sm text-gray-500">Nama Anda dicatat pada presensi, paraf jurnal, dan nilai yang Anda isi. Cukup sekali di perangkat ini.</p>
        <label className="label-field mt-4">Nama lengkap</label>
        <input className="input-field" value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Budi Santoso" />
        <button type="button" disabled={nama.trim().length < 3} className="btn-modal-save mt-4 w-full"
          onClick={() => { try { localStorage.setItem(KUNCI_NAMA, nama.trim()); } catch { /* abaikan */ } setNama(nama.trim()); setNamaSiap(true); }}>
          <UserRound /> Lanjut
        </button>
      </div>
    </Kulit>
  );

  const berjalan = d.siswa.filter(s => s.status === "ONGOING");
  return (
    <Kulit judul={d.dudi} sub={`${d.sekolah} · ${d.siswa.length} siswa PKL`}>
      <p className="text-sm text-gray-500">Mengisi sebagai <span className="font-medium text-primary-900">{nama}</span>.{" "}
        <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => setNamaSiap(false)}>Ganti</button></p>
      {pesan && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${pesan.jenis === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{pesan.teks}</p>}

      {d.siswa.length === 0 ? (
        <p className="panel py-10 text-center text-sm text-gray-400">Belum ada siswa yang ditempatkan di sini.</p>
      ) : (
        <>
          {berjalan.length > 0 && (
            <section className="panel overflow-hidden">
              <div className="panel-kepala"><p className="panel-judul">Presensi hari ini · {tgl(d.hariIni)}</p></div>
              <ul className="divide-y divide-gray-100">
                {berjalan.map(s => (
                  <li key={s.id} className="px-4 py-3 sm:px-5">
                    <p className="font-medium text-primary-900">{s.nama}<span className="ml-2 text-xs font-normal text-gray-400">{s.kelas}</span></p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {STATUS.map(x => (
                        <button key={x.v} type="button" disabled={sibuk} aria-pressed={s.presensiHariIni === x.v}
                          onClick={() => kirim({ aksi: "presensi", internshipId: s.id, status: x.v }, `Presensi ${s.nama}: ${x.label}`)}
                          className={`sentuh rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${s.presensiHariIni === x.v ? x.kelas : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>{x.label}</button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.siswa.map(s => (
            <section key={s.id} className="panel overflow-hidden">
              <button type="button" onClick={() => setBuka(b => (b === s.id ? null : s.id))} aria-expanded={buka === s.id}
                className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-primary-900">{s.nama}</p>
                  <p className="text-xs text-gray-500">{[s.kelas, s.jurusan, s.posisi].filter(Boolean).join(" · ")}</p>
                  <p className="angka mt-0.5 text-xs text-gray-400">{tgl(s.mulai)} – {tgl(s.selesai)}{s.guru ? ` · guru pembimbing ${s.guru}` : ""}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.jurnal.length > 0 && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">{s.jurnal.length} jurnal menunggu paraf</span>}
                  {s.rata != null && <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Nilai {s.rata}</span>}
                </div>
                <ChevronDown size={18} className={`shrink-0 text-gray-300 transition ${buka === s.id ? "rotate-180" : ""}`} />
              </button>
              {buka === s.id && <RincianSiswa s={s} d={d} sibuk={sibuk} kirim={kirim} />}
            </section>
          ))}
        </>
      )}
    </Kulit>
  );
}

function Kulit({ judul, sub, children }: { judul?: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f0f2f7]">
      <header className="px-4 py-5 text-white sm:px-6" style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Building2 size={20} /></span>
          <div className="min-w-0">
            <p className="truncate font-heading font-semibold">{judul ?? "Portal Industri PKL"}</p>
            <p className="truncate text-xs text-white/60">{sub ?? "Praktik Kerja Lapangan"}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

function RincianSiswa({ s, d, sibuk, kirim }: { s: Siswa; d: Data; sibuk: boolean; kirim: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(s.nilai ?? {}).map(([k, v]) => [k, String(v)])));
  const [catatan, setCatatan] = useState(s.catatan ?? "");
  const [lapor, setLapor] = useState({ jenis: "", isi: "" });
  return (
    <div className="space-y-5 border-t border-gray-100 px-4 py-4 sm:px-5">
      <p className="angka text-xs text-gray-500">30 hari terakhir: hadir {s.rekap.HADIR ?? 0} · izin {s.rekap.IZIN ?? 0} · sakit {s.rekap.SAKIT ?? 0} · tanpa kabar {s.rekap.ALPHA ?? 0}</p>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-900"><Signature size={15} /> Jurnal menunggu paraf</p>
          {s.jurnal.length > 1 && (
            <button type="button" disabled={sibuk} className="btn-modal-save px-3 text-xs" onClick={() => kirim({ aksi: "paraf", jurnalIds: s.jurnal.map(j => j.id) }, `${s.jurnal.length} jurnal ${s.nama} diparaf`)}>Paraf semua</button>
          )}
        </div>
        {s.jurnal.length === 0 ? <p className="text-sm text-gray-400">Tidak ada jurnal yang menunggu paraf.</p> : (
          <ul className="space-y-2">
            {s.jurnal.map(j => (
              <li key={j.id} className="flex gap-3 rounded-xl border border-gray-100 p-3">
                {j.photoUrl && (
                  <a href={j.photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={j.photoUrl} alt="" className="h-16 w-16 rounded-lg border border-gray-100 object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <p className="angka text-xs text-gray-400">{tgl(j.date)}</p>
                  <p className="text-sm text-gray-700">{j.activity}</p>
                  <div className="mt-1"><LencanaFotoJurnal ada={!!j.photoUrl} terverifikasi={j.fotoTerverifikasi} /></div>
                  {j.kompetensi.length > 0 && <p className="mt-1 text-xs text-gray-500">Kompetensi: {j.kompetensi.join(", ")}</p>}
                </div>
                <button type="button" disabled={sibuk} title="Paraf jurnal ini" className="btn-modal-cancel shrink-0 self-start px-3 text-xs"
                  onClick={() => kirim({ aksi: "paraf", jurnalIds: [j.id] }, "Jurnal diparaf")}><CheckCircle2 size={14} /> Paraf</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900"><ClipboardCheck size={15} /> Nilai akhir PKL (0–100)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {d.aspek.map(a => (
            <label key={a.kunci} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
              <span className="min-w-0 text-sm text-gray-700">{a.label}</span>
              <input inputMode="numeric" className="input-field angka w-20 shrink-0 text-right" value={nilai[a.kunci] ?? ""}
                onChange={e => setNilai(n => ({ ...n, [a.kunci]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} />
            </label>
          ))}
        </div>
        <textarea className="input-field mt-2" rows={2} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan untuk siswa / sekolah (opsional)" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{s.penilai ? `Terakhir diisi ${s.penilai}. Mengisi lagi akan menggantinya.` : "Diisi menjelang akhir PKL."}</span>
          <button type="button" disabled={sibuk} className="btn-modal-save" onClick={() => kirim({ aksi: "nilai", internshipId: s.id, nilai, catatan }, `Nilai ${s.nama} tersimpan`)}><Send /> Simpan Nilai</button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-900"><TriangleAlert size={15} className="text-amber-600" /> Laporkan masalah ke sekolah</p>
        <Select value={lapor.jenis} onChange={v => setLapor(l => ({ ...l, jenis: v }))} placeholder="Jenis masalah" options={Object.entries(d.jenisLaporan).map(([value, label]) => ({ value, label }))} />
        <textarea className="input-field mt-2" rows={2} value={lapor.isi} onChange={e => setLapor(l => ({ ...l, isi: e.target.value }))} placeholder="Apa yang terjadi?" />
        <div className="mt-2 flex justify-end">
          <button type="button" disabled={sibuk || !lapor.jenis || lapor.isi.trim().length < 10} className="btn-modal-cancel btn-teks"
            onClick={async () => { if (await kirim({ aksi: "lapor", internshipId: s.id, ...lapor }, "Laporan terkirim ke Humas dan guru pembimbing")) setLapor({ jenis: "", isi: "" }); }}>
            <Send size={16} /> Kirim Laporan
          </button>
        </div>
      </div>
    </div>
  );
}
