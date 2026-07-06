import { getSettings } from "@/lib/site-settings";

export async function GET() {
  const s = await getSettings(["letterhead.bukuInduk"]);
  return Response.json({ url: s["letterhead.bukuInduk"] });
}
