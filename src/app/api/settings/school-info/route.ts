import { getSettings } from "@/lib/site-settings";

interface StructureRow { role: string; name: string; highlight?: boolean }

export async function GET() {
  const s = await getSettings(["school.structure"]);
  let principalName = "";
  try {
    const parsed = JSON.parse(s["school.structure"] ?? "[]") as StructureRow[];
    principalName = parsed.find((r) => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    principalName = "";
  }
  return Response.json({ principalName });
}
