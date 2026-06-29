import { getSettings } from "@/lib/site-settings";

export async function GET() {
  const s = await getSettings(["logo.emblem", "logo.full", "logo.full_white"]);
  return Response.json({
    emblem: s["logo.emblem"],
    full: s["logo.full"],
    fullWhite: s["logo.full_white"],
  });
}
