"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UserCheck, Loader2, Save, Search, Printer, CheckCheck, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { STATUS_PRESENSI_PEGAWAI, labelOf, styleOf } from "@/lib/tu-konstanta";

interface Pegawai { userId: string; nama: string; role: string; nip: string | null; position: string | null; jabatan: string[] }
interface Baris { userId: string; status: string; jamMasuk: string | null; jamPulang: string | null; keterangan: string | null }
interface Isian { status: string; jamMasuk: string; jamPulang: string; keterangan: string }
/** Usulan dari Buku Piket: guru yang SEMUA jam mengajarnya hari itu dicatat ALPHA oleh petugas
 *  piket sementara TU belum mencatat apa pun. Hanya usulan — TU yang memutuskan (CLAUDE.md #33). */
interface Usulan { userId: string; status: string; jam: number; alasan: string }

const todayStr = () => new Date().toLocaleDateString("sv-SE");
const nowTime = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
const KOSONG: Isian = { status: "", jamMasuk: "", jamPulang: "", keterangan: "" };

export default function PresensiPegawaiManager() {
  const toast = useToast();

  const [tanggal, setTanggal] = useState(todayStr());
  const [pegawai, setPegawai] = useState<Pegawai[]>([]);
  const [isian, setIsian] = useState<Record<string, Isian>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [usulan, setUsulan] = useState<Usulan[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/presensi-pegawai?date=${tanggal}`)
      .then(r => r.json())
      .then((d: { pegawai?: Pegawai[]; rows?: Baris[]; usulan?: Usulan[] }) => {
        setPegawai(Array.isArray(d.pegawai) ? d.pegawai : []);
        setUsulan(Array.isArray(d.usulan) ? d.usulan : []);
        const map: Record<string, Isian> = {};
        for (const r of d.rows ?? []) {
          map[r.userId] = {
            // Fallback SENGAJA "" (bukan "HADIR") — lihat aturan default status kosong di
            // DESIGN_SYSTEM §6.6: nilai default tersembunyi pernah bikin orang yang belum
            // dicek diam-diam tercatat hadir.
            status: r.status ?? "",
            jamMasuk: r.jamMasuk ?? "", jamPulang: r.jamPulang ?? "", keterangan: r.keterangan ?? "",
          };
        }
        setIsian(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tanggal]);
  useEffect(() => { load(); }, [load]);

  const get = (id: string): Isian => isian[id] ?? KOSONG;
  const set = (id: string, patch: Partial<Isian>) =>
    setIsian(m => ({ ...m, [id]: { ...(m[id] ?? KOSONG), ...patch } }));

  /** Tombol "Semua Hadir" hanya mengisi yang MASIH KOSONG — supaya izin/sakit yang sudah
   * terlanjur dicatat tidak ikut tertimpa. */
  function semuaHadir() {
    setIsian(m => {
      const next = { ...m };
      for (const p of pegawai) {
        const cur = next[p.userId] ?? KOSONG;
        if (!cur.status) next[p.userId] = { ...cur, status: "HADIR", jamMasuk: cur.jamMasuk || nowTime() };
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const entries = pegawai.map(p => ({ userId: p.userId, ...get(p.userId) }));
    const res = await fetch("/api/admin/presensi-pegawai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tanggal, entries }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan presensi.");
    const d = await res.json().catch(() => ({ tersimpan: 0 }));
    toast.success(`Presensi tersimpan — ${d.tersimpan} pegawai.`);
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pegawai;
    return pegawai.filter(p =>
      p.nama.toLowerCase().includes(q) || (p.nip ?? "").toLowerCase().includes(q) ||
      p.jabatan.join(" ").toLowerCase().includes(q)
    );
  }, [pegawai, search]);

  const terisi = pegawai.filter(p => get(p.userId).status).length;
  const hadir = pegawai.filter(p => get(p.userId).status === "HADIR").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCheck size={22} />} title="Presensi Pegawai"
        description="Daftar hadir harian guru & tenaga kependidikan — terpisah dari absensi siswa maupun poin kedisiplinan guru" />
      {usulan.length > 0 && (
        <div className="panel mb-5 border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-800">
            {usulan.length} usulan dari Buku Piket
          </p>
          <p className="mb-3 text-xs text-amber-700">
            Petugas piket mencatat guru berikut ALPHA di seluruh jam mengajarnya, tetapi presensi
            harian mereka belum diisi. Periksa dulu — menerima usulan hanya mengisi kolom status,
            belum tersimpan sampai Anda menekan Simpan Presensi.
          </p>
          <div className="space-y-2">
            {usulan.map(u => {
              const org = pegawai.find(p2 => p2.userId === u.userId);
              const sudah = get(u.userId).status !== "";
              return (
                <div key={u.userId} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{org?.nama ?? "(pegawai)"}</span>
                  <span className="text-xs text-gray-500">· {u.alasan}</span>
                  {sudah ? (
                    <span className="ml-auto text-xs font-semibold text-emerald-600">sudah diisi</span>
                  ) : (
                    <button type="button" onClick={() => set(u.userId, { status: u.status })}
                      className="ml-auto rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-700">
                      Terima usulan ({u.status})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={pegawai.length} label="Total Pegawai" icon={Users} color="primary" />
        <StatTile value={terisi} label="Sudah Dicek" icon={CheckCheck} color="blue" />
        <StatTile value={hadir} label="Hadir" icon={UserCheck} color="emerald" />
      </div>

      <div className="alat-aksi alat-teks justify-end mb-5">
        <Link href={`/dashboard/admin/presensi-pegawai/rekap?month=${tanggal.slice(0, 7)}`}
          className="btn-modal-cancel">
          <Printer size={16} /> Rekap Bulanan
        </Link>
        <button onClick={handleSave} disabled={saving || loading} className="btn-modal-save">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Presensi
        </button>
      </div>

      <div className="page-card p-4 mb-5 grid gap-3 md:grid-cols-3">
        <div>
          <label className="label-field">Tanggal</label>
          <DatePicker value={tanggal} onChange={setTanggal} />
        </div>
        <div>
          <label className="label-field">Cari</label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nama, NIP, jabatan..." className="input-field pl-10 w-full" />
          </div>
        </div>
        <div className="flex items-end">
          <button onClick={semuaHadir} disabled={loading}
            className="btn-modal-cancel w-full">
            <CheckCheck size={15} /> Tandai Sisanya Hadir
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : pegawai.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Data Pegawai"
          description="Tambahkan guru & staf lebih dulu di menu Guru / Akun Pengguna." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada pegawai yang cocok dengan pencarian." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">#</th><th>Nama Pegawai</th><th>Status Kehadiran</th>
                    <th className="text-center">Datang</th><th className="text-center">Pulang</th><th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const v = get(p.userId);
                    return (
                      <tr key={p.userId} className={v.status ? undefined : "bg-amber-50/30"}>
                        <td className="text-gray-400">{i + 1}</td>
                        <td>
                          <span className="font-medium">{p.nama}</span>
                          <span className="block text-xs text-gray-400">
                            {p.nip ? `${p.nip} · ` : ""}{p.jabatan[0] ?? p.position ?? (p.role === "TAS" ? "Tenaga Kependidikan" : "Guru")}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {STATUS_PRESENSI_PEGAWAI.map(s => (
                              <button key={s.value}
                                onClick={() => set(p.userId, {
                                  status: v.status === s.value ? "" : s.value,
                                  // Jam datang ikut terisi otomatis saat ditandai HADIR supaya
                                  // petugas tidak perlu mengetik satu per satu.
                                  jamMasuk: v.status === s.value ? v.jamMasuk : (s.value === "HADIR" && !v.jamMasuk ? nowTime() : v.jamMasuk),
                                })}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                                  v.status === s.value ? styleOf(STATUS_PRESENSI_PEGAWAI, s.value)
                                    : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"}`}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="text-center">
                          <input value={v.jamMasuk} onChange={e => set(p.userId, { jamMasuk: e.target.value })}
                            placeholder="07:00" className="input-field w-20 text-center text-xs px-2 py-1.5" />
                        </td>
                        <td className="text-center">
                          <input value={v.jamPulang} onChange={e => set(p.userId, { jamPulang: e.target.value })}
                            placeholder="15:00" className="input-field w-20 text-center text-xs px-2 py-1.5" />
                        </td>
                        <td>
                          <input value={v.keterangan} onChange={e => set(p.userId, { keterangan: e.target.value })}
                            placeholder="—" className="input-field w-full text-xs px-2 py-1.5" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {terisi} dari {pegawai.length} pegawai sudah dicek. Baris berlatar kuning belum diisi —
            baris kosong tidak akan tersimpan sebagai kehadiran apa pun.
          </p>
        </>
      )}
    </div>
  );
}
