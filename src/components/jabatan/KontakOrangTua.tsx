"use client";
import { useCallback, useEffect, useState } from "react";
import { Contact, Copy, Loader2, MessageCircle, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { salinTeks } from "@/lib/salin-teks";

interface Kontak { peran: string; nama: string; nomor: string; wa: string }
interface Siswa { id: string; nama: string; nis: string; kontak: Kontak[]; akunOrtu: { nama: string; pernahMasuk: boolean } | null }
interface Data { kelas: { id: string; name: string }[]; classId: string; namaSaya: string; siswa: Siswa[] }

const TEMPLAT: Record<string, string> = {
  sapa: "Assalamu'alaikum Bapak/Ibu orang tua/wali dari {siswa} ({kelas}). Saya {wali}, wali kelas {kelas} SMK Al-Munawwir. ",
  undangan: "Assalamu'alaikum Bapak/Ibu orang tua/wali dari {siswa} ({kelas}). Kami mengundang Bapak/Ibu hadir di sekolah pada hari … pukul … untuk … Terima kasih. — {wali}, wali kelas {kelas}",
  kehadiran: "Assalamu'alaikum Bapak/Ibu orang tua/wali dari {siswa} ({kelas}). Kami informasikan bahwa hari ini {siswa} belum hadir di sekolah tanpa keterangan. Mohon kabarnya. — {wali}, wali kelas {kelas}",
  portal: "Assalamu'alaikum Bapak/Ibu orang tua/wali dari {siswa}. Kehadiran, nilai, dan pengumuman sekolah bisa dipantau di Portal Orang Tua: masuk dengan nomor HP Bapak/Ibu di situs sekolah. — {wali}, wali kelas {kelas}",
};
const NAMA_TEMPLAT: Record<string, string> = { sapa: "Sapaan", undangan: "Undangan ke sekolah", kehadiran: "Kabar ketidakhadiran", portal: "Ajakan memakai Portal Orang Tua" };

/** KONTAK ORANG TUA (wali kelas, 17 Sep 2026) — nomor dari data TU, pesan WhatsApp dikirim manual (tanpa gateway berbayar). */
/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function KontakOrangTua() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [classId, setClassId] = useState("");
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [templat, setTemplat] = useState("sapa");
  const [pesan, setPesan] = useState(TEMPLAT.sapa);

  const muat = useCallback((id: string) => {
    fetch(`/api/teacher/kontak-ortu${id ? `?classId=${id}` : ""}`, { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else { setData(d); setClassId(d.classId); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(""); }, [muat]);

  const namaKelas = data?.kelas.find(k => k.id === classId)?.name ?? "";
  const isi = (s: Siswa) => pesan.replaceAll("{siswa}", s.nama).replaceAll("{kelas}", namaKelas).replaceAll("{wali}", data?.namaSaya || "wali kelas");
  const daftar = (data?.siswa ?? []).filter(s =>
    (!cari || s.nama.toLowerCase().includes(cari.toLowerCase()) || s.nis.includes(cari))
    && (saring === "" || (saring === "TANPA_NOMOR" ? s.kontak.length === 0 : saring === "BELUM_PORTAL" ? !s.akunOrtu?.pernahMasuk : true)));
  const tanpaNomor = (data?.siswa ?? []).filter(s => !s.kontak.length).length;
  const belumPortal = (data?.siswa ?? []).filter(s => !s.akunOrtu?.pernahMasuk).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Contact size={22} />} title="Kontak Orang Tua"
        description={data ? `${namaKelas} · ${data.siswa.length} siswa · ${tanpaNomor} tanpa nomor · ${belumPortal} orang tua belum pernah masuk portal` : "Nomor orang tua dari data TU dan pesan WhatsApp siap kirim"} />
      {galat ? <EmptyState icon={Contact} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-4">
            <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau NIS…" className="input-field pl-10" /></div>
            {data.kelas.length > 1 && <div className="alat-saring"><Select value={classId} onChange={v => { setClassId(v); muat(v); }} options={data.kelas.map(k => ({ value: k.id, label: k.name }))} /></div>}
            <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[{ value: "", label: "Semua siswa" }, { value: "TANPA_NOMOR", label: "Tanpa nomor" }, { value: "BELUM_PORTAL", label: "Ortu belum masuk portal" }]} /></div>
          </div>

          <div className="panel mb-5 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[16rem_1fr]">
              <div>
                <label className="label-field">Templat pesan</label>
                <Select value={templat} onChange={v => { setTemplat(v); setPesan(TEMPLAT[v]); }} options={Object.entries(NAMA_TEMPLAT).map(([value, label]) => ({ value, label }))} />
                <p className="mt-2 text-xs text-gray-500">{"{siswa}"}, {"{kelas}"}, dan {"{wali}"} otomatis diganti per siswa.</p>
              </div>
              <div>
                <label htmlFor="isi-pesan-wa" className="label-field">Isi pesan (boleh diubah)</label>
                <textarea id="isi-pesan-wa" rows={3} className="input-field" value={pesan} onChange={e => setPesan(e.target.value)} maxLength={1500} />
              </div>
            </div>
            <p className="text-xs text-gray-500">Tombol <strong>WhatsApp</strong> membuka percakapan dengan pesan terisi — periksa lalu tekan kirim di WhatsApp. Nomor yang salah diperbaiki TU di Buku Induk.</p>
          </div>

          {daftar.length === 0 ? <EmptyState icon={Contact} title="Tidak ada siswa" description="Ubah pencarian atau saringan." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>#</th><th>Siswa</th><th>Kontak orang tua / wali</th><th className="hidden md:table-cell">Portal Orang Tua</th></tr></thead>
                <tbody>
                  {daftar.map((s, i) => (
                    <tr key={s.id}>
                      <td className="angka text-gray-500">{i + 1}</td>
                      <td className="min-w-[10rem]"><p className="font-semibold text-primary-900">{s.nama}</p><p className="angka text-xs text-gray-500">{s.nis}</p></td>
                      <td>
                        {s.kontak.length === 0 ? <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum ada nomor di data TU</span> : (
                          <div className="space-y-2">
                            {s.kontak.map(k => (
                              <div key={k.wa} className="flex flex-wrap items-center gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-800">{k.nama || k.peran} <span className="text-xs text-gray-500">· {k.peran}</span></p>
                                  <p className="angka text-xs text-gray-500">{k.nomor}</p>
                                </div>
                                <div className="ml-auto flex gap-1.5">
                                  <a href={`https://wa.me/${k.wa}?text=${encodeURIComponent(isi(s))}`} target="_blank" rel="noopener noreferrer" className="btn-modal-save px-3 text-xs"><MessageCircle /> WhatsApp</a>
                                  <button type="button" title="Salin nomor" className="btn-modal-cancel px-2.5 text-xs"
                                    onClick={async () => (await salinTeks(k.nomor)) ? toast.success("Nomor disalin.") : toast.error("Gagal menyalin.")}><Copy /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="hidden md:table-cell text-xs">
                        {!s.akunOrtu ? <span className="text-gray-400">Belum ada akun</span>
                          : s.akunOrtu.pernahMasuk ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Pernah masuk</span>
                          : <span className="status-badge bg-gray-50 text-gray-600 border-gray-200">Belum pernah masuk</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
