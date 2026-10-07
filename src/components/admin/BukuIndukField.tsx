"use client";
import { bakuNamaSekolah } from "@/lib/nama-sekolah";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";
import { toProperCase } from "@/lib/text";

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  wide?: boolean;
  options?: string[] | { value: string; label: string }[];
  min?: number;
  max?: number;
  maxLen?: number;
  readOnly?: boolean;
  placeholder?: string;
  /** id `<datalist>` eksternal (dirender oleh pemanggil) — kalau diisi, input teks biasa jadi
   * combobox: saran otomatis dari data yang sudah pernah diinput, TAPI tetap bisa diketik bebas
   * kalau belum ada di daftar. Pola sama seperti "Asal Sekolah" — dipakai jg utk "Tempat Lahir". */
  list?: string;
  /** Keterangan kecil di bawah isian. */
  hint?: string;
  /**
   * Perlakuan huruf saat isian kehilangan fokus:
   * - `"proper"` (bawaan) — Proper Case, untuk nama orang, alamat, dan teks bebas.
   * - `"sekolah"` — Proper Case yang mempertahankan singkatan jenjang (SMA, SMK, MTs, SMKN…).
   * - `"asli"` — **dibiarkan persis seperti diketik**. WAJIB untuk isian berupa KODE: nomor surat,
   *   nomor ijazah, NIS/NISN sekolah lama, SKHUN, koordinat. Dulu SEMUA isian teks dipaksa Proper
   *   Case tanpa terkecuali, sehingga "450/B.6/SMK_AM-IIBS/026/IX/2026" berubah jadi
   *   "450/B.6/Smk_am-Iibs/026/Ix/2026" begitu kursor pindah (laporan user 29 September 2026).
   */
  kapital?: "proper" | "sekolah" | "asli";
}

export default function Field({
  label, value, onChange, type = "text", wide = false,
  options, min, max, maxLen, readOnly, placeholder, list, hint, kapital = "proper",
}: FieldProps) {
  const rapikan = (v: string) =>
    kapital === "asli" ? v : kapital === "sekolah" ? bakuNamaSekolah(v) : toProperCase(v);
  const cls = `input-field ${readOnly ? "bg-gray-50 text-gray-500 cursor-default" : ""}`;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="label-field">{label}</label>
      {options ? (
        <Select
          value={value}
          onChange={onChange}
          options={options.map(o => typeof o === "string" ? { value: o, label: o } : o)}
          placeholder={placeholder ?? "— Pilih —"}
          disabled={readOnly}
        />
      ) : type === "textarea" ? (
        <textarea className={`${cls} resize-none`} rows={2} value={value}
          onChange={e => onChange(e.target.value)} readOnly={readOnly} placeholder={placeholder} />
      ) : type === "tel" ? (
        <input className={cls} type="tel" inputMode="numeric" pattern="[0-9]*"
          placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, ""))} readOnly={readOnly} />
      ) : type === "nik" ? (
        <>
          <input className={cls} type="text" inputMode="numeric"
            pattern={`[0-9]{${maxLen ?? 16}}`} maxLength={maxLen ?? 16}
            placeholder={`${maxLen ?? 16} digit`} value={value}
            onChange={e => onChange(e.target.value.replace(/\D/g, ""))} readOnly={readOnly} />
          {!readOnly && value.length > 0 && value.length !== (maxLen ?? 16) && (
            <p className="text-xs text-amber-600 mt-1">Harus {maxLen ?? 16} digit (baru {value.length})</p>
          )}
        </>
      ) : type === "number" ? (
        <input className={cls} type="number" min={min} max={max} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly} />
      ) : type === "date" ? (
        <DatePicker value={value} onChange={onChange} disabled={readOnly} />
      ) : (
        <input className={cls} type={type} maxLength={maxLen} placeholder={placeholder} list={list}
          value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
          onBlur={e => { if (!readOnly && kapital !== "asli" && e.target.value) onChange(rapikan(e.target.value)); }} />
      )}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
