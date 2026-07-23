import "server-only";
import { prisma } from "@/lib/prisma";
import type { WeekType } from "@/lib/schedule-week";

export async function getCurrentWeekType(): Promise<WeekType> {
  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  const anchor = activeYear?.startDate ?? new Date();
  const days = Math.floor((Date.now() - anchor.getTime()) / 86400000);
  return Math.floor(days / 7) % 2 === 0 ? "A" : "B";
}
