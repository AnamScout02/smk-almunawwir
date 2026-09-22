"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Send } from "lucide-react";

interface Data {
  sekolah: string; siswa: string; kelas: string; jurusan: string; perusahaan: string; posisi: string; pembimbing: string;
  mulai: string; selesai: string; berlakuSampai: string; aspek: { kunci: string; label: string }[];
  nilai: Record<string, number> | null; catatan: string | null; penilai: string | null; diisiPada: string | null;
}
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Formulir publik penilaian PKL (pembimbing industri). */
export default function FormPenilaianPkl({ token }: { token: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [penilai, setPenilai] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    fetch(`/api/penilaian-pkl/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) { setGalat(x?.error ?? "Tautan tidak berlaku."); return; }
      setD(x);
      setPenilai(x.penilai ?? x.pembimbing ?? "");
      setCatatan(x.catatan ?? "");
      if (x.nilai) setNilai(Object.fromEntries(Object.entries(x.nilai as Record<string, number>).map(([k, v]) => [k, String(v)])));
    }).catch(() => setGalat("Gagal memuat. Periksa koneksi internet."));
  }, [token]);

  async function kirim() {
    setPesan("");
    if (!d) return;
    const kosong = d.aspek.find(a => nilai[a.kunci] === undefined || nilai[a.kunci] === "");
    if (kosong) { setPesan(`Nilai "${kosong.label}" belum diisi.`); return; }
    setSibuk(true);
    const r = await fetch(`/api/penilaian-pkl/${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nilai: Object.fromEntries(Object.entries(nilai).map(([k, v]) => [k, Number(v)])), penilai, catatan }),
    }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { setPesan(x?.error ?? "Gagal mengirim."); return; }
    setSelesai(true);
  }

  const angka = Object.values(nilai).map(Number).filter(n => Number.isFinite(n));
  const rata = angka.length ? Math.round((angka.reduce((a, b) => a + b, 0) / angka.length) * 10) / 10 : null;
  return (
    <main className="min-h-dvh bg-cream px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-900 text-white"><ClipboardCheck size={20} /></span>
          <div><h1 className="font-heading text-xl font-bold text-primary-900">Penilaian Praktik Kerja Lapangan</h1><p className="text-sm text-gray-600">{d?.sekolah ?? "SMK Al-Munawwir IIBS"}</p></div>
        </div>
        {galat ? <div className="panel p-6 text-center text-sm text-gray-700">{galat}</div>
          : !d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
          : selesai ? (
            <div className="panel p-8 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
              <p className="mt-3 font-heading text-lg font-bold text-primary-900">Terima kasih, penilaian tersimpan.</p>
              <p className="mt-1 text-sm text-gray-600">Nilai rata-rata {rata?.toLocaleString("id-ID")}. Penilaian masih bisa diperbaiki lewat tautan yang sama sampai {tgl(d.berlakuSampai)}.</p>
            </div>
          ) : (
            <div className="panel space-y-5 p-5 sm:p-6">
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-gray-500">Siswa</dt><dd className="font-semibold text-primary-900">{d.siswa}</dd>
                <dt className="text-gray-500">Kelas</dt><dd>{[d.kelas, d.jurusan].filter(Boolean).join(" · ")}</dd>
                <dt className="text-gray-500">Tempat PKL</dt><dd>{d.perusahaan} — {d.posisi}</dd>
                <dt className="text-gray-500">Periode</dt><dd>{tgl(d.mulai)} – {tgl(d.selesai)}</dd>
              </dl>
              {d.diisiPada && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">Sudah dinilai pada {tgl(d.diisiPada)} — isian di bawah bisa diperbaiki.</p>}
              <div>
                <p className="label-field">Nilai tiap aspek (0–100)</p>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {d.aspek.map(a => (
                    <label key={a.kunci} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm text-gray-800">{a.label}</span>
                      <input type="number" min={0} max={100} inputMode="numeric" className="input-field w-24 text-center" value={nilai[a.kunci] ?? ""} onChange={e => setNilai(p => ({ ...p, [a.kunci]: e.target.value }))} />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-right text-sm text-gray-600">Rata-rata: <span className="angka font-bold text-primary-900">{rata?.toLocaleString("id-ID") ?? "—"}</span></p>
              </div>
              <div><label htmlFor="penilai" className="label-field">Nama penilai *</label><input id="penilai" className="input-field" maxLength={120} value={penilai} onChange={e => setPenilai(e.target.value)} /></div>
              <div><label htmlFor="catatan" className="label-field">Catatan untuk siswa & sekolah</label><textarea id="catatan" rows={4} maxLength={2000} className="input-field" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Kekuatan, hal yang perlu ditingkatkan, saran untuk sekolah" /></div>
              {pesan && <p className="error-msg">{pesan}</p>}
              <button type="button" onClick={kirim} disabled={sibuk} className="btn-modal-save w-full">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim Penilaian</button>
              <p className="text-center text-xs text-gray-500">Tautan ini khusus untuk penilaian siswa di atas dan berlaku sampai {tgl(d.berlakuSampai)}.</p>
            </div>
          )}
      </div>
    </main>
  );
}
