import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { bacaKontenSpmb, KUNCI_KONTEN_SPMB } from "@/lib/spmb-konten";

/** Gambar pratinjau saat tautan SPMB dibagikan di WA/IG/Facebook (2 Oktober 2026): poster utama +
 *  gelombang yang sedang/akan dibuka + sisa kursi, dibuat dari data saat itu juga.
 *  WAJIB force-dynamic: tanpa itu Next membuatnya SEKALI saat build (DB tidak terjangkau di tahap
 *  build, dan gelombangnya membeku) — pola yang sama dengan manifest.ts (CLAUDE.md #29).
 *  Aplikasi chat menyinggahkan pratinjau sendiri berhari-hari; itu di luar kendali situs. */
export const dynamic = "force-dynamic";
export const alt = "SPMB SMK Al Munawwir IIBS — Pendaftaran Online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Berkas unggahan (`/api/uploads/...` atau `/uploads/...`) / gambar statis → data URL. WEBP & SVG
 *  dilewati (tidak didukung pembuat gambar ini), dan apa pun yang gagal dibaca = tanpa gambar. */
/** Lebar & tinggi asli dari kepala berkas PNG/JPEG — pembuat gambar ini butuh ukuran pasti, dan
 *  memakai ukuran tebakan akan membuat poster gepeng atau terpotong. */
function ukuranGambar(b: Buffer): { w: number; h: number } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

async function dataUrl(alamat: string | null | undefined): Promise<{ src: string; w: number; h: number } | null> {
  if (!alamat) return null;
  const rel = alamat.replace(/^\/api\/uploads\//, "/uploads/").split("?")[0];
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME[ext] || !rel.startsWith("/")) return null;
  const jalur = normalize(join(process.cwd(), "public", rel));
  if (!jalur.startsWith(join(process.cwd(), "public"))) return null;
  try {
    const b = await readFile(jalur);
    const u = ukuranGambar(b);
    return u ? { src: `data:${MIME[ext]};base64,${b.toString("base64")}`, ...u } : null;
  } catch { return null; }
}

export default async function Image() {
  const kini = new Date();
  const [s, gelombang] = await Promise.all([
    getSettings([...KUNCI_KONTEN_SPMB, "logo.emblem", "school.name"]).catch(() => ({} as Record<string, string>)),
    prisma.gelombangSpmb.findMany({
      where: { aktif: true }, orderBy: { buka: "asc" },
      include: { kuota: true, _count: { select: { pendaftar: true } } },
    }).catch(() => []),
  ]);
  const k = bacaKontenSpmb(s);
  const dibuka = gelombang.find(g => g.buka <= kini && g.tutup >= kini);
  const berikut = gelombang.find(g => g.buka > kini);
  const acuan = dibuka ?? berikut;
  const kuota = acuan ? acuan.kuota.reduce((a, x) => a + x.kuota, 0) : 0;
  const sisa = acuan && kuota ? Math.max(0, kuota - acuan._count.pendaftar) : null;
  const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const status = dibuka ? `${dibuka.nama} DIBUKA — sampai ${tgl(dibuka.tutup)}`
    : berikut ? `${berikut.nama} dibuka ${tgl(berikut.buka)}` : "Pantau jadwal pendaftaran berikutnya";

  const [poster, logo] = await Promise.all([dataUrl(k.posters[0]), dataUrl(s["logo.emblem"] || "/images/logo-emblem.png")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 45%, #1B2B6B 100%)", color: "white", padding: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo.src} width={72} height={Math.round((72 * logo.h) / logo.w)} alt="" />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 26, fontWeight: 700 }}>{s["school.name"] || "SMK Al Munawwir IIBS"}</span>
              <span style={{ fontSize: 20, color: "#F5C842" }}>{`SPMB ${k.tahun}`.trim()}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{k.judul || "Penerimaan Murid Baru"}</span>
            {k.subjudul && <span style={{ fontSize: 28, color: "#F5C842", marginTop: 14 }}>{k.subjudul}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ display: "flex", fontSize: 26, fontWeight: 700, background: dibuka ? "#E8A020" : "rgba(255,255,255,.12)", color: dibuka ? "#0F1A45" : "white", padding: "12px 22px", borderRadius: 999, alignSelf: "flex-start" }}>
              {status}
            </span>
            {sisa !== null && <span style={{ fontSize: 26, color: "rgba(255,255,255,.8)" }}>{`Sisa ${sisa} dari ${kuota} kursi · Daftar online dari HP`}</span>}
          </div>
        </div>
        {poster && (() => {
          // Poster UTUH di dalam kotak 380×518 — skala dari ukuran aslinya, tidak dipotong.
          const skala = Math.min(380 / poster.w, 518 / poster.h);
          const w = Math.round(poster.w * skala), h = Math.round(poster.h * skala);
          return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 380 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster.src} width={w} height={h} alt=""
                style={{ borderRadius: 20, border: "5px solid rgba(232,160,32,.6)", transform: "rotate(3deg)" }} />
            </div>
          );
        })()}
      </div>
    ),
    { ...size },
  );
}
