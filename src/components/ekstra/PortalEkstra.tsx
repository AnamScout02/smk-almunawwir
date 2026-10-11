"use client";
import { useCallback, useEffect, useState } from "react";
import { Camera, Check, CheckCheck, Flag, Loader2, Save, UserRound, X } from "lucide-react";
import { kecilkanFoto } from "@/lib/olah-foto";

interface Anggota { id: string; nama: string; kelas: string; peran: string; status: string }
interface Data {
  ekskul: string; jenis: string; jadwalRutin: string | null; sekolah: string; hariIni: string; maksFoto: number; materi: string; foto: string[]; oleh: string;
  anggota: Anggota[]; pendaftar: { id: string; nama: string; kelas: string; alasan: string | null }[]; riwayat: { tanggal: string; materi: string | null; foto: number; hadir: number; peserta: number }[];
}
const STATUS = [
  { v: "HADIR", label: "Hadir", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { v: "IZIN", label: "Izin", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  { v: "SAKIT", label: "Sakit", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  { v: "ALPHA", label: "Tanpa kabar", kelas: "bg-red-50 text-red-600 border-red-200" },
];
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const KUNCI_NAMA = "portal-ekstra-nama";

/** PORTAL PEMBINA EKSTRAKURIKULER (tanpa akun) — absensi, kegiatan, dan foto HARI INI untuk satu ekskul. */
export default function PortalEkstra({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [nama, setNama] = useState("");
  const [namaSiap, setNamaSiap] = useState(false);
  const [materi, setMateri] = useState("");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState<{ jenis: "ok" | "galat"; teks: string } | null>(null);

  const muat = useCallback((awal = false) => {
    fetch(`/api/portal-ekstra/${token}`, { cache: "no-store" }).then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { setGalat(j?.error ?? "Gagal memuat."); return; }
      setD(j);
      if (awal) { setMateri(j.materi ?? ""); setStatus(Object.fromEntries((j.anggota as Anggota[]).map(a => [a.id, a.status]))); }
    }).catch(() => setGalat("Tidak ada sambungan. Coba muat ulang."));
  }, [token]);
  useEffect(() => { muat(true); try { const n = localStorage.getItem(KUNCI_NAMA); if (n) { setNama(n); setNamaSiap(true); } } catch { /* abaikan */ } }, [muat]);

  async function simpan() {
    if (!d) return;
    const kosong = d.anggota.filter(a => !status[a.id]).length;
    if (!materi.trim()) { setPesan({ jenis: "galat", teks: "Tulis dulu kegiatan/materi latihan hari ini." }); return; }
    if (kosong) { setPesan({ jenis: "galat", teks: `${kosong} anggota belum diisi kehadirannya.` }); return; }
    setSibuk("simpan");
    const r = await fetch(`/api/portal-ekstra/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nama, materi, rows: d.anggota.map(a => ({ studentId: a.id, status: status[a.id] })) }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    setPesan(r?.ok ? { jenis: "ok", teks: `Absensi ${j?.tersimpan ?? ""} anggota tersimpan. Terima kasih.` } : { jenis: "galat", teks: j?.error ?? "Gagal menyimpan. Periksa sambungan lalu coba lagi." });
    if (r?.ok) muat();
  }
  async function putuskan(ids: string[], terima: boolean) {
    setSibuk("daftar");
    const r = await fetch(`/api/portal-ekstra/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nama, putuskan: { ids, terima } }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    setPesan(r?.ok ? { jenis: "ok", teks: terima ? `${j?.diterima ?? 0} pendaftar diterima menjadi anggota.${j?.penuh?.length ? " Sebagian tidak diterima karena kuota penuh." : ""}` : `${j?.ditolak ?? 0} pendaftar tidak diterima.` } : { jenis: "galat", teks: j?.error ?? "Gagal menyimpan keputusan." });
    if (r?.ok) muat();
  }
  async function kirimFoto(files: FileList | null) {
    if (!files?.length || !d) return;
    setSibuk("foto");
    let ok = 0, salah = "";
    for (const f of [...files].slice(0, d.maksFoto)) {
      const kecil = (await kecilkanFoto(f, 1600).catch(() => null))?.file ?? f;
      const fd = new FormData(); fd.set("nama", nama); fd.set("file", kecil);
      const r = await fetch(`/api/portal-ekstra/${token}/foto`, { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) ok += 1; else { salah = (await r?.json().catch(() => null))?.error ?? "Foto gagal diunggah."; break; }
    }
    setSibuk("");
    setPesan(salah ? { jenis: "galat", teks: ok ? `${ok} foto tersimpan, lalu: ${salah}` : salah } : { jenis: "ok", teks: `${ok} foto tersimpan.` });
    muat();
  }

  // `Kulit` didefinisikan di LUAR komponen (bawah): komponen yang dibuat di dalam render dipasang ulang tiap ketikan,
  // sehingga kotak materi kehilangan fokus setiap huruf.
  const kepala = { judul: d?.ekskul ?? "Portal Pembina", sub: d ? `${d.sekolah} · ${d.anggota.length} anggota` : "Ekstrakurikuler" };
  if (!d) return <Kulit {...kepala}><div className="panel flex justify-center py-16 text-gray-400">{galat ? <p className="px-5 text-center text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></Kulit>;
  if (!namaSiap) return (
    <Kulit {...kepala}>
      <div className="panel p-5">
        <p className="font-heading font-semibold text-primary-900">Siapa yang mengisi?</p>
        <p className="mt-1 text-sm text-gray-500">Nama Anda dicatat pada absensi dan foto yang Anda kirim. Cukup sekali di perangkat ini.</p>
        <label className="label-field mt-4" htmlFor="pe-n">Nama lengkap</label>
        <input id="pe-n" className="input-field" value={nama} onChange={e => setNama(e.target.value)} placeholder="mis. Kak Budi Santoso" />
        <button type="button" disabled={nama.trim().length < 3} className="btn-modal-save mt-4 w-full" onClick={() => { try { localStorage.setItem(KUNCI_NAMA, nama.trim()); } catch { /* abaikan */ } setNama(nama.trim()); setNamaSiap(true); }}><UserRound /> Lanjut</button>
      </div>
    </Kulit>
  );
  const terisi = d.anggota.filter(a => status[a.id]).length;
  return (
    <Kulit {...kepala}>
      <p className="text-sm text-gray-500">Mengisi sebagai <span className="font-medium text-primary-900">{nama}</span>. <button type="button" className="font-medium text-primary-700 hover:underline" onClick={() => setNamaSiap(false)}>Ganti</button></p>
      {pesan && <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${pesan.jenis === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{pesan.teks}</p>}

      {d.pendaftar.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-kepala">
            <p className="panel-judul">Pendaftar baru <span className="angka ml-1 text-xs font-normal text-gray-400">{d.pendaftar.length}</span></p>
            <button type="button" disabled={sibuk === "daftar"} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900" onClick={() => putuskan(d.pendaftar.map(x => x.id), true)}><CheckCheck size={14} /> Terima semua</button>
          </div>
          <ul className="divide-y divide-gray-100">
            {d.pendaftar.map(x => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1"><p className="font-medium text-primary-900">{x.nama}<span className="ml-2 text-xs font-normal text-gray-400">{x.kelas}</span></p>{x.alasan && <p className="text-sm text-gray-500">{x.alasan}</p>}</div>
                <button type="button" title="Tidak diterima" disabled={sibuk === "daftar"} onClick={() => putuskan([x.id], false)} className="btn-modal-cancel btn-teks px-3 text-xs"><X /> Tolak</button>
                <button type="button" title="Terima" disabled={sibuk === "daftar"} onClick={() => putuskan([x.id], true)} className="btn-modal-save btn-teks px-3 text-xs"><Check /> Terima</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel p-5">
        <p className="font-heading font-semibold text-primary-900">Kegiatan hari ini</p>
        <p className="text-sm text-gray-500">{tgl(d.hariIni)}{d.jadwalRutin ? ` · jadwal rutin ${d.jadwalRutin}` : ""}</p>
        <label className="label-field mt-3" htmlFor="pe-m">Kegiatan / materi latihan</label>
        <textarea id="pe-m" rows={3} maxLength={1000} className="input-field" value={materi} onChange={e => setMateri(e.target.value)} placeholder="mis. Latihan baris-berbaris dan tali-temali" />
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-kepala">
          <p className="panel-judul">Kehadiran anggota <span className="angka ml-1 text-xs font-normal text-gray-400">{terisi}/{d.anggota.length}</span></p>
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900" onClick={() => setStatus(s => Object.fromEntries(d.anggota.map(a => [a.id, s[a.id] || "HADIR"])))}><CheckCheck size={14} /> Sisanya hadir</button>
        </div>
        {d.anggota.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada anggota. Hubungi koordinator ekstrakurikuler sekolah.</p> : (
          <ul className="divide-y divide-gray-100">
            {d.anggota.map(a => (
              <li key={a.id} className="px-4 py-3 sm:px-5">
                <p className="font-medium text-primary-900">{a.nama}<span className="ml-2 text-xs font-normal text-gray-400">{a.kelas}{a.peran ? ` · ${a.peran}` : ""}</span></p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUS.map(x => (
                    <button key={x.v} type="button" aria-pressed={status[a.id] === x.v} onClick={() => setStatus(s => ({ ...s, [a.id]: s[a.id] === x.v ? "" : x.v }))}
                      className={`sentuh rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${status[a.id] === x.v ? x.kelas : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>{x.label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-gray-100 p-4"><button type="button" disabled={sibuk === "simpan" || d.anggota.length === 0} onClick={simpan} className="btn-modal-save w-full">{sibuk === "simpan" ? <Loader2 className="animate-spin" /> : <Save />} Simpan absensi & kegiatan</button></div>
      </section>

      <section className="panel p-5">
        <p className="font-heading font-semibold text-primary-900">Foto bukti kegiatan <span className="angka ml-1 text-xs font-normal text-gray-400">{d.foto.length}/{d.maksFoto}</span></p>
        {d.foto.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- berkas unggahan */}
            {d.foto.map(f => <li key={f} className="overflow-hidden rounded-xl border border-gray-100"><img src={f} alt="Foto kegiatan hari ini" className="aspect-square w-full object-cover" /></li>)}
          </ul>
        )}
        {d.foto.length < d.maksFoto && (
          <label className={`btn-modal-cancel mt-3 w-full cursor-pointer ${sibuk === "foto" ? "pointer-events-none opacity-60" : ""}`}>
            {sibuk === "foto" ? <Loader2 className="animate-spin" /> : <Camera />} Ambil / pilih foto
            <input type="file" accept="image/*" multiple className="sr-only" onChange={e => { void kirimFoto(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <p className="mt-2 text-xs text-gray-500">Foto kegiatan bersama, bukan foto pribadi siswa. Menghapus foto dilakukan koordinator sekolah.</p>
      </section>

      {d.riwayat.length > 0 && (
        <section className="panel p-5">
          <p className="font-heading font-semibold text-primary-900">Pertemuan sebelumnya</p>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {d.riwayat.map(r => <li key={r.tanggal} className="py-2"><span className="font-medium text-primary-900">{tgl(r.tanggal)}</span><span className="block text-gray-600">{r.materi || "—"}</span><span className="text-xs text-gray-400">{r.peserta ? `${r.hadir}/${r.peserta} hadir` : "absensi belum diisi"} · {r.foto} foto</span></li>)}
          </ul>
        </section>
      )}
    </Kulit>
  );
}

function Kulit({ judul, sub, children }: { judul: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f0f2f7]">
      <header className="px-4 py-5 text-white sm:px-6" style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Flag size={20} /></span>
          <div className="min-w-0"><p className="truncate font-heading font-semibold">{judul}</p><p className="truncate text-xs text-white/60">{sub}</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
