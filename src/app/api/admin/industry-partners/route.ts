import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const partners = await prisma.industryPartner.findMany({ orderBy: { name: "asc" } });
    return Response.json(partners);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const { name, address, contactPerson, contactPhone, industryField, mouStartDate, mouEndDate, mouDocumentUrl, quota, notes } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Nama perusahaan wajib diisi." }, { status: 400 });
    }
    const partner = await prisma.industryPartner.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        industryField: industryField?.trim() || null,
        mouStartDate: mouStartDate ? new Date(mouStartDate) : null,
        mouEndDate: mouEndDate ? new Date(mouEndDate) : null,
        mouDocumentUrl: mouDocumentUrl?.trim() || null,
        quota: quota ? parseInt(quota) : null,
        notes: notes?.trim() || null,
      },
    });
    return Response.json(partner);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan mitra industri." }, { status: 500 });
  }
}
