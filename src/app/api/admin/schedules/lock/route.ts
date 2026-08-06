import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { assertKurikulum } from "@/lib/kurikulum-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  const settings = await getSettings(["schedule.locked"]);
  return NextResponse.json({ locked: settings["schedule.locked"] === "1" });
}

export async function POST(req: NextRequest) {
  const session = await verifyRole(["ADMIN", "TEACHER"]);
  await assertKurikulum(session);
  const { locked } = await req.json().catch(() => ({}));
  await prisma.siteSetting.upsert({
    where: { key: "schedule.locked" },
    update: { value: locked ? "1" : "0" },
    create: { key: "schedule.locked", value: locked ? "1" : "0" },
  });
  return NextResponse.json({ locked: !!locked });
}
