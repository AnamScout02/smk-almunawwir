import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { Role } from "@/types";

export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

export const verifyRole = cache(async (allowed: Role[]) => {
  const session = await verifySession();
  if (!allowed.includes(session.role)) {
    redirect("/login");
  }
  return session;
});
