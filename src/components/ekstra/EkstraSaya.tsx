"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Flag, Loader2, Send, Trash2, UserPlus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Ikut {
  id: string; nama: string; jenis: string; peran: string; jadwalRutin: string | null; pembina: string[]; sejak: string; pertemuan: number;
  kehadiran: Record<string, number>;
  kegiatan: { tanggal: string; materi: string; status: string; foto: string[] }[];
  agenda: { judul: string; jenis: string; mulai: string; tempat: string | null }[];
  nilai: { semester: string; predikat: string; keterangan: string | null }[];
}
interface Tersedia { id: string; nama: string; jenis: string; jadwalRutin: string | null; deskripsi: string | null; pembina: string[]; anggota: number; kuota: number | null; buka: boolean; penuh: boolean; menunggu: boolean }
interface Data {
  peran: "STUDENT" | "PARENT"; siswa: { nama: string; kelas: string }; semester: string; ikut: Ikut[];
  pendaftaran: { id: string; ekskulId: string; ekskul: string; status: string; alasan: string | null; catatan: string | null; dibuat: string; diputus: string | null }[];
  setelan: { dibuka: boolean; maks: number; terpakai: number }; tersedia: Tersedia[];
}
const WARNA: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200", IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200", ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const LABEL: Record<string, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Tanpa kabar" };
const STATUS_DAFTAR: Record<string, [string, string]> = {
  MENUNGGU: ["Menunggu keputusan", "bg-amber-50 text-amber-700 border-amber-200"],
  DITERIMA: ["Diterima", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  DITOLAK: ["Belum diterima", "bg-red-50 text-red-600 border-red-200"],
};
// Tanggal kalender ("YYYY-MM-DD") dibaca apa adanya; CAP WAKTU (ISO lengkap) dibaca di WIB — memotong 10 huruf pertamanya
// memberi tanggal UTC, yang antara 00.00–07.00 WIB masih hari kemarin.
const tgl = (s: string) => new Date(s.length > 10 ? s : `${s}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: s.length > 10 ? "Asia/Jakarta" : "UTC" });
const tglJam = (s: string) => new Date(s).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** EKSTRAKURIKULER — portal siswa (lihat + mendaftar) dan orang tua (hanya lihat, `anak` = id siswa dari pemilih anak).
 *  Satu komponen supaya keduanya selalu menampilkan hal yang sama; siapa boleh apa diputuskan server (/api/ekstra/saya). */
export default function EkstraSaya({ anak }: { anak?: string }) {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<Tersedia | null>(null);
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  const muat = useCallback(() => {
    fetch(`/api/ekstra/saya${anak ? `?anak=${encodeURIComponent(anak)}` : ""}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat."); else setD(j); })
      .catch(() => setGalat("Gagal memuat. Periksa sambungan lalu muat ulang."));
  }, [anak]);
  useEffect(() => { muat(); }, [muat]);

  async function daftar() {
    if (!pilih) return;
    setSibuk(true);
    const r = await fetch("/api/ekstra/saya", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extracurricularId: pilih.id, alasan }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal mendaftar."); return; }
    toast.success(`Pendaftaran ke ${pilih.nama} terkirim. Tunggu keputusan pembina.`);
    setPilih(null); setAlasan(""); muat();
  }
  async function batal(id: string, nama: string) {
    if (!(await confirm(`Batalkan pendaftaran ke ${nama}?`))) return;
    const r = await fetch(`/api/ekstra/saya?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error((await r?.json().catch(() => null))?.error ?? "Gagal membatalkan."); return; }
    toast.success("Pendaftaran dibatalkan."); muat();
  }

  const ortu = d?.peran === "PARENT";
  const judul = <PageHeader icon={<Flag size={22} />} title="Ekstrakurikuler" description={d ? (ortu ? `Kegiatan ${d.siswa.nama}${d.siswa.kelas ? ` — ${d.siswa.kelas}` : ""}` : `Kegiatan yang kamu ikuti — ${d.semester}`) : "Kegiatan ekstrakurikuler dan organisasi"} />;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<div className="flex min-h-[40vh] items-center justify-center text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></div>;

  const jumlah = (k: string) => d.ikut.reduce((n, e) => n + (e.kehadiran[k] ?? 0), 0);
  const menunggu = d.pendaftaran.filter(p => p.status === "MENUNGGU");
  const sisa = Math.max(0, d.setelan.maks - d.setelan.terpakai);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={d.ikut.length} label="Kegiatan diikuti" icon={Flag} color="primary" />
          <StatTile value={jumlah("HADIR")} label="Hadir latihan semester ini" ikon="hadir" color="emerald" />
          <StatTile value={jumlah("IZIN") + jumlah("SAKIT")} label="Izin & sakit" ikon="izin" color="blue" />
          <StatTile value={jumlah("ALPHA")} label="Tanpa kabar" ikon="alpha" color="red" sorot={jumlah("ALPHA") > 0} />
        </div>

        {menunggu.length > 0 && (
          <div className="panel p-5">
            <p className="panel-judul">Pendaftaran menunggu keputusan</p>
            <ul className="mt-2 divide-y divide-gray-100">
              {menunggu.map(p => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="font-medium text-primary-900">{p.ekskul}</p><p className="text-xs text-gray-400">Dikirim {tgl(p.dibuat)}</p></div>
                  <span className={`status-badge ${STATUS_DAFTAR.MENUNGGU[1]}`}>{STATUS_DAFTAR.MENUNGGU[0]}</span>
                  {!ortu && <button type="button" title="Batalkan pendaftaran" onClick={() => batal(p.id, p.ekskul)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {d.ikut.length === 0 ? (
          <div className="panel"><p className="py-10 text-center text-sm text-gray-400">{ortu ? `${d.siswa.nama} belum mengikuti kegiatan ekstrakurikuler.` : "Kamu belum mengikuti kegiatan ekstrakurikuler."}</p></div>
        ) : d.ikut.map(e => {
          const total = e.kehadiran.HADIR + e.kehadiran.IZIN + e.kehadiran.SAKIT + e.kehadiran.ALPHA;
          const persen = total ? Math.round((e.kehadiran.HADIR / total) * 100) : null;
          return (
            <section key={e.id} className="panel overflow-hidden">
              <div className="panel-kepala">
                <p className="panel-judul">{e.nama}{e.peran && <span className="ml-2 text-xs font-normal text-gray-400">{e.peran}</span>}</p>
                <span className="status-badge bg-primary-50 text-primary-700 border-primary-100">{e.jenis === "INTRA" ? "Organisasi intra" : "Ekstrakurikuler"}</span>
              </div>
              <div className="panel-isi space-y-5">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div><dt className="text-xs text-gray-400">Pembina</dt><dd className="font-medium text-primary-900">{e.pembina.join(", ") || "Belum ditetapkan"}</dd></div>
                  <div><dt className="text-xs text-gray-400">Jadwal rutin</dt><dd className="font-medium text-primary-900">{e.jadwalRutin || "Belum diisi"}</dd></div>
                  <div><dt className="text-xs text-gray-400">Anggota sejak</dt><dd className="font-medium text-primary-900">{tgl(e.sejak)}</dd></div>
                </dl>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${persen != null && persen < 75 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${persen ?? 0}%` }} /></div>
                    <span className="angka text-sm text-gray-600">{persen == null ? "Belum ada absensi" : `${persen}% hadir`}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400"><span className="angka">{e.pertemuan}</span> pertemuan tercatat semester ini · hadir <span className="angka">{e.kehadiran.HADIR}</span>, izin <span className="angka">{e.kehadiran.IZIN}</span>, sakit <span className="angka">{e.kehadiran.SAKIT}</span>, tanpa kabar <span className="angka">{e.kehadiran.ALPHA}</span></p>
                </div>
                {e.agenda.length > 0 && (
                  <div>
                    <p className="label-kecil mb-2">Jadwal mendatang</p>
                    <ul className="space-y-1.5 text-sm">
                      {e.agenda.map((a, i) => <li key={i} className="flex items-start gap-2"><CalendarDays size={15} className="mt-0.5 shrink-0 text-primary-500" /><span><span className="font-medium text-primary-900">{a.judul}</span><span className="block text-xs text-gray-500">{tglJam(a.mulai)}{a.tempat ? ` · ${a.tempat}` : ""}</span></span></li>)}
                    </ul>
                  </div>
                )}
                {e.nilai.length > 0 && (
                  <div>
                    <p className="label-kecil mb-2">Nilai</p>
                    <ul className="space-y-1 text-sm">{e.nilai.map(n => <li key={n.semester}><span className="font-medium text-primary-900">{n.semester}: {n.predikat}</span>{n.keterangan && <span className="text-gray-500"> — {n.keterangan}</span>}</li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="label-kecil mb-2">Kegiatan terbaru</p>
                  {e.kegiatan.length === 0 ? <p className="text-sm text-gray-400">Belum ada pertemuan yang dicatat semester ini.</p> : (
                    <ul className="divide-y divide-gray-100">
                      {e.kegiatan.map(k => (
                        <li key={k.tanggal} className="py-2.5">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-primary-900">{tgl(k.tanggal)}</p><p className="text-sm text-gray-600">{k.materi || "—"}</p></div>
                            {k.status ? <span className={`status-badge ${WARNA[k.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{LABEL[k.status] ?? k.status}</span> : <span className="status-badge bg-gray-50 text-gray-500 border-gray-200">Belum diabsen</span>}
                          </div>
                          {k.foto.length > 0 && (
                            <ul className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
                              {k.foto.map(f => (
                                <li key={f} className="shrink-0"><button type="button" onClick={() => setFoto(f)} className="block overflow-hidden rounded-lg border border-gray-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element -- berkas unggahan */}
                                  <img src={f} alt={`Foto kegiatan ${e.nama} ${tgl(k.tanggal)}`} loading="lazy" className="h-20 w-28 object-cover" />
                                </button></li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {!ortu && (
          <section className="panel overflow-hidden">
            <div className="panel-kepala">
              <p className="panel-judul">Daftar kegiatan lain</p>
              <span className="text-xs text-gray-500">{d.setelan.dibuka ? <>Sisa pilihan <span className="angka font-semibold text-primary-900">{sisa}</span> dari <span className="angka">{d.setelan.maks}</span></> : "Pendaftaran ditutup"}</span>
            </div>
            <div className="panel-isi">
              {!d.setelan.dibuka ? <p className="text-sm text-gray-400">Pendaftaran ekstrakurikuler sedang ditutup. Tanyakan jadwal pembukaannya ke pembina atau wali kelas.</p>
                : d.tersedia.length === 0 ? <p className="text-sm text-gray-400">Tidak ada kegiatan lain yang bisa dipilih.</p> : (
                  <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {d.tersedia.map(t => {
                      const alasanTutup = t.menunggu ? "Menunggu keputusan" : !t.buka ? "Tidak menerima pendaftar" : t.penuh ? "Kuota penuh" : sisa === 0 ? "Pilihanmu sudah penuh" : "";
                      return (
                        <li key={t.id} className="min-w-0 rounded-xl border border-gray-100 p-4">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-heading text-sm font-semibold text-primary-900">{t.nama}</p>
                              <p className="text-xs text-gray-400">{t.jenis === "INTRA" ? "Organisasi intra" : "Ekstrakurikuler"} · <span className="angka">{t.anggota}</span>{t.kuota ? <> dari <span className="angka">{t.kuota}</span></> : ""} anggota</p>
                            </div>
                            {alasanTutup ? <span className="status-badge bg-gray-50 text-gray-500 border-gray-200">{alasanTutup}</span>
                              : <button type="button" onClick={() => { setPilih(t); setAlasan(""); }} className="btn-modal-save btn-teks px-3 text-xs"><UserPlus /> Daftar</button>}
                          </div>
                          {t.deskripsi && <p className="mt-2 text-sm text-gray-600">{t.deskripsi}</p>}
                          <p className="mt-2 text-xs text-gray-500">{t.jadwalRutin || "Jadwal belum diisi"}{t.pembina.length ? ` · Pembina: ${t.pembina.join(", ")}` : ""}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          </section>
        )}

        {d.pendaftaran.some(p => p.status !== "MENUNGGU") && (
          <div className="panel p-5">
            <p className="panel-judul">Riwayat pendaftaran</p>
            <ul className="mt-2 divide-y divide-gray-100">
              {d.pendaftaran.filter(p => p.status !== "MENUNGGU").map(p => (
                <li key={p.id} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1"><p className="font-medium text-primary-900">{p.ekskul}</p><p className="text-xs text-gray-400">{p.diputus ? `Diputuskan ${tgl(p.diputus)}` : ""}{p.catatan ? ` · ${p.catatan}` : ""}</p></div>
                  <span className={`status-badge ${(STATUS_DAFTAR[p.status] ?? STATUS_DAFTAR.MENUNGGU)[1]}`}>{(STATUS_DAFTAR[p.status] ?? [p.status])[0]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Modal open={!!pilih} onClose={() => !sibuk && setPilih(null)} title="Daftar Kegiatan" description={pilih?.nama}
        footer={<>
          <button type="button" onClick={() => setPilih(null)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={daftar} disabled={sibuk} className="btn-modal-save flex-1">{sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim pendaftaran</button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Pendaftaranmu dikirim ke pembina {pilih?.nama}. Kamu resmi menjadi anggota setelah pembina menerimanya.</p>
          <div><label className="label-field" htmlFor="es-alasan">Alasan atau pengalaman (boleh dikosongkan)</label>
            <textarea id="es-alasan" rows={3} maxLength={300} className="input-field" value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="mis. Pernah ikut di SMP, ingin belajar lebih lanjut" /></div>
        </div>
      </Modal>
      <Modal open={!!foto} onClose={() => setFoto(null)} title="Foto Kegiatan" size="xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- berkas unggahan */}
        {foto && <img src={foto} alt="Foto kegiatan ekstrakurikuler" className="mx-auto max-h-[70vh] w-auto rounded-xl" />}
      </Modal>
    </div>
  );
}
