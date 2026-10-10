"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Loader2, Check, X, Search, GraduationCap, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface ChangeEntry { old: unknown; new: unknown; label: string }
type Keputusan = { aksi: "APPROVE" | "REJECT"; tolak: string[] };
interface EditRequest {
  id: string; status: string; createdAt: string; changes: Record<string, ChangeEntry>;
  student: { nis: string; user: { name: string }; class: { name: string } | null; major: { name: string } | null };
}
interface PegawaiRequest {
  id: string; status: string; createdAt: string; changes: Record<string, ChangeEntry>;
  user: { name: string; email: string; role: string; teacher: { nip: string; subject: string } | null };
}

const PERAN: Record<string, string> = { TEACHER: "Guru", TAS: "Staf TU", ADMIN: "Administrator" };

function displayVal(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-300 italic">kosong</span>;
  if (Array.isArray(v)) return `${v.length} item`;
  return String(v);
}

const tglPanjang = (v: string) =>
  new Date(v).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** Satu kartu pengajuan: kepala bisa diketuk, isinya tabel Lama → Baru dengan CENTANG PER ISIAN.
 *  TU sering menemukan satu isian salah tulis di antara isian yang benar — dulu satu-satunya pilihan
 *  adalah menolak seluruh pengajuan dan siswa/pegawai mengetik ulang semuanya (permintaan user
 *  30 September 2026). Isian yang centangnya dilepas ditolak; sisanya tetap diterapkan. */
function KartuPengajuan({
  judul, keterangan, changes, createdAt, terbuka, onToggle, memproses, onPutuskan,
}: {
  judul: ReactNode; keterangan: string; changes: Record<string, ChangeEntry>;
  createdAt: string; terbuka: boolean; onToggle: () => void; memproses: boolean;
  onPutuskan: (k: Keputusan) => void;
}) {
  const kunci = Object.keys(changes);
  const [tolak, setTolak] = useState<Set<string>>(new Set());
  const ubah = (k: string) => setTolak(p => {
    const n = new Set(p);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const diterima = kunci.length - tolak.size;

  return (
    <div className="panel overflow-hidden">
      <button onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-primary-50/30">
        <div className="min-w-0">
          <p className="font-semibold text-primary-900">{judul}</p>
          <p className="text-xs text-gray-400">
            {keterangan} · {kunci.length} isian diubah · diajukan {tglPanjang(createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">Menunggu</span>
      </button>
      {terbuka && (
        <div className="border-t border-gray-50 px-5 py-4">
          <p className="mb-3 text-sm text-gray-500">
            Lepas centang isian yang datanya salah — isian itu ditolak, yang lain tetap disimpan.
          </p>
          <div className="mb-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-20">Setujui</th>
                  <th>Isian</th><th>Data Lama</th><th>Data Baru</th>
                </tr>
              </thead>
              <tbody>
                {kunci.map(k => {
                  const c = changes[k];
                  const ditolak = tolak.has(k);
                  return (
                    <tr key={k} className={ditolak ? "opacity-60" : ""}>
                      <td>
                        <label className="sentuh flex cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={!ditolak} onChange={() => ubah(k)}
                            className="h-4 w-4 accent-emerald-600" />
                          <span className="text-xs text-gray-400">{ditolak ? "tolak" : "ya"}</span>
                        </label>
                      </td>
                      <td className="font-medium text-primary-900">{c.label}</td>
                      <td className="text-gray-400">{displayVal(c.old)}</td>
                      <td className={ditolak ? "text-gray-400 line-through" : "font-medium text-emerald-600"}>{displayVal(c.new)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="alat-aksi alat-teks justify-end">
            <button onClick={() => onPutuskan({ aksi: "REJECT", tolak: kunci })} disabled={memproses}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100">
              <X size={14} /> Tolak Semua
            </button>
            <button onClick={() => onPutuskan({ aksi: "APPROVE", tolak: [...tolak] })}
              disabled={memproses || diterima === 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
              {memproses ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {tolak.size === 0 ? "Setujui Semua" : `Simpan ${diterima} Isian, Tolak ${tolak.size}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifikasiDataPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<"siswa" | "pegawai">("siswa");
  const [siswa, setSiswa] = useState<EditRequest[]>([]);
  const [pegawai, setPegawai] = useState<PegawaiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useCariAwal(setSearch);
  const [fKelas, setFKelas] = useState("");
  const [fPeran, setFPeran] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/profile-edit-requests?status=PENDING").then(r => r.json()).catch(() => []),
      fetch("/api/admin/pegawai-edit-requests?status=PENDING").then(r => r.json()).catch(() => []),
    ]).then(([a, b]) => {
      setSiswa(Array.isArray(a) ? a : []);
      setPegawai(Array.isArray(b) ? b : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function decide(jenis: "siswa" | "pegawai", id: string, k: Keputusan) {
    if (k.aksi === "REJECT" && !(await confirmDialog("Tolak SEMUA isian pada pengajuan ini?"))) return;
    if (k.aksi === "APPROVE" && k.tolak.length > 0
      && !(await confirmDialog(`${k.tolak.length} isian akan ditolak dan tidak disimpan. Lanjutkan?`))) return;
    const jalur = jenis === "siswa" ? "profile-edit-requests" : "pegawai-edit-requests";
    setProcessingId(id);
    const res = await fetch(`/api/admin/${jalur}/${id}/decide`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: k.aksi, tolak: k.tolak }),
    }).catch(() => null);
    setProcessingId(null);
    if (!res) { toast.error("Gagal menghubungi server"); return; }
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Gagal memproses"); return; }
    const d = await res.json().catch(() => ({} as { diterima?: number; ditolak?: number }));
    toast.success(!d.diterima ? "Pengajuan ditolak"
      : d.ditolak ? `${d.diterima} isian disimpan, ${d.ditolak} ditolak`
      : "Perubahan disetujui");
    load();
  }

  const q = search.toLowerCase();
  const siswaTersaring = siswa.filter(r =>
    (!q || r.student.user.name.toLowerCase().includes(q) || r.student.nis.toLowerCase().includes(q))
    && (!fKelas || r.student.class?.name === fKelas));
  const pegawaiTersaring = pegawai.filter(r =>
    (!q || r.user.name.toLowerCase().includes(q) || (r.user.teacher?.nip ?? "").toLowerCase().includes(q))
    && (!fPeran || r.user.role === fPeran));

  const tabs: { kunci: "siswa" | "pegawai"; label: string; ikon: typeof Users; jumlah: number }[] = [
    { kunci: "siswa", label: "Siswa", ikon: GraduationCap, jumlah: siswa.length },
    { kunci: "pegawai", label: "Guru & Staf", ikon: Users, jumlah: pegawai.length },
  ];
  const adaTab = tab === "siswa" ? siswa.length > 0 : pegawai.length > 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ShieldCheck size={22} />}
        title="Verifikasi Perubahan Data"
        description="Siswa, guru, dan staf mengajukan perubahan biodatanya sendiri — data resmi baru berubah setelah Anda setujui di sini"
      />

      <div className="space-y-6">
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {tabs.map(t => (
              <button key={t.kunci} onClick={() => { setTab(t.kunci); setExpandedId(null); }}
                className={`sentuh flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === t.kunci ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <t.ikon size={15} /> {t.label}
                {t.jumlah > 0 && (
                  <span className={`angka rounded-full px-1.5 text-xs ${tab === t.kunci ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
                    {t.jumlah}
                  </span>
                )}
              </button>
            ))}
          </div>
          {!loading && adaTab && (
            <>
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={tab === "siswa" ? "Cari nama atau NIS siswa..." : "Cari nama atau NIP pegawai..."}
                  className="input-field pl-10" />
              </div>
              <div className="alat-saring">
                {tab === "siswa" ? (
                  <Select value={fKelas} onChange={setFKelas} placeholder="Semua kelas" options={[
                    { value: "", label: "Semua kelas" },
                    ...[...new Set(siswa.map(r => r.student.class?.name).filter((n): n is string => !!n))].sort()
                      .map(k => ({ value: k, label: k })),
                  ]} />
                ) : (
                  <Select value={fPeran} onChange={setFPeran} placeholder="Semua peran" options={[
                    { value: "", label: "Semua peran" },
                    ...[...new Set(pegawai.map(r => r.user.role))].sort()
                      .map(p => ({ value: p, label: PERAN[p] ?? p })),
                  ]} />
                )}
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        ) : tab === "siswa" ? (
          siswa.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Tidak Ada Pengajuan Menunggu"
              description="Semua pengajuan perubahan data siswa sudah diproses." />
          ) : siswaTersaring.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada pengajuan yang cocok dengan pencarian." />
          ) : (
            <div className="space-y-4">
              {siswaTersaring.map(r => (
                <KartuPengajuan key={r.id}
                  judul={<>{r.student.user.name} <span className="text-sm font-normal text-gray-400">— NIS {r.student.nis}</span></>}
                  keterangan={`${r.student.class?.name ?? "—"} · ${r.student.major?.name ?? "—"}`}
                  changes={r.changes} createdAt={r.createdAt}
                  terbuka={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  memproses={processingId === r.id} onPutuskan={k => decide("siswa", r.id, k)} />
              ))}
            </div>
          )
        ) : pegawai.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Tidak Ada Pengajuan Menunggu"
            description="Semua pengajuan perubahan biodata guru & staf sudah diproses." />
        ) : pegawaiTersaring.length === 0 ? (
          <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada pengajuan yang cocok dengan pencarian." />
        ) : (
          <div className="space-y-4">
            {pegawaiTersaring.map(r => (
              <KartuPengajuan key={r.id}
                judul={<>{r.user.name} <span className="text-sm font-normal text-gray-400">
                  — {r.user.teacher?.nip ? `NIP ${r.user.teacher.nip}` : r.user.email}</span></>}
                keterangan={`${PERAN[r.user.role] ?? r.user.role}${r.user.teacher?.subject ? ` · ${r.user.teacher.subject}` : ""}`}
                changes={r.changes} createdAt={r.createdAt}
                terbuka={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                memproses={processingId === r.id} onPutuskan={k => decide("pegawai", r.id, k)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
