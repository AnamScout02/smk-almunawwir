import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const admissionSchema = z.object({
  fullName: z.string().min(2),
  birthPlace: z.string().min(2),
  birthDate: z.string(),
  gender: z.string().min(1),
  nik: z.string().optional(),
  phone: z.string().min(9),
  nisn: z.string().optional(),
  address: z.string().optional(),
  previousSchool: z.string().min(2),
  email: z.string().email(),
  guardianName: z.string().optional(),
  chosenMajor: z.string().optional(),
  // Dokumen
  ijazah: z.string().url().optional().or(z.literal("")),
  kk: z.string().url().optional().or(z.literal("")),
  ktp_wali: z.string().url().optional().or(z.literal("")),
  foto: z.string().url().optional().or(z.literal("")),
  dokumen_lain: z.string().url().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Periksa kembali isian Anda." }, { status: 400 });
  }

  try {
    const d = parsed.data;
    const admission = await prisma.admission.create({
      data: {
        fullName: d.fullName,
        birthPlace: d.birthPlace,
        birthDate: new Date(d.birthDate),
        gender: d.gender,
        nik: d.nik ?? null,
        phone: d.phone,
        nisn: d.nisn ?? null,
        address: d.address ?? null,
        previousSchool: d.previousSchool,
        email: d.email,
        guardianName: d.guardianName ?? null,
        chosenMajor: d.chosenMajor ?? "",
        ijazahUrl: d.ijazah || null,
        kkUrl: d.kk || null,
        ktpWaliUrl: d.ktp_wali || null,
        fotoUrl: d.foto || null,
        dokumenLainUrl: d.dokumen_lain || null,
      },
    });
    return Response.json({ success: true, id: admission.id }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan data, coba lagi." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admissions = await prisma.admission.findMany({
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ admissions });
  } catch {
    return Response.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
