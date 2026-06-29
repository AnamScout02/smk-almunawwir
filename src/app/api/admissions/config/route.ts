import { getSettings } from "@/lib/site-settings";

export async function GET() {
  const config = await getSettings([
    "form.require_nik",
    "form.require_nisn",
    "form.require_address",
    "form.require_guardian",
    "form.require_ijazah",
    "form.require_kk",
    "form.require_ktp_wali",
    "form.require_foto",
    "form.require_dokumen_lain",
  ]);
  return Response.json(config);
}
