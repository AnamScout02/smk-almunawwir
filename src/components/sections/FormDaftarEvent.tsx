"use client";
import { useState, type FormEvent } from "react";
import { Loader2, Send, CheckCircle2, Paperclip } from "lucide-react";

const TEKS = {
  id: {
    nama: "Nama peserta / tim", namaPh: "Nama lengkap atau nama tim", asal: "Asal sekolah / instansi", asalPh: "Cth: SMP Negeri 1 Sumenep",
    kontak: "WhatsApp atau e-mail", kontakPh: "08xxxxxxxxxx", catatan: "Catatan (opsional)", catatanPh: "Kategori yang diikuti, anggota tim, dsb.",
    karya: "Berkas karya (opsional)", karyaHint: "JPG/PNG/PDF/DOCX/PPTX/ZIP/MP4, maks. 6 MB", tautan: "Tautan karya (opsional)",
    tautanPh: "https://drive.google.com/… — untuk karya di atas 6 MB", bukti: "Bukti pembayaran", buktiHint: "Foto/PDF struk transfer, maks. 3 MB",
    pilih: "Pilih berkas", kirim: "Kirim Pendaftaran", mengirim: "Mengirim…", berhasil: "Pendaftaran terkirim!",
    berhasilSiswa: "Status pendaftaranmu bisa dilihat di menu Lomba & Event pada portal siswa.",
    berhasilUmum: "Panitia akan menghubungi lewat kontak yang kamu isi. Simpan tangkapan layar ini sebagai bukti.",
    gagal: "Pendaftaran gagal dikirim. Periksa koneksi lalu coba lagi.", besar: "Ukuran berkas total melebihi 9 MB.",
    wajib: "wajib",
  },
  en: {
    nama: "Participant / team name", namaPh: "Full name or team name", asal: "School / institution", asalPh: "e.g. SMP Negeri 1 Sumenep",
    kontak: "WhatsApp or e-mail", kontakPh: "08xxxxxxxxxx", catatan: "Notes (optional)", catatanPh: "Category, team members, etc.",
    karya: "Submission file (optional)", karyaHint: "JPG/PNG/PDF/DOCX/PPTX/ZIP/MP4, max 6 MB", tautan: "Submission link (optional)",
    tautanPh: "https://drive.google.com/… — for files over 6 MB", bukti: "Payment receipt", buktiHint: "Photo/PDF of transfer receipt, max 3 MB",
    pilih: "Choose file", kirim: "Submit Registration", mengirim: "Submitting…", berhasil: "Registration submitted!",
    berhasilSiswa: "You can track your registration in the Competitions & Events menu of the student portal.",
    berhasilUmum: "The committee will reach you through the contact you provided. Keep a screenshot as proof.",
    gagal: "Registration failed. Check your connection and try again.", besar: "Total file size exceeds 9 MB.",
    wajib: "required",
  },
};

type Kunci = "namaPeserta" | "asalSekolah" | "kontak" | "karyaTautan" | "buktiBayar";

/** Formulir pendaftaran event/lomba di /lomba/[slug]. Validasi sebenarnya di server — pesan per isian
 *  (`kolom`) dari server ditempel di bawah kotaknya, sama dengan pola formulir SPMB (CLAUDE.md #103). */
export default function FormDaftarEvent({ slug, lang, siswa, namaAwal, perluBukti }: {
  slug: string; lang: "id" | "en"; siswa: boolean; namaAwal: string; perluBukti: boolean;
}) {
  const c = TEKS[lang];
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState("");
  const [kolom, setKolom] = useState<Partial<Record<Kunci, string>>>({});
  const [selesai, setSelesai] = useState(false);
  const [namaBerkas, setNamaBerkas] = useState<{ karya?: string; bukti?: string }>({});

  async function kirimForm(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const total = ["karya", "buktiBayar"].reduce((a, k) => a + ((fd.get(k) as File | null)?.size ?? 0), 0);
    if (total > 9 * 1024 * 1024) { setGalat(c.besar); return; }
    setKirim(true); setGalat(""); setKolom({});
    try {
      const r = await fetch(`/api/event/${encodeURIComponent(slug)}/daftar`, { method: "POST", body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setGalat(d?.error || c.gagal); if (d?.kolom) setKolom(d.kolom); return; }
      setSelesai(true);
    } catch { setGalat(c.gagal); } finally { setKirim(false); }
  }

  if (selesai) return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <p className="flex items-center gap-2 font-heading text-lg font-bold text-emerald-800"><CheckCircle2 size={20} /> {c.berhasil}</p>
      <p className="mt-2 text-sm text-emerald-700">{siswa ? c.berhasilSiswa : c.berhasilUmum}</p>
    </div>
  );

  const pesan = (k: Kunci) => (kolom[k] ? <p className="mt-1 text-sm text-red-600">{kolom[k]}</p> : null);
  // Fungsi biasa, BUKAN komponen: komponen yang didefinisikan di dalam render dibuat ulang tiap render,
  // sehingga <input type="file"> ter-mount ulang dan berkas yang sudah dipilih hilang.
  const berkas = (nama: "karya" | "buktiBayar", k: "karya" | "bukti", label: string, hint: string, wajib = false) => (
    <div>
      <label className="label-field">{label}{wajib && <span className="text-red-500"> * </span>}</label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm transition hover:border-primary-500 hover:bg-primary-50">
        <Paperclip size={16} className="shrink-0 text-gray-400" />
        <span className="min-w-0 truncate text-gray-600">{namaBerkas[k] ?? c.pilih}</span>
        <input type="file" name={nama} className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.pptx,.zip,video/mp4"
          onChange={e => setNamaBerkas(b => ({ ...b, [k]: e.target.files?.[0]?.name }))} />
      </label>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
      {nama === "buktiBayar" && pesan("buktiBayar")}
    </div>
  );

  return (
    <form onSubmit={kirimForm} noValidate className="space-y-4 rounded-3xl border border-gray-100 bg-cream p-6">
      <div>
        <label className="label-field">{c.nama} <span className="text-red-500">*</span></label>
        <input name="namaPeserta" defaultValue={namaAwal} placeholder={c.namaPh} className="input-field" maxLength={200} />
        {pesan("namaPeserta")}
      </div>
      {!siswa && (
        <div>
          <label className="label-field">{c.asal} <span className="text-red-500">*</span></label>
          <input name="asalSekolah" placeholder={c.asalPh} className="input-field" maxLength={200} />
          {pesan("asalSekolah")}
        </div>
      )}
      <div>
        <label className="label-field">{c.kontak} <span className="text-red-500">*</span></label>
        <input name="kontak" inputMode="tel" placeholder={c.kontakPh} className="input-field" maxLength={100} />
        {pesan("kontak")}
      </div>
      <div>
        <label className="label-field">{c.catatan}</label>
        <textarea name="catatan" rows={3} placeholder={c.catatanPh} className="input-field" maxLength={1000} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {berkas("karya", "karya", c.karya, c.karyaHint)}
        {perluBukti && berkas("buktiBayar", "bukti", c.bukti, c.buktiHint, true)}
      </div>
      <div>
        <label className="label-field">{c.tautan}</label>
        <input name="karyaTautan" inputMode="url" placeholder={c.tautanPh} className="input-field" maxLength={500} />
        {pesan("karyaTautan")}
      </div>
      {galat && <p className="error-msg">{galat}</p>}
      <button type="submit" disabled={kirim} className="btn-primary w-full sm:w-auto">
        {kirim ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {kirim ? c.mengirim : c.kirim}
      </button>
    </form>
  );
}
