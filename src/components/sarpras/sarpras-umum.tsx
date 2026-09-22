"use client";
import TimePicker from "@/components/shared/TimePicker";
import DatePicker from "@/components/shared/DatePicker";

/** Bagian bersama komponen Sarpras & Lab (17 Sep 2026). */
export const STATUS_PINJAM: Record<string, { label: string; kelas: string }> = {
  MENUNGGU: { label: "Menunggu persetujuan", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DISETUJUI: { label: "Disetujui", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DIPINJAM: { label: "Sedang dipakai", kelas: "bg-purple-50 text-purple-700 border-purple-200" },
  DIKEMBALIKAN: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITOLAK: { label: "Ditolak", kelas: "bg-red-50 text-red-600 border-red-200" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};
export const STATUS_RUSAK: Record<string, { label: string; kelas: string }> = {
  BELUM_DIPERBAIKI: { label: "Belum diperbaiki", kelas: "bg-red-50 text-red-600 border-red-200" },
  SEDANG_DIPERBAIKI: { label: "Sedang diperbaiki", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
export const PRIORITAS: Record<string, string> = { RENDAH: "Tidak mendesak", SEDANG: "Biasa", TINGGI: "Mendesak (mengganggu KBM/keselamatan)" };
export const KONDISI: Record<string, string> = { BAIK: "Baik", RUSAK_RINGAN: "Rusak ringan", RUSAK_BERAT: "Rusak berat" };

export const hariIniWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const keIso = (tanggal: string, jam: string) => `${tanggal}T${jam || "07:00"}:00+07:00`;
export const tgl = (s: string | Date, jam = false) => new Date(s).toLocaleString("id-ID", {
  weekday: jam ? "short" : undefined, day: "numeric", month: "short", year: jam ? undefined : "numeric",
  ...(jam ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Asia/Jakarta",
});
export const rentang = (a: string, b: string) => {
  const s1 = new Date(a), s2 = new Date(b);
  const hari = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return hari(s1) === hari(s2) ? `${tgl(a, true)}–${jam(s2)}` : `${tgl(a, true)} s/d ${tgl(b, true)}`;
};

/** Tanggal (kalender situs) + jam. */
export function WaktuPilih({ label, tanggal, jam, onTanggal, onJam, id }: { label: string; tanggal: string; jam: string; onTanggal: (v: string) => void; onJam: (v: string) => void; id: string }) {
  return (
    <div>
      <span className="label-field">{label}</span>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <DatePicker value={tanggal} onChange={onTanggal} />
        <TimePicker value={jam} onChange={v => onJam(v)} id={id} aria-label={`Jam ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}
