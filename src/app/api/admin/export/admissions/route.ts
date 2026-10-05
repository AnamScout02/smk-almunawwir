import { prisma } from "@/lib/prisma";
import { verifySpmbAccess } from "@/lib/spmb";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    await verifySpmbAccess();

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

    return balasanExcel({
      namaFile: `pendaftaran-${new Date().toISOString().slice(0, 10)}`,
      namaSheet: "Pendaftaran",
      headers, rows,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
