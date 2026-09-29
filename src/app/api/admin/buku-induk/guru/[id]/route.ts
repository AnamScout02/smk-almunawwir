import { NextRequest, NextResponse } from "next/server";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { normalizeBukuIndukText } from "@/lib/text";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyBukuIndukFullAccess();
  const { id } = await params;
  const body = await req.json();
  const {
    birthPlace, birthDate, gender, religion, address,
    education, position, startDate, teacherStatus, teacherNotes, phone,
    bukuIndukData, password,
    // Nama, NIP & mata pelajaran DIEDIT DI SINI juga. Sebelumnya ketiganya hanya bisa diubah dari
    // Akun Pengguna / Kelola Guru sehingga Buku Induk Guru — dokumen resmi kepegawaian — justru
    // tidak bisa memperbaiki nama gurunya sendiri (keluhan user 29 September 2026: "edit nama buku
    // induk guru gimana", "kenapa dobel-dobel tempatnya").
    name, nip, subject,
  } = body;

  try {
    // Jika ada password baru, update password user
    if (password && typeof password === "string" && password.trim().length >= 1) {
      const hashed = await bcrypt.hash(password, 12);
      const teacherRef = await prisma.teacher.findUnique({ where: { id }, select: { userId: true, user: { select: { name: true, email: true } } } });
      if (teacherRef) {
        await prisma.user.update({ where: { id: teacherRef.userId }, data: { password: hashed } });
        await cabutSemuaSesiPengguna(teacherRef.userId, "GANTI_PASSWORD");
        await logActivity(session, {
          action: "RESET_PASSWORD", entity: "Teacher", entityId: id,
          description: `${session.name} mereset password guru/pegawai "${teacherRef.user.name}" (${teacherRef.user.email})`,
        });
      }
    }

    // Nama disimpan di `User`, NIP & mapel di `Teacher` — diperbarui hanya bila benar-benar dikirim
    // dan benar-benar berubah, supaya halaman lain yang tidak mengirimnya tidak ikut mengosongkan.
    const lama = await prisma.teacher.findUnique({
      where: { id },
      select: { nip: true, subject: true, userId: true, user: { select: { name: true } } },
    });
    if (!lama) return NextResponse.json({ error: "Guru tidak ditemukan" }, { status: 404 });

    const namaBaru = typeof name === "string" ? name.trim() : "";
    const nipBaru = typeof nip === "string" ? nip.trim() : "";
    const mapelBaru = typeof subject === "string" ? subject.trim() : "";
    const berubah: string[] = [];

    if (nipBaru && nipBaru !== lama.nip) {
      const bentrok = await prisma.teacher.findFirst({ where: { nip: nipBaru, id: { not: id } }, select: { user: { select: { name: true } } } });
      if (bentrok) {
        return NextResponse.json({ error: `NIP ${nipBaru} sudah dipakai ${bentrok.user.name}.` }, { status: 409 });
      }
      berubah.push(`NIP ${lama.nip} → ${nipBaru}`);
    }
    if (namaBaru && namaBaru !== lama.user.name) {
      await prisma.user.update({ where: { id: lama.userId }, data: { name: namaBaru } });
      berubah.push(`Nama "${lama.user.name}" → "${namaBaru}"`);
    }
    if (mapelBaru && mapelBaru !== lama.subject) berubah.push(`Mapel "${lama.subject}" → "${mapelBaru}"`);

    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        phone:         phone || null,
        birthPlace:    birthPlace || null,
        birthDate:     birthDate ? new Date(birthDate) : null,
        gender:        gender || null,
        religion:      religion || null,
        address:       address || null,
        education:     education || null,
        position:      position || null,
        startDate:     startDate ? new Date(startDate) : null,
        teacherStatus: teacherStatus || "AKTIF",
        teacherNotes:  teacherNotes || null,
        ...(nipBaru ? { nip: nipBaru } : {}),
        ...(mapelBaru ? { subject: mapelBaru } : {}),
        ...(bukuIndukData !== undefined ? { bukuIndukData: normalizeBukuIndukText(bukuIndukData) } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        homeroomOf: { select: { name: true } },
      },
    });
    if (berubah.length > 0) {
      await logActivity(session, {
        action: "UPDATE", entity: "Teacher", entityId: id,
        description: `${session.name} mengubah identitas guru "${teacher.user.name}": ${berubah.join("; ")}`,
        metadata: { berubah },
      });
    }
    return NextResponse.json(teacher);
  } catch (err) {
    console.error("[buku-induk guru PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan guru" }, { status: 500 });
  }
}
