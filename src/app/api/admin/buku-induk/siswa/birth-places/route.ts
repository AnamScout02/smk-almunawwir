import { NextResponse } from "next/server";
import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar Tempat Lahir yang pernah diinput (siswa + ayah/ibu/wali) — dipakai untuk saran
 * autocomplete (datalist) di form Buku Induk Siswa, pola sama persis
 * /api/admin/buku-induk/siswa/previous-schools (isi dropdown TAPI tetap bisa ketik bebas kalau
 * kotanya belum pernah tercatat). Dibuka utk siapapun yang punya akses Buku Induk Siswa
 * (termasuk wali kelas ter-scope) — saran gabungan, bukan data per-siswa. */
export async function GET() {
  await assertBukuIndukSiswaScope();

  const students = await prisma.student.findMany({
    select: { birthPlace: true, bukuIndukData: true },
  });

  const set = new Set<string>();
  for (const s of students) {
    if (s.birthPlace?.trim()) set.add(s.birthPlace.trim());
    const buku = s.bukuIndukData as Record<string, unknown> | null;
    for (const key of ["fatherBirthPlace", "motherBirthPlace", "guardianBirthPlace"] as const) {
      const v = buku?.[key];
      if (typeof v === "string" && v.trim()) set.add(v.trim());
    }
  }

  return NextResponse.json([...set].sort((a, b) => a.localeCompare(b, "id")));
}
