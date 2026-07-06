"use client";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  wide?: boolean;
  options?: string[];
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
          options={options.map(o => ({ value: o, label: o }))}
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
        <input className={cls} type="text" inputMode="numeric"
          pattern={`[0-9]{${maxLen ?? 16}}`} maxLength={maxLen ?? 16}
          placeholder={`${maxLen ?? 16} digit`} value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, ""))} readOnly={readOnly} />
      ) : type === "number" ? (
        <input className={cls} type="number" min={min} max={max} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly} />
      ) : type === "date" ? (
        <DatePicker value={value} onChange={onChange} disabled={readOnly} />
      ) : (
        <input className={cls} type={type} maxLength={maxLen} placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly} />
      )}
    </div>
  );
}
