export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bacaKodeTaut, kirimPesanTelegram, panggilTelegram, PERAN_TELEGRAM, setelanTelegram } from "@/lib/telegram";
import { tanganiPesan, tanganiTombol, type PesanKeluar } from "@/lib/telegram-perintah";

/** Kiriman dari Telegram (webhook). Dijaga `X-Telegram-Bot-Api-Secret-Token` yang hanya diketahui Telegram & situs.
 *  Bot HANYA mengerti: /start <kode> (menautkan), /berhenti (melepas), selain itu petunjuk singkat. Selalu membalas 200 —
 *  balasan galat membuat Telegram mengirim ulang kiriman yang sama berkali-kali. */
export async function POST(req: Request) {
  const s = await setelanTelegram();
  const kirim = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") ?? ""), benar = Buffer.from(s?.rahasia ?? "");
  if (!s || !benar.length || kirim.length !== benar.length || !timingSafeEqual(kirim, benar)) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    type Tombol = { inline_keyboard?: { callback_data?: string }[][] };
    const u = await req.json() as {
      message?: { text?: string; chat?: { id?: number; type?: string }; from?: { first_name?: string; username?: string }; reply_to_message?: { reply_markup?: Tombol } };
      callback_query?: { id: string; data?: string; message?: { message_id?: number; chat?: { id?: number; type?: string } } };
    };
    // Tombol "Sesuai rencana" pada pesan jurnal (src/lib/telegram-perintah.ts).
    const cq = u.callback_query;
    if (cq) {
      const c = cq.message?.chat;
      if (c?.id && c.type === "private") {
        const h = await tanganiTombol({ chatId: String(c.id), data: cq.data ?? "" }).catch(() => ({ jawab: "Gagal diproses.", ganti: undefined as string | undefined }));
        await panggilTelegram(s.token, "answerCallbackQuery", { callback_query_id: cq.id, text: h.jawab });
        if (h.ganti && cq.message?.message_id) await panggilTelegram(s.token, "editMessageText", { chat_id: c.id, message_id: cq.message.message_id, text: h.ganti, parse_mode: "HTML" });
      } else await panggilTelegram(s.token, "answerCallbackQuery", { callback_query_id: cq.id });
      return NextResponse.json({ ok: true });
    }
    const m = u.message, chat = m?.chat;
    if (!m || !chat?.id || chat.type !== "private") return NextResponse.json({ ok: true });
    const chatId = String(chat.id), teks = (m.text ?? "").trim();
    const balas = (judul: string, isi: string) => kirimPesanTelegram(s.token, chatId, judul, isi);
    if (/^\/(berhenti|stop)\b/i.test(teks)) {
      const n = await prisma.tautanTelegram.deleteMany({ where: { chatId } });
      await balas(n.count ? "Tautan dilepas" : "Belum tertaut", n.count ? "Kabar sekolah tidak lagi dikirim ke obrolan ini. Menautkan lagi bisa dari menu Profil di MyAlwis." : "Obrolan ini belum tertaut ke akun mana pun.");
      return NextResponse.json({ ok: true });
    }
    // Jadwal & jurnal dari obrolan — hanya untuk obrolan yang sudah tertaut; selain itu jatuh ke petunjuk di bawah.
    if (!/^\/start\b/i.test(teks) && teks) {
      const kirim = (p: PesanKeluar) => panggilTelegram(s.token, "sendMessage", {
        chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, text: p.teks.slice(0, 3900),
        ...(p.tombol ? { reply_markup: { inline_keyboard: [p.tombol.map(t => ({ text: t.teks, callback_data: t.data }))] } } : {}),
      });
      const balasData = m.reply_to_message?.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data ?? null;
      if (await tanganiPesan({ chatId, teks, balasData }, kirim)) return NextResponse.json({ ok: true });
    }
    const kode = /^\/start\s+(\S+)/.exec(teks)?.[1];
    const userId = kode ? bacaKodeTaut(kode) : null;
    if (!userId) {
      await balas("Bot kabar SMK Al-Munawwir IIBS", kode ? "Tautan sudah kedaluwarsa. Buka menu Profil di MyAlwis lalu tekan lagi \"Hubungkan Telegram\"." : "Bot ini mengirim kabar sekolah untuk guru & staf. Untuk menautkan: buka menu Profil di MyAlwis, tekan \"Hubungkan Telegram\".\n/jadwal — jadwal mengajar hari ini\n/jurnal — isi jurnal yang belum diisi\n/berhenti — berhenti menerima kabar");
      return NextResponse.json({ ok: true });
    }
    const akun = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
    if (!akun || !PERAN_TELEGRAM.includes(akun.role)) { await balas("Tidak bisa ditautkan", "Kabar lewat Telegram hanya untuk akun guru & staf."); return NextResponse.json({ ok: true }); }
    const nama = [m.from?.first_name, m.from?.username ? `@${m.from.username}` : ""].filter(Boolean).join(" ").slice(0, 80) || null;
    await prisma.$transaction([
      prisma.tautanTelegram.deleteMany({ where: { OR: [{ chatId }, { userId }] } }),
      prisma.tautanTelegram.create({ data: { userId, chatId, nama } }),
    ]);
    await balas("Telegram terhubung", `Akun: ${akun.name}\nKabar sekolah untuk Anda (disposisi, pengingat, pengumuman) sekarang juga dikirim ke sini.\n/jadwal — jadwal mengajar hari ini\n/jurnal — isi jurnal yang belum diisi\n/berhenti — berhenti menerima kabar`);
  } catch { /* kiriman yang tidak dimengerti diabaikan */ }
  return NextResponse.json({ ok: true });
}
