import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { susunKonfigSeb } from "@/lib/seb-konfig";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Unduh berkas Safe Exam Browser (.seb) untuk komputer lab — pengatur ujian saja, karena berkasnya
 *  memuat hash sandi keluar. Sandi keluar = PIN keluar aplikasi ujian (`ujian.pinAplikasi`). */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json({ error: "Khusus pengatur ujian." }, { status: 403 });
    const s = await getSettings(["ujian.pinAplikasi"]);
    if (!s["ujian.pinAplikasi"]) return Response.json({ error: "Isi PIN keluar dulu — PIN itu menjadi sandi keluar Safe Exam Browser." }, { status: 400 });
    const { xml } = susunKonfigSeb(s["ujian.pinAplikasi"]);
    await logActivity(session, { action: "EXPORT", entity: "SiteSetting", description: "Mengunduh berkas konfigurasi Safe Exam Browser" }).catch(() => {});
    return new Response(xml, {
      headers: {
        "Content-Type": "application/seb",
        "Content-Disposition": 'attachment; filename="ujian-smk-almunawwir.seb"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyusun berkas." }, { status: 500 });
  }
}
