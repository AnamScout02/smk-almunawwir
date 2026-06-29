"use client";
import { useState } from "react";
import { Save, CheckCircle2, Loader2 } from "lucide-react";

type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "textarea" | "number" | "toggle3";
  dir?: "rtl";
  fontArabic?: boolean;
};

type Section = {
  id: string;
  label: string;
  desc: string;
  fields: FieldDef[];
};

const SECTIONS: Section[] = [
  {
    id: "stats",
    label: "Statistik",
    desc: "Angka-angka yang tampil di bagian 'Dalam Angka' halaman beranda.",
    fields: [
      { key: "stats.students", label: "Jumlah Siswa Aktif", type: "number", hint: 'Ditampilkan sebagai "1200+"' },
      { key: "stats.achievements", label: "Prestasi Nasional", type: "number", hint: 'Ditampilkan sebagai "50+"' },
      { key: "stats.graduation_rate", label: "Tingkat Kelulusan (%)", type: "number", hint: 'Ditampilkan sebagai "98%"' },
      { key: "stats.years", label: "Lama Berdiri (tahun)", type: "number", hint: "Hitung dari 2014 ke tahun sekarang" },
      { key: "stats.partners", label: "Mitra Industri", type: "number", hint: 'Ditampilkan sebagai "30+"' },
      { key: "stats.founded_year", label: "Tahun Berdiri", type: "number", hint: 'Tampil di deskripsi: "Berdiri sejak 2014"' },
    ],
  },
  {
    id: "cta",
    label: "Banner CTA",
    desc: "Teks di bagian ajakan pendaftaran (Bergabunglah Bersama Kami).",
    fields: [
      { key: "cta.title", label: "Judul CTA", type: "text" },
      { key: "cta.ppdb_year", label: "Tahun Ajaran PPDB", type: "text", hint: 'Contoh: "2026/2027"' },
      { key: "cta.subtitle", label: "Teks Keterangan CTA", type: "textarea" },
      { key: "cta.sub_note", label: "Catatan Kecil di Bawah Tombol", type: "text", hint: 'Contoh: "Kuota terbatas · Tersedia beasiswa prestasi & tahfidz"' },
    ],
  },
  {
    id: "contact",
    label: "Info Kontak",
    desc: "Informasi kontak yang tampil di footer, halaman Kontak, dan seluruh website.",
    fields: [
      { key: "contact.phone", label: "Nomor Telepon / WhatsApp", type: "text", hint: "Format: 0838-7820-3670" },
      { key: "contact.email", label: "Alamat Email", type: "text" },
      { key: "contact.address", label: "Alamat Lengkap", type: "textarea" },
      { key: "contact.hours_main", label: "Jam Operasional (Utama)", type: "text", hint: 'Contoh: "Sen–Kam & Sab: 06.45–14.00"' },
      { key: "contact.hours_friday", label: "Jam Operasional (Jumat)", type: "text", hint: 'Contoh: "Jumat: 06.45–13.00"' },
    ],
  },
  {
    id: "school",
    label: "Info Sekolah",
    desc: "Tagline dan teks hero yang tampil di halaman utama.",
    fields: [
      { key: "school.tagline", label: "Tagline / Slogan Sekolah", type: "text", hint: 'Tampil di hero section beranda' },
      { key: "school.hero_subtitle", label: "Subtitle Hero Beranda", type: "textarea", hint: "Paragraf singkat di bawah tagline hero" },
    ],
  },
  {
    id: "islamic",
    label: "Ayat & Hadis",
    desc: "Teks Arab, terjemahan, dan sumber kutipan yang tampil di berbagai halaman website.",
    fields: [
      {
        key: "islamic.cta_arabic",
        label: "Ayat Banner CTA (Arab)",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
        hint: "Tampil di bagian ajakan pendaftaran. Ketik atau paste teks Arab.",
      },
      {
        key: "islamic.cta_trans",
        label: "Terjemahan Ayat CTA",
        type: "textarea",
        hint: 'Terjemahan Indonesia. Contoh: "Dan barangsiapa bertakwa kepada Allah..."',
      },
      {
        key: "islamic.cta_source",
        label: "Sumber Ayat CTA",
        type: "text",
        hint: 'Contoh: "QS. Ath-Thalaq: 2"',
      },
      {
        key: "islamic.footer_arabic",
        label: "Motto Arab di Footer",
        type: "text",
        dir: "rtl",
        fontArabic: true,
        hint: 'Tampil di footer di bawah logo. Contoh: "النور يهدي إلى النور"',
      },
      {
        key: "islamic.quote1_arabic",
        label: "Kutipan 1 — Teks Arab",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
        hint: "Kutipan pertama di dashboard guru/siswa.",
      },
      { key: "islamic.quote1_trans", label: "Kutipan 1 — Terjemahan", type: "textarea" },
      { key: "islamic.quote1_source", label: "Kutipan 1 — Sumber", type: "text", hint: 'Contoh: "QS. Al-Alaq: 1"' },
      {
        key: "islamic.quote2_arabic",
        label: "Kutipan 2 — Teks Arab",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
      },
      { key: "islamic.quote2_trans", label: "Kutipan 2 — Terjemahan", type: "textarea" },
      { key: "islamic.quote2_source", label: "Kutipan 2 — Sumber", type: "text" },
      {
        key: "islamic.quote3_arabic",
        label: "Kutipan 3 — Teks Arab",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
      },
      { key: "islamic.quote3_trans", label: "Kutipan 3 — Terjemahan", type: "textarea" },
      { key: "islamic.quote3_source", label: "Kutipan 3 — Sumber", type: "text" },
    ],
  },
  {
    id: "form",
    label: "Form PPDB",
    desc: "Atur mana field dan dokumen yang wajib diisi, opsional, atau disembunyikan di formulir pendaftaran.",
    fields: [
      { key: "form.require_nik", label: "NIK (Nomor Induk Keluarga)", type: "toggle3" },
      { key: "form.require_nisn", label: "NISN", type: "toggle3" },
      { key: "form.require_address", label: "Alamat Lengkap", type: "toggle3" },
      { key: "form.require_guardian", label: "Nama Wali", type: "toggle3" },
      { key: "form.require_ijazah", label: "Upload Ijazah / SKL", type: "toggle3" },
      { key: "form.require_kk", label: "Upload Kartu Keluarga (KK)", type: "toggle3" },
      { key: "form.require_ktp_wali", label: "Upload KTP Orang Tua / Wali", type: "toggle3" },
      { key: "form.require_foto", label: "Upload Pas Foto (3×4)", type: "toggle3" },
      { key: "form.require_dokumen_lain", label: "Upload Dokumen Lain", type: "toggle3" },
    ],
  },
];

export default function ContentEditor({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [activeTab, setActiveTab] = useState("stats");
  const [values, setValues] = useState<Record<string, string>>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] ?? "" }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      setError(`Gagal menyimpan "${key}"`);
    } finally {
      setSaving(null);
    }
  }

  const activeSection = SECTIONS.find((s) => s.id === activeTab)!;

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === s.id
                ? "bg-primary-700 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-primary-50 border border-gray-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <p className="text-gray-400 text-sm mb-6 pb-5 border-b border-gray-100">
          {activeSection.desc}
        </p>
        <div className="space-y-6">
          {activeSection.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-navy mb-1">
                {field.label}
              </label>
              {field.hint && (
                <p className="text-xs text-gray-400 mb-2">{field.hint}</p>
              )}
              {field.type === "toggle3" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { val: "1", label: "Wajib", cls: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200" },
                    { val: "0", label: "Opsional", cls: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" },
                    { val: "off", label: "Sembunyikan", cls: "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200" },
                  ].map(({ val, label, cls }) => {
                    const isActive = (values[field.key] ?? "1") === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setValues((prev) => ({ ...prev, [field.key]: val }));
                          handleSave(field.key);
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                          isActive
                            ? cls + " ring-2 ring-offset-1 ring-current"
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"
                        }`}
                      >
                        {saving === field.key && isActive ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                        {label}
                        {saved === field.key && isActive && <CheckCircle2 size={13} className="inline ml-1" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-3 items-start">
                  {field.type === "textarea" ? (
                    <textarea
                      rows={field.dir === "rtl" ? 4 : 3}
                      dir={field.dir}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className={`flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none${field.fontArabic ? " font-arabic text-xl leading-loose" : ""}`}
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      dir={field.dir}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className={`flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary-300${field.fontArabic ? " font-arabic text-xl" : ""}`}
                    />
                  )}
                  <button
                    onClick={() => handleSave(field.key)}
                    disabled={saving === field.key}
                    className={`shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      saved === field.key
                        ? "bg-emerald-500 text-white"
                        : "bg-primary-700 text-white hover:bg-primary-800"
                    } disabled:opacity-60`}
                  >
                    {saving === field.key ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : saved === field.key ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Save size={15} />
                    )}
                    {saving === field.key ? "..." : saved === field.key ? "Tersimpan" : "Simpan"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
