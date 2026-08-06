import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { signOnlyofficeConfig, appInternalUrl } from "@/lib/onlyoffice";
import { createSuratLetterDocx, randomDocxKey, saveDocxToUploads } from "@/lib/onlyoffice-docx";

export const dynamic = "force-dynamic";

interface StructureRow { role: string; name: string; highlight?: boolean }

function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson || "[]") as StructureRow[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const isViewMode = req.nextUrl.searchParams.get("mode") === "view";

    const surat = await prisma.surat.findUnique({ where: { id } });
    if (!surat || surat.tipe !== "KELUAR") {
      return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    }
    if (isViewMode && !surat.docxUrl) {
      return NextResponse.json({ error: "Surat ini belum punya versi Word" }, { status: 404 });
    }

    let { docxUrl, docxKey } = surat;
    if (!docxUrl) {
      const s = await getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "letterhead.ttdKepalaSekolah", "school.structure"]);
      const penandaTangan = surat.penandaTangan || "Kepala SMK Al Munawwir IIBS";
      const isKepalaSekolah = penandaTangan.trim() === "Kepala SMK Al Munawwir IIBS";
      const buffer = await createSuratLetterDocx({
        nomor: surat.nomor || "…",
        perihal: surat.perihal || "…",
        pihak: surat.pihak || "…",
        tanggal: surat.tanggal,
        penandaTangan,
        principalName: isKepalaSekolah ? getPrincipalName(s["school.structure"]) : "",
        kopAtasUrl: s["letterhead.bukuInduk"],
        kopBawahUrl: s["letterhead.kopBawah"],
        signatureUrl: isKepalaSekolah ? s["letterhead.ttdKepalaSekolah"] : null,
        bodyHtml: surat.content,
      });
      const filename = `surat-${id}-${Date.now()}.docx`;
      docxUrl = await saveDocxToUploads("surat-docx", filename, buffer);
      docxKey = randomDocxKey();
      await prisma.surat.update({ where: { id }, data: { docxUrl, docxKey } });
    }

    const base = appInternalUrl();
    const config = {
      document: {
        fileType: "docx",
        key: docxKey,
        title: `Surat-${surat.nomor.replace(/\//g, "-")}.docx`,
        url: `${base}${docxUrl}`,
        permissions: { edit: !isViewMode, download: true, print: true },
      },
      documentType: "word",
      editorConfig: {
        mode: isViewMode ? "view" : "edit",
        lang: "id",
        callbackUrl: `${base}/api/onlyoffice/callback?suratId=${id}`,
        user: { id: session.userId, name: session.name },
      },
    };
    const token = await signOnlyofficeConfig(config);

    return NextResponse.json({ ...config, token });
  } catch (e) {
    console.error("[onlyoffice surat config]", e);
    return NextResponse.json({ error: "Gagal menyiapkan editor" }, { status: 500 });
  }
}
