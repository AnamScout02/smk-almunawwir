"use client";
import { useRef, useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertTriangle, Images } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

type Hasil =
  | { berkas: string; status: "COCOK"; id: string; nama: string; kelas: string | null; sudahAda: boolean }
  | { berkas: string; status: "TIDAK_DIKENAL" | "GANDA" | "DOBEL"; id?: string; nama?: string; kelas?: string | null };

const KET: Record<string, { teks: string; gaya: string }> = {
  TIDAK_DIKENAL: { teks: "NIS/NISN tidak dikenali", gaya: "bg-red-50 text-red-700 border-red-200" },
  GANDA: { teks: "Nomor dipakai lebih dari satu orang", gaya: "bg-amber-50 text-amber-700 border-amber-200" },
  DOBEL: { teks: "Lebih dari satu berkas untuk orang ini", gaya: "bg-amber-50 text-amber-700 border-amber-200" },
};

/** Unggah Foto Kartu (KTS) massal — nama berkas = NIS atau NISN (siswa) / NIP (guru). Pratinjau dulu dari NAMA
 *  berkas saja (belum ada yang terunggah), baru setelah petugas menekan Simpan berkas yang cocok diunggah dan
 *  dipasang. Yang tidak dikenal / ganda / dobel dilewati — tidak pernah ditebak. Lihat
 *  /api/admin/kartu-tanda/foto-massal. */
export default function UnggahFotoKartu({ open, onClose, jenis, onSelesai }: {
  open: boolean; onClose: () => void; jenis: "SISWA" | "GURU"; onSelesai: () => void;
}) {
  const toast = useToast();
  const masukan = useRef<HTMLInputElement>(null);
  const [berkas, setBerkas] = useState<File[]>([]);
  const [hasil, setHasil] = useState<Hasil[] | null>(null);
  const [sibuk, setSibuk] = useState<"" | "cocok" | "unggah">("");
  const [kemajuan, setKemajuan] = useState(0);

  const tutup = () => { if (sibuk) return; setBerkas([]); setHasil(null); setKemajuan(0); onClose(); };

  async function pilih(daftar: FileList | null) {
    const f = [...(daftar ?? [])].filter(x => /^image\/(jpeg|png)$/.test(x.type));
    if (!f.length) { toast.warning("Pilih berkas foto JPG/PNG."); return; }
    setBerkas(f); setHasil(null); setSibuk("cocok");
    try {
      const r = await fetch("/api/admin/kartu-tanda/foto-massal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ langkah: "cocok", jenis, nama: f.map(x => x.name) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal mencocokkan"); return; }
      setHasil(d.hasil);
    } catch { toast.error("Koneksi gagal."); } finally { setSibuk(""); }
  }

  const cocok = (hasil ?? []).filter((h): h is Extract<Hasil, { status: "COCOK" }> => h.status === "COCOK");

  async function simpan() {
    if (!cocok.length) return;
    setSibuk("unggah"); setKemajuan(0);
    const pasangan: { id: string; url: string }[] = [];
    let gagal = 0;
    try {
      // Tiga berkas sekaligus: cukup cepat tanpa membanjiri jaringan sekolah.
      const antre = [...cocok];
      const kerja = async () => {
        for (let h = antre.shift(); h; h = antre.shift()) {
          const f = berkas.find(x => x.name === h.berkas);
          if (!f) { gagal++; continue; }
          const fd = new FormData();
          fd.append("file", f); fd.append("folder", "buku-induk/kartu");
          const r = await fetch("/api/upload", { method: "POST", body: fd }).catch(() => null);
          const d = await r?.json().catch(() => null);
          if (r?.ok && d?.url) pasangan.push({ id: h.id, url: d.url }); else gagal++;
          setKemajuan(k => k + 1);
        }
      };
      await Promise.all([kerja(), kerja(), kerja()]);
      if (pasangan.length) {
        const r = await fetch("/api/admin/kartu-tanda/foto-massal", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ langkah: "simpan", jenis, pasangan }),
        });
        const d = await r.json().catch(() => null);
        if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
        toast.success(`${d.tersimpan} Foto Kartu tersimpan${gagal ? `, ${gagal} gagal diunggah` : ""}`);
      } else toast.error("Tidak ada foto yang berhasil diunggah.");
      setBerkas([]); setHasil(null); onSelesai(); onClose();
    } finally { setSibuk(""); }
  }

  const label = jenis === "GURU" ? "NIP" : "NIS atau NISN";
  return (
    <Modal open={open} onClose={tutup} title={`Unggah Foto Kartu ${jenis === "GURU" ? "Guru" : "Siswa"}`} size="xl" scrollBody
      footer={<>
        <button type="button" onClick={tutup} disabled={!!sibuk} className="btn-modal-cancel flex-1">Batal</button>
        <button type="button" onClick={simpan} disabled={!!sibuk || !cocok.length} className="btn-modal-save flex-1">
          {sibuk === "unggah" ? <Loader2 className="animate-spin" /> : <Upload />}
          {sibuk === "unggah" ? `Mengunggah ${kemajuan}/${cocok.length}…` : `Unggah & Simpan ${cocok.length} Foto`}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          Beri nama tiap berkas dengan <strong>{label}</strong>, mis. <span className="font-mono">{jenis === "GURU" ? "TMP-004.jpg" : "0012345678.jpg"}</span>
          {jenis === "SISWA" && <> atau <span className="font-mono">001-001.064.jpg</span> (garis miring NIS ditulis &quot;-&quot;)</>}.
          Foto hanya mengisi <strong>Foto Kartu</strong> — Foto Masuk/Keluar di Buku Induk tidak berubah. Sebaiknya rasio 3×4.
        </div>

        <button type="button" onClick={() => masukan.current?.click()} disabled={!!sibuk}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-sm text-gray-500 transition hover:border-primary-500 hover:bg-primary-50">
          {sibuk === "cocok" ? <Loader2 size={24} className="animate-spin text-gray-400" /> : <Images size={24} className="text-gray-400" />}
          <span className="mt-2 font-semibold text-primary-900">{berkas.length ? `${berkas.length} berkas dipilih — pilih ulang` : "Pilih foto (bisa banyak sekaligus)"}</span>
          <span className="text-xs text-gray-400">JPG/PNG, maks. 5MB per foto</span>
        </button>
        <input ref={masukan} type="file" accept="image/jpeg,image/png" multiple className="hidden"
          onChange={e => { void pilih(e.target.files); e.target.value = ""; }} />

        {hasil && (
          <>
            <div className="kisi-kartu kisi-kartu-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="angka text-2xl font-bold text-emerald-700">{cocok.length}</p><p className="text-xs text-emerald-700">siap disimpan</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="angka text-2xl font-bold text-amber-700">{cocok.filter(h => h.sudahAda).length}</p><p className="text-xs text-amber-700">menimpa Foto Kartu lama</p></div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="angka text-2xl font-bold text-red-700">{hasil.length - cocok.length}</p><p className="text-xs text-red-700">dilewati</p></div>
            </div>
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Berkas</th><th>{jenis === "GURU" ? "Guru" : "Siswa"}</th>{jenis === "SISWA" && <th>Kelas</th>}<th>Keterangan</th></tr></thead>
                  <tbody>
                    {hasil.map(h => (
                      <tr key={h.berkas}>
                        <td className="font-mono text-xs">{h.berkas}</td>
                        <td className="font-medium text-primary-900">{h.nama ?? "—"}</td>
                        {jenis === "SISWA" && <td>{h.kelas ?? "—"}</td>}
                        <td>
                          {h.status === "COCOK" ? (
                            <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                              <CheckCircle2 size={12} /> {h.sudahAda ? "Cocok · ganti foto lama" : "Cocok"}
                            </span>
                          ) : (
                            <span className={`status-badge ${KET[h.status].gaya}`}><AlertTriangle size={12} /> {KET[h.status].teks}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
