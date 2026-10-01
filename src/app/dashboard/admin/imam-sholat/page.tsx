import ImamSholatManager from "@/components/shared/ImamSholatManager";

/* Presensi imam dicek di Buku Piket portal INI — jangan menautkan portal guru ke rute admin
   (CLAUDE.md #45: layout admin menolak guru tanpa jabatan TU). */
export default function Page() {
  return <ImamSholatManager bukuPiketHref="/dashboard/admin/kedisiplinan-guru" />;
}
