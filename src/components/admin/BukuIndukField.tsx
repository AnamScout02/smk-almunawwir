"use client";
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
}

export default function Field({
  label, value, onChange, type = "text", wide = false,
  options, min, max, maxLen, readOnly, placeholder,
}: FieldProps) {
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
        <input className={cls} type={type} maxLength={maxLen} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
          onBlur={e => { if (!readOnly && e.target.value) onChange(toProperCase(e.target.value)); }} />
      )}
    </div>
  );
}
