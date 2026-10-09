"use client";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Sparkles, Download, Upload } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

type Hasil = { baris: number; nis: string; nama: string; status: "UBAH" | "SAMA" | "GALAT"; ket: string };
type Pratinjau = { ringkas: { ubah: number; sama: number; galat: number }; peringatan: string[]; hasil: Hasil[] };
type Usulan = { studentId: string; nama: string; kelas: string | null; jurusan: string; mitraId: string; dudi: string; alasan: string };
type Saran = { belum: number; usulan: Usulan[]; tanpa: { nama: string; kelas: string | null; sebab: string }[]; dudiBerkuota: number };

/** Dua alat bantu Penempatan (9 Okt 2026): IMPOR dari Excel (pratinjau dulu, baru terapkan) dan SARAN penempatan otomatis
 *  untuk siswa yang belum dapat DUDI. Keduanya hanya mengusulkan — yang tersimpan hanya yang ditekan Terapkan. */
export default function AlatPenempatanPkl({ onSelesai }: { onSelesai: () => void }) {
  const toast = useToast();
  const [impor, setImpor] = useState(false);
  const [saran, setSaran] = useState(false);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [pra, setPra] = useState<Pratinjau | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [dataSaran, setDataSaran] = useState<Saran | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const isian = useRef<HTMLInputElement>(null);

  async function kirimBerkas(f: File, terapkan: boolean) {
    setSibuk(true);
    try {
      const fd = new FormData(); fd.append("file", f); if (terapkan) fd.append("terapkan", "1");
      const r = await fetch("/api/pkl/penempatan/impor", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error ?? "Gagal membaca berkas."); return; }
      if (terapkan) { toast.success(`${j.ringkas.ubah} siswa diperbarui dari Excel.`); setImpor(false); setBerkas(null); setPra(null); onSelesai(); }
      else setPra(j);
    } catch { toast.error("Gagal mengirim berkas."); } finally { setSibuk(false); }
  }
  useEffect(() => {
    if (!saran) return;
    let batal = false;
    fetch("/api/pkl/penempatan/saran").then(r => r.json()).then((j: Saran & { error?: string }) => { if (batal) return; if (j.error) toast.error(j.error); else { setDataSaran(j); setPilih(new Set(j.usulan.map(u => u.studentId))); } }).catch(() => { if (!batal) toast.error("Gagal menyusun saran."); });
    return () => { batal = true; };
  }, [saran, toast]);
  async function terapkanSaran() {
    if (!dataSaran) return;
    const perDudi = new Map<string, string[]>();
    for (const u of dataSaran.usulan) if (pilih.has(u.studentId)) perDudi.set(u.mitraId, [...(perDudi.get(u.mitraId) ?? []), u.studentId]);
    setSibuk(true);
    let ok = 0; const gagal: string[] = [];
    for (const [mitraId, studentIds] of perDudi) {
      const r = await fetch("/api/pkl/penempatan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentIds, mitraId }) }).catch(() => null);
      const j = await r?.json().catch(() => ({}));
      if (r?.ok) ok += studentIds.length; else gagal.push(j?.peringatan?.join("; ") ?? j?.error ?? "gagal");
    }
    setSibuk(false);
    if (ok) toast.success(`${ok} siswa ditempatkan.`);
    if (gagal.length) toast.error(`Sebagian tidak diterapkan: ${gagal[0]}`);
    setSaran(false); setDataSaran(null); onSelesai();
  }
  const WARNA = { UBAH: "bg-emerald-50 text-emerald-700 border-emerald-200", GALAT: "bg-red-50 text-red-600 border-red-200", SAMA: "bg-gray-50 text-gray-500 border-gray-200" };
  return (
    <>
      <button type="button" className="btn-modal-cancel btn-teks" onClick={() => setSaran(true)}><Sparkles size={16} /> Saran Penempatan</button>
      <button type="button" className="btn-modal-cancel btn-teks" onClick={() => setImpor(true)}><FileSpreadsheet size={16} /> Impor Excel</button>

      <Modal open={impor} onClose={() => { setImpor(false); setPra(null); setBerkas(null); }} title="Impor Penempatan dari Excel" description="Pratinjau dulu, baru diterapkan" size="lg" scrollBody
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => { setImpor(false); setPra(null); setBerkas(null); }}>Tutup</button>
          {pra && berkas && <button type="button" className="btn-modal-save" disabled={sibuk || !pra.ringkas.ubah} onClick={() => kirimBerkas(berkas, true)}>{sibuk && <Loader2 size={14} className="animate-spin" />} Terapkan {pra.ringkas.ubah} Perubahan</button>}</>}>
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>Unduh template — sudah berisi seluruh peserta PKL dengan datanya sekarang.</li>
            <li>Isi kolom DUDI dan Guru Pembimbing dengan nama yang disalin persis dari sheet Daftar DUDI / Daftar Guru. Sel yang dikosongkan tidak diubah.</li>
            <li>Unggah kembali. Tidak ada yang tersimpan sebelum tombol Terapkan ditekan.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <a href="/api/pkl/penempatan/impor" className="btn-modal-cancel"><Download size={16} /> Unduh Template</a>
            <button type="button" className="btn-modal-save" disabled={sibuk} onClick={() => isian.current?.click()}>{sibuk && !pra ? <Loader2 size={14} className="animate-spin" /> : <Upload size={16} />} Pilih Berkas</button>
            <input ref={isian} type="file" accept=".xlsx" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setBerkas(f); setPra(null); void kirimBerkas(f, false); } }} />
          </div>
          {pra && (
            <>
              <p className="text-sm text-gray-700"><span className="angka font-semibold text-emerald-700">{pra.ringkas.ubah}</span> akan diubah · <span className="angka font-semibold text-red-600">{pra.ringkas.galat}</span> ditolak · <span className="angka">{pra.ringkas.sama}</span> tidak berubah</p>
              {pra.peringatan.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><p className="font-semibold">Melebihi kuota (tetap bisa diterapkan):</p><ul className="mt-1 list-disc pl-5">{pra.peringatan.map(p => <li key={p}>{p}</li>)}</ul></div>}
              {pra.hasil.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="data-table">
                    <thead><tr><th className="w-10">Baris</th><th>Siswa</th><th>Hasil</th><th>Keterangan</th></tr></thead>
                    <tbody>{pra.hasil.map(h => (
                      <tr key={h.baris}><td className="angka">{h.baris}</td><td>{h.nama}<span className="angka block text-xs text-gray-400">{h.nis}</span></td>
                        <td><span className={`status-badge ${WARNA[h.status]}`}>{h.status === "UBAH" ? "Diubah" : "Ditolak"}</span></td><td className="text-gray-600">{h.ket}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal open={saran} onClose={() => { setSaran(false); setDataSaran(null); }} title="Saran Penempatan" description="Usulan untuk siswa yang belum dapat DUDI" size="lg" scrollBody
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => { setSaran(false); setDataSaran(null); }}>Tutup</button>
          {!!dataSaran?.usulan.length && <button type="button" className="btn-modal-save" disabled={sibuk || !pilih.size} onClick={terapkanSaran}>{sibuk && <Loader2 size={14} className="animate-spin" />} Tempatkan {pilih.size} Siswa</button>}</>}>
        {!dataSaran ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Dari <span className="angka font-semibold">{dataSaran.belum}</span> siswa yang belum dapat DUDI, <span className="angka font-semibold text-emerald-700">{dataSaran.usulan.length}</span> bisa diusulkan. Disusun dari jurusan yang diterima DUDI, sisa kuota, dan kecamatan rumah siswa. Lepas centang yang tidak sesuai.</p>
            {dataSaran.dudiBerkuota === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Belum ada DUDI aktif yang kuotanya diisi. Isi kuota di Data DUDI supaya saran bisa disusun.</p>}
            {dataSaran.usulan.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="data-table">
                  <thead><tr><th className="w-10"><input type="checkbox" aria-label="Pilih semua" checked={pilih.size === dataSaran.usulan.length} onChange={e => setPilih(e.target.checked ? new Set(dataSaran.usulan.map(u => u.studentId)) : new Set())} /></th><th>Siswa</th><th>Usulan DUDI</th><th>Alasan</th></tr></thead>
                  <tbody>{dataSaran.usulan.map(u => (
                    <tr key={u.studentId}>
                      <td><input type="checkbox" aria-label={`Pilih ${u.nama}`} checked={pilih.has(u.studentId)} onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(u.studentId); else n.delete(u.studentId); return n; })} /></td>
                      <td>{u.nama}<span className="block text-xs text-gray-400">{u.kelas ?? "—"}</span></td><td className="font-medium text-primary-900">{u.dudi}</td><td className="text-xs text-gray-500">{u.alasan}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {dataSaran.tanpa.length > 0 && (
              <details className="rounded-xl border border-gray-100 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-gray-700">{dataSaran.tanpa.length} siswa belum bisa diusulkan</summary>
                <ul className="mt-2 space-y-1 text-gray-600">{dataSaran.tanpa.slice(0, 200).map((t, i) => <li key={i}>{t.nama} <span className="text-xs text-gray-400">· {t.kelas ?? "—"} · {t.sebab}</span></li>)}</ul>
              </details>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
