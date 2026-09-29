import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const list = await prisma.pklRegistration.findMany({
      where: status ? { status } : undefined,
      include: {
        student: {
          select: {
            nis: true, user: { select: { name: true } },
            class: { select: { name: true } }, major: { select: { name: true } },
          },
        },
        documents: { include: { requirement: { select: { name: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json(list);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
