import "server-only";
import type { Prisma } from "@prisma/client";

/** Konvensi: aset dianggap "milik Lab" kalau kategori atau lokasinya mengandung kata "lab" (case-insensitive). */
export function isLabAsset(asset: { category: string; location?: string | null }): boolean {
  const text = `${asset.category} ${asset.location ?? ""}`.toLowerCase();
  return text.includes("lab");
}

export const LAB_ASSET_FILTER: Prisma.AssetWhereInput = {
  OR: [
    { category: { contains: "lab", mode: "insensitive" } },
    { location: { contains: "lab", mode: "insensitive" } },
  ],
};
