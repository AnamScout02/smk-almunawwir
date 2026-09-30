import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { signOnlyofficeConfig, appInternalUrl } from "@/lib/onlyoffice";
import { createNotulenDocx, randomDocxKey, saveDocxToUploads } from "@/lib/onlyoffice-docx";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Konfigurasi ONLYOFFICE untuk NOTULEN RAPAT — kembaran /api/onlyoffice/surat/[id].
 *  Dokumen awal dibangkitkan dari isian terstruktur yang sudah ada, jadi editor tidak pernah
 *  terbuka kosong (permintaan user 30 September 2026: "notulen bisa edit kayak surat juga"). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const isViewMode = req.nextUrl.searchParams.get("mode") === "view";

    const notulen = await prisma.meetingMinutes.findUnique({
      where: { id },
      include: { attendees: { orderBy: { order: "asc" }, select: { name: true } } },
    });
    if (!notulen) return NextResponse.json({ error: "Notulen tidak ditemukan" }, { status: 404 });
    if (isViewMode && !notulen.docxUrl) {
      return NextResponse.json({ error: "Notulen ini belum punya versi Word" }, { status: 404 });
    }

    let { docxUrl, docxKey } = notulen;
    if (!docxUrl) {
      const s = await getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "school.structure"]);
      const buffer = await createNotulenDocx({
        tanggal: notulen.date,
        waktu: notulen.time,
        tempat: notulen.place,
        pemimpin: notulen.leader,
        materi: notulen.topic,
        dibukaOleh: notulen.openedBy,
        sambutan: notulen.greetings ?? [],
        peserta: notulen.attendees.map(a => a.name),
        keputusan: notulen.decisions,
        notulis: notulen.notulis,
        principalName: getPrincipalName(s["school.structure"]),
        kopAtasUrl: s["letterhead.bukuInduk"],
        kopBawahUrl: s["letterhead.kopBawah"],
      });
      const filename = `notulen-${id}-${Date.now()}.docx`;
      docxUrl = await saveDocxToUploads("notulen-docx", filename, buffer);
      docxKey = randomDocxKey();
      await prisma.meetingMinutes.update({ where: { id }, data: { docxUrl, docxKey } });
    }

    const base = appInternalUrl();
    const tglJudul = notulen.date.toISOString().slice(0, 10);
    const config = {
      document: {
        fileType: "docx",
        key: docxKey,
        title: `Notulen-${tglJudul}.docx`,
        url: `${base}${docxUrl}`,
        permissions: { edit: !isViewMode, download: true, print: true },
      },
      documentType: "word",
      editorConfig: {
        mode: isViewMode ? "view" : "edit",
        lang: "id",
        callbackUrl: `${base}/api/onlyoffice/callback?notulenId=${id}`,
        user: { id: session.userId, name: session.name },
      },
    };
    const token = await signOnlyofficeConfig(config);
    return NextResponse.json({ ...config, token });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[onlyoffice notulen config]", e);
    return NextResponse.json({ error: "Gagal menyiapkan editor" }, { status: 500 });
  }
}
