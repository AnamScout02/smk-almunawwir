import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getOrCreateVerificationToken } from "@/lib/verification";
import { generateQrDataUrl } from "@/lib/qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const token = await getOrCreateVerificationToken(id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const verifyUrl = `${baseUrl}/verify/${token}`;
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  return NextResponse.json({ qrDataUrl });
}
