"use client";
import { useCallback, useEffect, useState } from "react";
import { Megaphone, Loader2, Eye, EyeOff, Gavel, TriangleAlert } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Usul = { id: string; nomor: string | null; fullName: string; skor: number | null; gugur: boolean; status: string; usul: string; peringkat: number | null };
type JurusanHasil = { nama: string; kuota: number; pendaftar: Usul[] };
type Hasil = { gelombang: string; cadangan: number; jurusan: JurusanHasil[]; ringkas: { diterima: number; cadangan: number; ditolak: number; belum: number } };

const WARNA: Record<string, string> = {
  DITERIMA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CADANGAN: "bg-amber-50 text-amber-700 border-amber-200",
  DITOLAK: "bg-red-50 text-red-600 border-red-200",
};

export default function PengumumanSpmbManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [gelombang, setGelombang] = useState<{ id: string; nama: string }[]>([]);
  const [pilih, setPilih] = useState("");
  const [cadangan, setCadangan] = useState(5);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [dibuka, setDibuka] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/spmb/gelombang").then(r => r.json()).catch(() => null),
      fetch("/api/spmb/pengaturan").then(r => r.json()).catch(() => null),
    ]).then(([g, s]) => {
      if (g && !g.error) {
        const daftar = (g.gelombang ?? []).map((x: { id: string; nama: string }) => ({ id: x.id, nama: x.nama }));
        setGelombang(daftar);
        if (daftar.length) setPilih(daftar[daftar.length - 1].id);
      }
      if (s && !s.error) setDibuka(s["spmb.hasilDibuka"] === "1");
    }).catch(() => {}).finally(() => setMemuat(false));
  }, []);

  const pratinjau = useCallback(async (gelombangId: string, jmlCadangan: number) => {
    if (!gelombangId) { setHasil(null); return; }
    setSibuk(true);
    const d = await fetch(`/api/spmb/pengumuman?gelombangId=${gelombangId}&cadangan=${jmlCadangan}`)
      .then(r => r.json()).catch(() => null);
    setSibuk(false);
    if (d && !d.error) setHasil(d); else { setHasil(null); if (d?.error) toast.error(d.error); }
  }, [toast]);

  useEffect(() => { pratinjau(pilih, cadangan); }, [pilih, cadangan, pratinjau]);

  async function tetapkan() {
    if (!hasil) return;
    const ya = await confirm(
      `Tetapkan hasil seleksi "${hasil.gelombang}"? ${hasil.ringkas.diterima} diterima, ${hasil.ringkas.cadangan} cadangan, ` +
      `${hasil.ringkas.ditolak} belum diterima. Status pendaftar akan diperbarui.`);
    if (!ya) return;
    setSibuk(true);
    const r = await fetch("/api/spmb/pengumuman", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gelombangId: pilih, cadangan }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success(`${d?.diubah ?? 0} pendaftar diperbarui`); await pratinjau(pilih, cadangan); }
    else toast.error(d?.error ?? "Gagal menetapkan hasil");
  }

  async function gantiGerbang(nyala: boolean) {
    const ya = await confirm(nyala
      ? "Buka hasil seleksi? Pendaftar langsung bisa melihat keputusan diterima/tidak lewat nomor pendaftaran dan tanggal lahirnya."
      : "Tutup kembali hasil seleksi? Pendaftar hanya akan melihat bahwa berkasnya sedang diperiksa.");
    if (!ya) return;
    setSibuk(true);
    const r = await fetch("/api/spmb/pengaturan", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "spmb.hasilDibuka": nyala ? "1" : "0" }),
    }).catch(() => null);
    setSibuk(false);
    if (r?.ok) { setDibuka(nyala); toast.success(nyala ? "Hasil seleksi dibuka" : "Hasil seleksi ditutup"); }
    else toast.error("Gagal mengubah");
  }

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Megaphone size={22} />} title="Pengumuman Hasil"
        description="Tetapkan diterima/cadangan/belum diterima dari peringkat & kuota, lalu buka hasilnya untuk pendaftar" />

      <div className="space-y-6">
        {hasil && (
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={hasil.ringkas.diterima} label="Usul diterima" ikon="hadir" color="emerald" />
            <StatTile value={hasil.ringkas.cadangan} label="Usul cadangan" ikon="menunggu" color="amber" />
            <StatTile value={hasil.ringkas.ditolak} label="Belum diterima" ikon="alpha" color="red" />
            <StatTile value={hasil.ringkas.belum} label="Belum dinilai" ikon="daftar-tugas" color="gray"
              sorot={hasil.ringkas.belum > 0} />
          </div>
        )}

        <div className={`panel p-5 ${dibuka ? "ring-1 ring-emerald-200" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-heading font-semibold text-navy text-sm">
                {dibuka ? "Hasil seleksi SEDANG DIBUKA" : "Hasil seleksi masih ditutup"}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {dibuka
                  ? "Pendaftar bisa melihat keputusannya di halaman SPMB dengan nomor pendaftaran + tanggal lahir."
                  : "Pendaftar hanya melihat bahwa berkasnya sedang diperiksa — tetapkan hasil dulu, baru buka."}
              </p>
            </div>
            <button type="button" disabled={sibuk} onClick={() => gantiGerbang(!dibuka)}
              className={dibuka ? "btn-modal-cancel" : "btn-modal-save"}>
              {dibuka ? <><EyeOff size={16} /> Tutup Hasil</> : <><Eye size={16} /> Buka Hasil</>}
            </button>
          </div>
        </div>

        <div className="baris-alat">
          <div className="alat-saring">
            <Select value={pilih} onChange={setPilih}
              options={gelombang.length ? gelombang.map(g => ({ value: g.id, label: g.nama })) : [{ value: "", label: "Belum ada gelombang" }]} />
          </div>
          <div className="alat-saring">
            <Select value={String(cadangan)} onChange={v => setCadangan(Number(v))}
              options={[0, 3, 5, 10, 20, 50].map(n => ({ value: String(n), label: n === 0 ? "Tanpa cadangan" : `${n} cadangan / jurusan` }))} />
          </div>
          <div className="alat-aksi">
            <button type="button" disabled={sibuk || !hasil} onClick={tetapkan} className="btn-awas btn-teks">
              {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />} Tetapkan Hasil
            </button>
          </div>
        </div>

        {hasil?.ringkas.belum ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-start gap-2 text-sm text-amber-700">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <span><span className="font-semibold text-amber-800">{hasil.ringkas.belum} pendaftar belum punya nilai.</span>{" "}
                Mereka TIDAK ikut diputuskan — statusnya dibiarkan apa adanya. Lengkapi dulu di menu Seleksi &amp; Nilai bila mereka harus ikut.</span>
            </p>
          </div>
        ) : null}

        {!hasil ? (
          <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Pilih gelombang untuk melihat usulan hasil.</p></div>
        ) : hasil.jurusan.length === 0 ? (
          <div className="panel p-5"><p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar di gelombang ini.</p></div>
        ) : (
          hasil.jurusan.map(j => (
            <div key={j.nama} className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-white px-5 py-3.5">
                <p className="font-heading font-semibold text-navy text-sm">{j.nama}</p>
                <p className="text-xs text-gray-500">
                  Kuota <span className="angka font-semibold text-primary-900">{j.kuota || "tidak dibatasi"}</span> ·
                  pendaftar <span className="angka font-semibold text-primary-900">{j.pendaftar.length}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>
                    <th className="w-10">No</th><th>Pendaftar</th>
                    <th className="text-right">Skor</th><th>Status sekarang</th><th>Usulan</th>
                  </tr></thead>
                  <tbody>
                    {j.pendaftar.map((p, i) => (
                      <tr key={p.id}>
                        <td className="angka">{p.peringkat ?? i + 1}</td>
                        <td>
                          <p className="font-medium text-primary-900">{p.fullName}</p>
                          <p className="angka text-xs text-gray-400">{p.nomor ?? "—"}</p>
                        </td>
                        <td className="angka text-right">{p.gugur ? <span className="text-red-600">Gugur</span> : p.skor?.toFixed(2) ?? "—"}</td>
                        <td className="text-gray-500">{p.status}</td>
                        <td>
                          <span className={`status-badge ${WARNA[p.usul] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{p.usul}</span>
                          {p.usul !== p.status && <span className="ml-1.5 text-xs text-amber-600">berubah</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
