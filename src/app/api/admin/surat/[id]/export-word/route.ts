import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function fmtLong(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

interface StructureRow { role: string; name: string; highlight?: boolean }

function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson || "[]") as StructureRow[];
    return parsed.find((r) => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch (e) {
    lemparBilaPengalihan(e);
    return "";
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const [surat, s] = await Promise.all([
      prisma.surat.findUnique({ where: { id } }),
      getSettings(["contact.address", "contact.phone", "contact.email", "letterhead.bukuInduk", "letterhead.kopBawah", "school.structure"]),
    ]);
    if (!surat || surat.tipe !== "KELUAR") {
      return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
    }

    // Surat dari alur "langsung ke Editor Word" — docx aslinya sendiri sudah lengkap (kop,
    // nomor/perihal, isi, ttd), jadi langsung sajikan file itu, bukan bikin .doc palsu dari HTML.
    if (surat.docxUrl && !surat.content) {
      return NextResponse.redirect(new URL(surat.docxUrl, req.url));
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const kopAtasUrl = s["letterhead.bukuInduk"] ? `${baseUrl}${s["letterhead.bukuInduk"]}` : "";
    const kopBawahUrl = s["letterhead.kopBawah"] ? `${baseUrl}${s["letterhead.kopBawah"]}` : "";
    const penandaTangan = surat.penandaTangan || "Kepala SMK Al Munawwir IIBS";
    const isKepalaSekolah = penandaTangan.trim() === "Kepala SMK Al Munawwir IIBS";
    const principalName = isKepalaSekolah ? getPrincipalName(s["school.structure"]) : "";

    const kontak = [s["contact.phone"] && `Telp/WA: ${s["contact.phone"]}`, s["contact.email"] && `Email: ${s["contact.email"]}`]
      .filter(Boolean).join(" &mdash; ");

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${surat.nomor}</title>
<!--[if gte mso 9]>
<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
<![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; color: #0F1A45; }
  table { border-collapse: collapse; }
  .kop { text-align: center; background: #0F1A45; padding: 12px 8px; margin-bottom: 16px; border-bottom: 4px solid #E8A020; }
  .kop .nama { font-weight: bold; font-size: 16pt; text-transform: uppercase; color: #fff; }
  .kop .sub { font-style: italic; font-size: 10pt; color: #E8A020; }
  .kop .alamat, .kop .kontak { font-size: 9pt; color: #fff; }
  .ttd { text-align: center; margin-top: 40px; float: right; min-width: 220px; }
  p { margin: 0 0 10px 0; }
</style>
</head>
<body>
  ${kopAtasUrl
    ? `<img src="${kopAtasUrl}" style="width:100%;display:block;margin-bottom:16px;" alt="Kop Surat">`
    : `<div class="kop">
    <div class="nama">SMK Al Munawwir IIBS</div>
    <div class="sub">Islamic International Boarding School</div>
    ${s["contact.address"] ? `<div class="alamat">${s["contact.address"]}</div>` : ""}
    ${kontak ? `<div class="kontak">${kontak}</div>` : ""}
  </div>`}

  <table>
    <tr><td style="padding-right:8px;">Nomor</td><td style="padding-right:8px;">:</td><td><b>${surat.nomor}</b></td></tr>
    <tr><td style="padding-right:8px;">Perihal</td><td style="padding-right:8px;">:</td><td><b>${surat.perihal}</b></td></tr>
  </table>
  <p>&nbsp;</p>
  <p>Kepada Yth.<br><b>${surat.pihak}</b></p>

  <div style="text-align: justify;">${surat.content || "<p><i>Isi surat belum ditulis.</i></p>"}</div>

  <div class="ttd">
    <p>Singojuruh, ${fmtLong(surat.tanggal)}</p>
    <p>${penandaTangan}</p>
    <p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>
    <p><u><b>${principalName ? `( ${principalName} )` : "&nbsp;"}</b></u></p>
  </div>
  <div style="clear:both;"></div>
  ${kopBawahUrl ? `<img src="${kopBawahUrl}" style="width:100%;display:block;margin-top:24px;" alt="Kop Bawah">` : ""}
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="Surat-${surat.nomor.replace(/\//g, "-")}.doc"`,
      },
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal membuat file Word" }, { status: 500 });
  }
}
