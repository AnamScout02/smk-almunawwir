import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  await verifyRole(["ADMIN"]);
  const settings = await prisma.siteSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  await verifyRole(["ADMIN"]);
  const { key, value } = await req.json() as { key: string; value: string };
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const setting = await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  // Revalidate halaman yang menggunakan settings
  revalidatePath("/");
  revalidatePath("/contact");
  revalidatePath("/programs");
  revalidatePath("/about");
  revalidatePath("/news");
  revalidatePath("/gallery");
  revalidatePath("/admissions");
  revalidatePath("/dashboard/admin/content");

  return NextResponse.json(setting);
}
