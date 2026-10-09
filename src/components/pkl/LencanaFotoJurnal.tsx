import { ShieldCheck, ImageIcon } from "lucide-react";

/** Tanda di jurnal PKL: foto diambil dari kamera di halaman (dicap waktu server) atau diunggah dari galeri. */
export default function LencanaFotoJurnal({ ada, terverifikasi, waktu, lokasi }: { ada: boolean; terverifikasi: boolean; waktu?: string | null; lokasi?: boolean }) {
  if (!ada) return null;
  if (!terverifikasi) return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400"><ImageIcon size={12} /> foto dari galeri — waktu tidak terverifikasi</span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
      <ShieldCheck size={12} /> foto kamera{waktu ? ` · ${new Date(waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB` : ""}{lokasi ? " · berlokasi" : ""}
    </span>
  );
}
