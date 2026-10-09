import "server-only";
import { tanggalDari } from "@/lib/pkl-server";

const teks = (v: unknown, maks = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, maks) : null);
const angka = (v: unknown) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? null : n; };
const daftar = (v: unknown, maks = 40) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string").map(x => x.trim()).filter(Boolean))].slice(0, maks) : []);

/** Isian DUDI dari badan permintaan — dipakai POST & PUT supaya keduanya tidak pernah berbeda. */
export function isianDudi(b: Record<string, unknown>) {
  const lat = angka(b.lat), lng = angka(b.lng);
  const kuota = angka(b.quota);
  return {
    name: teks(b.name, 160) ?? "",
    address: teks(b.address, 500), kabupaten: teks(b.kabupaten, 80), kecamatan: teks(b.kecamatan, 80),
    // Titik di luar Indonesia hampir pasti salah ketik (lintang/bujur tertukar) — dibuang, bukan disimpan.
    lat: lat != null && lng != null && lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141 ? lat : null,
    lng: lat != null && lng != null && lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141 ? lng : null,
    industryField: teks(b.industryField, 120), pimpinan: teks(b.pimpinan, 120), pimpinanJabatan: teks(b.pimpinanJabatan, 80),
    contactPerson: teks(b.contactPerson, 120), contactPhone: teks(b.contactPhone, 40), email: teks(b.email, 120), website: teks(b.website, 200),
    mouStartDate: tanggalDari(b.mouStartDate), mouEndDate: tanggalDari(b.mouEndDate), mouDocumentUrl: teks(b.mouDocumentUrl, 300),
    quota: kuota != null && kuota >= 0 ? Math.min(999, Math.round(kuota)) : null,
    jurusanIds: daftar(b.jurusanIds, 20), pekerjaan: daftar(b.pekerjaan, 40).map(x => x.slice(0, 80)),
    fasilitas: teks(b.fasilitas, 500), jamKerja: teks(b.jamKerja, 120), notes: teks(b.notes, 1000),
    aktif: b.aktif !== false, calonPemberiKerja: b.calonPemberiKerja === true,
    // Hanya alamat unggahan situs sendiri — bukan tautan gambar luar yang bisa diganti pemiliknya kapan saja.
    logoUrl: typeof b.logoUrl === "string" && /^\/(api\/)?uploads\/mitra-industri\//.test(b.logoUrl) ? b.logoUrl : null,
    tampilPublik: b.tampilPublik !== false,
  };
}

