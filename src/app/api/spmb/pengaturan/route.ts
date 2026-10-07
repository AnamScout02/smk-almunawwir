import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { KUNCI_FORM_SPMB, KUNCI_KONTEN_SPMB } from "@/lib/spmb-konten";
import { KUNCI_TAHAPAN_SPMB } from "@/lib/spmb-tahapan";
import { logActivity } from "@/lib/activity-log";
import { kirimLatar } from "@/lib/push-server";
import { kabarTahapan } from "@/lib/spmb-kabar";

export const dynamic = "force-dynamic";

const DIIZINKAN = new Set<string>([
  ...KUNCI_KONTEN_SPMB, ...KUNCI_FORM_SPMB, ...KUNCI_TAHAPAN_SPMB,
]);

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    return NextResponse.json(await getSettings([...DIIZINKAN]));
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const body = await req.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Isian tidak sah" }, { status: 400 });

    // Hanya kunci yang didaftarkan boleh ditulis — tanpa saringan ini route ini menjadi pintu
    // untuk menimpa SiteSetting apa pun (mis. kunci Dapodik) dari satu halaman panitia SPMB.
    const masuk = Object.entries(body).filter(([k]) => DIIZINKAN.has(k));
    if (!masuk.length) return NextResponse.json({ error: "Tidak ada isian yang dikenali" }, { status: 400 });

    // Hasil baru DIBUKA → kabari tiap calon yang sudah diputuskan (sekali per calon per keputusan).
    const bukaHasil = body["spmb.hasilDibuka"] === "1"
      && (await prisma.siteSetting.findUnique({ where: { key: "spmb.hasilDibuka" } }))?.value !== "1";

    await prisma.$transaction(masuk.map(([key, value]) => {
      const v = typeof value === "string" ? value : JSON.stringify(value ?? "");
      return prisma.siteSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
    }));
    if (bukaHasil) kirimLatar(async () => {
      const diputus = await prisma.admission.findMany({
        where: { status: { in: ["DITERIMA", "ACCEPTED", "CADANGAN", "DITOLAK", "REJECTED"] }, langgananSpmb: { some: {} } },
        select: { id: true, status: true },
      });
      for (const d of diputus) {
        const terima = ["DITERIMA", "ACCEPTED"].includes(d.status);
        await kabarTahapan(d.id, {
          kunci: `spmb-hasil:${d.id}:${d.status}`,
          judul: terima ? "Selamat, Anda DITERIMA" : d.status === "CADANGAN" ? "Hasil seleksi: cadangan" : "Hasil seleksi sudah diumumkan",
          isi: terima ? "Alhamdulillah, Anda dinyatakan diterima." : "Hasil seleksi sudah bisa dilihat di halaman tahapan.",
        }).catch(() => null);
      }
    });
    await logActivity(session, {
      action: "UPDATE", entity: "SpmbPengaturan",
      description: `Mengubah ${masuk.length} isian SPMB (${masuk.map(([k]) => k.replace("spmb.", "")).join(", ")})`,
    });
    return NextResponse.json({ ok: true, tersimpan: masuk.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
