export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bacaKodeTaut, kirimPesanTelegram, PERAN_TELEGRAM, setelanTelegram } from "@/lib/telegram";

/** Kiriman dari Telegram (webhook). Dijaga `X-Telegram-Bot-Api-Secret-Token` yang hanya diketahui Telegram & situs.
 *  Bot HANYA mengerti: /start <kode> (menautkan), /berhenti (melepas), selain itu petunjuk singkat. Selalu membalas 200 —
 *  balasan galat membuat Telegram mengirim ulang kiriman yang sama berkali-kali. */
export async function POST(req: Request) {
  const s = await setelanTelegram();
  const kirim = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") ?? ""), benar = Buffer.from(s?.rahasia ?? "");
  if (!s || !benar.length || kirim.length !== benar.length || !timingSafeEqual(kirim, benar)) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const u = await req.json() as { message?: { text?: string; chat?: { id?: number; type?: string }; from?: { first_name?: string; username?: string } } };
    const m = u.message, chat = m?.chat;
    if (!m || !chat?.id || chat.type !== "private") return NextResponse.json({ ok: true });
    const chatId = String(chat.id), teks = (m.text ?? "").trim();
    const balas = (judul: string, isi: string) => kirimPesanTelegram(s.token, chatId, judul, isi);
    if (/^\/(berhenti|stop)\b/i.test(teks)) {
      const n = await prisma.tautanTelegram.deleteMany({ where: { chatId } });
      await balas(n.count ? "Tautan dilepas" : "Belum tertaut", n.count ? "Kabar sekolah tidak lagi dikirim ke obrolan ini. Menautkan lagi bisa dari menu Profil di MyAlwis." : "Obrolan ini belum tertaut ke akun mana pun.");
      return NextResponse.json({ ok: true });
    }
    const kode = /^\/start\s+(\S+)/.exec(teks)?.[1];
    const userId = kode ? bacaKodeTaut(kode) : null;
    if (!userId) {
      await balas("Bot kabar SMK Al-Munawwir IIBS", kode ? "Tautan sudah kedaluwarsa. Buka menu Profil di MyAlwis lalu tekan lagi \"Hubungkan Telegram\"." : "Bot ini mengirim kabar sekolah untuk guru & staf. Untuk menautkan: buka menu Profil di MyAlwis, tekan \"Hubungkan Telegram\".\n/berhenti — berhenti menerima kabar");
      return NextResponse.json({ ok: true });
    }
    const akun = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    if (!akun || !PERAN_TELEGRAM.includes(akun.role)) { await balas("Tidak bisa ditautkan", "Kabar lewat Telegram hanya untuk akun guru & staf."); return NextResponse.json({ ok: true }); }
    const nama = [m.from?.first_name, m.from?.username ? `@${m.from.username}` : ""].filter(Boolean).join(" ").slice(0, 80) || null;
    await prisma.$transaction([
      prisma.tautanTelegram.deleteMany({ where: { OR: [{ chatId }, { userId }] } }),
      prisma.tautanTelegram.create({ data: { userId, chatId, nama } }),
    ]);
    await balas("Telegram terhubung", `Akun: ${akun.name}\nKabar sekolah untuk Anda (disposisi, pengingat, pengumuman) sekarang juga dikirim ke sini.\n/berhenti — berhenti menerima kabar`);
  } catch { /* kiriman yang tidak dimengerti diabaikan */ }
  return NextResponse.json({ ok: true });
}
