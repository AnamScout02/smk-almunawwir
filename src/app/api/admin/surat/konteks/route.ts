import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Nilai yang SELALU sama untuk semua surat — diisi otomatis ke template, tidak perlu diketik:
 * nama kepala sekolah dan tahun pelajaran aktif. */
export async function GET() {
  try {
    await verifyTasAccess();
    const [settings, tahun] = await Promise.all([
      getSettings(["school.structure"]),
      prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    ]);
    return Response.json({
      kepalaSekolah: getPrincipalName(settings["school.structure"]) || "",
      tahunPelajaran: tahun?.name ?? "",
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ kepalaSekolah: "", tahunPelajaran: "" });
  }
}
