"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, Clock, AlertTriangle, XCircle, Loader2, CalendarDays, MapPin, MessageCircle, Users, Printer, LogOut,
  Shirt, Upload, PartyPopper, Search, FileText, ClipboardCheck, Wallet, Bell, BellRing, IdCard, ReceiptText, Signature,
} from "lucide-react";
import PenyuntingTtd from "@/components/shared/PenyuntingTtd";
import { statusPush, type StatusPush } from "@/lib/push-client";
import DatePicker from "@/components/shared/DatePicker";
import type { Lang } from "@/lib/lang";
import { HUBUNGAN_WALI, rupiah, type InfoBayar, type InfoMpls, type JadwalTahap, type SetelanSeragam, type TahapCalon, type IsiSeragam } from "@/lib/spmb-tahapan";
import { kecilkanFoto, periksaMutu } from "@/lib/olah-foto";
import { deteksiDokumen, kanvasKeFile, type Sudut } from "@/lib/pindai-dokumen";
import PemindaiDokumen from "@/components/spmb/PemindaiDokumen";

type Data = {
  nama: string; nomor: string; jurusan: string; gelombang: string | null; tahun: string; sekolah: string;
  tahap: TahapCalon[]; tuntas: boolean; ditolak: boolean; menungguPeriksaUlang: boolean;
  perbaikan: { pesan: string | null; dokumen: { kunci: string; label: string }[] } | null;
  grup: { tautan: string; diklik: boolean; bergabung: boolean };
  seragam: { setelan: SetelanSeragam; isi: IsiSeragam | null; terbuka: boolean; terkunci: boolean };
  mpls: InfoMpls | null;
  kontak: { nama: string; wa: string };
  sesi: { pilihan: { id: string; tanggal: string; jamMulai: string; jamSelesai: string; tempat: string | null; catatan: string | null; kuota: number; sisa: number }[]; dipilih: string | null; terbuka: boolean };
  kabar: { id: string; judul: string; isi: string; createdAt: string }[];
  push: { publicKey: string | null; tersedia: boolean };
  kartuPeserta: boolean;
  pakta: {
    judul: string; wajib: boolean; isi: string; terbuka: boolean; walinya: string;
    sudah: { nama: string | null; hubungan: string | null; at: string } | null;
  } | null;
  bayar: InfoBayar & {
    info: string; keteranganPotongan: string | null; sudahKonfirmasi: boolean;
    riwayat: { id: string; jumlah: number; tanggal: string; metode: string; status: string; alasanTolak: string | null }[];
  };
};

const KUNCI_SIMPAN = "spmb-tahapan";

const TEKS = {
  id: {
    masukJudul: "Buka Tahapan Pendaftaran", masukKet: "Masukkan nomor pendaftaran dan tanggal lahir calon siswa.",
    nomor: "Nomor pendaftaran", lahir: "Tanggal lahir", buka: "Buka", tidakKetemu: "Nomor pendaftaran atau tanggal lahir tidak cocok.",
    galat: "Gagal memuat. Periksa koneksi lalu coba lagi.", kemajuan: (a: number, b: number) => `${a} dari ${b} tahap selesai`,
    gelombang: "Gelombang", jurusan: "Jurusan", grupJudul: "Grup WhatsApp", grupKet: "Bergabunglah ke grup gelombang Anda untuk informasi terbaru dari panitia.",
    grupBuka: "Gabung Grup WA", grupSudah: "Saya sudah bergabung", grupTercatat: "Tercatat sudah bergabung",
    selesai: "Selesai", berjalan: "Sedang berjalan", menunggu: "Menunggu", perbaikan: "Perlu perbaikan", berhenti: "Berhenti",
    jadwal: "Jadwal", pesanPanitia: "Pesan panitia", periksaUlang: "Perbaikan berkas sudah terkirim dan sedang diperiksa ulang panitia.",
    unggahUlang: "Unggah ulang berkas berikut:", kirimPerbaikan: "Kirim Perbaikan", unggah: "Pilih berkas", mengunggah: "Mengunggah...",
    seragamKet: "Pilih ukuran sesuai keterangan. Ukuran bisa diubah sampai panitia melakukan asesmen.",
    catatanUkuran: "Catatan ukuran (opsional)", simpanSeragam: "Simpan Ukuran", ubahSeragam: "Ubah Ukuran", seragamTerkunci: "Ukuran sudah dikunci panitia.",
    daftarUlang: "Buka Halaman Daftar Ulang", tersimpan: "Tersimpan.",
    resmi: (t: string, s: string) => `Selamat! Anda resmi menjadi peserta MPLS Tahun Ajaran ${t} ${s}.`,
    ditolak: "Mohon maaf, pendaftaran belum dapat kami terima. Terima kasih telah mendaftar.",
    perlengkapan: "Perlengkapan", tempat: "Tempat", cetak: "Cetak Formulir", keluar: "Keluar", hubungi: "Hubungi Panitia",
    sd: "s.d.", pukul: "pukul",
    bayarJudul: "Pembayaran", bayarKet: "Boleh langsung lunas atau dicicil — juga setelah MPLS.",
    tagihan: "Tagihan", terbayar: "Sudah disahkan", sisa: "Sisa", menungguPeriksa: "Menunggu diperiksa panitia", potongan: "Potongan",
    syaratLunas: "Daftar ulang tuntas setelah pembayaran lunas.", syaratDp: (n: string) => `Daftar ulang tuntas setelah pembayaran minimal ${n} disahkan.`,
    kirimBukti: "Kirim Bukti Pembayaran", jumlah: "Jumlah dibayar (Rp)", tglBayar: "Tanggal bayar", buktiFoto: "Foto / berkas bukti transfer",
    riwayat: "Riwayat pembayaran", sah: "Sah", menungguS: "Diperiksa", ditolakS: "Ditolak", lunas: "Lunas",
    belumTagihan: "Rincian biaya belum ditetapkan panitia.",
    konfirmasi: "Saya Bersedia Daftar Ulang", konfirmasiKet: "Dengan menekan tombol ini, calon menyatakan jadi bersekolah di sini.",
    sudahKonfirmasi: "Daftar ulang sudah dikonfirmasi.", tungguBayar: (n: string) => `Menunggu pembayaran minimal ${n} disahkan panitia.`,
    notifJudul: "Pemberitahuan ke HP ini", notifKet: "Dapatkan kabar langsung saat panitia memverifikasi berkas, mengumumkan hasil, atau mengesahkan pembayaran.",
    notifAktifkan: "Aktifkan Pemberitahuan", notifAktif: "Pemberitahuan aktif di perangkat ini.", notifDitolak: "Izin pemberitahuan diblokir di browser. Buka setelan situs untuk mengizinkannya.",
    notifIos: "Di iPhone, pasang situs ini ke Layar Utama (Bagikan → Tambah ke Layar Utama) lalu buka dari sana untuk mengaktifkan pemberitahuan.",
    kabarJudul: "Kabar terbaru",
    sesiJudul: "Pilih sesi kedatangan", sesiKet: "Pilih jadwal datang ke sekolah untuk asesmen dan cek kesehatan. Bisa diganti sampai asesmen dilakukan.",
    sesiPenuh: "Penuh", sesiSisa: (n: number) => `sisa ${n} kursi`, sesiDipilih: "Dipilih", sesiPilih: "Pilih",
    kartuPeserta: "Kartu Peserta Tes", kuitansi: "Kuitansi",
    paktaKet: "Dibaca dan ditandatangani orang tua / wali langsung di HP ini.", paktaWajib: "Wajib ditandatangani sebelum konfirmasi daftar ulang.",
    paktaNama: "Nama lengkap orang tua / wali", paktaHubungan: "Hubungan dengan calon murid", paktaSetuju: "Saya telah membaca dan menyetujui seluruh isi surat pernyataan di atas.",
    paktaTtd: "Tanda tangan", paktaSimpan: "Tanda Tangani", paktaSudah: (n: string, h: string, w: string) => `Ditandatangani ${n} (${h}) — ${w}.`,
    paktaCetak: "Cetak Surat Pernyataan", paktaDulu: "Tanda tangani Surat Pernyataan orang tua dulu (kartu di atas).",
    paktaBelum: "Isi nama, pilih hubungan, dan centang persetujuan sebelum menandatangani.",
  },
  en: {
    masukJudul: "Open Registration Progress", masukKet: "Enter the registration number and the applicant's date of birth.",
    nomor: "Registration number", lahir: "Date of birth", buka: "Open", tidakKetemu: "Registration number or date of birth does not match.",
    galat: "Failed to load. Check your connection and try again.", kemajuan: (a: number, b: number) => `${a} of ${b} steps completed`,
    gelombang: "Wave", jurusan: "Major", grupJudul: "WhatsApp Group", grupKet: "Join your wave's group for the latest information from the committee.",
    grupBuka: "Join WA Group", grupSudah: "I have joined", grupTercatat: "Recorded as joined",
    selesai: "Done", berjalan: "In progress", menunggu: "Waiting", perbaikan: "Needs revision", berhenti: "Stopped",
    jadwal: "Schedule", pesanPanitia: "Committee message", periksaUlang: "Your revised documents were sent and are being re-checked.",
    unggahUlang: "Re-upload the following documents:", kirimPerbaikan: "Send Revision", unggah: "Choose file", mengunggah: "Uploading...",
    seragamKet: "Choose sizes based on the notes. You can change them until the committee's assessment.",
    catatanUkuran: "Size note (optional)", simpanSeragam: "Save Sizes", ubahSeragam: "Change Sizes", seragamTerkunci: "Sizes have been locked by the committee.",
    daftarUlang: "Open Re-registration Page", tersimpan: "Saved.",
    resmi: (t: string, s: string) => `Congratulations! You are officially an MPLS (orientation) participant for academic year ${t} at ${s}.`,
    ditolak: "We're sorry, we are unable to accept this registration. Thank you for applying.",
    perlengkapan: "What to bring", tempat: "Venue", cetak: "Print Form", keluar: "Sign out", hubungi: "Contact Committee",
    sd: "to", pukul: "at",
    bayarJudul: "Payment", bayarKet: "Pay in full or in installments — also after the orientation.",
    tagihan: "Total due", terbayar: "Approved", sisa: "Remaining", menungguPeriksa: "Awaiting committee check", potongan: "Discount",
    syaratLunas: "Re-registration completes after full payment.", syaratDp: (n: string) => `Re-registration completes after at least ${n} is approved.`,
    kirimBukti: "Send Payment Proof", jumlah: "Amount paid (Rp)", tglBayar: "Payment date", buktiFoto: "Photo / file of transfer proof",
    riwayat: "Payment history", sah: "Approved", menungguS: "Checking", ditolakS: "Rejected", lunas: "Paid",
    belumTagihan: "Fees have not been set by the committee yet.",
    konfirmasi: "Confirm Re-registration", konfirmasiKet: "By pressing this button, the applicant confirms enrolling here.",
    sudahKonfirmasi: "Re-registration confirmed.", tungguBayar: (n: string) => `Waiting for at least ${n} to be approved by the committee.`,
    notifJudul: "Notifications on this phone", notifKet: "Get notified right away when the committee verifies documents, announces results, or approves payments.",
    notifAktifkan: "Turn On Notifications", notifAktif: "Notifications are on for this device.", notifDitolak: "Notifications are blocked in the browser. Allow them in the site settings.",
    notifIos: "On iPhone, add this site to the Home Screen (Share → Add to Home Screen) and open it from there to turn on notifications.",
    kabarJudul: "Latest updates",
    sesiJudul: "Choose an arrival session", sesiKet: "Choose when to come to school for the assessment and health check. You can change it until the assessment.",
    sesiPenuh: "Full", sesiSisa: (n: number) => `${n} seats left`, sesiDipilih: "Selected", sesiPilih: "Choose",
    kartuPeserta: "Test Participant Card", kuitansi: "Receipt",
    paktaKet: "Read and signed by the parent / guardian directly on this phone.", paktaWajib: "Must be signed before confirming re-registration.",
    paktaNama: "Parent / guardian full name", paktaHubungan: "Relationship to the applicant", paktaSetuju: "I have read and agree to the entire statement above.",
    paktaTtd: "Signature", paktaSimpan: "Sign", paktaSudah: (n: string, h: string, w: string) => `Signed by ${n} (${h}) — ${w}.`,
    paktaCetak: "Print Statement", paktaDulu: "Please have the parent sign the Statement first (card above).",
    paktaBelum: "Fill in the name, choose the relationship, and tick the agreement before signing.",
  },
};

/** Judul tahap dalam bahasa Inggris (judul Indonesia dari spmb-tahapan.ts). */
const JUDUL_EN: Record<string, string> = {
  DAFTAR: "Registration", VERIFIKASI: "Document Verification", SERAGAM: "Uniform Size", ASESMEN: "Initial Assessment",
  PEMERIKSAAN: "Physical & Health Check", DITERIMA: "Result Announcement", DAFTAR_ULANG: "Re-registration & Payment",
};

function tgl(iso: string | null | undefined, lang: Lang) {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00+07:00") : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

function KotakJadwal({ j, lang }: { j: JadwalTahap; lang: Lang }) {
  const t = TEKS[lang];
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
      <p className="mb-1 flex items-center gap-1.5 font-semibold"><CalendarDays size={15} /> {t.jadwal}</p>
      {j.tanggal && (
        <p>{tgl(j.tanggal, lang)}{j.tanggalSampai ? ` ${t.sd} ${tgl(j.tanggalSampai, lang)}` : ""}
          {j.jamMulai ? `, ${t.pukul} ${j.jamMulai}${j.jamSelesai ? `–${j.jamSelesai}` : ""} WIB` : ""}</p>
      )}
      {j.tempat && <p className="mt-0.5 flex items-center gap-1.5"><MapPin size={14} /> {j.tempat}</p>}
      {j.catatan && <p className="mt-1 whitespace-pre-line text-blue-700">{j.catatan}</p>}
    </div>
  );
}

/** `onKeluar` = dipasang di dalam halaman lain (Cek Status di /admissions, 7 Okt 2026): tombol Keluar & tautan yang
 *  tidak sah menyerahkan kembali ke induknya, bukan berpindah ke /spmb/tahapan. */
export default function TahapanCalon({ lang = "id", nomorAwal = "", tandaAwal = "", onKeluar }: { lang?: Lang; nomorAwal?: string; tandaAwal?: string; onKeluar?: () => void }) {
  const t = TEKS[lang];
  const router = useRouter();
  const [kunci, setKunci] = useState<{ nomor: string; t: string } | null>(nomorAwal && tandaAwal ? { nomor: nomorAwal, t: tandaAwal } : null);
  const [siapKunci, setSiapKunci] = useState(!!(nomorAwal && tandaAwal));
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");

  // Kunci tersimpan di perangkat — calon tidak perlu mengetik ulang setiap membuka halaman ini.
  useEffect(() => {
    if (nomorAwal && tandaAwal) {
      try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify({ nomor: nomorAwal, t: tandaAwal })); } catch { /* abaikan */ }
      return;
    }
    try {
      const v = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || "null");
      if (v?.nomor && v?.t) setKunci(v);
    } catch { /* abaikan */ }
    setSiapKunci(true);
  }, [nomorAwal, tandaAwal]);

  const muat = useCallback(async (k: { nomor: string; t: string }) => {
    setMemuat(true);
    setGalat("");
    try {
      const r = await fetch(`/api/spmb/calon?nomor=${encodeURIComponent(k.nomor)}&t=${encodeURIComponent(k.t)}`);
      const d = await r.json();
      if (r.ok) setData(d);
      else {
        setGalat(d?.error || t.galat);
        setKunci(null);
        try { localStorage.removeItem(KUNCI_SIMPAN); } catch { /* abaikan */ }
      }
    } catch { setGalat(t.galat); }
    finally { setMemuat(false); }
  }, [t.galat]);

  useEffect(() => { if (kunci) muat(kunci); }, [kunci, muat]);

  function keluar() {
    try { localStorage.removeItem(KUNCI_SIMPAN); } catch { /* abaikan */ }
    setKunci(null);
    setData(null);
    if (onKeluar) onKeluar(); else router.replace("/spmb/tahapan");
  }

  async function aksi(body: Record<string, unknown>) {
    if (!kunci) return { ok: false, error: t.galat };
    const r = await fetch("/api/spmb/calon", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, nomor: kunci.nomor, t: kunci.t }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (r?.ok) { await muat(kunci); return { ok: true }; }
    return { ok: false, error: d?.error || t.galat };
  }

  if (!siapKunci) return <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!kunci && onKeluar) return null;
  if (!kunci) return <FormMasuk lang={lang} galatAwal={galat} onMasuk={k => { setKunci(k); router.replace(`/spmb/tahapan?nomor=${encodeURIComponent(k.nomor)}&t=${encodeURIComponent(k.t)}`); }} />;
  if (memuat && !data) return <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <p className="py-10 text-center text-sm text-gray-400">{galat || t.galat}</p>;

  const selesai = data.tahap.filter(x => x.status === "SELESAI").length;
  const persen = Math.round((selesai / data.tahap.length) * 100);
  const waPanitia = data.kontak.wa ? `https://wa.me/${data.kontak.wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Assalamu'alaikum, saya ${data.nama} (no. pendaftaran ${data.nomor}).`)}` : "";

  return (
    <div className="space-y-6">
      {/* Identitas + kemajuan */}
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-kecil text-primary-700">{data.nomor}</p>
            <h2 className="font-heading text-xl font-semibold text-navy">{data.nama}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {data.gelombang && <>{t.gelombang}: {data.gelombang} · </>}{t.jurusan}: {data.jurusan || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/spmb/formulir?nomor=${encodeURIComponent(kunci.nomor)}&t=${encodeURIComponent(kunci.t)}`} className="btn-modal-cancel">
              <Printer size={16} /> {t.cetak}
            </Link>
            {data.kartuPeserta && (
              <Link href={`/spmb/kartu?nomor=${encodeURIComponent(kunci.nomor)}&t=${encodeURIComponent(kunci.t)}`} className="btn-modal-cancel">
                <IdCard size={16} /> {t.kartuPeserta}
              </Link>
            )}
            <button type="button" onClick={keluar} className="btn-modal-cancel"><LogOut size={16} /> {t.keluar}</button>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs text-gray-500">
            <span>{t.kemajuan(selesai, data.tahap.length)}</span><span className="angka">{persen}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${persen}%` }} />
          </div>
        </div>
      </div>

      {data.tuntas && (
        <div className="panel overflow-hidden border-emerald-200">
          <div className="bg-gradient-to-br from-emerald-50 to-white p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white"><PartyPopper size={24} /></span>
              <div className="min-w-0">
                <p className="font-heading text-lg font-semibold text-emerald-800">{t.resmi(data.tahun, data.sekolah)}</p>
                {data.mpls && (
                  <div className="mt-3 space-y-1.5 text-sm text-emerald-900">
                    <p className="font-semibold">{data.mpls.judul}</p>
                    {data.mpls.mulai && (
                      <p className="flex items-center gap-1.5"><CalendarDays size={15} />
                        {tgl(data.mpls.mulai, lang)}{data.mpls.selesai ? ` ${t.sd} ${tgl(data.mpls.selesai, lang)}` : ""}
                        {data.mpls.jam ? `, ${data.mpls.jam}` : ""}</p>
                    )}
                    {data.mpls.tempat && <p className="flex items-center gap-1.5"><MapPin size={15} /> {data.mpls.tempat}</p>}
                    {data.mpls.keterangan && <p className="whitespace-pre-line text-emerald-800">{data.mpls.keterangan}</p>}
                    {data.mpls.perlengkapan && (
                      <div><p className="mt-2 font-semibold">{t.perlengkapan}</p><p className="whitespace-pre-line">{data.mpls.perlengkapan}</p></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {data.ditolak && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <XCircle size={20} className="mt-0.5 shrink-0" /> <p>{t.ditolak}</p>
        </div>
      )}

      {data.grup.tautan && !data.ditolak && <KartuGrup data={data} lang={lang} aksi={aksi} />}
      {data.push.tersedia && data.push.publicKey && !data.tuntas && !data.ditolak && <KartuNotif data={data} lang={lang} aksi={aksi} />}
      {data.kabar.length > 0 && (
        <div className="panel p-5">
          <p className="panel-judul mb-3">{t.kabarJudul}</p>
          <ul className="space-y-3">
            {data.kabar.map(k => (
              <li key={k.id} className="flex gap-3 text-sm">
                <BellRing size={16} className="mt-0.5 shrink-0 text-primary-700" />
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{k.judul}</p>
                  <p className="text-gray-600">{k.isi}</p>
                  <p className="text-xs text-gray-400">{new Date(k.createdAt).toLocaleString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!data.ditolak && <KartuBayar data={data} lang={lang} aksi={aksi} kunci={kunci} />}
      {data.pakta && (data.pakta.terbuka || data.pakta.sudah) && !data.ditolak && <KartuPakta data={data} lang={lang} kunci={kunci} onSelesai={() => muat(kunci)} />}

      {/* Daftar tahapan */}
      <ol className="panel divide-y divide-gray-100">
        {data.tahap.map((x, i) => (
          <BarisTahap key={x.kode} no={i + 1} x={x} data={data} lang={lang} aksi={aksi} />
        ))}
      </ol>

      {waPanitia && (
        <div className="flex justify-center">
          <a href={waPanitia} target="_blank" rel="noopener noreferrer" className="btn-modal-cancel btn-teks"><MessageCircle size={16} /> {t.hubungi}</a>
        </div>
      )}
    </div>
  );
}

function FormMasuk({ lang, galatAwal, onMasuk }: { lang: Lang; galatAwal: string; onMasuk: (k: { nomor: string; t: string }) => void }) {
  const t = TEKS[lang];
  const [nomor, setNomor] = useState("");
  const [lahir, setLahir] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(galatAwal);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!nomor.trim() || !lahir) return;
    setSibuk(true);
    setGalat("");
    try {
      const r = await fetch(`/api/admissions/status?nomor=${encodeURIComponent(nomor.trim())}&lahir=${encodeURIComponent(lahir)}`);
      const d = await r.json();
      if (d?.found && d.data?.tandaCetak) onMasuk({ nomor: d.data.nomor, t: d.data.tandaCetak });
      else setGalat(d?.error || t.tidakKetemu);
    } catch { setGalat(t.galat); }
    finally { setSibuk(false); }
  }

  return (
    <form onSubmit={kirim} className="panel mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-navy">{t.masukJudul}</h2>
        <p className="text-sm text-gray-500">{t.masukKet}</p>
      </div>
      <div>
        <label className="label-field">{t.nomor}</label>
        <input className="input-field uppercase" value={nomor} onChange={e => setNomor(e.target.value)} placeholder="SPMB-01-0001" />
      </div>
      <div>
        <label className="label-field">{t.lahir}</label>
        <DatePicker value={lahir} onChange={setLahir} />
      </div>
      {galat && <p className="error-msg">{galat}</p>}
      <button type="submit" disabled={sibuk || !nomor.trim() || !lahir} className="btn-modal-save w-full">
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} {t.buka}
      </button>
    </form>
  );
}

type Aksi = (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

function KartuGrup({ data, lang, aksi }: { data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  return (
    <div className="panel flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Users size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-navy">{t.grupJudul}{data.gelombang ? ` — ${data.gelombang}` : ""}</p>
        <p className="text-sm text-gray-500">{t.grupKet}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={data.grup.tautan} target="_blank" rel="noopener noreferrer" onClick={() => { aksi({ aksi: "grup-klik" }); }}
          className="btn-modal-save btn-teks"><MessageCircle size={16} /> {t.grupBuka}</a>
        {data.grup.bergabung
          ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><Check size={14} /> {t.grupTercatat}</span>
          : <button type="button" onClick={() => aksi({ aksi: "grup-gabung" })} className="btn-modal-cancel btn-teks"><Check size={16} /> {t.grupSudah}</button>}
      </div>
    </div>
  );
}

const GAYA_STATUS = {
  SELESAI: { lingkar: "bg-emerald-600 text-white", teks: "text-emerald-700", ikon: Check },
  BERJALAN: { lingkar: "bg-primary-900 text-white ring-4 ring-primary-100", teks: "text-primary-700", ikon: Clock },
  PERBAIKAN: { lingkar: "bg-amber-500 text-white ring-4 ring-amber-100", teks: "text-amber-700", ikon: AlertTriangle },
  BERHENTI: { lingkar: "bg-red-600 text-white", teks: "text-red-600", ikon: XCircle },
  MENUNGGU: { lingkar: "bg-gray-100 text-gray-400", teks: "text-gray-400", ikon: Clock },
} as const;

function BarisTahap({ no, x, data, lang, aksi }: { no: number; x: TahapCalon; data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  const g = GAYA_STATUS[x.status];
  const label = { SELESAI: t.selesai, BERJALAN: t.berjalan, PERBAIKAN: t.perbaikan, BERHENTI: t.berhenti, MENUNGGU: t.menunggu }[x.status];
  const aktif = x.status === "BERJALAN" || x.status === "PERBAIKAN";
  return (
    <li className={`flex gap-3 p-4 sm:gap-4 sm:p-5 ${x.status === "MENUNGGU" ? "opacity-70" : ""}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${g.lingkar}`}>
        {x.status === "MENUNGGU" ? <span className="angka">{no}</span> : <g.ikon size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-heading font-semibold text-navy">{lang === "en" ? JUDUL_EN[x.kode] : x.judul}</p>
          <p className={`text-xs font-semibold ${g.teks}`}>
            {label}{x.status === "SELESAI" && x.tanggal ? ` · ${new Date(x.tanggal).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}` : ""}
          </p>
        </div>
        {lang === "id" && <p className="text-sm text-gray-500">{x.ket}</p>}

        {x.pesan && x.status !== "PERBAIKAN" && <p className={`mt-2 text-sm ${x.status === "BERHENTI" ? "text-red-600" : "text-gray-600"}`}>{x.pesan}</p>}
        {x.jadwal && x.status !== "SELESAI" && <KotakJadwal j={x.jadwal} lang={lang} />}

        {x.kode === "VERIFIKASI" && data.menungguPeriksaUlang && x.status === "BERJALAN" && (
          <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{t.periksaUlang}</p>
        )}
        {x.kode === "VERIFIKASI" && x.status === "PERBAIKAN" && data.perbaikan && <FormPerbaikan data={data} lang={lang} aksi={aksi} />}
        {x.kode === "ASESMEN" && data.sesi.terbuka && data.sesi.pilihan.length > 0 && <PilihSesi data={data} lang={lang} aksi={aksi} />}
        {x.kode === "SERAGAM" && (aktif || x.status === "SELESAI") && data.seragam.terbuka && <FormSeragam data={data} lang={lang} aksi={aksi} selesai={x.status === "SELESAI"} />}
        {x.kode === "DAFTAR_ULANG" && aktif && <KonfirmasiDaftarUlang data={data} lang={lang} aksi={aksi} />}
      </div>
    </li>
  );
}

function FormPerbaikan({ data, lang, aksi }: { data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  const [berkas, setBerkas] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const p = data.perbaikan!;
  const lengkap = p.dokumen.every(d => berkas[d.kunci]);

  async function kirim() {
    setSibuk(true);
    setGalat("");
    const h = await aksi({ aksi: "perbaikan", berkas });
    if (!h.ok) setGalat(h.error || t.galat);
    setSibuk(false);
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      {p.pesan && (
        <div className="text-sm text-amber-800">
          <p className="font-semibold">{t.pesanPanitia}</p>
          <p className="whitespace-pre-line">{p.pesan}</p>
        </div>
      )}
      {p.dokumen.length > 0 && (
        <>
          <p className="text-sm font-semibold text-amber-800">{t.unggahUlang}</p>
          <div className="space-y-2">
            {p.dokumen.map(d => (
              <PengunggahBerkas key={d.kunci} label={d.label} lang={lang} url={berkas[d.kunci]} dokumen={d.kunci !== "foto"}
                onSelesai={u => setBerkas(b => ({ ...b, [d.kunci]: u }))} />
            ))}
          </div>
          {galat && <p className="error-msg">{galat}</p>}
          <button type="button" disabled={sibuk || !lengkap} onClick={kirim} className="btn-modal-save">
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {t.kirimPerbaikan}
          </button>
        </>
      )}
    </div>
  );
}

function PengunggahBerkas({ label, lang, url, onSelesai, jenis = "perbaikan", dokumen = false }: { label: string; lang: Lang; url?: string; onSelesai: (u: string) => void; jenis?: string; dokumen?: boolean }) {
  const t = TEKS[lang];
  const ref = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [saran, setSaran] = useState<string[]>([]);
  // Foto DOKUMEN (bukan pas foto / bukti bayar) yang tepi kertasnya terduga dirapikan dulu di pemindai.
  const [pindai, setPindai] = useState<{ file: File; kanvas: HTMLCanvasElement; sudut: Sudut } | null>(null);

  async function pilih(asli: File) {
    setGalat("");
    setSibuk(true);
    // Foto HP dikecilkan dulu (olah-foto.ts), batas 5 MB diperiksa SETELAHNYA — foto kamera 7 MB jadi ±400 KB.
    const olah = await kecilkanFoto(asli).catch(() => null);
    const f = olah?.file ?? asli;
    const sudut = dokumen && olah?.kanvas ? deteksiDokumen(olah.kanvas) : null;
    if (sudut && olah?.kanvas) { setPindai({ file: f, kanvas: olah.kanvas, sudut }); return; }
    kirim(f, olah?.kanvas ?? null);
  }

  async function kirim(f: File, kanvas: HTMLCanvasElement | null) {
    setSibuk(true);
    const saran = kanvas ? periksaMutu(kanvas, lang === "en" ? "en" : "id") : [];
    if (f.size > 5 * 1024 * 1024) { setGalat(lang === "en" ? "Max 5 MB" : "Maksimal 5 MB"); setSibuk(false); return; }
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("type", jenis);
      const r = await fetch("/api/admissions/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.url) { onSelesai(d.url); setSaran(saran); } else setGalat(d?.error || t.galat);
    } catch { setGalat(t.galat); }
    finally { setSibuk(false); }
  }

  async function pakaiHasil(hasil: HTMLCanvasElement) {
    const p = pindai;
    setPindai(null);
    if (!p) return;
    const f = await kanvasKeFile(hasil, p.file.name).catch(() => null);
    if (f) kirim(f, hasil); else kirim(p.file, p.kanvas);
  }
  /** Ditutup tanpa memilih = lanjut dengan foto asli, supaya unggahan tidak menggantung. */
  function pakaiAsli() {
    const p = pindai;
    setPindai(null);
    if (p) kirim(p.file, p.kanvas);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <FileText size={18} className="shrink-0 text-gray-400" />
      <p className="min-w-0 flex-1 text-sm font-medium text-gray-700">{label}</p>
      {url && <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><Check size={13} /> OK</span>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) pilih(f); e.target.value = ""; }} />
      <button type="button" disabled={sibuk} onClick={() => ref.current?.click()} className="btn-modal-cancel btn-teks">
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {sibuk ? t.mengunggah : t.unggah}
      </button>
      {galat && <p className="w-full text-xs text-red-600">{galat}</p>}
      {saran.length > 0 && !galat && (
        <div role="status" className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">{lang === "en" ? "Consider uploading again:" : "Sebaiknya unggah ulang:"}</p>
          <ul className="mt-0.5 list-disc pl-4">{saran.map(x => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {pindai && <PemindaiDokumen kanvas={pindai.kanvas} sudutAwal={pindai.sudut} lang={lang} onPakai={pakaiHasil} onAsli={pakaiAsli} onTutup={pakaiAsli} />}
    </div>
  );
}

function FormSeragam({ data, lang, aksi, selesai }: { data: Data; lang: Lang; aksi: Aksi; selesai: boolean }) {
  const t = TEKS[lang];
  const { setelan, isi, terkunci } = data.seragam;
  const [ubah, setUbah] = useState(!selesai);
  const [pilihan, setPilihan] = useState<Record<string, string>>(() =>
    Object.fromEntries((isi?.pilihan ?? []).map(p => [p.item, p.ukuran])));
  const [catatan, setCatatan] = useState(isi?.catatan ?? "");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const lengkap = setelan.item.every(i => pilihan[i.nama]);

  async function simpan() {
    setSibuk(true);
    setGalat("");
    const h = await aksi({ aksi: "seragam", pilihan: setelan.item.map(i => ({ item: i.nama, ukuran: pilihan[i.nama] })), catatan });
    if (h.ok) setUbah(false); else setGalat(h.error || t.galat);
    setSibuk(false);
  }

  if (!ubah) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(isi?.pilihan ?? []).map(p => (
          <span key={p.item} className="status-badge bg-primary-50 text-primary-700 border-primary-100"><Shirt size={13} /> {p.item}: {p.ukuran}</span>
        ))}
        {terkunci
          ? <span className="text-xs text-gray-400">{t.seragamTerkunci}</span>
          : <button type="button" onClick={() => setUbah(true)} className="btn-modal-cancel btn-teks">{t.ubahSeragam}</button>}
      </div>
    );
  }

  return (
    // Di HP kartu ini melebar ke kiri sejajar lingkaran tahap (-ml-12 = lingkaran 36px + jarak 12px) — di kolom
    // yang menjorok, kotak ukuran terlalu sempit dan keterangannya terlipat 5 baris (temuan user 7 Okt 2026).
    <div className="-ml-12 mt-3 space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:ml-0 sm:p-4">
      <p className="text-sm text-gray-500">{t.seragamKet}</p>
      {setelan.catatan && <p className="whitespace-pre-line rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{setelan.catatan}</p>}
      {setelan.gambar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={setelan.gambar} alt="Tabel ukuran seragam" className="max-h-96 w-auto rounded-xl border border-gray-100" />
      )}
      {setelan.item.map(item => (
        <div key={item.nama}>
          <p className="label-field">{item.nama}</p>
          {/* Kisi kotak ringkas (7 Okt 2026, temuan user "di mobile kurang rapi"): ukuran besar di atas, keterangan kecil
              di bawah — dulu satu baris penuh per ukuran dengan keterangan terlipat 3–4 baris di kolom sempit. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {item.ukuran.map(u => {
              const dipilih = pilihan[item.nama] === u.label;
              return (
                <button key={u.label} type="button" onClick={() => setPilihan(p => ({ ...p, [item.nama]: u.label }))} aria-pressed={dipilih}
                  className={`sentuh relative flex flex-col items-start rounded-xl border px-3 py-2 text-left transition ${dipilih ? "border-primary-700 bg-primary-50 ring-2 ring-primary-100" : "border-gray-200 bg-white hover:border-primary-300"}`}>
                  <span className="font-heading text-lg font-semibold leading-tight text-navy">{u.label}</span>
                  {u.keterangan && u.keterangan.split(/\s*·\s*/).map((k, n) => (
                    // Angka & satuannya diikat spasi tak-putus ("48 cm") — tanpa itu "cm" sering jatuh sendirian ke baris berikut.
                    <span key={n} className={`${n === 0 ? "mt-0.5" : ""} text-xs leading-snug text-gray-500`}>{k.replace(/(\d)\s+(cm|mm|kg)\b/gi, "$1\u00a0$2")}</span>
                  ))}
                  {dipilih && <Check size={15} className="absolute right-2 top-2 text-primary-700" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <label className="label-field">{t.catatanUkuran}</label>
        <input className="input-field" value={catatan} maxLength={300} onChange={e => setCatatan(e.target.value)} />
      </div>
      {galat && <p className="error-msg">{galat}</p>}
      <button type="button" disabled={sibuk || !lengkap} onClick={simpan} className="btn-modal-save">
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Shirt size={16} />} {t.simpanSeragam}
      </button>
    </div>
  );
}

function KonfirmasiDaftarUlang({ data, lang, aksi }: { data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const b = data.bayar;
  if (b.sudahKonfirmasi) {
    return (
      <div className="mt-3 space-y-1 text-sm">
        <p className="text-emerald-700"><Check size={14} className="mr-1 inline" />{t.sudahKonfirmasi}</p>
        {!b.cukup && <p className="text-amber-700">{t.tungguBayar(rupiah(b.wajib))}</p>}
      </div>
    );
  }
  const tungguPakta = !!data.pakta?.wajib && !data.pakta.sudah;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm text-gray-500">{t.konfirmasiKet}</p>
      {b.wajib > 0 && <p className="text-sm text-amber-700">{b.syarat === "LUNAS" ? t.syaratLunas : t.syaratDp(rupiah(b.wajib))}</p>}
      {tungguPakta && <p className="text-sm text-amber-700"><Signature size={14} className="mr-1 inline" />{t.paktaDulu}</p>}
      {galat && <p className="error-msg">{galat}</p>}
      <button type="button" disabled={sibuk || tungguPakta} className="btn-modal-save btn-teks"
        onClick={async () => { setSibuk(true); setGalat(""); const h = await aksi({ aksi: "daftar-ulang" }); if (!h.ok) setGalat(h.error || t.galat); setSibuk(false); }}>
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />} {t.konfirmasi}
      </button>
    </div>
  );
}

function KartuBayar({ data, lang, aksi, kunci }: { data: Data; lang: Lang; aksi: Aksi; kunci: { nomor: string; t: string } }) {
  const t = TEKS[lang];
  const b = data.bayar;
  const [buka, setBuka] = useState(false);
  const [jumlah, setJumlah] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [bukti, setBukti] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const persen = b.tagihan ? Math.min(100, Math.round((b.sah / b.tagihan) * 100)) : 0;
  const LABEL: Record<string, { teks: string; kelas: string }> = {
    SAH: { teks: t.sah, kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    MENUNGGU: { teks: t.menungguS, kelas: "bg-amber-50 text-amber-700 border-amber-200" },
    DITOLAK: { teks: t.ditolakS, kelas: "bg-red-50 text-red-600 border-red-200" },
  };

  async function kirim() {
    setSibuk(true);
    setGalat("");
    const h = await aksi({ aksi: "bayar", jumlah: Number(jumlah.replace(/\D/g, "")), tanggal, bukti });
    if (h.ok) { setBuka(false); setJumlah(""); setTanggal(""); setBukti(""); } else setGalat(h.error || t.galat);
    setSibuk(false);
  }

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white"><Wallet size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-navy">{t.bayarJudul}{b.lunas && <span className="status-badge ml-2 bg-emerald-50 text-emerald-700 border-emerald-200">{t.lunas}</span>}</p>
          <p className="text-sm text-gray-500">{t.bayarKet}</p>
        </div>
      </div>

      {b.tagihan > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-gray-50 p-2.5"><p className="text-xs text-gray-400">{t.tagihan}</p><p className="angka text-sm font-semibold text-navy">{rupiah(b.tagihan)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-2.5"><p className="text-xs text-emerald-600">{t.terbayar}</p><p className="angka text-sm font-semibold text-emerald-700">{rupiah(b.sah)}</p></div>
            <div className="rounded-xl bg-gray-50 p-2.5"><p className="text-xs text-gray-400">{t.sisa}</p><p className="angka text-sm font-semibold text-navy">{rupiah(b.sisa)}</p></div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${persen}%` }} /></div>
          {b.potongan > 0 && <p className="text-xs text-gray-500">{t.potongan}: {rupiah(b.potongan)}{b.keteranganPotongan ? ` (${b.keteranganPotongan})` : ""}</p>}
          {b.menunggu > 0 && <p className="text-sm text-amber-700">{t.menungguPeriksa}: {rupiah(b.menunggu)}</p>}
        </div>
      ) : <p className="mt-3 text-sm text-gray-400">{t.belumTagihan}</p>}

      {b.info && <p className="mt-4 whitespace-pre-line rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{b.info}</p>}

      {b.riwayat.length > 0 && (
        <div className="mt-4">
          <p className="label-field">{t.riwayat}</p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {b.riwayat.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="angka font-semibold text-navy">{rupiah(r.jumlah)}</span>
                <span className="text-gray-400">{new Date(r.tanggal).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</span>
                <span className={`status-badge ml-auto ${LABEL[r.status]?.kelas ?? ""}`}>{LABEL[r.status]?.teks ?? r.status}</span>
                {r.status === "SAH" && (
                  <Link href={`/spmb/kuitansi?nomor=${encodeURIComponent(kunci.nomor)}&t=${encodeURIComponent(kunci.t)}&p=${r.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"><ReceiptText size={13} /> {t.kuitansi}</Link>
                )}
                {r.alasanTolak && <p className="w-full text-xs text-red-600">{r.alasanTolak}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!b.lunas && (buka ? (
        <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label-field">{t.jumlah}</label>
              <input className="input-field angka" inputMode="numeric" value={jumlah}
                onChange={e => { const n = e.target.value.replace(/\D/g, ""); setJumlah(n ? Number(n).toLocaleString("id-ID") : ""); }} /></div>
            <div><label className="label-field">{t.tglBayar}</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
          </div>
          <PengunggahBerkas label={t.buktiFoto} lang={lang} url={bukti} onSelesai={setBukti} jenis="pembayaran" />
          {galat && <p className="error-msg">{galat}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setBuka(false)} className="btn-modal-cancel">{lang === "en" ? "Cancel" : "Batal"}</button>
            <button type="button" disabled={sibuk || !jumlah || !bukti} onClick={kirim} className="btn-modal-save">
              {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {t.kirimBukti}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setBuka(true)} className="btn-modal-cancel btn-teks mt-4"><Upload size={16} /> {t.kirimBukti}</button>
      ))}
    </div>
  );
}

function KartuNotif({ data, lang, aksi }: { data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  const [st, setSt] = useState<StatusPush>("memeriksa");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => { statusPush().then(setSt).catch(() => setSt("tidak-didukung")); }, []);
  if (st === "memeriksa" || st === "tidak-didukung" || st === "perlu-https") return null;

  async function aktifkan() {
    setSibuk(true);
    setGalat("");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") { setSt("ditolak"); return; }
      await navigator.serviceWorker.register("/sw.js").catch(() => null);
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const k = data.push.publicKey!;
        const pad = "=".repeat((4 - (k.length % 4)) % 4);
        const biner = atob((k + pad).replace(/-/g, "+").replace(/_/g, "/"));
        const kunci = new Uint8Array(new ArrayBuffer(biner.length));
        for (let i = 0; i < biner.length; i++) kunci[i] = biner.charCodeAt(i);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci });
      }
      // Simpan sebagai langganan PENDAFTAR ini (bukan akun) — lihat src/lib/spmb-kabar.ts.
      const h = await aksi({ aksi: "langganan", subscription: sub.toJSON() });
      if (h.ok) setSt("aktif"); else setGalat(h.error || t.galat);
    } catch { setGalat(t.galat); }
    finally { setSibuk(false); }
  }

  return (
    <div className="panel flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"><Bell size={20} /></span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold text-navy">{t.notifJudul}</p>
        <p className="text-sm text-gray-500">
          {st === "aktif" ? t.notifAktif : st === "ditolak" ? t.notifDitolak : st === "perlu-pasang-ios" ? t.notifIos : t.notifKet}
        </p>
        {galat && <p className="mt-1 text-xs text-red-600">{galat}</p>}
      </div>
      {st === "belum" && (
        <button type="button" disabled={sibuk} onClick={aktifkan} className="btn-modal-save btn-teks">
          {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} {t.notifAktifkan}
        </button>
      )}
      {st === "aktif" && <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><Check size={14} /> {t.notifAktif.split(" ")[0]}</span>}
    </div>
  );
}

function PilihSesi({ data, lang, aksi }: { data: Data; lang: Lang; aksi: Aksi }) {
  const t = TEKS[lang];
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="text-sm font-semibold text-navy">{t.sesiJudul}</p>
      <p className="text-sm text-gray-500">{t.sesiKet}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.sesi.pilihan.map(x => {
          const dipilih = data.sesi.dipilih === x.id;
          const penuh = x.sisa <= 0 && !dipilih;
          return (
            <button key={x.id} type="button" disabled={penuh || dipilih || !!sibuk}
              onClick={async () => { setSibuk(x.id); setGalat(""); const h = await aksi({ aksi: "sesi", sesiId: x.id }); if (!h.ok) setGalat(h.error || t.galat); setSibuk(null); }}
              className={`sentuh rounded-xl border p-3 text-left text-sm transition ${dipilih ? "border-primary-700 bg-primary-50 ring-2 ring-primary-100" : penuh ? "border-gray-200 bg-gray-100 text-gray-400" : "border-gray-200 bg-white hover:border-primary-300"}`}>
              <span className="block font-semibold text-navy">{tgl(x.tanggal, lang)}</span>
              <span className="angka block text-gray-600">{x.jamMulai}–{x.jamSelesai} WIB{x.tempat ? ` · ${x.tempat}` : ""}</span>
              <span className={`mt-1 block text-xs ${dipilih ? "font-semibold text-primary-700" : penuh ? "text-red-500" : "text-emerald-700"}`}>
                {sibuk === x.id ? <Loader2 size={12} className="inline animate-spin" /> : dipilih ? t.sesiDipilih : penuh ? t.sesiPenuh : t.sesiSisa(x.sisa)}
              </span>
            </button>
          );
        })}
      </div>
      {galat && <p className="error-msg">{galat}</p>}
    </div>
  );
}

function KartuPakta({ data, lang, kunci, onSelesai }: { data: Data; lang: Lang; kunci: { nomor: string; t: string }; onSelesai: () => void }) {
  const t = TEKS[lang];
  const p = data.pakta!;
  const [nama, setNama] = useState(p.walinya);
  const [hubungan, setHubungan] = useState("");
  const [setuju, setSetuju] = useState(false);
  const siap = nama.trim().length >= 3 && !!hubungan && setuju;
  const q = `nomor=${encodeURIComponent(kunci.nomor)}&t=${encodeURIComponent(kunci.t)}`;
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${p.sudah ? "bg-emerald-600" : "bg-primary-700"}`}><Signature size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold text-navy">{p.judul}</p>
          <p className="text-sm text-gray-500">{t.paktaKet}{p.wajib && !p.sudah ? ` ${t.paktaWajib}` : ""}</p>
        </div>
      </div>
      {p.sudah ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-sm text-emerald-700"><Check size={14} className="mr-1 inline" />
            {t.paktaSudah(p.sudah.nama ?? "", p.sudah.hubungan ?? "", new Date(p.sudah.at).toLocaleString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }))}</p>
          <Link href={`/spmb/pakta?${q}`} className="btn-modal-cancel btn-teks"><Printer size={16} /> {t.paktaCetak}</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm leading-relaxed text-gray-700">{p.isi}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label-field">{t.paktaNama}</label><input className="input-field" value={nama} maxLength={100} onChange={e => setNama(e.target.value)} /></div>
            <div>
              <label className="label-field">{t.paktaHubungan}</label>
              <div className="flex flex-wrap gap-1.5">
                {HUBUNGAN_WALI.map(h => (
                  <button key={h} type="button" onClick={() => setHubungan(h)}
                    className={`sentuh rounded-lg border px-4 py-2 text-sm transition ${hubungan === h ? "border-primary-700 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300"}`}>
                    {lang === "en" ? ({ Ayah: "Father", Ibu: "Mother", Wali: "Guardian" } as Record<string, string>)[h] : h}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={setuju} onChange={e => setSetuju(e.target.checked)} /> {t.paktaSetuju}
          </label>
          <div>
            <p className="label-field">{t.paktaTtd}</p>
            {!siap && <p className="mb-2 text-xs text-amber-700">{t.paktaBelum}</p>}
            <PenyuntingTtd endpoint={`/api/spmb/calon/pakta?${q}`} onSelesai={onSelesai} siap={siap} labelSimpan={t.paktaSimpan}
              ekstra={{ nama: nama.trim(), hubungan, setuju: setuju ? "1" : "0" }} />
          </div>
        </div>
      )}
    </div>
  );
}
