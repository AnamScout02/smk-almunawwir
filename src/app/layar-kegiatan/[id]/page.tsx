export const dynamic = "force-dynamic";

import { verifySession } from "@/lib/dal";
import LayarQrKegiatan from "@/components/kegiatan/LayarQrKegiatan";

export const metadata = { title: "QR Presensi Kegiatan" };

/** Layar QR tanpa sidebar — dibuka di laptop yang tersambung proyektor/TV. Hak dicek API /api/kegiatan/[id]/qr. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, s] = await Promise.all([params, verifySession()]);
  return <LayarQrKegiatan id={id} kembaliHref={s.role === "TEACHER" ? "/dashboard/teacher/kegiatan" : "/dashboard/admin/kegiatan"} />;
}
