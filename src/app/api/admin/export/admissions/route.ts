import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS"]);

    const admissions = await prisma.admission.findMany({
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "No", "Nama Lengkap", "Tempat Lahir", "Tanggal Lahir", "Jenis Kelamin",
      "NIK", "No WhatsApp", "NISN", "Alamat", "Asal Sekolah",
      "Email", "Nama Wali", "Konsentrasi Keahlian", "Status", "Tanggal Daftar", "Catatan",
    ];

    const rows = admissions.map((a, i) => [
      i + 1,
      a.fullName,
      a.birthPlace ?? "",
      a.birthDate ? new Date(a.birthDate).toLocaleDateString("id-ID") : "",
      a.gender ?? "",
      a.nik ?? "",
      a.phone,
      a.nisn ?? "",
      (a.address ?? "").replace(/\n/g, " "),
      a.previousSchool ?? "",
      a.email,
      a.guardianName ?? "",
      a.chosenMajor,
      a.status,
      new Date(a.createdAt).toLocaleDateString("id-ID"),
      (a.notes ?? "").replace(/\n/g, " "),
    ]);

    const escape = (v: string | number) => {
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [headers, ...rows]
      .map(row => row.map(escape).join(","))
      .join("\n");

    const bom = "﻿"; // UTF-8 BOM for Excel
    return new Response(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pendaftaran-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch {
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
