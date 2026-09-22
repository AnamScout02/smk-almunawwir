"use client";
import { useState } from "react";
import { Save, CheckCircle2, Loader2 } from "lucide-react";

type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "textarea" | "number" | "date" | "toggle3";
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
    desc: "Angka-angka yang tampil di bagian 'Dalam Angka' halaman beranda. Jumlah siswa aktif & jumlah jurusan sudah otomatis dari data Siswa/Jurusan, tidak perlu diisi manual.",
    fields: [
      { key: "stats.achievements", label: "Prestasi Nasional", type: "number", hint: 'Ditampilkan sebagai "50+"' },
      { key: "stats.graduation_rate", label: "Tingkat Kelulusan (%)", type: "number", hint: 'Ditampilkan sebagai "98%"' },
      { key: "stats.partners", label: "Mitra Industri", type: "number", hint: 'Ditampilkan sebagai "30+"' },
      { key: "stats.founded_year", label: "Tahun Berdiri", type: "number", hint: 'Tampil di deskripsi: "Berdiri sejak 2014" — lama berdiri dihitung otomatis dari tahun ini' },
    ],
  },
  {
    id: "facilities",
    label: "Fasilitas",
    desc: "Angka yang tampil di halaman Fasilitas — hanya untuk fakta fisik kampus yang tidak ada datanya di sistem. Koleksi Buku sudah otomatis dari data Perpustakaan.",
    fields: [
      { key: "facilities.labs", label: "Jumlah Laboratorium", type: "number" },
      { key: "facilities.dormitory_capacity", label: "Kapasitas Asrama", type: "number", hint: 'Ditampilkan sebagai "800+"' },
      { key: "facilities.campus_area", label: "Luas Kampus", type: "text", hint: 'Contoh: "10 Ha"' },
    ],
  },
  {
    id: "cta",
    label: "Banner CTA",
    desc: "Teks di bagian ajakan pendaftaran (Bergabunglah Bersama Kami).",
    fields: [
      { key: "cta.title", label: "Judul CTA", type: "text" },
      { key: "cta.ppdb_year", label: "Tahun Ajaran SPMB", type: "text", hint: 'Contoh: "2026/2027"' },
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
    desc: "Judul & paragraf slide pertama beranda (dipakai selama belum ada slide di menu Banner/Hero).",
    fields: [
      { key: "school.tagline", label: "Judul Slide Pertama Beranda", type: "text", hint: "Judul besar di beranda (bahasa Indonesia). Tidak dipakai bila sudah ada slide di menu Banner/Hero." },
      { key: "school.hero_subtitle", label: "Paragraf Slide Pertama Beranda", type: "textarea", hint: "Paragraf di bawah judul besar beranda (bahasa Indonesia). Tidak dipakai bila sudah ada slide di menu Banner/Hero." },
      { key: "school.struktur_year", label: "Tahun Ajaran (Struktur Pimpinan)", type: "text", hint: 'Tampil di halaman Tentang Kami. Contoh: "2025/2026"' },
    ],
  },
  {
    id: "keunggulan",
    label: "Keunggulan (Beranda)",
    desc: "Bagian \"Keunggulan Kami\" di beranda: judul dan 6 kartu (urutan kartu: Boarding, Vokasi, Guru, PKL, Fasilitas, Lingkungan). Bahasa Inggris memakai terjemahan bawaan.",
    fields: [
      { key: "why.label", label: "Label Kecil di Atas Judul", type: "text" },
      { key: "why.heading", label: "Judul Bagian", type: "text" },
      { key: "why.sub", label: "Kalimat Pengantar", type: "textarea" },
      { key: "why.1_title", label: "Kartu 1 — Judul", type: "text" },
      { key: "why.1_desc", label: "Kartu 1 — Keterangan", type: "textarea" },
      { key: "why.2_title", label: "Kartu 2 — Judul", type: "text" },
      { key: "why.2_desc", label: "Kartu 2 — Keterangan", type: "textarea" },
      { key: "why.3_title", label: "Kartu 3 — Judul", type: "text" },
      { key: "why.3_desc", label: "Kartu 3 — Keterangan", type: "textarea" },
      { key: "why.4_title", label: "Kartu 4 — Judul", type: "text" },
      { key: "why.4_desc", label: "Kartu 4 — Keterangan", type: "textarea" },
      { key: "why.5_title", label: "Kartu 5 — Judul", type: "text" },
      { key: "why.5_desc", label: "Kartu 5 — Keterangan", type: "textarea" },
      { key: "why.6_title", label: "Kartu 6 — Judul", type: "text" },
      { key: "why.6_desc", label: "Kartu 6 — Keterangan", type: "textarea" },
    ],
  },
  {
    id: "admissions",
    label: "Pendaftaran (SPMB)",
    desc: "Tanggal buka/tutup dan kuota pendaftaran yang tampil di halaman Pendaftaran.",
    fields: [
      { key: "admissions.open_date", label: "Tanggal Buka Pendaftaran", type: "date" },
      { key: "admissions.close_date", label: "Tanggal Tutup Pendaftaran", type: "date" },
      { key: "admissions.quota", label: "Kuota Siswa Baru", type: "number", hint: 'Ditampilkan sebagai "200 Siswa"' },
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
        key: "islamic.login_arabic",
        label: "Ayat Halaman Login (Arab)",
        type: "text",
        dir: "rtl",
        fontArabic: true,
        hint: "Teks Arab besar di panel kiri halaman Masuk (Login).",
      },
      { key: "islamic.login_label", label: "Keterangan di Bawah Ayat Login", type: "text", hint: 'Contoh: "Iqra\' Bismi Rabbik"' },
      {
        key: "islamic.quote1_arabic",
        label: "Kutipan 1 — Teks Arab",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
        hint: "Tampil di halaman Tentang Kami (bagian bawah).",
      },
      { key: "islamic.quote1_trans", label: "Kutipan 1 — Terjemahan", type: "textarea" },
      { key: "islamic.quote1_source", label: "Kutipan 1 — Sumber", type: "text", hint: 'Contoh: "QS. Al-Alaq: 1"' },
      {
        key: "islamic.quote2_arabic",
        label: "Kutipan 2 — Teks Arab",
        hint: "Tampil di Beranda, di bawah bagian Keunggulan Kami.",
        type: "textarea",
        dir: "rtl",
        fontArabic: true,
      },
      { key: "islamic.quote2_trans", label: "Kutipan 2 — Terjemahan", type: "textarea" },
      { key: "islamic.quote2_source", label: "Kutipan 2 — Sumber", type: "text" },
      {
        key: "islamic.quote3_arabic",
        label: "Kutipan 3 — Teks Arab",
        hint: "Cadangan — saat ini belum ditampilkan di halaman mana pun.",
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
    label: "Form SPMB",
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
                      className={`flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none${field.fontArabic ? " font-arabic text-xl leading-loose" : ""}`}
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      dir={field.dir}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className={`flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-primary-300${field.fontArabic ? " font-arabic text-xl" : ""}`}
                    />
                  )}
                  <button
                    onClick={() => handleSave(field.key)}
                    disabled={saving === field.key}
                    className={`shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      saved === field.key
                        ? "bg-emerald-500 text-white"
                        : "bg-primary-700 text-white hover:bg-primary-900"
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
