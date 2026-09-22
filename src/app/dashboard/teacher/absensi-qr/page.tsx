import LayarQrAbsensi from "@/components/shared/LayarQrAbsensi";

// Petugas piket hari ini (gerbang & semua kelas) dan wali kelas (kelas walinya) — hak akses dicek /api/absensi-qr/layar.
export default function GuruLayarQrAbsensiPage() {
  return <LayarQrAbsensi backHref="/dashboard/teacher" />;
}
