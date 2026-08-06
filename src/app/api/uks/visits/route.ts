import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertUks } from "@/lib/uks-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const visits = await prisma.uksVisit.findMany({
      orderBy: { visitDate: "desc" },
      include: {
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
        usages: { include: { medicine: { select: { name: true, unit: true } } } },
      },
    });
    return NextResponse.json(visits);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertUks(session);

    const body = await req.json();
    const { studentId, visitDate, complaint, treatment, notes, medicineUsages } = body;

    if (!studentId || !complaint) {
      return NextResponse.json({ error: "Siswa dan keluhan wajib diisi" }, { status: 400 });
    }

    const usages: { medicineId: string; quantity: number }[] = Array.isArray(medicineUsages)
      ? medicineUsages.filter((u: { medicineId?: string; quantity?: number }) => u.medicineId && Number(u.quantity) > 0)
        .map((u: { medicineId: string; quantity: number }) => ({ medicineId: u.medicineId, quantity: Number(u.quantity) }))
      : [];

    const visit = await prisma.$transaction(async (tx) => {
      for (const u of usages) {
        const med = await tx.uksMedicine.findUnique({ where: { id: u.medicineId } });
        if (!med) throw new Error(`Obat tidak ditemukan`);
        if (med.stock < u.quantity) throw new Error(`Stok "${med.name}" tidak cukup (sisa ${med.stock})`);
        await tx.uksMedicine.update({ where: { id: u.medicineId }, data: { stock: { decrement: u.quantity } } });
      }
      return tx.uksVisit.create({
        data: {
          studentId,
          visitDate: visitDate ? new Date(visitDate) : new Date(),
          complaint, treatment: treatment || null, notes: notes || null,
          usages: { create: usages },
        },
        include: {
          student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
          usages: { include: { medicine: { select: { name: true, unit: true } } } },
        },
      });
    });
    return NextResponse.json(visit, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Kepala UKS." }, { status: 403 });
    }
    console.error("[uks visits POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan kunjungan" }, { status: 500 });
  }
}
