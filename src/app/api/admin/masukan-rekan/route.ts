import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/**
 * SATU-SATUNYA jalur yang boleh menampilkan pasangan pengirim–penerima (src/lib/masukan-rekan.ts).
 * Khusus role ADMIN (superadmin) — TAS & guru berjabatan apa pun TIDAK diberi akses, karena
 * seluruh nilai fitur ini bergantung pada pengirim tidak terlihat oleh rekan kerjanya.
 */
export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const items = await prisma.masukanRekan.findMany({
      select: {
        id: true, jenis: true, isi: true, dibacaAt: true, createdAt: true,
        pengirim: { select: { id: true, name: true, role: true } },
        penerima: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json(items);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Khusus Superadmin." }, { status: 403 });
  }
}
