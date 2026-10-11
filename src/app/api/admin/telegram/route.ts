import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { enkripsiToken, kirimKeTelegram, KUNCI_TG, lupakanTelegram, panggilTelegram, setelanTelegram } from "@/lib/telegram";

/** Setelan bot Telegram — khusus Superadmin. Token TIDAK PERNAH dikembalikan; balasan hanya menyebut ada/tidaknya. */
export async function GET() {
  await verifyRole(["ADMIN"]);
  const [s, tertaut, pegawai] = await Promise.all([
    setelanTelegram(),
    prisma.tautanTelegram.findMany({ orderBy: { createdAt: "desc" }, select: { aktif: true, createdAt: true, user: { select: { name: true, role: true } } } }),
    prisma.user.count({ where: { role: { in: ["TEACHER", "TAS", "ADMIN"] } } }),
  ]);
  let webhook: { url: string; galat: string; tertunda: number } | null = null;
  if (s) { const w = await panggilTelegram<{ url: string; last_error_message?: string; pending_update_count: number }>(s.token, "getWebhookInfo"); if (w.ok && w.hasil) webhook = { url: w.hasil.url, galat: w.hasil.last_error_message ?? "", tertunda: w.hasil.pending_update_count }; }
  return NextResponse.json({ adaToken: !!s, bot: s?.bot ?? "", webhook, alamatWebhook: `${ALAMAT_APLIKASI}/api/telegram/webhook`, pegawai,
    tertaut: tertaut.map(t => ({ nama: t.user.name, peran: t.user.role, aktif: t.aktif, sejak: t.createdAt })) });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const b = await req.json().catch(() => ({})) as { token?: string; hapus?: boolean; uji?: boolean };
  if (b.uji) {
    const n = await kirimKeTelegram([session.userId], "Uji kabar Telegram", "Kalau pesan ini sampai, bot sudah bekerja untuk akun Anda.", "/dashboard/admin/notifikasi");
    return n ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Tidak terkirim — tautkan dulu Telegram akun Anda dari menu Profil." }, { status: 400 });
  }
  if (b.hapus) {
    const s = await setelanTelegram();
    if (s) await panggilTelegram(s.token, "deleteWebhook");
    await prisma.siteSetting.deleteMany({ where: { key: { in: Object.values(KUNCI_TG) } } });
    lupakanTelegram();
    await logActivity(session, { action: "UPDATE_SETTING", entity: "Telegram", description: "Menghapus token bot Telegram" });
    return NextResponse.json({ ok: true });
  }
  const token = (b.token ?? "").trim();
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,60}$/.test(token)) return NextResponse.json({ error: "Bentuk token tidak dikenali. Salin utuh dari BotFather (angka:huruf)." }, { status: 400 });
  const saya = await panggilTelegram<{ username: string }>(token, "getMe");
  if (!saya.ok || !saya.hasil?.username) return NextResponse.json({ error: `Token ditolak Telegram: ${saya.pesan ?? "tidak dikenal"}` }, { status: 400 });
  const rahasia = randomBytes(24).toString("base64url");
  const pasang = await panggilTelegram(token, "setWebhook", { url: `${ALAMAT_APLIKASI}/api/telegram/webhook`, secret_token: rahasia, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  if (!pasang.ok) return NextResponse.json({ error: `Bot dikenali, tetapi alamat penerima gagal dipasang: ${pasang.pesan}` }, { status: 400 });
  const simpan = (key: string, value: string) => prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await prisma.$transaction([simpan(KUNCI_TG.token, enkripsiToken(token)), simpan(KUNCI_TG.bot, saya.hasil.username), simpan(KUNCI_TG.rahasia, rahasia)]);
  lupakanTelegram();
  await panggilTelegram(token, "setMyCommands", { commands: [{ command: "berhenti", description: "Berhenti menerima kabar sekolah" }] });
  await logActivity(session, { action: "UPDATE_SETTING", entity: "Telegram", description: `Memasang bot Telegram @${saya.hasil.username}` });
  return NextResponse.json({ ok: true, bot: saya.hasil.username });
}
