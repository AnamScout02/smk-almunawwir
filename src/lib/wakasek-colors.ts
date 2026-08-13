// Warna tetap per jabatan Wakil Kepala — dipakai buat bedain agenda tiap Wakasek di kalender
// (AgendaCalendar). Sama pola dengan colorForTeacherCode di teacher-colors.ts: daftar tetap utk
// jabatan yang sudah dikenal, fallback rumus golden-angle kalau ada jabatan "Wakil Kepala *" baru
// yang belum masuk daftar (supaya tetap dapat warna unik, bukan abu-abu generik semua).
const WAKASEK_COLOR_HEX: Record<string, string> = {
  "Wakil Kepala Kurikulum": "#2563EB",
  "Wakil Kepala Kesiswaan": "#DB2777",
  "Wakil Kepala Sarana Prasarana": "#D97706",
  "Wakil Kepala Humas": "#059669",
  "Wakil Kepala Bidang Penjamin Mutu": "#7C3AED",
};

export function colorForJabatan(name: string): string {
  const fixed = WAKASEK_COLOR_HEX[name];
  if (fixed) return fixed;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  const hue = (hash * 137.508) % 360;
  return `hsl(${hue}, 62%, 45%)`;
}
