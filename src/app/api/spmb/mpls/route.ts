import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { assertSpmb } from "@/lib/spmb";
import { keadaanMpls } from "@/lib/spmb-mpls";
import { isoWib, tengahMalamWib } from "@/lib/kegiatan-qr";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const k = await keadaanMpls();
    const dalam = new Set(k.kegiatan?.targetUserIds ?? []);
    return NextResponse.json({
      mpls: k.mpls, resmi: k.resmi, siapIkut: k.pesertaUserIds.length, belumSiswa: k.belumSiswa,
      // Peserta yang belum masuk Kegiatan (mis. calon yang baru tuntas setelah kegiatan dibuat).
      baru: k.pesertaUserIds.filter(id => !dalam.has(id)).length,
      kegiatan: k.kegiatan ? { ...k.kegiatan, peserta: k.kegiatan.targetUserIds.length, targetUserIds: undefined } : null,
      halamanKegiatan: session.role === "TEACHER" ? "/dashboard/teacher/kegiatan" : "/dashboard/admin/kegiatan",
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Buat / perbarui Kegiatan MPLS dari Info MPLS (Pengaturan SPMB → Tahapan Calon) + jam harian. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json().catch(() => ({}));
    const jam = (v: unknown) => (/^\d{2}:\d{2}$/.test(String(v ?? "")) ? String(v) : "");
    const jamMulai = jam(b?.jamMulai), jamSelesai = jam(b?.jamSelesai);
    if (!jamMulai || !jamSelesai || jamSelesai <= jamMulai) return NextResponse.json({ error: "Isi jam mulai & selesai harian MPLS dengan benar." }, { status: 400 });
    const k = await keadaanMpls();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k.mpls.mulai)) return NextResponse.json({ error: "Tanggal mulai MPLS belum diisi di Pengaturan SPMB → Tahapan Calon → MPLS." }, { status: 409 });
    const sampaiIso = /^\d{4}-\d{2}-\d{2}$/.test(k.mpls.selesai) && k.mpls.selesai > k.mpls.mulai ? k.mpls.selesai : "";
    const hari = sampaiIso ? Math.round((tengahMalamWib(sampaiIso).getTime() - tengahMalamWib(k.mpls.mulai).getTime()) / 86_400_000) + 1 : 1;
    if (hari > 60) return NextResponse.json({ error: "MPLS paling lama 60 hari." }, { status: 400 });
    const mulai = new Date(`${k.mpls.mulai}T${jamMulai}:00+07:00`), selesai = new Date(`${k.mpls.mulai}T${jamSelesai}:00+07:00`);
    const sampaiTanggal = sampaiIso ? tengahMalamWib(sampaiIso) : null;
    const tempat = String(b?.tempat ?? k.mpls.tempat ?? "").trim().slice(0, 150) || null;
    const data = {
      judul: (k.mpls.judul || "MPLS").slice(0, 200), jenis: "KEGIATAN", tempat, mulai, selesai, sampaiTanggal,
      targetRole: "STUDENT", targetKelasIds: [], targetJurusanIds: [], targetJabatan: [], targetUserIds: k.pesertaUserIds,
      catatan: "Dibuat dari Pusat SPMB — peserta = calon yang resmi mengikuti MPLS.",
    };

    let id = k.kegiatan?.id ?? null;
    if (id) {
      // Pola #100: rentang tidak boleh dipersempit melewati hari yang sudah punya catatan kehadiran.
      const akhir = sampaiTanggal ?? tengahMalamWib(k.mpls.mulai);
      const luar = await prisma.presensiKegiatan.count({ where: { kegiatanId: id, OR: [{ tanggal: { lt: tengahMalamWib(k.mpls.mulai) } }, { tanggal: { gt: akhir } }] } });
      if (luar) return NextResponse.json({ error: "Sudah ada catatan kehadiran di luar tanggal MPLS yang baru. Sesuaikan tanggalnya dulu." }, { status: 409 });
      await prisma.kegiatan.update({ where: { id }, data });
    } else {
      const baru = await prisma.kegiatan.create({ data: { ...data, pembuatId: session.userId, pembuatNama: session.name, statusPersetujuan: "DISETUJUI" } });
      id = baru.id;
      await prisma.siteSetting.upsert({ where: { key: "spmb.mplsKegiatanId" }, update: { value: id }, create: { key: "spmb.mplsKegiatanId", value: id } });
    }
    await logActivity(session, { action: k.kegiatan ? "UPDATE" : "CREATE", entity: "Kegiatan", entityId: id, description: `SPMB: ${k.kegiatan ? "memperbarui" : "membuat"} kegiatan MPLS (${k.pesertaUserIds.length} peserta, ${isoWib(mulai)}${sampaiIso ? ` s.d. ${sampaiIso}` : ""})` }).catch(() => null);
    return NextResponse.json({ ok: true, id, peserta: k.pesertaUserIds.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
