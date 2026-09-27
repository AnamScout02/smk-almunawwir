"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DoorOpen, IdCard, LayoutGrid, ListOrdered, Loader2, Pencil, Plus, Printer, Shuffle, Trash2, UserX, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Alert from "@/components/admin/Alert";
import Modal from "@/components/admin/Modal";
import StatTile from "@/components/admin/StatTile";
import GroupedSection from "@/components/admin/GroupedSection";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Kegiatan { id: string; nama: string; singkatan: string; aktif: boolean; tingkat: number[]; tahunAjaran: string | null; mekanisme?: string }
interface Ruang { id: string; nama: string; lokasi: string | null; kapasitas: number; kolom: number; urutan: number; aktif: boolean; dipakai?: number }
interface Peserta { id: string; nis: string; nama: string; kelas: string; grade: number; nomor: string }
interface RuangSesi {
  ruang: Ruang; sesi: number; jumlah: number;
  kursi: { kursi: number; peserta: Peserta | null }[];
  kelas: { nama: string; jumlah: number; nomorAwal: string; nomorAkhir: string }[];
}
interface Denah {
  kegiatan: { id: string; nama: string; singkatan: string; tingkat: number[]; tahunAjaran: string | null };
  ruangSesi: RuangSesi[]; belumDitempatkan: Peserta[]; total: number; ditempatkan: number; usang: number; jumlahSesi: number;
  aturRuang?: { pola: string; jurusan: Record<string, string>; kelas: Record<string, string> };
  kelompok?: { jurusan: Kelompok[]; kelas: Kelompok[] };
}
interface Kelompok { id: string; label: string; jumlah: number }
type PetaPeruntukan = { jurusan: Record<string, string>; kelas: Record<string, string> };
type FormRuang = { id?: string; nama: string; lokasi: string; kapasitas: string; kolom: string; urutan: string; aktif: boolean };

const WARNA_TINGKAT: Record<number, string> = {
  10: "bg-blue-50 border-blue-200 text-blue-800",
  11: "bg-emerald-50 border-emerald-200 text-emerald-800",
  12: "bg-amber-50 border-amber-200 text-amber-800",
};
const POLA = [
  { value: "SELANG_SELING", label: "Selang-seling tingkat (X, XI, XII bergantian)" },
  { value: "SELANG_SELING_JURUSAN", label: "Selang-seling, satu ruang satu jurusan" },
  { value: "PER_KELAS", label: "Berurutan per kelas" },
];

/** DENAH RUANG UJIAN — daftar ruang, pembagian peserta satu kegiatan ke ruang/sesi/kursi (otomatis + pindah manual),
 * dan tautan cetak denah pintu, kartu meja, serta rekap. Nomor peserta sama persis dengan kartu peserta. */
export default function DenahRuangManager({ basePath, bolehAtur }: { basePath: string; bolehAtur: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  const [ruang, setRuang] = useState<Ruang[]>([]);
  const [denah, setDenah] = useState<Denah | null>(null);
  const [muat, setMuat] = useState(true);
  const [muatDenah, setMuatDenah] = useState(false);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [pola, setPola] = useState("SELANG_SELING");
  const [peruntukan, setPeruntukan] = useState<PetaPeruntukan>({ jurusan: {}, kelas: {} });
  const aturDimuat = useRef("");
  const [membagi, setMembagi] = useState(false);
  const [form, setForm] = useState<FormRuang | null>(null);
  const [simpanRuang, setSimpanRuang] = useState(false);
  const [pindah, setPindah] = useState<{ peserta: Peserta; ruangId: string; sesi: string; kursi: string } | null>(null);
  const [memindah, setMemindah] = useState(false);

  const muatRuang = useCallback(async () => {
    const d = await fetch("/api/teacher/ruang-ujian").then(r => r.json()).catch(() => null);
    const daftar: Ruang[] = Array.isArray(d?.ruang) ? d.ruang : [];
    setRuang(daftar);
    setDipilih(new Set(daftar.filter(r => r.aktif).map(r => r.id)));
  }, []);

  const muatUlangDenah = useCallback(async (id: string) => {
    if (!id) { setDenah(null); return; }
    setMuatDenah(true);
    const d: Denah | null = await fetch(`/api/teacher/denah-ruang?kegiatan=${id}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setDenah(d);
    // Pola & ruang khusus terakhir kegiatan ini — dipasang sekali saat kegiatan dibuka, supaya memuat ulang denah
    // (mis. setelah memindah peserta) tidak menimpa pilihan yang sedang diubah.
    if (d?.aturRuang && aturDimuat.current !== id) {
      aturDimuat.current = id;
      setPola(d.aturRuang.pola);
      setPeruntukan({ jurusan: d.aturRuang.jurusan ?? {}, kelas: d.aturRuang.kelas ?? {} });
    }
    setMuatDenah(false);
  }, []);

  useEffect(() => {
    let batal = false;
    Promise.all([fetch("/api/teacher/kegiatan-ujian").then(r => r.json()).catch(() => ({})), muatRuang()])
      .then(([k]) => {
        if (batal) return;
        const daftar: Kegiatan[] = Array.isArray(k?.daftar) ? k.daftar : [];
        setKegiatan(daftar);
        const pilih = daftar.find(x => x.aktif) ?? daftar[0];
        if (pilih) setKegiatanId(pilih.id);
      })
      .catch(() => {})
      .finally(() => { if (!batal) setMuat(false); });
    return () => { batal = true; };
  }, [muatRuang]);

  useEffect(() => { muatUlangDenah(kegiatanId); }, [kegiatanId, muatUlangDenah]);

  const ruangAktif = useMemo(() => ruang.filter(r => r.aktif), [ruang]);
  const kapasitasDipilih = useMemo(() => ruang.filter(r => dipilih.has(r.id)).reduce((n, r) => n + r.kapasitas, 0), [ruang, dipilih]);
  const perkiraanSesi = denah?.total && kapasitasDipilih ? Math.ceil(denah.total / kapasitasDipilih) : 0;
  const qs = `?kegiatan=${kegiatanId}`;

  // Ruang khusus: pola per jurusan → peruntukan jurusan, pola per kelas → peruntukan kelas.
  const jenisKhusus: keyof PetaPeruntukan = pola === "PER_KELAS" ? "kelas" : "jurusan";
  const petaKhusus = peruntukan[jenisKhusus];
  const kelompokKhusus = denah?.kelompok?.[jenisKhusus] ?? [];
  const ruangTercentang = ruang.filter(r => r.aktif && dipilih.has(r.id));
  const ringkasKhusus = kelompokKhusus.map(k => {
    const rs = ruangTercentang.filter(r => petaKhusus[r.id] === k.id);
    const kursi = rs.reduce((n, r) => n + r.kapasitas, 0);
    return { ...k, ruang: rs.length, kursi, sesi: kursi ? Math.ceil(k.jumlah / kursi) : 0 };
  }).filter(k => k.ruang > 0);
  function aturKhusus(ruangId: string, nilai: string) {
    setPeruntukan(p => {
      const peta = { ...p[jenisKhusus] };
      if (nilai) peta[ruangId] = nilai; else delete peta[ruangId];
      return { ...p, [jenisKhusus]: peta };
    });
  }

  async function kirim(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    return { ok: !!r?.ok, d };
  }

  async function simpanFormRuang() {
    if (!form) return;
    setSimpanRuang(true);
    const { ok, d } = await kirim(form.id ? `/api/teacher/ruang-ujian/${form.id}` : "/api/teacher/ruang-ujian", form.id ? "PUT" : "POST", {
      nama: form.nama, lokasi: form.lokasi, kapasitas: Number(form.kapasitas), kolom: Number(form.kolom), urutan: Number(form.urutan), aktif: form.aktif,
    });
    setSimpanRuang(false);
    if (!ok) return toast.error(d?.error ?? "Gagal menyimpan ruang.");
    toast.success(form.id ? "Ruang diperbarui." : "Ruang ditambahkan.");
    setForm(null);
    await muatRuang();
    muatUlangDenah(kegiatanId);
  }

  async function hapusRuang(r: Ruang) {
    if (!(await confirm(`Hapus ruang "${r.nama}"?`))) return;
    const { ok, d } = await kirim(`/api/teacher/ruang-ujian/${r.id}`, "DELETE");
    if (!ok) return toast.error(d?.error ?? "Gagal menghapus ruang.");
    toast.success("Ruang dihapus.");
    muatRuang();
  }

  async function bagikan() {
    if (!denah) return;
    if (!dipilih.size) return toast.error("Centang minimal satu ruang aktif.");
    if (denah.ditempatkan > 0 && !(await confirm(`Pembagian ruang ${denah.kegiatan.singkatan} yang sudah ada (${denah.ditempatkan} peserta) akan diganti seluruhnya. Lanjutkan?`))) return;
    setMembagi(true);
    const { ok, d } = await kirim("/api/teacher/denah-ruang", "POST", { kegiatanId, ruangIds: [...dipilih], pola, peruntukan });
    setMembagi(false);
    if (!ok) return toast.error(d?.error ?? "Gagal membagi ruang.");
    toast.success(`${d.ditempatkan} peserta dibagi ke ${d.ruang} ruang${d.sesi > 1 ? ` dalam ${d.sesi} sesi` : ""}.`);
    muatRuang();
    muatUlangDenah(kegiatanId);
  }

  async function kosongkan() {
    if (!denah) return;
    if (!(await confirm(`Kosongkan seluruh pembagian ruang ${denah.kegiatan.singkatan}? Kartu peserta, daftar hadir, dan berita acara kembali tanpa keterangan ruang.`))) return;
    const { ok, d } = await kirim(`/api/teacher/denah-ruang${qs}`, "DELETE");
    if (!ok) return toast.error(d?.error ?? "Gagal mengosongkan.");
    toast.success("Pembagian ruang dikosongkan.");
    muatRuang();
    muatUlangDenah(kegiatanId);
  }

  function bukaPindah(p: Peserta, tempat?: { ruangId: string; sesi: number; kursi: number }) {
    setPindah({ peserta: p, ruangId: tempat?.ruangId ?? ruangAktif[0]?.id ?? "", sesi: String(tempat?.sesi ?? 1), kursi: String(tempat?.kursi ?? 1) });
  }

  async function simpanPindah() {
    if (!pindah) return;
    setMemindah(true);
    const { ok, d } = await kirim("/api/teacher/denah-ruang", "PATCH", {
      kegiatanId, studentId: pindah.peserta.id, ruangId: pindah.ruangId, sesi: Number(pindah.sesi), kursi: Number(pindah.kursi),
    });
    setMemindah(false);
    if (!ok) return toast.error(d?.error ?? "Gagal memindahkan peserta.");
    toast.success(d?.pesan ?? "Peserta dipindahkan.");
    setPindah(null);
    muatUlangDenah(kegiatanId);
  }

  const tautanCetak = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-primary-700 hover:bg-primary-50 whitespace-nowrap";
  const ruangTujuan = ruang.find(r => r.id === pindah?.ruangId);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Denah Ruang Ujian"
        description="Bagi peserta ke ruang, sesi, dan kursi — lalu cetak denah pintu, kartu meja, dan rekap pembagian ruang" />

      <div className="flex items-center gap-2 mb-5">
        <Link href={`${basePath}/administrasi`} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali ke Administrasi Ujian
        </Link>
      </div>

      {muat ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
        <div className="space-y-5">
          {!bolehAtur && (
            <Alert variant="info" title="Mode lihat & cetak">
              Daftar ruang dan pembagian peserta diatur Administrator atau Wakil Kepala Kurikulum. Anda tetap bisa melihat denah dan mencetaknya.
            </Alert>
          )}

          {/* ---------------- Daftar ruang ---------------- */}
          <div className="page-card">
            <div className="page-card-header">
              <div className="flex items-center gap-2">
                <DoorOpen size={16} className="text-primary-700" />
                <h2 className="font-heading font-bold text-gray-800 text-sm">Daftar Ruang</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{ruangAktif.length} ruang aktif · {ruangAktif.reduce((n, r) => n + r.kapasitas, 0)} kursi</span>
                {bolehAtur && (
                  <button type="button" onClick={() => setForm({ nama: "", lokasi: "", kapasitas: "36", kolom: "6", urutan: String(ruang.length + 1), aktif: true })}
                    className="btn-modal-save text-xs px-3 py-1.5">
                    <Plus size={14} /> Tambah Ruang
                  </button>
                )}
              </div>
            </div>
            {ruang.length === 0 ? (
              <EmptyState icon={DoorOpen} title="Belum ada ruang ujian"
                description={bolehAtur ? "Tambahkan ruang (mis. Lab Komputer 1, kapasitas 36, 6 meja per baris) sebelum membagi peserta." : "Pengatur ujian belum menambahkan ruang."} />
            ) : (
              <div className="overflow-x-auto scrollbar-visible p-5">
                <table className="data-table">
                  <thead>
                    <tr>
                      {bolehAtur && <th className="w-10 text-center">Pakai</th>}
                      <th>Ruang</th><th className="text-center">Kapasitas</th><th className="text-center">Meja/baris</th>
                      <th className="text-center">Kursi terisi</th><th>Status</th>{bolehAtur && <th className="text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {ruang.map(r => (
                      <tr key={r.id}>
                        {bolehAtur && (
                          <td className="text-center">
                            <input type="checkbox" aria-label={`Pakai ${r.nama} saat membagi`} disabled={!r.aktif} checked={dipilih.has(r.id)}
                              onChange={e => setDipilih(s => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })}
                              className="w-4 h-4 accent-[#1B2B6B]" />
                          </td>
                        )}
                        <td>
                          <p className="font-semibold text-gray-800">{r.nama}</p>
                          {r.lokasi && <p className="text-xs text-gray-400">{r.lokasi}</p>}
                        </td>
                        <td className="text-center tabular-nums">{r.kapasitas}</td>
                        <td className="text-center tabular-nums">{r.kolom}</td>
                        <td className="text-center tabular-nums">{r.dipakai ?? 0}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${r.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                            {r.aktif ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        {bolehAtur && (
                          <td>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------------- Pembagian per kegiatan ---------------- */}
          <div className="page-card p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] items-end">
              <div>
                <label className="label-field">Kegiatan ujian</label>
                <Select value={kegiatanId} onChange={setKegiatanId} placeholder="Pilih kegiatan"
                  options={kegiatan.map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama}${k.tahunAjaran ? ` ${k.tahunAjaran}` : ""}${k.tingkat.length ? ` · tingkat ${k.tingkat.join(", ")}` : ""}` }))} />
              </div>
              {denah && denah.ditempatkan > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Link href={`${basePath}/administrasi/ruang/denah${qs}`} className={tautanCetak}><Printer size={15} /> Denah Pintu</Link>
                  <Link href={`${basePath}/administrasi/ruang/kartu-meja${qs}`} className={tautanCetak}><IdCard size={15} /> Kartu Meja</Link>
                  <Link href={`${basePath}/administrasi/ruang/rekap${qs}`} className={tautanCetak}><ListOrdered size={15} /> Rekap Ruang</Link>
                </div>
              )}
            </div>

            {kegiatan.find(k => k.id === kegiatanId)?.mekanisme === "KELAS" && (
              <Alert variant="info" title="Kegiatan ini dilaksanakan per kelas">
                Siswa ujian di kelasnya masing-masing sesuai jam per kelas, dan pengawasnya guru mapel — denah ruang tidak diperlukan.
                Bila ternyata peserta dibagi ke ruang ujian, ubah cara pelaksanaannya di Pengawas atau Pengaturan Ujian.
              </Alert>
            )}
            {kegiatan.length === 0 ? (
              <EmptyState icon={LayoutGrid} title="Belum ada kegiatan ujian" description="Buat kegiatan (mis. STS) di Pengaturan Pusat Ujian lebih dulu." />
            ) : muatDenah || !denah ? (
              <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : (
              <>
                <div className="kisi-kartu kisi-kartu-4">
                  <StatTile value={denah.total} label="Peserta kegiatan" icon={Users} color="primary" size="md" />
                  <StatTile value={denah.ditempatkan} label="Sudah punya kursi" icon={LayoutGrid} color="emerald" size="md" />
                  <StatTile value={denah.belumDitempatkan.length} label="Belum ditempatkan" icon={UserX} color={denah.belumDitempatkan.length ? "amber" : "gray"} size="md" />
                  <StatTile value={denah.jumlahSesi} label="Sesi" icon={ListOrdered} color="blue" size="md" />
                </div>

                {bolehAtur && (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] items-end">
                    <div>
                      <label className="label-field">Pola tempat duduk</label>
                      <Select value={pola} onChange={setPola} options={POLA} />
                      <p className="text-xs text-gray-500 mt-1.5">
                        Ruang tercentang: <strong>{dipilih.size}</strong> · <strong>{kapasitasDipilih}</strong> kursi
                        {perkiraanSesi > 0 && <> · perkiraan <strong>{perkiraanSesi}</strong> sesi untuk {denah.total} peserta</>}
                      </p>
                      {pola === "SELANG_SELING_JURUSAN" && (
                        <p className="text-xs text-amber-700 mt-1">
                          Tiap jurusan mulai di ruang baru; di dalam ruang tingkatnya bergantian (jurusan satu tingkat: kelasnya bergantian).
                          Sisa kursi di ruang terakhir sebuah jurusan dibiarkan kosong, jadi sesinya bisa lebih banyak dari perkiraan.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={bagikan} disabled={membagi || !dipilih.size || !denah.total} className="btn-modal-save">
                        {membagi ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />} Bagikan Otomatis
                      </button>
                      {denah.ditempatkan > 0 && (
                        <button type="button" onClick={kosongkan} className="btn-modal-cancel"><Trash2 size={16} /> Kosongkan</button>
                      )}
                    </div>
                  </div>
                )}

                {bolehAtur && pola !== "SELANG_SELING" && (
                  <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                    <div>
                      <p className="font-heading font-bold text-sm text-gray-800">Ruang khusus {jenisKhusus}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pilih {jenisKhusus} untuk ruang tertentu — ruang itu hanya diisi {jenisKhusus} tersebut, dengan jumlah kursi sesuai kapasitasnya.
                        Bila kursinya kurang, sisanya lanjut ke sesi berikutnya di ruang yang sama. Ruang &ldquo;Otomatis&rdquo; dipakai {jenisKhusus} yang tidak diberi ruang khusus.
                        Pilihan ini tersimpan untuk kegiatan ini saat Bagikan Otomatis ditekan.
                      </p>
                    </div>
                    {ruangTercentang.length === 0 ? (
                      <p className="text-xs text-gray-500">Centang ruang yang dipakai di Daftar Ruang lebih dulu.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                        {ruangTercentang.map(r => (
                          <div key={r.id} className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-800 truncate">{r.nama}</p>
                              <p className="text-xs text-gray-400">{r.kapasitas} kursi</p>
                            </div>

                            <div className="alat-aksi justify-end">
                              <button type="button" title="Edit" onClick={() => setForm({ id: r.id, nama: r.nama, lokasi: r.lokasi ?? "", kapasitas: String(r.kapasitas), kolom: String(r.kolom), urutan: String(r.urutan), aktif: r.aktif })}
                                className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                              <button type="button" title="Hapus" onClick={() => hapusRuang(r)}
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                            </div>
                            <div className="w-44 shrink-0">
                              <Select value={petaKhusus[r.id] ?? ""} onChange={v => aturKhusus(r.id, v)} placeholder="Otomatis"
                                options={[{ value: "", label: "Otomatis" }, ...kelompokKhusus.map(k => ({ value: k.id, label: `${k.label} (${k.jumlah})` }))]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {ringkasKhusus.length > 0 && (
                      <ul className="text-xs text-gray-600 space-y-0.5 border-t border-gray-100 pt-2">
                        {ringkasKhusus.map(k => (
                          <li key={k.id}>
                            <strong>{k.label}</strong>: {k.jumlah} siswa di {k.ruang} ruang ({k.kursi} kursi)
                            {k.sesi > 1 && <span className="text-amber-700"> — butuh {k.sesi} sesi</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {denah.usang > 0 && (
                  <Alert variant="warning" title={`${denah.usang} tempat duduk diabaikan`}>
                    Milik siswa yang sudah tidak aktif atau tidak lagi di tingkat kegiatan ini. Bagikan ulang supaya denahnya rapat kembali.
                  </Alert>
                )}

                {denah.ruangSesi.length === 0 && denah.belumDitempatkan.length > 0 && (
                  <EmptyState icon={Shuffle} title="Belum ada pembagian ruang"
                    description={bolehAtur ? "Centang ruang yang dipakai, pilih pola, lalu tekan Bagikan Otomatis." : "Pengatur ujian belum membagi peserta kegiatan ini."} />
                )}

                {denah.ruangSesi.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="font-semibold">Warna tingkat:</span>
                    {[10, 11, 12].filter(g => denah.kegiatan.tingkat.length === 0 || denah.kegiatan.tingkat.includes(g)).map(g => (
                      <span key={g} className={`px-2 py-0.5 rounded-md border ${WARNA_TINGKAT[g]}`}>{g === 10 ? "X" : g === 11 ? "XI" : "XII"}</span>
                    ))}
                    {bolehAtur && <span>· klik kursi untuk memindahkan peserta</span>}
                  </div>
                )}

                {denah.ruangSesi.map(rs => (
                  <GroupedSection key={`${rs.ruang.id}-${rs.sesi}`} icon={DoorOpen} count={rs.jumlah}
                    title={`${rs.ruang.nama}${denah.jumlahSesi > 1 ? ` · Sesi ${rs.sesi}` : ""}`}
                    subtitle={`${rs.ruang.lokasi ? `${rs.ruang.lokasi} · ` : ""}${rs.kelas.map(k => `${k.nama} (${k.jumlah})`).join(", ")}`}
                    headerActions={
                      <Link href={`${basePath}/administrasi/ruang/denah${qs}&ruang=${rs.ruang.id}&sesi=${rs.sesi}`}
                        className="btn-modal-cancel px-3 text-xs">
                        <Printer size={13} /> Cetak ruang ini
                      </Link>
                    }>
                    <div className="p-4 overflow-x-auto scrollbar-visible">
                      <div style={{ minWidth: `${rs.ruang.kolom * 7.5}rem` }}>
                        <div className="mb-2 rounded-lg border border-gray-300 bg-gray-50 text-center text-[11px] font-semibold tracking-widest text-gray-500 py-1">MEJA PENGAWAS · DEPAN RUANG</div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${rs.ruang.kolom}, minmax(0, 1fr))` }}>
                          {rs.kursi.map(k => k.peserta ? (
                            <button key={k.kursi} type="button" disabled={!bolehAtur} title={bolehAtur ? "Pindahkan peserta" : undefined}
                              onClick={() => bukaPindah(k.peserta!, { ruangId: rs.ruang.id, sesi: rs.sesi, kursi: k.kursi })}
                              className={`text-left rounded-lg border px-2 py-1.5 min-w-0 ${WARNA_TINGKAT[k.peserta.grade] ?? "bg-gray-50 border-gray-200 text-gray-800"} ${bolehAtur ? "hover:ring-2 hover:ring-primary-300" : "cursor-default"}`}>
                              <span className="flex justify-between gap-1 text-[11px] opacity-70"><span>Kursi {k.kursi}</span><span className="truncate">{k.peserta.kelas}</span></span>
                              <span className="block font-mono text-[11px] font-bold truncate">{k.peserta.nomor}</span>
                              <span className="block text-xs leading-tight truncate">{k.peserta.nama}</span>
                            </button>
                          ) : (
                            <div key={k.kursi} className="rounded-lg border border-dashed border-gray-200 px-2 py-1.5 text-[11px] text-gray-300 min-w-0">
                              Kursi {k.kursi}<span className="block text-center py-1">kosong</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GroupedSection>
                ))}

                {denah.belumDitempatkan.length > 0 && denah.ruangSesi.length > 0 && (
                  <GroupedSection icon={UserX} title="Belum Ditempatkan" subtitle="Siswa aktif baru atau yang terlepas saat dipindah" count={denah.belumDitempatkan.length} variant="warning">
                    <div className="overflow-x-auto scrollbar-visible p-4">
                      <table className="data-table">
                        <thead><tr><th>Nomor Peserta</th><th>Nama</th><th>Kelas</th>{bolehAtur && <th className="text-right">Aksi</th>}</tr></thead>
                        <tbody>
                          {denah.belumDitempatkan.map(p => (
                            <tr key={p.id}>
                              <td className="font-mono text-xs">{p.nomor}</td><td>{p.nama}</td><td>{p.kelas}</td>
                              {bolehAtur && (
                                <td className="text-right">
                                  <button type="button" onClick={() => bukaPindah(p)} className="text-xs font-semibold text-primary-700 hover:underline">Tempatkan</button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GroupedSection>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah Ruang" : "Tambah Ruang"} size="md"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanFormRuang} disabled={simpanRuang} className="btn-modal-save">
            {simpanRuang && <Loader2 size={15} className="animate-spin" />} Simpan
          </button>
        </>}>
        {form && (
          <div className="space-y-3">
            <div>
              <label className="label-field" htmlFor="ruang-nama">Nama ruang</label>
              <input id="ruang-nama" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="mis. Lab Komputer 1" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field" htmlFor="ruang-lokasi">Lokasi (opsional)</label>
              <input id="ruang-lokasi" value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} placeholder="mis. Gedung B lantai 2" className="input-field w-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-field" htmlFor="ruang-kapasitas">Kapasitas</label>
                <input id="ruang-kapasitas" type="number" min={1} max={200} value={form.kapasitas} onChange={e => setForm({ ...form, kapasitas: e.target.value })} className="input-field w-full" />
              </div>
              <div>
                <label className="label-field" htmlFor="ruang-kolom">Meja/baris</label>
                <input id="ruang-kolom" type="number" min={1} max={12} value={form.kolom} onChange={e => setForm({ ...form, kolom: e.target.value })} className="input-field w-full" />
              </div>
              <div>
                <label className="label-field" htmlFor="ruang-urutan">Urutan</label>
                <input id="ruang-urutan" type="number" value={form.urutan} onChange={e => setForm({ ...form, urutan: e.target.value })} className="input-field w-full" />
              </div>
            </div>
            <p className="text-xs text-gray-500">Kapasitas = jumlah kursi/komputer yang dipakai ujian. Meja per baris dipakai untuk menggambar denah.</p>
            {form.id && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} className="w-4 h-4 accent-[#1B2B6B]" />
                Ruang aktif (dipakai saat membagi peserta)
              </label>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!pindah} onClose={() => setPindah(null)} title={pindah ? `Pindahkan ${pindah.peserta.nama}` : ""}
        description={pindah ? `${pindah.peserta.nomor} · ${pindah.peserta.kelas}` : undefined} size="md"
        footer={<>
          <button type="button" onClick={() => setPindah(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanPindah} disabled={memindah || !pindah?.ruangId} className="btn-modal-save">
            {memindah && <Loader2 size={15} className="animate-spin" />} Pindahkan
          </button>
        </>}>
        {pindah && (
          <div className="space-y-3">
            <div>
              <label className="label-field">Ruang tujuan</label>
              <Select value={pindah.ruangId} onChange={v => setPindah({ ...pindah, ruangId: v })}
                options={ruangAktif.map(r => ({ value: r.id, label: `${r.nama} (${r.kapasitas} kursi)` }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field" htmlFor="pindah-sesi">Sesi</label>
                <input id="pindah-sesi" type="number" min={1} max={6} value={pindah.sesi} onChange={e => setPindah({ ...pindah, sesi: e.target.value })} className="input-field w-full" />
              </div>
              <div>
                <label className="label-field" htmlFor="pindah-kursi">Kursi</label>
                <input id="pindah-kursi" type="number" min={1} max={ruangTujuan?.kapasitas ?? 200} value={pindah.kursi} onChange={e => setPindah({ ...pindah, kursi: e.target.value })} className="input-field w-full" />
              </div>
            </div>
            <p className="text-xs text-gray-500">Kalau kursi tujuan sudah terisi, kedua peserta bertukar tempat duduk.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
