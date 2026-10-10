#!/usr/bin/env node
// PEMANTAU SITUS (10 Oktober 2026) — dijalankan cron HOST tiap 2 menit, DI LUAR aplikasi, supaya tetap bisa mengabari saat
// aplikasinya sendiri yang mati. Kabar dikirim lewat bot Telegram sekolah ke Superadmin yang menautkan Telegram-nya
// (token & daftar obrolan dibaca dari basis data, lalu disinggahkan di berkas 0600 untuk dipakai saat basis data ikut mati).
// Yang dipantau: aplikasi + basis data menjawab (/api/sehat), disk hampir penuh, dan server yang baru menyala setelah mati.
// Yang TIDAK bisa dipantau dari sini: listrik/internet sekolah padam — mesin ini ikut mati. Itu baru terlihat saat menyala lagi.
// Pasang: */2 * * * * /usr/bin/node /root/smk-almunawwir/scripts/pantau-situs.mjs >> /root/pantau/situs.log 2>&1
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createDecipheriv, createHash } from "node:crypto";

const DIR = "/root/pantau", BERKAS = `${DIR}/situs.json`, AKAR = "/root/smk-almunawwir";
const kini = Date.now(), menit = ms => Math.round(ms / 60000);
mkdirSync(DIR, { recursive: true });
let k = {}; try { k = JSON.parse(readFileSync(BERKAS, "utf8")); } catch {}
const simpan = () => { writeFileSync(BERKAS, JSON.stringify(k)); chmodSync(BERKAS, 0o600); };
const sql = q => execFileSync("docker", ["exec", "-i", "smk_almunawwir_db", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'], { input: q, timeout: 15000 }).toString().trim();

// Token bot & obrolan Superadmin — diperbarui tiap kali basis data bisa dibaca.
try {
  const rahasia = /^SESSION_SECRET=["']?([^"'\n]+)/m.exec(readFileSync(`${AKAR}/.env`, "utf8"))?.[1] ?? "smk-almunawwir-iibs-secret-change-in-production-2026";
  const simpanan = sql(`select value from "SiteSetting" where key='telegram.token';`);
  if (simpanan) {
    const [, iv, tag, isi] = simpanan.split(":");
    const d = createDecipheriv("aes-256-gcm", createHash("sha256").update(`telegram-token|${rahasia}`).digest(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    k.token = Buffer.concat([d.update(Buffer.from(isi, "base64")), d.final()]).toString("utf8");
    k.obrolan = sql(`select t."chatId" from "TautanTelegram" t join "User" u on u.id=t."userId" where u.role='ADMIN' and t.aktif;`).split("\n").filter(Boolean);
  } else { delete k.token; k.obrolan = []; }
} catch { /* basis data tidak terjangkau — pakai singgahan terakhir */ }

async function kabari(judul, isi) {
  console.log(new Date().toISOString(), judul, "—", isi);
  if (!k.token) return;
  for (const chat of k.obrolan ?? []) {
    await fetch(`https://api.telegram.org/bot${k.token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chat_id: chat, text: `${judul}\n${isi}` }) }).catch(() => null);
  }
}

// 1. Server baru menyala setelah mati (jeda antar-jalan jauh di atas 2 menit).
if (k.terakhir && kini - k.terakhir > 10 * 60000) await kabari("🔌 Server menyala kembali", `Pemantau tidak berjalan selama ±${menit(kini - k.terakhir)} menit — server atau listrik sempat mati.`);
k.terakhir = kini;

// 2. Aplikasi + basis data.
let sehat = false, sebab = "tidak menjawab";
try { const r = await fetch("http://127.0.0.1:3000/api/sehat", { signal: AbortSignal.timeout(12000) }); sehat = r.ok; if (!r.ok) sebab = r.status === 503 ? "basis data tidak menjawab" : `HTTP ${r.status}`; } catch {}
if (sehat) {
  if (k.mati) await kabari("✅ Situs pulih", `Situs kembali menjawab setelah ±${menit(kini - k.matiSejak)} menit.`);
  k.gagal = 0; k.mati = false;
} else {
  k.gagal = (k.gagal ?? 0) + 1;
  if (k.gagal === 1) k.matiSejak = kini;
  // Dua kali berturut-turut (±4 menit) baru dikabari — memasang versi baru memang membuat situs berhenti ±1 menit.
  if (k.gagal >= 2 && !k.mati) { k.mati = true; await kabari("🚨 Situs sekolah tidak menjawab", `Sebab: ${sebab}. Sudah ±${menit(kini - k.matiSejak) || 2} menit.`); }
}

// 3. Disk (sekali sehari selama di atas ambang).
try {
  const pakai = Number(execFileSync("df", ["--output=pcent", "/"]).toString().replace(/\D+/g, " ").trim());
  if (pakai >= 90 && kini - (k.diskKabar ?? 0) > 20 * 3600000) { k.diskKabar = kini; await kabari("💾 Disk server hampir penuh", `Terpakai ${pakai}%. Pangkas image & cache Docker lama.`); }
} catch {}
simpan();
