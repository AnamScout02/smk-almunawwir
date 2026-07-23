import { getSettings } from "@/lib/site-settings";

export async function GET() {
  const s = await getSettings(["stats.students"]);
  return Response.json({ students: s["stats.students"] });
}
