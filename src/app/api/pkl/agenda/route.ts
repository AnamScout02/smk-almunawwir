import { randomBytes } from "crypto";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";
import { bacaAgendaPkl, simpanAgendaPkl } from "@/lib/pkl-agenda";

export const dynamic = "force-dynamic";

export async function GET() {
  try { await sesiPkl(); return Response.json({ agenda: await bacaAgendaPkl() }); }
  catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
export async function POST(req: Request) {
  try {
    await sesiPkl();
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const tanggal = typeof b.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal) ? b.tanggal : "";
    const judul = typeof b.judul === "string" ? b.judul.trim().slice(0, 120) : "";
    if (!tanggal || judul.length < 3) return Response.json({ error: "Isi tanggal dan nama agenda (minimal 3 huruf)." }, { status: 400 });
    const semua = await bacaAgendaPkl();
    semua.push({ id: randomBytes(6).toString("hex"), tanggal, judul, ket: typeof b.ket === "string" ? b.ket.trim().slice(0, 300) : "", untuk: b.untuk === "SEMUA" ? "SEMUA" : "PANITIA" });
    await simpanAgendaPkl(semua);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
export async function DELETE(req: Request) {
  try {
    await sesiPkl();
    const id = new URL(req.url).searchParams.get("id");
    const semua = await bacaAgendaPkl();
    await simpanAgendaPkl(semua.filter(a => a.id !== id));
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
