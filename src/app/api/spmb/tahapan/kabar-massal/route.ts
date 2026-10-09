import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { kabariCalon } from "@/lib/spmb-kabar";
import { lahirIso, tandaFormulir } from "@/lib/spmb-tanda";
import { aturanTahapan, denganBayar, jadwalDenganSesi, PILIH_TAHAPAN, ringkasBayar, setelanBayar, tautanTahapan } from "@/lib/spmb-tahapan-server";
import { PESAN_TERTAHAN, bacaPakta, kunciTertahan, susunTahapan } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** KABARI MASSAL calon yang tertahan (7 Okt 2026). Kabar dicatat di halaman tahapan calon + dikirim ke HP yang
 *  mengaktifkan pemberitahuan. Calon tanpa pemberitahuan dikembalikan sebagai daftar tombol WhatsApp — situs
 *  tidak bisa mengirim WA sendiri. Satu calon paling banyak SEKALI per hari (kunci per tanggal WIB), jadi tombol
 *  yang tertekan dua kali tidak membanjiri HP orang tua. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json().catch(() => ({}));
    const ids: string[] = [...new Set<string>((Array.isArray(b?.ids) ? b.ids : []).map((x: unknown) => String(x)))].slice(0, 300);
    const pesanBebas = String(b?.pesan ?? "").trim().slice(0, 600);
    if (!ids.length) return NextResponse.json({ error: "Pilih calon yang akan dikabari." }, { status: 400 });

    const [calon, aturan, setBayar, peta, s] = await Promise.all([
      prisma.admission.findMany({
        where: { id: { in: ids }, studentId: null },
        select: {
          ...PILIH_TAHAPAN, id: true, nomor: true, fullName: true, phone: true, birthDate: true, sesiId: true, sesi: true,
          gelombang: { select: { jadwalTahap: true, _count: { select: { sesi: true } } } },
          _count: { select: { langgananSpmb: true } },
        },
      }),
      aturanTahapan(), setelanBayar(), ringkasBayar(ids), getSettings(["spmb.pakta", "school.name"]),
    ]);
    const pakta = bacaPakta(s["spmb.pakta"]);
    const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
    const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

    let dicatat = 0, sudahHariIni = 0, keHp = 0;
    const tanpaHp: { id: string; nama: string; nomor: string | null; wa: string }[] = [];
    for (const mentah of calon) {
      const a = denganBayar(mentah, setBayar, peta);
      const { tahap, tuntas } = susunTahapan(a, aturan, jadwalDenganSesi(a.gelombang?.jadwalTahap, a.sesi));
      if (tuntas) continue;
      const kini = tahap.find(t => t.status === "BERJALAN" || t.status === "PERBAIKAN");
      const k = kunciTertahan(kini, {
        sesiId: a.sesiId, adaSesi: (a.gelombang?._count.sesi ?? 0) > 0, daftarUlangConfirmedAt: a.daftarUlangConfirmedAt,
        bayarCukup: a.bayar.cukup, paktaPerlu: pakta.aktif && pakta.wajib && !a.paktaAt,
      });
      const isi = pesanBebas || (k ? PESAN_TERTAHAN[k] : `Pendaftaran Anda sedang di tahap ${kini?.judul ?? "berikutnya"}. Pantau perkembangannya di halaman tahapan.`);
      const baru = await kabariCalon(a.id, { kunci: `spmb-ingat-manual:${a.id}:${hari}`, judul: "Pengingat dari panitia SPMB", isi }).catch(() => false);
      if (baru) { dicatat++; if (a._count.langgananSpmb) keHp++; } else sudahHariIni++;
      if (!a._count.langgananSpmb && a.phone) {
        const tautan = a.nomor ? tautanTahapan(a.nomor, tandaFormulir(a.nomor, lahirIso(a.birthDate))) : "";
        const teks = `Assalamu'alaikum. Kami panitia SPMB ${sekolah} menyampaikan pengingat untuk ${a.fullName}${a.nomor ? ` (no. pendaftaran ${a.nomor})` : ""}.\n\n${isi}${tautan ? `\n\nHalaman tahapan: ${tautan}` : ""}\n\nTerima kasih.`;
        const wa = a.phone.replace(/\D/g, "").replace(/^0/, "62");
        tanpaHp.push({ id: a.id, nama: a.fullName, nomor: a.nomor, wa: `https://wa.me/${wa}?text=${encodeURIComponent(teks)}` });
      }
    }
    await logActivity(session, { action: "UPDATE", entity: "Admission", description: `SPMB: mengabari ${dicatat} calon tertahan` }).catch(() => null);
    return NextResponse.json({ dicatat, sudahHariIni, keHp, tanpaHp });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal mengirim kabar" }, { status: 500 });
  }
}
