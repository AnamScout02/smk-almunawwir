import { NextRequest } from "next/server";

const BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await fetch(`${BASE}/villages/${id}.json`, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error("upstream error");
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Gagal memuat data desa/kelurahan" }, { status: 502 });
  }
}
