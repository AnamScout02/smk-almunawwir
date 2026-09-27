import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { sesiMasihHidup } from "@/lib/sesi-server";
import { susunPapanPantau, sidikPapan } from "@/lib/pantau-ujian";

export const dynamic = "force-dynamic";

const JEDA_MS = 2000;         // periksa perubahan tiap 2 detik
const SEGARKAN_MS = 15_000;   // kirim ulang papan penuh minimal tiap 15 detik (sisa waktu, denyut terakhir)
const UMUR_MS = 10 * 60_000;  // stream menutup sendiri; EventSource menyambung ulang lewat proxy → sesi & akses diperiksa ulang

/** PAPAN PANTAU LANGSUNG (Server-Sent Events). Pasangan hook `usePantauLangsung` di browser.
 *
 * Isi tiap kiriman sama persis dengan GET /pantau (lihat `susunPapanPantau`), tapi hanya dikirim saat ada
 * yang berubah — siswa mulai/selesai/terputus/menjawab/melanggar, token berganti — jadi pengawas melihat
 * perubahan dalam ±2 detik tanpa layar memuat ulang tiap 5 detik. Di antara kiriman ada komentar `: detak`
 * supaya koneksi yang putus cepat ketahuan dan proxy tidak menahan stream.
 *
 * `Cache-Control: no-transform` WAJIB: tanpa itu kompresi respons menahan potongan stream di buffer dan
 * papan baru sampai berkelompok (terlambat puluhan detik). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

  const enc = new TextEncoder();
  const tidur = (ms: number) => new Promise(r => setTimeout(r, ms));

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const tulis = (teks: string) => {
        try { ctrl.enqueue(enc.encode(teks)); return true; } catch { return false; }
      };
      tulis("retry: 3000\n\n");
      const mulai = Date.now();
      let sidik = "";
      let kirimTerakhir = 0;
      let putaran = 0;

      while (!req.signal.aborted && Date.now() - mulai < UMUR_MS) {
        try {
          // Sesi dicabut (logout di perangkat lain, dicabut admin) → berhenti, jangan terus mengalirkan data.
          if (putaran % 5 === 0 && session.sid && !(await sesiMasihHidup(session.sid))) {
            tulis(`event: tutup\ndata: {"alasan":"sesi"}\n\n`);
            break;
          }
          const exam = await ujianDalamCakupan(session, id);
          if (!exam) {
            tulis(`event: tutup\ndata: {"alasan":"akses"}\n\n`);
            break;
          }
          const papan = await susunPapanPantau(exam);
          const s = sidikPapan(papan);
          if (s !== sidik || Date.now() - kirimTerakhir >= SEGARKAN_MS) {
            if (!tulis(`event: papan\ndata: ${JSON.stringify(papan)}\n\n`)) break;
            sidik = s;
            kirimTerakhir = Date.now();
          } else if (!tulis(": detak\n\n")) {
            break;
          }
        } catch (galat) {
          lemparBilaPengalihan(galat);
          // Database sesaat tak terjangkau: jangan putuskan pengawas, coba lagi di putaran berikut.
          if (!tulis(": galat sementara\n\n")) break;
        }
        putaran++;
        await tidur(JEDA_MS);
      }
      try { ctrl.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
