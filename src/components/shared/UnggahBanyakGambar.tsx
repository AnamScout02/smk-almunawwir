"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

/** Unggah BEBERAPA gambar sekali pilih (2 Oktober 2026, temuan user: "upload poster masih single,
 *  dan belum bisa upload lebih dari 1"). `ImageUpload` sengaja TIDAK diubah — komponen itu dipakai
 *  belasan tempat untuk satu gambar tunggal (logo, banner, foto profil) dan menambahkan `multiple`
 *  di sana akan mengubah perilaku semuanya.
 *
 *  Berkas diunggah SATU PER SATU, bukan serentak: jaringan sekolah sering lambat dan unggahan
 *  paralel justru saling memperlambat sampai time out. Yang gagal dilaporkan per nama berkas,
 *  yang berhasil tetap tersimpan — satu berkas rusak tidak menggagalkan sisanya. */
export default function UnggahBanyakGambar({ folder, label = "Tambah gambar", hint, maks = 12, onSelesai }: {
  folder: string;
  label?: string;
  hint?: string;
  /** Batas berkas dalam SEKALI pilih — penjaga salah pilih "Select All" di galeri HP. */
  maks?: number;
  /** Dipanggil SEKALI dengan seluruh alamat yang berhasil diunggah. */
  onSelesai: (alamat: string[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kemajuan, setKemajuan] = useState({ ke: 0, dari: 0 });
  const [galat, setGalat] = useState<string[]>([]);

  async function pilih(berkas: FileList | null) {
    if (!berkas?.length) return;
    const daftar = Array.from(berkas).slice(0, maks);
    const lebih = berkas.length - daftar.length;
    setGalat([]);
    setSibuk(true);
    const berhasil: string[] = [];
    const gagal: string[] = [];

    for (let i = 0; i < daftar.length; i++) {
      const f = daftar[i];
      setKemajuan({ ke: i + 1, dari: daftar.length });
      if (f.size > 5 * 1024 * 1024) { gagal.push(`${f.name} — lebih dari 5MB`); continue; }
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("folder", folder);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await r.json().catch(() => null);
        if (r.ok && d?.url) berhasil.push(d.url);
        else gagal.push(`${f.name} — ${d?.error ?? "gagal diunggah"}`);
      } catch {
        gagal.push(`${f.name} — koneksi terputus`);
      }
    }

    setSibuk(false);
    setKemajuan({ ke: 0, dari: 0 });
    if (lebih > 0) gagal.push(`${lebih} berkas lain tidak ikut — maksimal ${maks} sekali pilih`);
    setGalat(gagal);
    if (ref.current) ref.current.value = "";   // supaya berkas yang sama bisa dipilih lagi
    if (berhasil.length) onSelesai(berhasil);
  }

  return (
    <div>
      <button type="button" disabled={sibuk} onClick={() => ref.current?.click()} className="btn-modal-cancel w-full">
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {sibuk ? `Mengunggah ${kemajuan.ke} dari ${kemajuan.dari}…` : label}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => pilih(e.target.files)} />
      {hint && !sibuk && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {galat.length > 0 && (
        <ul className="mt-2 space-y-1">
          {galat.map(g => <li key={g} className="text-xs font-medium text-red-600">{g}</li>)}
        </ul>
      )}
    </div>
  );
}
