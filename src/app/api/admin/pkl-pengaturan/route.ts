import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertPkl as assertHumas } from "@/lib/pkl-humas";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { logActivity } from "@/lib/activity-log";
import { KUNCI_PENDAFTARAN_DIBUKA, KUNCI_TINGKAT_PENDAFTAR, semesterBerjalan } from "@/lib/pkl-pendaftar";

export const dynamic = "force-dynamic";

const KUNCI = [KUNCI_TINGKAT_PENDAFTAR, KUNCI_PENDAFTARAN_DIBUKA];
const SAKELAR = ["auto", "buka", "tutup"];

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const s = await getSettings(KUNCI);
    return NextResponse.json({ ...s, semester: semesterBerjalan() });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const body = await req.json() as Record<string, unknown>;

    const tingkat = String(body[KUNCI_TINGKAT_PENDAFTAR] ?? "")
      .split(",")
      .map(x => Number(x.trim()))
      .filter(n => Number.isInteger(n) && n >= 10 && n <= 12);
    if (tingkat.length === 0) {
      return NextResponse.json({ error: "Pilih minimal satu tingkat kelas (10, 11, atau 12)." }, { status: 400 });
    }
    const dibuka = String(body[KUNCI_PENDAFTARAN_DIBUKA] ?? "auto").trim().toLowerCase();
    if (!SAKELAR.includes(dibuka)) {
      return NextResponse.json({ error: "Nilai jendela pendaftaran tidak sah." }, { status: 400 });
    }

    const nilai: Record<string, string> = {
      [KUNCI_TINGKAT_PENDAFTAR]: [...new Set(tingkat)].sort((a, b) => a - b).join(","),
      [KUNCI_PENDAFTARAN_DIBUKA]: dibuka,
    };
    await prisma.$transaction(
      Object.entries(nilai).map(([key, value]) =>
        prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
    await logActivity(session, {
      action: "UPDATE", entity: "SiteSetting",
      description: `Jendela pendaftaran PKL: tingkat ${nilai[KUNCI_TINGKAT_PENDAFTAR]}, status ${dibuka}`,
    });
    return NextResponse.json({ ...nilai, semester: semesterBerjalan() });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan pengaturan pendaftaran PKL." }, { status: 500 });
  }
}
