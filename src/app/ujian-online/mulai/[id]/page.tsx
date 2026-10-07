"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchUjian } from "@/lib/perangkat-ujian";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, KeyRound, Loader2, MonitorSmartphone, PlayCircle,
  ShieldCheck, Sparkles,
  ShieldBan,
} from "lucide-react";

/** TAHAP 3 — KONFIRMASI & PETUNJUK UJIAN.
 *
 * Layar terakhir sebelum jam berjalan: keterangan ujian (jumlah soal per jenis, alokasi waktu,
 * jadwal), petunjuk pengerjaan, kotak token dari pengawas, dan pernyataan kesanggupan. Tombol
 * "MULAI MENGERJAKAN" sengaja mati sampai token terisi DAN pernyataan dicentang — jam ujian
 * baru dijalankan server setelah tombol itu ditekan, bukan saat halaman ini dibuka. */

interface Info {
  kegiatan: { nama: string; singkatan: string; semester: string | null; tahunAjaran: string | null } | null;
  petunjukTambahan: string;
  izinKalkulator: boolean; izinCoretan: boolean; nilaiSementara?: boolean;
  id: string; judul: string; deskripsi: string | null; mapel: string; guru: string; kelas: string;
  durasi: number; mulai: string; tutup: string; serverNow: string;
  totalSoal: number; jumlahDikerjakan: number; disampel: boolean; totalSkor: number;
  rincian: { tipe: string; label: string; jumlah: number }[];
  perluExamkey: boolean; acakSoal: boolean; acakOpsi: boolean; batasPindahTab: number; tampilkanNilai: boolean;
  sudahMulai: boolean; sudahSelesai: boolean; nilai: number | null; aktifDiPerangkatLain: number | null;
  /** Ditahan panitia (mis. belum menyelesaikan administrasi) — token pasti ditolak; lihat src/lib/peserta-ditahan.ts. */
  ditahan?: string | null;
}

const jam = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const tgl = (d: string) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function KonfirmasiUjianPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [muat, setMuat] = useState(true);
  const [token, setToken] = useState("");
  const [setuju, setSetuju] = useState(false);
  const [kirim, setKirim] = useState(false);
  const [error, setError] = useState("");
  const [adaKey, setAdaKey] = useState(false);

  /** examkey dibawa oleh browser ujian sekolah lewat URL; disalin ke sessionStorage supaya tetap
   * terbawa setelah berpindah halaman. */
  function ambilExamkey(): string {
    try {
      const k = new URLSearchParams(window.location.search).get("examkey");
      if (k) { sessionStorage.setItem("examkey", k); return k; }
      return sessionStorage.getItem("examkey") ?? "";
    } catch { return ""; }
  }

  useEffect(() => {
    if (ambilExamkey()) queueMicrotask(() => setAdaKey(true));
    fetch(`/api/student/exams/${id}/info`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setInfo(d); })
      .catch(() => setError("Koneksi bermasalah."))
      .finally(() => setMuat(false));
  }, [id]);

  async function mulai() {
    setError(""); setKirim(true);
    // Layar penuh HARUS diminta di dalam gestur klik — kalau diminta setelah halaman ujian terbuka,
    // browser menolaknya. Gagal pun tidak apa-apa: halaman ujian punya tirai satu tombol.
    document.documentElement.requestFullscreen?.().catch(() => {});
    try {
      const r = await fetchUjian("/api/student/exams/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim().toUpperCase(), examkey: ambilExamkey(), examId: id }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.selesai && d.examId) { router.push(`/ujian-online/${d.examId}`); return; }
        setError(d.error || "Gagal masuk ujian."); return;
      }
      // Token kegiatan yang membuka beberapa ujian sekaligus: server mengembalikan daftar pilihan.
      if (Array.isArray(d.pilih) && d.pilih.length) {
        setError(`Token ${d.kegiatan ?? "kegiatan"} membuka beberapa ujian: ${d.pilih.map((x: { mapel: string }) => x.mapel).join(", ")}. Pilih ujiannya dari daftar, lalu masukkan token lagi.`);
        return;
      }
      if (d.examId !== id) { setError("Token itu milik ujian yang lain. Periksa lagi token dari pengawas."); return; }
      router.push(`/ujian-online/${d.examId}`);
    } catch { setError("Koneksi bermasalah. Coba lagi."); }
    finally { setKirim(false); }
  }

  const siap = token.trim().length >= 4 && setuju && !kirim;

  return (
    <>
        {muat ? (
          <div className="rounded-2xl border border-primary-100 bg-white shadow-lg py-16 flex justify-center">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : !info ? (
          <div className="rounded-2xl border border-primary-100 bg-white shadow-lg p-6">
            <p className="error-msg text-center">{error || "Ujian tidak ditemukan."}</p>
            <div className="flex justify-center mt-4">
              <Link href="/ujian-online" className="btn-modal-cancel">
                <ArrowLeft size={18} /> Kembali ke Beranda Peserta
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* ——— keterangan ujian ——— */}
            <div className="rounded-2xl border border-primary-100 bg-white shadow-lg overflow-hidden">
              <div className="relative px-5 py-4" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                  style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", filter: "invert(1)" }} />
                <div className="relative">
                  {info.kegiatan && (
                    <p className="text-white/60 text-xs font-heading font-semibold uppercase tracking-[0.12em] mb-1">
                      {info.kegiatan.nama}{info.kegiatan.tahunAjaran ? ` · ${info.kegiatan.tahunAjaran}` : ""}
                    </p>
                  )}
                  <p className="text-gold text-xs font-heading font-semibold uppercase tracking-[0.12em]">{info.mapel}</p>
                  <h2 className="font-heading font-bold text-white text-lg leading-snug mt-0.5">{info.judul}</h2>
                  <p className="text-white/50 text-xs mt-1">{info.kelas} · {info.guru}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-50 border-b border-gray-50">
                {[
                  { v: info.jumlahDikerjakan, l: "Soal Dikerjakan" },
                  { v: `${info.durasi} menit`, l: "Alokasi Waktu" },
                  { v: jam(info.mulai), l: "Dibuka" },
                  { v: jam(info.tutup), l: "Ditutup" },
                ].map((s, i) => (
                  <div key={i} className="px-4 py-3.5 text-center">
                    <p className="font-heading font-bold text-gray-800">{s.v}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-gray-400">{tgl(info.mulai)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {info.rincian.map(r => (
                    <span key={r.tipe} className="badge badge-navy">{r.jumlah} {r.label}</span>
                  ))}
                </div>
                {info.disampel && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Dari {info.totalSoal} soal yang tersedia, Anda menerima {info.jumlahDikerjakan} soal yang dipilih acak —
                    naskah tiap peserta berbeda.
                  </p>
                )}
                {info.deskripsi && <p className="text-sm text-gray-600 leading-relaxed">{info.deskripsi}</p>}
              </div>
            </div>

            {/* ——— sudah selesai / sedang aktif di perangkat lain ——— */}
            {info.sudahSelesai ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
                <p className="font-heading font-bold text-emerald-800">Anda sudah mengumpulkan ujian ini.</p>
                {info.tampilkanNilai && info.nilai !== null && (
                  <p className="text-sm text-emerald-700 mt-1">Nilai {info.nilaiSementara ? "sementara" : "Anda"}: <strong className="text-2xl font-heading">{info.nilai}</strong></p>
                )}
                <Link href="/ujian-online" className="btn-primary inline-flex items-center gap-2 text-sm mt-4">
                  <ArrowLeft size={15} /> Kembali ke Beranda
                </Link>
              </div>
            ) : info.ditahan ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
                <ShieldBan size={32} className="mx-auto text-rose-600 mb-2" />
                <p className="font-heading font-bold text-rose-800">Belum bisa mengikuti ujian</p>
                <p className="text-sm text-rose-700 mt-1 leading-relaxed">{info.ditahan}</p>
                <p className="text-xs text-rose-600 mt-2">Setelah urusan administrasi selesai, panitia akan membuka akses Anda — lalu masukkan token seperti biasa.</p>
                <Link href="/ujian-online" className="btn-modal-cancel mt-4">
                  <ArrowLeft size={15} /> Kembali ke Beranda
                </Link>
              </div>
            ) : (
              <>
                {info.aktifDiPerangkatLain !== null && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                    <MonitorSmartphone size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-heading font-bold text-amber-800 text-sm">Ujian ini sedang terbuka di perangkat lain</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                        Terakhir aktif {info.aktifDiPerangkatLain} detik lalu. Kalau itu bukan Anda, laporkan ke pengawas.
                        Kalau komputer Anda tadi bermasalah, lanjutkan saja di sini — jawaban yang sudah tersimpan tetap ada,
                        dan sisa waktu tetap dihitung dari jam mulai yang pertama.
                      </p>
                    </div>
                  </div>
                )}

                {/* ——— petunjuk ——— */}
                <div className="panel p-5">
                  <p className="font-heading font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                    <Sparkles size={15} className="text-gold-dark" /> Petunjuk Pengerjaan
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 leading-relaxed">
                    <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">1.</span><span>Waktu berjalan sejak tombol <strong>Mulai Mengerjakan</strong> ditekan dan dihitung di server — menutup halaman atau mati listrik tidak menghentikan hitungan.</span></li>
                    <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">2.</span><span>Jawaban <strong>tersimpan otomatis</strong> setiap kali Anda memilih atau mengetik. Tidak perlu menekan simpan.</span></li>
                    <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">3.</span><span>Dilarang membuka tab, jendela, atau aplikasi lain. Perpindahan tab <strong>tercatat</strong> dan terlihat oleh pengawas{info.batasPindahTab > 0 ? `, maksimal ${info.batasPindahTab} kali` : ""}.</span></li>
                    {info.acakSoal && <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">4.</span><span>Urutan soal{info.acakOpsi ? " dan pilihan jawaban" : ""} diacak berbeda untuk tiap peserta — nomor teman Anda bukan nomor Anda.</span></li>}
                    <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">{info.acakSoal ? 5 : 4}.</span><span>Kumpulkan sebelum waktu habis. Kalau waktu habis, jawaban yang sudah tersimpan otomatis dikumpulkan.</span></li>
                    <li className="flex gap-2"><span className="text-primary-700 font-bold shrink-0">{info.acakSoal ? 6 : 5}.</span><span>Kalau ada gangguan komputer/jaringan, angkat tangan dan panggil pengawas — jangan menutup ujian sendiri.</span></li>
                  </ul>
                  {(info.izinKalkulator || info.izinCoretan) && (
                    <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      Alat bantu tersedia di layar ujian: {[info.izinKalkulator ? "kalkulator" : "", info.izinCoretan ? "kertas coretan" : ""].filter(Boolean).join(" dan ")}. Tidak perlu membawa kalkulator atau kertas sendiri.
                    </p>
                  )}
                  {info.petunjukTambahan.trim() && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Petunjuk dari sekolah</p>
                      <ul className="text-sm text-gray-600 space-y-1.5 leading-relaxed list-disc pl-5">
                        {info.petunjukTambahan.split("\n").map(t => t.trim()).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* ——— token & pernyataan ——— */}
                <div className="panel p-5">
                  {error && <p className="error-msg mb-3">{error}</p>}
                  <label className="label-field flex items-center gap-1.5"><KeyRound size={13} /> Token Ujian</label>
                  <input value={token} onChange={e => setToken(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter" && siap) mulai(); }}
                    className="input-field text-center font-mono text-2xl tracking-[0.4em] font-bold" placeholder="TOKEN" maxLength={6} autoFocus />
                  <p className="text-xs text-gray-400 mt-1.5">Token diumumkan pengawas di ruang ujian dan bisa berubah sewaktu-waktu.</p>

                  {info.perluExamkey && (
                    <p className={`mt-3 text-xs flex items-center gap-1.5 ${adaKey ? "text-emerald-700" : "text-red-600"}`}>
                      <ShieldCheck size={13} />
                      {adaKey ? "Browser ujian sekolah terdeteksi." : "Ujian ini hanya bisa dibuka lewat browser ujian sekolah."}
                    </p>
                  )}

                  <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
                    <input type="checkbox" checked={setuju} onChange={e => setSetuju(e.target.checked)} className="mt-0.5 accent-primary-700" />
                    <span className="text-sm text-gray-600 leading-relaxed">
                      Saya sudah membaca petunjuk di atas dan sanggup mengerjakan ujian ini dengan <strong>jujur</strong>,
                      tanpa bantuan orang lain maupun alat lain.
                    </span>
                  </label>

                  <button onClick={mulai} disabled={!siap}
                    className="btn-modal-save w-full mt-4 disabled:opacity-40 disabled:cursor-not-allowed">
                    {kirim ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />} MULAI MENGERJAKAN
                  </button>
                  {!siap && !kirim && (
                    <p className="text-xs text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
                      <AlertTriangle size={11} /> Isi token dan centang pernyataan untuk mengaktifkan tombol.
                    </p>
                  )}
                  <p className="text-xs text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
                    <Clock size={11} /> Jam mulai dicatat server saat tombol ditekan.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
    </>
  );
}
