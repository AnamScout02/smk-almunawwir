import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

interface Row {
  "Judul Buku"?: string; "Penulis"?: string; "Penerbit"?: string; "Kategori"?: string;
  "Stok"?: string | number; "Lokasi/Rak"?: string; "Barcode"?: string;
}

async function generateBarcode(): Promise<string> {
  const count = await prisma.book.count();
  const base = `PST-${String(count + 1).padStart(5, "0")}`;
  const existing = await prisma.book.findUnique({ where: { barcode: base } });
  if (!existing) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });

    let created = 0, updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      try {
        const title = String(row["Judul Buku"] ?? "").trim();
        const category = String(row["Kategori"] ?? "").trim();
        if (!title || !category) {
          errors.push(`Baris ${rowNum}: Judul Buku dan Kategori wajib diisi`);
          continue;
        }

        const stockRaw = String(row["Stok"] ?? "").trim();
        const stock = stockRaw ? parseInt(stockRaw, 10) : 1;
        const barcode = String(row["Barcode"] ?? "").trim();

        const data = {
          title,
          category,
          author: String(row["Penulis"] ?? "").trim() || null,
          publisher: String(row["Penerbit"] ?? "").trim() || null,
          stock: Number.isFinite(stock) && stock > 0 ? stock : 1,
          location: String(row["Lokasi/Rak"] ?? "").trim() || null,
        };

        if (barcode) {
          const existing = await prisma.book.findUnique({ where: { barcode } });
          if (existing) {
            await prisma.book.update({ where: { id: existing.id }, data });
            updated++;
            continue;
          }
          await prisma.book.create({ data: { ...data, barcode } });
          created++;
        } else {
          await prisma.book.create({ data: { ...data, barcode: await generateBarcode() } });
          created++;
        }
      } catch (err) {
        lemparBilaPengalihan(err);
        console.error(`[perpustakaan books import] baris ${rowNum}`, err);
        errors.push(`Baris ${rowNum}: Gagal menyimpan (${err instanceof Error ? err.message : "error tidak diketahui"})`);
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan books import]", e);
    return NextResponse.json({ error: "Gagal memproses file import" }, { status: 500 });
  }
}
