import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { rapikanNomorWa } from "@/lib/spmb-form";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Koordinator BKK", "Wakil Kepala Humas"]);

    const alumni = await prisma.student.findMany({
      where: { studentStatus: "LULUS" },
      select: {
        id: true, nis: true, enrollYear: true, parentPhone: true, bukuIndukData: true,
        user: { select: { name: true } },
        major: { select: { name: true, code: true } },
        alumniTracer: true,
      },
      orderBy: { user: { name: "asc" } },
    });

    // Nomor untuk tombol AJAKAN WhatsApp (8 Okt 2026): nomor alumni sendiri didahulukan, kalau tidak ada nomor orang tua
    // (pesannya dibedakan di layar). Buku Induk utuh tidak dikirim ke browser — hanya nomor & tahun lulus.
    const hasil = alumni.map(({ parentPhone, bukuIndukData, ...a }) => {
      const d = (bukuIndukData ?? {}) as Record<string, unknown>;
      const hpSiswa = typeof d.studentPhone === "string" ? rapikanNomorWa(d.studentPhone) : "";
      const hpOrtu = rapikanNomorWa(parentPhone ?? "");
      const sah = (n: string) => /^62\d{8,13}$/.test(n);
      const lulus = typeof d.graduationDate === "string" ? d.graduationDate.slice(0, 4) : "";
      return { ...a, lulus, ajak: sah(hpSiswa) ? { nomor: hpSiswa, milik: "alumni" } : sah(hpOrtu) ? { nomor: hpOrtu, milik: "ortu" } : null };
    });
    return NextResponse.json(hasil);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator BKK." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
