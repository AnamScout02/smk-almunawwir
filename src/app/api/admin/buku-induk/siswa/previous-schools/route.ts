import { NextResponse } from "next/server";
import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar nama sekolah asal yang pernah diinput + alamatnya (kalau ada) — dipakai untuk
 * saran autocomplete di form Buku Induk Siswa, supaya penulisan nama sekolah konsisten
 * dan alamat tidak perlu diketik ulang kalau sekolahnya sudah pernah dicatat. Sengaja
 * dibuka utk SIAPAPUN yang punya akses Buku Induk Siswa (termasuk wali kelas ter-scope) —
 * ini cuma daftar saran gabungan seluruh sekolah, bukan data per-siswa, aman dilihat lintas kelas. */
export async function GET() {
  await assertBukuIndukSiswaScope();

  const students = await prisma.student.findMany({
    where: { previousSchool: { not: null } },
    select: { previousSchool: true, bukuIndukData: true },
    orderBy: { enrollYear: "desc" },
  });

  const map = new Map<string, string>();
  for (const s of students) {
    const name = s.previousSchool?.trim();
    if (!name) continue;
    const address = (s.bukuIndukData as Record<string, unknown> | null)?.prevSchoolAddress;
    if (!map.has(name) || (!map.get(name) && typeof address === "string" && address)) {
      map.set(name, typeof address === "string" ? address : "");
    }
  }

  const result = Array.from(map.entries())
    .map(([name, address]) => ({ name, address }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(result);
}
