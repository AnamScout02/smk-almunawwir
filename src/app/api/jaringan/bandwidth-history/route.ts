import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertJaringan } from "@/lib/jaringan-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};
// Ukuran "kantong" waktu buat rata-rata — makin panjang rentangnya, makin kasar (biar jumlah titik
// yang dikirim ke chart tetap wajar, bukan ribuan titik mentah tiap 5 menit).
const BUCKET_MS: Record<string, number> = {
  "1h": 5 * 60 * 1000,        // mentah, ~12 titik
  "24h": 15 * 60 * 1000,      // ~96 titik
  "7d": 60 * 60 * 1000,       // per jam, ~168 titik
  "30d": 24 * 60 * 60 * 1000, // per hari, ~30 titik
};

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    const { searchParams } = new URL(req.url);
    const iface = searchParams.get("interface");
    const range = searchParams.get("range") || "24h";
    if (!iface) return NextResponse.json({ error: "Parameter interface wajib diisi." }, { status: 400 });
    if (!RANGE_MS[range]) return NextResponse.json({ error: "Rentang tidak valid." }, { status: 400 });

    const since = new Date(Date.now() - RANGE_MS[range]);
    const rows = await prisma.bandwidthLog.findMany({
      where: { interface: iface, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { downloadMbps: true, uploadMbps: true, timestamp: true },
    });

    const bucketMs = BUCKET_MS[range];
    const buckets = new Map<number, { rx: number[]; tx: number[]; t: Date }>();
    for (const r of rows) {
      const key = Math.floor(r.timestamp.getTime() / bucketMs) * bucketMs;
      const b = buckets.get(key) ?? { rx: [], tx: [], t: new Date(key) };
      b.rx.push(r.downloadMbps);
      b.tx.push(r.uploadMbps);
      buckets.set(key, b);
    }
    const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
    const points = [...buckets.values()]
      .sort((a, b) => a.t.getTime() - b.t.getTime())
      .map(b => ({ t: b.t.toISOString(), rx: avg(b.rx), tx: avg(b.tx) }));

    return NextResponse.json({ interface: iface, range, points });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
