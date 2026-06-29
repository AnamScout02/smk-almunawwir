import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 5) {
    return Response.json({ error: "Masukkan nomor WA atau email yang valid." }, { status: 400 });
  }

  try {
    const admission = await prisma.admission.findFirst({
      where: {
        OR: [
          { phone: { contains: q } },
          { email: { equals: q.toLowerCase() } },
        ],
      },
      select: {
        fullName: true,
        chosenMajor: true,
        status: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!admission) {
      return Response.json({ found: false });
    }

    const parts = admission.fullName.trim().split(" ");
    const maskedName = parts
      .map((p, i) =>
        i === 0
          ? p.slice(0, 2) + "*".repeat(Math.max(p.length - 2, 2))
          : p[0] + "*".repeat(Math.max(p.length - 1, 1))
      )
      .join(" ");

    return Response.json({
      found: true,
      data: {
        maskedName,
        chosenMajor: admission.chosenMajor,
        status: admission.status,
        notes: admission.notes,
        createdAt: admission.createdAt,
      },
    });
  } catch {
    return Response.json({ error: "Gagal mengambil data, coba lagi." }, { status: 500 });
  }
}
