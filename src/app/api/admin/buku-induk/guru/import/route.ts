import { potretGuru, catatRiwayatGuru } from "@/lib/riwayat-induk";
import { NextRequest, NextResponse } from "next/server";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { toProperCaseName, normalizeBukuIndukText } from "@/lib/text";
import { GURU_KOLOM_IMPOR } from "@/lib/buku-induk-guru-columns";
import type { Prisma } from "@prisma/client";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000) {
    const parsed = XLSX.SSF.parse_date_code(num);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function s(val: unknown): string {
  return String(val ?? "").trim();
}

export async function POST(req: NextRequest) {
  const sesiImpor = await verifyBukuIndukFullAccess();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  if (rows.length === 0) return NextResponse.json({ error: "Tidak ada data di file" }, { status: 400 });

  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const nip = s(row["NIP"]);
    const nama = s(row["Nama Lengkap"]);
    const mapel = s(row["Mata Pelajaran"]);

    if (!nip || !nama) {
      results.errors.push(`Baris ${rowNum}: NIP dan Nama Lengkap wajib diisi`);
      continue;
    }

    const updateData = {
      phone:         s(row["No. HP"]) || null,
      birthPlace:    s(row["Tempat Lahir"]) || null,
      birthDate:     parseDate(row["Tanggal Lahir (DD/MM/YYYY)"]),
      gender:        s(row["Jenis Kelamin (L/P)"]).toUpperCase() || null,
      religion:      s(row["Agama"]) || null,
      address:       s(row["Alamat"]) || null,
      education:     s(row["Pendidikan Terakhir (S1/S2/D3/dll)"]) || null,
      position:      s(row["Jabatan (Guru Tetap/GTT/PNS/Honorer)"]) || null,
      startDate:     parseDate(row["Tanggal Mulai Mengajar (DD/MM/YYYY)"]),
      teacherStatus: s(row["Status (AKTIF/PENSIUN/KELUAR)"]).toUpperCase() || "AKTIF",
      teacherNotes:  s(row["Keterangan"]) || null,
    };

    // Isian Buku Induk lain (bukuIndukData) — kolomnya dari GURU_KOLOM_IMPOR, sama persis dengan template & formulir.
    const isiBuku: Record<string, string> = {};
    for (const k of GURU_KOLOM_IMPOR) {
      if (k.tanggal) { const d = parseDate(row[k.judul]); if (d) isiBuku[k.key] = d.toISOString().slice(0, 10); }
      else { const v = s(row[k.judul]); if (v) isiBuku[k.key] = v; }
    }
    const bukuBaru = normalizeBukuIndukText(isiBuku) as Record<string, unknown>;

    try {
      const existing = await prisma.teacher.findUnique({ where: { nip } });
      if (existing) {
        // DIGABUNG, bukan ditimpa (6 Okt 2026): sel kosong di Excel mempertahankan data lama. Dulu kolom kosong
        // mengosongkan data, dan Status kosong mengembalikan guru PENSIUN/KELUAR menjadi AKTIF.
        const dasar: Record<string, unknown> = Object.fromEntries(Object.entries(updateData).filter(([, v]) => v !== null && v !== ""));
        if (!s(row["Status (AKTIF/PENSIUN/KELUAR)"])) delete dasar.teacherStatus;
        const lama = (existing.bukuIndukData as Record<string, unknown> | null) ?? {};
        const sebelumRiwayat = await potretGuru(existing.id);
        await prisma.teacher.update({
          where: { nip },
          data: { ...dasar, ...(mapel ? { subject: mapel } : {}), bukuIndukData: { ...lama, ...bukuBaru } as Prisma.InputJsonValue },
        });
        await catatRiwayatGuru(sesiImpor, existing.id, sebelumRiwayat, "impor Excel").catch(() => 0);
        results.updated++;
      } else {
        const email = `${nip}@smkalmunawwir.sch.id`;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const bcrypt = await import("bcryptjs");
          // Password awal = "Almunawwir1", SAMA dengan impor siswa & formulir (keputusan user 2026-08-09; diseragamkan
          // 6 Okt 2026). Dulu NIP — tidak seragam, dan NIP mudah ditebak karena tercetak di kartu & dokumen sekolah.
          user = await prisma.user.create({
            data: {
              name: toProperCaseName(nama),
              email,
              password: await bcrypt.hash("Almunawwir1", 10),
              role: "TEACHER",
            },
          });
        }
        await prisma.teacher.create({
          data: {
            nip,
            userId: user.id,
            subject: mapel || "Belum diisi",
            ...updateData,
            bukuIndukData: bukuBaru as Prisma.InputJsonValue,
          },
        });
        results.created++;
      }
    } catch (e: unknown) {
      lemparBilaPengalihan(e);
      const msg = e instanceof Error ? e.message : String(e);
      results.errors.push(`Baris ${rowNum} (${nip}): ${msg}`);
    }
  }

  return NextResponse.json(results);
}
