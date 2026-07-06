const BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

export async function GET() {
  try {
    const res = await fetch(`${BASE}/provinces.json`, { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error("upstream error");
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Gagal memuat data provinsi" }, { status: 502 });
  }
}
