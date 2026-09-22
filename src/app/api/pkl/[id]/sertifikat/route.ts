import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPkl, nomorSertifikatBerikutnya } from "@/lib/pkl-humas";

export const dynamic = "force-dynamic";

/** Terbitkan nomor & token QR keaslian sertifikat PKL (sekali; berikutnya dipakai ulang). */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  const pkl = await aksesPkl(session, id);
  if (!pkl) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  if (pkl.sertifikatNomor) return Response.json({ nomor: pkl.sertifikatNomor });
  const tahun = new Date(pkl.endDate.getTime() + 7 * 3600_000).getUTCFullYear();
  for (let coba = 0; coba < 3; coba++) {
    try {
      const nomor = await nomorSertifikatBerikutnya(tahun);
      await prisma.internship.update({ where: { id }, data: { sertifikatNomor: nomor, sertifikatToken: randomBytes(18).toString("base64url"), sertifikatPada: new Date() } });
      return Response.json({ nomor });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  return Response.json({ error: "Gagal menerbitkan nomor, coba lagi." }, { status: 409 });
}
