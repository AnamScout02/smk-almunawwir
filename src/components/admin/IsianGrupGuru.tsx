"use client";
import Field from "@/components/admin/BukuIndukField";
import { GURU_COLUMNS } from "@/lib/buku-induk-guru-columns";

/** Merender SEMUA isian `bukuIndukData` milik satu grup GURU_COLUMNS. Satu sumber untuk formulir
 *  Buku Induk Guru (TU) dan formulir "Biodata Saya" pegawai — supaya kunci, label, dan jenis
 *  isiannya tidak pernah berbeda di kedua tempat. */
export default function IsianGrupGuru({ grup, e, setE }: {
  grup: string;
  e: (k: string) => string;
  setE: (k: string) => (v: string) => void;
}) {
  return (
    <>
      {GURU_COLUMNS.filter(c => c.isian && c.group === grup).map(c => (
        <Field key={c.key} label={c.label} value={e(c.key)}
          type={c.isian?.tipe === "date" ? "date" : c.isian?.tipe === "textarea" ? "textarea" : "text"}
          wide={c.isian?.tipe === "textarea"}
          options={c.isian?.opsi}
          onChange={setE(c.key)} />
      ))}
    </>
  );
}
