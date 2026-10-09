"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert, Loader2, Search, Save, ArrowRightLeft, Plus, CircleCheck, Hourglass, Inbox } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { useToast } from "@/components/shared/ToastProvider";
import { JENIS_LAPORAN, STATUS_LAPORAN } from "@/lib/pkl-label";

type Laporan = {
  id: string; pelapor: string; pelaporNama: string; jenis: string; isi: string; fotoUrl: string | null; status: string; tindakLanjut: string | null;
  ditanganiOleh: string | null; ditanganiPada: string | null; selesaiPada: string | null; dibuat: string;
  studentId: string; siswa: string; nis: string; kelas: string | null; tempat: string; adaDudi: boolean; guru: string | null;
};
const PELAPOR: Record<string, string> = { SISWA: "Siswa", INDUSTRI: "Pembimbing industri", GURU: "Guru" };
const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** LAPORAN MASALAH PKL (9 Okt 2026) — dari siswa, pembimbing industri, atau guru. Humas melihat semuanya; guru
 *  pembimbing hanya siswa bimbingannya (`kembaliHref` dikirim portal guru karena halamannya di luar menu).
 *  Laporan "tidak cocok" bisa langsung dilanjutkan ke Mutasi dari sini. */
export default function LaporanPklManager({ kembaliHref }: { kembaliHref?: string }) {
  const toast = useToast();
  const [data, setData] = useState<{ humas: boolean; laporan: Laporan[] } | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("TERBUKA");
  const [buka, setBuka] = useState<Laporan | null>(null);
  const [baru, setBaru] = useState(false);

  const muat = useCallback(() => {
    return fetch("/api/pkl/laporan").then(r => r.json()).then(d => { if (d.error) toast.error(d.error); else setData(d); })
      .catch(() => toast.error("Gagal memuat laporan."));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (data?.laporan ?? []).filter(l =>
      (!q || `${l.siswa} ${l.nis} ${l.kelas ?? ""} ${l.tempat} ${l.isi}`.toLowerCase().includes(q)) &&
      (!saring || (saring === "TERBUKA" ? l.status !== "SELESAI" : l.status === saring)));
  }, [data, cari, saring]);

  if (!data) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const semua = data.laporan;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<TriangleAlert size={22} />} title="Laporan Masalah PKL" description="Laporan dari siswa, pembimbing industri, dan guru — beserta tindak lanjutnya" />
      {kembaliHref && <BarisKembali href={kembaliHref} />}

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={semua.filter(l => l.status === "BARU").length} label="Belum ditangani" icon={Inbox} color="red" sorot={semua.some(l => l.status === "BARU")} />
          <StatTile value={semua.filter(l => l.status === "DITANGANI").length} label="Sedang ditangani" icon={Hourglass} color="amber" />
          <StatTile value={semua.filter(l => l.status === "SELESAI").length} label="Selesai" icon={CircleCheck} color="emerald" />
        </div>

        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari siswa, kelas, tempat PKL, atau isi laporan..." />
          </div>
          <div className="alat-saring">
            <Select value={saring} onChange={setSaring} options={[{ value: "TERBUKA", label: "Belum selesai" }, { value: "", label: "Semua laporan" },
              ...Object.entries(STATUS_LAPORAN).map(([value, s]) => ({ value, label: s.label }))]} />
          </div>
          <div className="alat-aksi"><button type="button" className="btn-modal-save btn-teks" onClick={() => setBaru(true)}><Plus size={16} /> Catat Masalah</button></div>
        </div>

        <div className="panel overflow-hidden">
          {tersaring.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">{semua.length ? "Tidak ada laporan pada saringan ini." : "Belum ada laporan masalah."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Masuk</th><th>Siswa</th><th>Tempat PKL</th><th>Masalah</th><th>Pelapor</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {tersaring.map(l => (
                    <tr key={l.id}>
                      <td className="angka whitespace-nowrap text-sm text-gray-600">{waktu(l.dibuat)}</td>
                      <td><p className="font-medium text-primary-900">{l.siswa}</p><p className="angka text-xs text-gray-400">{l.kelas ?? "tanpa kelas"}{l.guru ? ` · ${l.guru}` : ""}</p></td>
                      <td className="text-sm text-gray-600">{l.tempat}</td>
                      <td className="max-w-[22rem]"><p className="text-sm font-medium text-gray-700">{JENIS_LAPORAN[l.jenis] ?? l.jenis}</p><p className="line-clamp-2 text-xs text-gray-500">{l.isi}</p></td>
                      <td className="text-sm text-gray-600">{PELAPOR[l.pelapor] ?? l.pelapor}<span className="block text-xs text-gray-400">{l.pelaporNama}</span></td>
                      <td><span className={`status-badge ${STATUS_LAPORAN[l.status]?.kelas ?? ""}`}>{STATUS_LAPORAN[l.status]?.label ?? l.status}</span></td>
                      <td className="text-right"><button type="button" className="btn-modal-save px-3 text-xs" onClick={() => setBuka(l)}>Buka</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {buka && <ModalLaporan l={buka} humas={data.humas} onTutup={() => setBuka(null)} onSimpan={() => { setBuka(null); muat(); }} />}
      {baru && <ModalBaru onTutup={() => setBaru(false)} onSimpan={() => { setBaru(false); muat(); }} />}
    </div>
  );
}

function ModalLaporan({ l, humas, onTutup, onSimpan }: { l: Laporan; humas: boolean; onTutup: () => void; onSimpan: () => void }) {
  const toast = useToast();
  const [tindak, setTindak] = useState(l.tindakLanjut ?? "");
  const [sibuk, setSibuk] = useState(false);
  async function simpan(status: string) {
    setSibuk(true);
    const r = await fetch(`/api/pkl/laporan/${l.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, tindakLanjut: tindak }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(status === "SELESAI" ? "Laporan diselesaikan" : "Tindak lanjut disimpan"); onSimpan(); } else toast.error(d?.error ?? "Gagal menyimpan");
  }
  return (
    <Modal open onClose={onTutup} size="lg" scrollBody title={JENIS_LAPORAN[l.jenis] ?? l.jenis} description={`${l.siswa} · ${l.kelas ?? "tanpa kelas"} · ${l.tempat}`}
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" disabled={sibuk} onClick={() => simpan("DITANGANI")}><Save /> Simpan, Masih Ditangani</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={() => simpan("SELESAI")}>{sibuk ? <Loader2 className="animate-spin" /> : <CircleCheck />} Selesai</button>
      </>}>
      <>
        <div className="rounded-xl border border-gray-100 bg-[#f5f6fa] p-4">
          <p className="label-kecil mb-1">Laporan dari {PELAPOR[l.pelapor]?.toLowerCase() ?? l.pelapor} · {l.pelaporNama} · {waktu(l.dibuat)}</p>
          <p className="whitespace-pre-line text-sm text-gray-700">{l.isi}</p>
          {l.fotoUrl && <a href={l.fotoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-primary-700 hover:underline">Lihat foto lampiran</a>}
        </div>
        <div>
          <label className="label-field">Tindak lanjut sekolah</label>
          <textarea className="input-field" rows={4} value={tindak} onChange={e => setTindak(e.target.value)} placeholder="Apa yang sudah dilakukan dan hasilnya. Catatan ini dibaca siswa pelapor." />
          {l.ditanganiOleh && <p className="mt-1.5 text-xs text-gray-400">Terakhir diisi {l.ditanganiOleh}{l.ditanganiPada ? `, ${waktu(l.ditanganiPada)}` : ""}</p>}
        </div>
        {humas && l.adaDudi && l.status !== "SELESAI" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3">
            <p className="min-w-0 flex-1 text-sm text-gray-600">Bila penyelesaiannya memindahkan siswa ke tempat lain, catat lewat Mutasi supaya riwayatnya terhubung ke laporan ini.</p>
            <Link href={`/pusat-pkl/penempatan?mutasi=${l.studentId}&laporan=${l.id}`} className="btn-modal-cancel btn-teks"><ArrowRightLeft size={16} /> Mutasi Siswa</Link>
          </div>
        )}
      </>
    </Modal>
  );
}

/** Humas / guru pembimbing mencatat masalah yang ia temukan sendiri (mis. saat monitoring). */
function ModalBaru({ onTutup, onSimpan }: { onTutup: () => void; onSimpan: () => void }) {
  const toast = useToast();
  const [siswa, setSiswa] = useState<{ studentId: string; nama: string; kelas: string | null; tempat: string | null }[]>([]);
  const [f, setF] = useState({ studentId: "", jenis: "", isi: "" });
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    // Humas: seluruh peserta; guru pembimbing: siswa bimbingannya (rute pembimbing).
    fetch("/api/pkl/penempatan").then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.peserta) { setSiswa(d.peserta); return; }
      return fetch("/api/teacher/pkl").then(r => r.json()).then((x: { studentId: string; student: { user: { name: string }; class: { name: string } | null }; company: string }[]) => {
        if (Array.isArray(x)) setSiswa(x.map(p => ({ studentId: p.studentId, nama: p.student.user.name, kelas: p.student.class?.name ?? null, tempat: p.company })));
      });
    }).catch(() => {});
  }, []);
  async function simpan() {
    if (!f.studentId || !f.jenis || f.isi.trim().length < 10) { toast.error("Siswa, jenis masalah, dan uraian (min. 10 huruf) wajib diisi."); return; }
    setSibuk(true);
    const r = await fetch("/api/pkl/laporan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success("Masalah dicatat"); onSimpan(); } else toast.error(d?.error ?? "Gagal menyimpan");
  }
  return (
    <Modal open onClose={onTutup} size="lg" title="Catat Masalah PKL" description="Masalah yang ditemukan sekolah, mis. saat monitoring"
      footer={<>
        <button type="button" className="btn-modal-cancel flex-1" onClick={onTutup}>Batal</button>
        <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={simpan}>{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
      </>}>
      <>
        <div><label className="label-field">Siswa</label>
          <Select value={f.studentId} onChange={v => setF(x => ({ ...x, studentId: v }))} placeholder="Pilih siswa"
            options={siswa.map(s => ({ value: s.studentId, label: `${s.nama} — ${s.kelas ?? "tanpa kelas"}${s.tempat ? ` · ${s.tempat}` : ""}` }))} /></div>
        <div><label className="label-field">Jenis masalah</label>
          <Select value={f.jenis} onChange={v => setF(x => ({ ...x, jenis: v }))} placeholder="Pilih jenis masalah" options={Object.entries(JENIS_LAPORAN).map(([value, label]) => ({ value, label }))} /></div>
        <div><label className="label-field">Uraian</label>
          <textarea className="input-field" rows={4} value={f.isi} onChange={e => setF(x => ({ ...x, isi: e.target.value }))} /></div>
      </>
    </Modal>
  );
}
