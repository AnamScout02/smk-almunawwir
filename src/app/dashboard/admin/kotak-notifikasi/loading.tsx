import { Bell, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

/** Rangka saat halaman notifikasi dimuat — tanpa ini Next menampilkan layar kosong selama
 * server menyiapkan datanya (temuan user 19 September 2026). */
export default function Loading() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Bell size={22} />} title="Notifikasi"
        description="Kabar, pengingat, dan pengumuman untuk akun Anda" />
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    </div>
  );
}
