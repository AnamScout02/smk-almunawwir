"use client";
import NotificationBell from "@/components/shared/NotificationBell";

interface AdminTopBarProps {
  unreadMessages?: number;
  pendingAdmissions?: number;
  pendingProfileEdits?: number;
  overdueBooks?: number;
}

/** Lonceng notifikasi mengambang di pojok kanan-atas, DI ATAS PageHeader tiap halaman (bukan
 * strip/blok warna sendiri) — wrapper-nya sengaja tinggi 0 (tidak makan ruang layout) supaya
 * PageHeader setiap halaman tetap mulai persis dari y=0, tidak ada "space" terpisah di atasnya. */
export default function AdminTopBar({ unreadMessages = 0, pendingAdmissions = 0, pendingProfileEdits = 0, overdueBooks = 0 }: AdminTopBarProps) {
  const notifications = [
    { label: "Pesan masuk belum dibaca", count: unreadMessages, href: "/dashboard/admin/messages" },
    { label: "Pendaftaran PPDB baru", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
    { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
  ];

  return (
    <div className="hidden lg:block sticky top-0 z-40 print:hidden" style={{ height: 0 }}>
      <div className="absolute top-3 right-6">
        <NotificationBell items={notifications} variant="dark" />
      </div>
    </div>
  );
}
