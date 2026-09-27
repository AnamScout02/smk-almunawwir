"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, BookOpen, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Clock, Loader2, LogIn, Smartphone, Trophy, User2,
} from "lucide-react";
import { HALAMAN_APLIKASI, hpAndroid, lewatAplikasi } from "@/lib/aplikasi-ujian";
import EmptyState from "@/components/admin/EmptyState";

/** TAHAP 2 — BERANDA PESERTA UJIAN.
 *
 * Isi layar pertama setelah siswa masuk portal ujian: identitas dirinya (supaya yakin tidak
 * salah akun), kartu ujian yang berlaku HARI INI, dan riwayat ujian yang sudah dikumpulkan.
 * Membuka halaman ini TIDAK menjalankan jam ujian — menekan kartu hanya membawa ke halaman
 * konfirmasi & petunjuk (tahap 3), tempat token diminta. */

interface UjianAktif {
  id: string; judul: string; mapel: string; guru: string; durasi: number;
  kegiatan: { nama: string; singkatan: string } | null;
  mulai: string; tutup: string; jumlahSoal: number; sudahMulai: boolean; sudahSelesai: boolean;
  /** Alasan penahanan panitia (belum menyelesaikan administrasi) — src/lib/peserta-ditahan.ts. */
  ditahan?: string | null;
  status: "AKAN_DATANG" | "BERLANGSUNG";
}
interface UjianRiwayat {
  id: string; judul: string; mapel: string; tutup: string; dikumpulkan: string | null;
  kegiatan: { nama: string; singkatan: string } | null;
  nilai: number | null; bolehLihatNilai: boolean; jumlahSoal: number; sementara?: boolean;
}
interface Muatan {
  siswa: { nama: string; nis: string; nisn: string; kelas: string; avatar: string | null };
  aktif: UjianAktif[]; riwayat: UjianRiwayat[];
}

const jam = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const tgl = (d: string) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function BerandaPesertaPage() {
  const [data, setData] = useState<Muatan | null>(null);
  // HP Android yang belum memakai Aplikasi Ujian → tawarkan unduhan (beberapa ujian mewajibkannya).
  const [hpTanpaAplikasi, setHpTanpaAplikasi] = useState(false);
  useEffect(() => { const ua = navigator.userAgent; queueMicrotask(() => setHpTanpaAplikasi(hpAndroid(ua) && !lewatAplikasi(ua))); }, []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selesaiId, setSelesaiId] = useState<string | null>(null);

  // Datang dari halaman ujian yang baru dikumpulkan (?selesai=<id>): tampilkan pesan berhasil sekali,
  // lalu rapikan alamatnya supaya pesan tidak muncul lagi saat halaman dimuat ulang.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("selesai");
      if (q) { queueMicrotask(() => setSelesaiId(q)); window.history.replaceState(null, "", "/ujian-online"); }
    } catch { /* abaikan */ }
  }, []);

  useEffect(() => {
    fetch("/api/student/exams")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError("Koneksi bermasalah."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {loading ? (
        <div className="rounded-2xl border border-primary-100 bg-white shadow-lg py-16 flex justify-center">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-primary-100 bg-white shadow-lg p-6">
          <p className="error-msg text-center">{error}</p>
        </div>
      ) : data && (
        <div className="space-y-5">
          {selesaiId && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 shadow-lg p-4 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-heading font-bold text-emerald-800">Ujian berhasil dikumpulkan</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {data.riwayat.find(r => r.id === selesaiId)?.judul ?? "Jawaban Anda"} — sudah tersimpan di server. Terima kasih.
                </p>
              </div>
            </div>
          )}
          {/* ——— identitas peserta ——— */}
          <div className="rounded-2xl border border-primary-100 bg-white shadow-lg p-5 flex items-center gap-4">
            {data.siswa.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.siswa.avatar} alt={data.siswa.nama} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-primary-100 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
                <User2 size={26} className="text-primary-300" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-heading font-bold text-gray-800 text-lg leading-tight truncate">{data.siswa.nama}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.siswa.kelas} · NIS {data.siswa.nis}{data.siswa.nisn ? ` · NISN ${data.siswa.nisn}` : ""}
              </p>
              <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                <BadgeCheck size={12} /> Pastikan nama di atas benar sebelum mengerjakan.
              </p>
            </div>
          </div>

          {/* ——— tautan panduan peserta ——— */}
          <Link href="/ujian-online/panduan"
            className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-white px-5 py-3.5 shadow-sm hover:bg-primary-50 transition">
            <BookOpen size={18} className="text-gold-dark shrink-0" />
            <span className="flex-1 min-w-0 text-sm">
              <span className="font-heading font-bold text-primary-900">Panduan Peserta</span>
              <span className="block text-xs text-gray-500">Cara memasukkan token, isi layar ujian, dan kalau terjadi gangguan.</span>
            </span>
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          </Link>

          {hpTanpaAplikasi && (
            <a href={HALAMAN_APLIKASI}
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 shadow-sm hover:bg-amber-100 transition">
              <Smartphone size={18} className="text-amber-600 shrink-0" />
              <span className="flex-1 min-w-0 text-sm">
                <span className="font-heading font-bold text-amber-900">Unduh Aplikasi MyAlwis Mobile</span>
                <span className="block text-xs text-amber-800">Layar terkunci otomatis saat ujian — beberapa ujian mewajibkannya. Pasang sebelum hari ujian.</span>
              </span>
              <ChevronRight size={16} className="text-amber-500 shrink-0" />
            </a>
          )}

          {/* ——— ujian hari ini ——— */}
          <div>
            <h2 className="font-heading font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
              <CalendarClock size={16} className="text-primary-700" /> Ujian Hari Ini
            </h2>
            {data.aktif.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100">
                <EmptyState icon={ClipboardList} title="Belum ada ujian hari ini"
                  description="Kartu ujian akan muncul di sini pada hari pelaksanaan. Tunggu arahan dari guru atau pengawas." />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.aktif.map(u => {
                  const jalan = u.status === "BERLANGSUNG";
                  return (
                    <div key={u.id} className="panel p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {u.kegiatan && <span className="badge badge-gold" title={u.kegiatan.nama}>{u.kegiatan.singkatan}</span>}
                            <span className="badge badge-navy">{u.mapel}</span>
                          </div>
                          <p className="font-heading font-bold text-gray-800 leading-snug">{u.judul}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{u.guru}</p>
                        </div>
                        <span className={`status-badge shrink-0 ${jalan ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {jalan ? "Dibuka" : "Belum Dibuka"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 my-3 text-center">
                        <div className="rounded-xl bg-gray-50 py-2">
                          <p className="font-heading font-bold text-gray-800 text-sm">{u.jumlahSoal}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Soal</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 py-2">
                          <p className="font-heading font-bold text-gray-800 text-sm">{u.durasi}′</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Durasi</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 py-2">
                          <p className="font-heading font-bold text-gray-800 text-sm">{jam(u.mulai)}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Mulai</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                        <Clock size={11} /> Ditutup pukul {jam(u.tutup)} — {tgl(u.tutup)}
                      </p>
                      {u.ditahan && (
                        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          <strong>Ditahan panitia:</strong> {u.ditahan}. Hubungi Tata Usaha / panitia ujian.
                        </p>
                      )}
                      {jalan ? (
                        <Link href={`/ujian-online/mulai/${u.id}`}
                          className="btn-modal-save w-full mt-auto">
                          <LogIn size={15} /> {u.sudahMulai ? "Lanjutkan Ujian" : "Ikuti Ujian"}
                        </Link>
                      ) : (
                        <button disabled className="w-full mt-auto px-4 py-2.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed">
                          Menunggu pukul {jam(u.mulai)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ——— riwayat ——— */}
          <div>
            <h2 className="font-heading font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-gold-dark" /> Ujian yang Sudah Selesai
            </h2>
            {data.riwayat.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100">
                <EmptyState icon={CheckCircle2} title="Belum ada riwayat" description="Ujian yang sudah Anda kumpulkan akan tercatat di sini." />
              </div>
            ) : (
              <div className="panel divide-y divide-gray-50">
                {data.riwayat.map(u => (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 text-sm truncate">{u.judul}</p>
                      <p className="text-xs text-gray-400">
                        {u.kegiatan ? `${u.kegiatan.singkatan} · ` : ""}{u.mapel} · {u.dikumpulkan ? `dikumpulkan ${jam(u.dikumpulkan)}, ${tgl(u.dikumpulkan)}` : "tidak dikerjakan"}
                      </p>
                    </div>
                    {u.dikumpulkan ? (
                      u.bolehLihatNilai ? (
                        u.nilai !== null ? (
                          <div className="text-right shrink-0">
                            <p className="font-heading font-bold text-primary-900 text-lg leading-none">{u.nilai}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{u.sementara ? "Nilai sementara" : "Nilai"}</p>
                          </div>
                        ) : (
                          <span className="status-badge bg-amber-50 text-amber-700 border-amber-200 shrink-0">Menunggu Koreksi</span>
                        )
                      ) : (
                        <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">Terkumpul</span>
                      )
                    ) : (
                      <span className="status-badge bg-gray-50 text-gray-500 border-gray-200 shrink-0">Terlewat</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
