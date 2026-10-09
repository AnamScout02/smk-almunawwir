"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CopyCheck, Loader2, ExternalLink, UserCheck, RotateCcw } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { LABEL_ALASAN, type AlasanGanda } from "@/lib/spmb-ganda";
import { LABEL_STATUS } from "@/lib/spmb-status";

type Anggota = {
  id: string; nomor: string | null; nama: string; lahir: string; tempatLahir: string | null; nik: string | null; nisn: string | null;
  phone: string; sekolahAsal: string | null; jurusan: string; status: string; verifikasiStatus: string; daftar: string;
  sudahSiswa: boolean; gelombang: string | null; pembayaran: number;
};
type Kelompok = { pasti: boolean; alasan: AlasanGanda[]; anggota: Anggota[] };

const tgl = (iso: string, jam = false) => new Date(jam ? iso : iso + "T00:00:00Z").toLocaleDateString("id-ID", {
  day: "numeric", month: "short", year: "numeric", timeZone: jam ? "Asia/Jakarta" : "UTC",
});

/** Nilai yang SAMA di lebih dari satu baris kelompok ditebalkan — itulah yang membuatnya diduga ganda. */
function Sel({ nilai, semua }: { nilai: string | null; semua: (string | null)[] }) {
  if (!nilai) return <span className="text-gray-300">—</span>;
  const kembar = semua.filter(x => x === nilai).length > 1;
  return <span className={kembar ? "font-semibold text-primary-900" : "text-gray-600"}>{nilai}</span>;
}

export default function PendaftarGandaManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ kelompok: Kelompok[]; diabaikan: number } | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    return fetch("/api/spmb/ganda").then(r => r.json()).then(d => { if (!d.error) setData(d); else toast.error(d.error); })
      .catch(() => {}).finally(() => setMemuat(false));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(body: Record<string, unknown>, pesan: string) {
    setSibuk(true);
    const r = await fetch("/api/spmb/ganda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(pesan); muat(); } else toast.error(d?.error || "Gagal menyimpan");
  }

  if (memuat && !data) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
  );
  const kelompok = data?.kelompok ?? [];
  const pasti = kelompok.filter(k => k.pasti).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CopyCheck size={22} />} title="Pendaftar Diduga Ganda"
        description="Orang yang sama terdaftar lebih dari sekali — untuk diperiksa panitia, tidak ada yang dihapus otomatis" />
      <BarisKembali href="/pusat-spmb/tahapan" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={kelompok.length} label="Kelompok perlu diperiksa" icon={CopyCheck} color="amber" sorot={kelompok.length > 0} />
          <StatTile value={pasti} label="NIK atau NISN sama" icon={CopyCheck} color="red" />
          <StatTile value={data?.diabaikan ?? 0} label="Pasangan ditandai bukan ganda" icon={UserCheck} color="emerald" />
        </div>

        <div className="panel p-5 text-sm text-gray-600">
          <p className="panel-judul mb-2">Cara memeriksa</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Nilai yang <span className="font-semibold text-primary-900">ditebalkan</span> sama di lebih dari satu baris. Baris teratas adalah yang mendaftar lebih dulu.</li>
            <li>Bila memang orang yang sama: buka baris yang <em>tidak</em> dipakai, lalu hapus dari jendela calon. Pertahankan baris yang sudah diverifikasi, sudah membayar, atau sudah jadi siswa.</li>
            <li>Bila ternyata dua orang berbeda (anak kembar, nama pasaran): tekan <span className="font-medium">Bukan Ganda</span> supaya tidak muncul lagi.</li>
          </ul>
        </div>

        {(data?.diabaikan ?? 0) > 0 && (
          <div className="alat-aksi alat-teks justify-end">
            <button type="button" disabled={sibuk} className="btn-modal-cancel"
              onClick={async () => { if (await confirm("Tampilkan lagi semua pasangan yang pernah ditandai bukan ganda?")) kirim({ aksi: "pulihkan" }, "Tanda bukan ganda dihapus"); }}>
              <RotateCcw size={16} /> Tampilkan Lagi yang Disingkirkan
            </button>
          </div>
        )}

        {kelompok.length === 0 ? (
          <div className="panel"><EmptyState icon={UserCheck} title="Tidak ada pendaftar yang diduga ganda" description="Tidak ditemukan NIK, NISN, atau nama dan tanggal lahir yang sama di antara pendaftar." /></div>
        ) : kelompok.map(k => {
          const a = k.anggota;
          return (
            <div key={a.map(x => x.id).join("|")} className="panel overflow-hidden">
              <div className="panel-kepala flex-wrap gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="panel-judul">{a.length} pendaftaran</p>
                  {k.alasan.map(x => (
                    <span key={x} className={`status-badge ${x === "NIK" || x === "NISN" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{LABEL_ALASAN[x]}</span>
                  ))}
                </div>
                <button type="button" disabled={sibuk} className="btn-modal-cancel px-3 text-xs"
                  onClick={async () => { if (await confirm(`Tandai ${a.length} pendaftaran ini sebagai orang yang berbeda? Kelompok ini tidak ditampilkan lagi.`)) kirim({ aksi: "abaikan", ids: a.map(x => x.id) }, "Ditandai bukan ganda"); }}>
                  <UserCheck size={14} /> Bukan Ganda
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Calon</th><th>Lahir</th><th>NIK</th><th>NISN</th><th>WhatsApp</th><th>Sekolah asal</th><th>Jurusan · Gelombang</th><th>Keadaan</th><th>Mendaftar</th><th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.map(x => (
                      <tr key={x.id}>
                        <td>
                          <p className="font-medium text-primary-900">{x.nama}</p>
                          <p className="angka text-xs text-gray-400">{x.nomor ?? "tanpa nomor"}</p>
                        </td>
                        <td className="angka whitespace-nowrap"><Sel nilai={tgl(x.lahir)} semua={a.map(y => tgl(y.lahir))} />{x.tempatLahir ? <span className="block text-xs text-gray-400">{x.tempatLahir}</span> : null}</td>
                        <td className="angka"><Sel nilai={x.nik} semua={a.map(y => y.nik)} /></td>
                        <td className="angka"><Sel nilai={x.nisn} semua={a.map(y => y.nisn)} /></td>
                        <td className="angka"><Sel nilai={x.phone} semua={a.map(y => y.phone)} /></td>
                        <td>{x.sekolahAsal || <span className="text-gray-300">—</span>}</td>
                        <td>{x.jurusan || "—"}<span className="block text-xs text-gray-400">{x.gelombang ?? "tanpa gelombang"}</span></td>
                        <td>
                          <span className="text-sm text-gray-600">{LABEL_STATUS[x.status] ?? x.status}</span>
                          <span className="block text-xs text-gray-400">
                            {[x.verifikasiStatus === "TERVERIFIKASI" ? "berkas terverifikasi" : null, x.pembayaran ? `${x.pembayaran} pembayaran` : null, x.sudahSiswa ? "sudah jadi siswa" : null].filter(Boolean).join(" · ") || "belum diproses"}
                          </span>
                        </td>
                        <td className="angka whitespace-nowrap text-gray-600">{tgl(x.daftar, true)}</td>
                        <td className="text-right">
                          <Link href={`/pusat-spmb/tahapan?buka=${x.id}`} className="btn-modal-save px-3 text-xs"><ExternalLink size={14} /> Buka</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
