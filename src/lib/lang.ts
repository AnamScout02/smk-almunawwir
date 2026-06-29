import { cookies } from "next/headers";

export type Lang = "id" | "en";

export async function getLang(): Promise<Lang> {
  try {
    const jar = await cookies();
    return jar.get("lang")?.value === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}
