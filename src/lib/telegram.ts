import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** BOT TELEGRAM UNTUK GURU & STAF (10 Oktober 2026, pilihan user) — kabar yang masuk kotak notifikasi akun ikut dikirim ke
 *  Telegram orangnya, gratis, untuk yang belum memasang aplikasi. Aturannya:
 *   - HANYA guru, staf, dan admin (`PERAN_TELEGRAM`). Siswa & orang tua tidak: isi kabar mereka menyangkut anak, dan kanal
 *     mereka adalah aplikasi/push.
 *   - Menautkan = orangnya sendiri menekan tautan dari Profil (`t.me/<bot>?start=<kode>`); kode bertanda tangan, berlaku
 *     15 menit, jadi tidak ada yang bisa menautkan akun orang lain dengan menebak. Tidak ada daftar chat id yang diketik.
 *   - Token bot disimpan TERENKRIPSI (pola `dapodik.kunci`), tidak pernah dikembalikan ke browser.
 *   - Gagal mengirim tidak boleh mengganggu apa pun: semua pemanggil memakai `void … .catch`.
 *   - Peringatan server (situs mati, galat baru) dikirim ke akun ADMIN yang menautkan Telegram. */
export const KUNCI_TG = { token: "telegram.token", bot: "telegram.bot", rahasia: "telegram.rahasia" } as const;
export const PERAN_TELEGRAM = ["TEACHER", "TAS", "ADMIN"];

const kunciSandi = () => createHash("sha256").update(`telegram-token|${process.env.SESSION_SECRET ?? ""}`).digest();
export function enkripsiToken(teks: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", kunciSandi(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), isi.toString("base64")].join(":");
}
function dekripsi(simpanan: string): string | null {
  try {
    const [v, iv, tag, isi] = simpanan.split(":");
    if (v !== "v1" || !iv || !tag || !isi) return null;
    const d = createDecipheriv("aes-256-gcm", kunciSandi(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(isi, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

export interface SetelanTelegram { token: string; bot: string; rahasia: string }
const g = globalThis as unknown as { __telegram?: { nilai: SetelanTelegram | null; sampai: number } };
export function lupakanTelegram() { delete g.__telegram; }

/** null = bot belum disetel (seluruh fitur diam). Disinggahkan 60 detik. */
export async function setelanTelegram(): Promise<SetelanTelegram | null> {
  if (g.__telegram && g.__telegram.sampai > Date.now()) return g.__telegram.nilai;
  const baris = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(KUNCI_TG) } }, select: { key: true, value: true } }).catch(() => []);
  const v = (k: string) => baris.find(b => b.key === k)?.value ?? "";
  const token = v(KUNCI_TG.token) ? dekripsi(v(KUNCI_TG.token)) : null;
  const nilai = token ? { token, bot: v(KUNCI_TG.bot), rahasia: v(KUNCI_TG.rahasia) } : null;
  g.__telegram = { nilai, sampai: Date.now() + 60_000 };
  return nilai;
}

export async function panggilTelegram<T = unknown>(token: string, metode: string, isi?: Record<string, unknown>): Promise<{ ok: boolean; hasil?: T; kode?: number; pesan?: string }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metode}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi ?? {}), signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json().catch(() => null) as { ok?: boolean; result?: T; error_code?: number; description?: string } | null;
    return j?.ok ? { ok: true, hasil: j.result } : { ok: false, kode: j?.error_code ?? r.status, pesan: j?.description ?? "Telegram tidak menjawab" };
  } catch { return { ok: false, pesan: "Telegram tidak bisa dihubungi dari server" }; }
}

const aman = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mutlak = (url?: string) => !url ? null : /^https?:\/\//.test(url) ? url : `${ALAMAT_APLIKASI}${url.startsWith("/") ? "" : "/"}${url}`;

export async function kirimPesanTelegram(token: string, chatId: string, judul: string, isi: string, url?: string) {
  const tujuan = mutlak(url);
  return panggilTelegram(token, "sendMessage", {
    chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
    text: `<b>${aman(judul).slice(0, 200)}</b>${isi ? `\n${aman(isi).slice(0, 3000)}` : ""}`,
    ...(tujuan ? { reply_markup: { inline_keyboard: [[{ text: "Buka di MyAlwis", url: tujuan }]] } } : {}),
  });
}

/** Kirim satu kabar ke akun-akun yang menautkan Telegram. Obrolan yang memblokir bot (403) dilepas tautannya. */
export async function kirimKeTelegram(userIds: string[], judul: string, isi: string, url?: string): Promise<number> {
  const s = await setelanTelegram();
  if (!s || !userIds.length) return 0;
  const tautan = await prisma.tautanTelegram.findMany({ where: { userId: { in: userIds }, aktif: true, user: { role: { in: PERAN_TELEGRAM as never[] } } }, select: { userId: true, chatId: true } }).catch(() => []);
  let terkirim = 0;
  for (const t of tautan) {
    const r = await kirimPesanTelegram(s.token, t.chatId, judul, isi, url);
    if (r.ok) terkirim++;
    else if (r.kode === 403) await prisma.tautanTelegram.delete({ where: { userId: t.userId } }).catch(() => null);
    else if (r.kode === 429) await new Promise(x => setTimeout(x, 1500));
  }
  return terkirim;
}

/** Peringatan server → akun ADMIN yang menautkan Telegram. */
export async function peringatanServer(judul: string, isi: string, url?: string) {
  const admin = await prisma.user.findMany({ where: { role: "ADMIN", tautanTelegram: { aktif: true } }, select: { id: true } }).catch(() => []);
  return kirimKeTelegram(admin.map(a => a.id), judul, isi, url);
}

/* ── Kode tautan: <userId>_<kedaluwarsa base36>_<tanda 16> — muat di parameter /start (≤64, [A-Za-z0-9_-]). ── */
const tanda = (userId: string, exp: string) => createHmac("sha256", `telegram-taut|${process.env.SESSION_SECRET ?? ""}`).update(`${userId}|${exp}`).digest("base64url").slice(0, 16);
export function kodeTaut(userId: string) { const exp = Math.floor((Date.now() + 15 * 60_000) / 1000).toString(36); return `${userId}_${exp}_${tanda(userId, exp)}`; }
export function bacaKodeTaut(kode: string): string | null {
  const m = /^([a-z0-9]{10,40})_([a-z0-9]{4,10})_([A-Za-z0-9_-]{16})$/.exec(kode);
  if (!m) return null;
  const a = Buffer.from(m[3]), b = Buffer.from(tanda(m[1], m[2]));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return parseInt(m[2], 36) * 1000 > Date.now() ? m[1] : null;
}
