import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJaringan } from "@/lib/jaringan-guard";
import { withMikrotik, MikrotikRow } from "@/lib/mikrotik";

export const dynamic = "force-dynamic";

const MARKER_PREFIX = "sid:";
const DEFAULT_RATE_LIMIT = "5M/5M";
const GURU_PROFILE = "GURU";
const STAFF_PROFILE = "ADMIN";
const MAX_CONFLICTS_REPORTED = 20;

interface Target { id: string; username: string; name: string; profile: string }

/** Sinkronkan akun hotspot siswa/guru/pegawai dari data sistem — buat/perbarui akun & profil per kelas
 *  (siswa) / GURU / ADMIN, nonaktifkan akun yang pemiliknya sudah tidak aktif lagi. Dicocokkan lewat
 *  marker "sid:<id>" di kolom comment (bukan lewat username) supaya tetap sinkron walau NIS/NIP berubah.
 *  Setiap target diproses dalam try/catch sendiri — satu konflik (mis. username sudah dipakai akun
 *  hotspot lama yang dibuat manual) tidak boleh menggagalkan seluruh proses untuk semua siswa/guru lain. */
export async function POST() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertJaringan(session);

    try {
      const [students, teachers, staff] = await Promise.all([
        prisma.student.findMany({
          where: { studentStatus: "AKTIF" },
          select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
        }),
        prisma.teacher.findMany({
          select: { id: true, nip: true, user: { select: { name: true } } },
        }),
        prisma.user.findMany({
          where: { role: { in: ["TAS", "ADMIN"] } },
          select: { id: true, name: true, email: true },
        }),
      ]);

      const targets: Target[] = [
        ...students.map((s) => ({ id: s.id, username: s.nis, name: s.user.name, profile: s.class?.name ?? "Tanpa Kelas" })),
        ...teachers.map((t) => ({ id: t.id, username: t.nip, name: t.user.name, profile: GURU_PROFILE })),
        ...staff.map((u) => ({ id: u.id, username: u.email.split("@")[0], name: u.name, profile: STAFF_PROFILE })),
      ];

      const summary = await withMikrotik(async (conn) => {
        const [existingUsers, existingProfiles] = await Promise.all([
          conn.write("/ip/hotspot/user/print") as Promise<MikrotikRow[]>,
          conn.write("/ip/hotspot/user/profile/print") as Promise<MikrotikRow[]>,
        ]);

        const profileNames = new Set(existingProfiles.map((p) => p.name));
        const byMarker = new Map<string, MikrotikRow>();
        const byName = new Map<string, MikrotikRow>();
        for (const u of existingUsers) {
          byName.set(u.name, u);
          const marker = (u.comment ?? "").split(" ")[0];
          if (marker.startsWith(MARKER_PREFIX)) byMarker.set(marker.slice(MARKER_PREFIX.length), u);
        }

        let profilesCreated = 0, created = 0, updated = 0, disabled = 0;
        const conflicts: string[] = [];
        const activeIds = new Set(targets.map((t) => t.id));

        for (const t of targets) {
          try {
            if (!profileNames.has(t.profile)) {
              await conn.write("/ip/hotspot/user/profile/add", [`=name=${t.profile}`, `=rate-limit=${DEFAULT_RATE_LIMIT}`]);
              profileNames.add(t.profile);
              profilesCreated++;
            }

            const marker = `${MARKER_PREFIX}${t.id}`;
            const comment = `${marker} ${t.name}`;
            const existing = byMarker.get(t.id);

            if (!existing) {
              const clash = byName.get(t.username);
              if (clash) {
                conflicts.push(`${t.username} (${t.name}) — username sudah dipakai akun hotspot lain yang tidak berelasi`);
                continue;
              }
              await conn.write("/ip/hotspot/user/add", [
                `=name=${t.username}`, `=password=${t.username}`, `=profile=${t.profile}`, `=comment=${comment}`,
              ]);
              byName.set(t.username, { name: t.username } as MikrotikRow);
              created++;
            } else if (existing.name !== t.username || existing.profile !== t.profile || existing.disabled === "true") {
              const clash = byName.get(t.username);
              if (clash && clash !== existing) {
                conflicts.push(`${t.username} (${t.name}) — username tujuan sudah dipakai akun hotspot lain`);
                continue;
              }
              await conn.write("/ip/hotspot/user/set", [
                `=.id=${existing[".id"]}`, `=name=${t.username}`, `=password=${t.username}`, `=profile=${t.profile}`,
                `=comment=${comment}`, "=disabled=no",
              ]);
              updated++;
            }
          } catch (e) {
            conflicts.push(`${t.username} (${t.name}) — ${e instanceof Error ? e.message : "gagal diproses"}`);
          }
        }

        for (const [id, u] of byMarker) {
          if (!activeIds.has(id) && u.disabled !== "true") {
            try {
              await conn.write("/ip/hotspot/user/set", [`=.id=${u[".id"]}`, "=disabled=yes"]);
              disabled++;
            } catch { /* biarkan, tidak fatal */ }
          }
        }

        return {
          created, updated, disabled, profilesCreated, totalAktif: targets.length,
          skipped: conflicts.length,
          conflicts: conflicts.slice(0, MAX_CONFLICTS_REPORTED),
        };
      });

      return NextResponse.json(summary);
    } catch (e) {
      console.error("[jaringan hotspot-users sync]", e);
      return NextResponse.json({ error: "Gagal sinkronisasi ke Mikrotik" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Pengelola Jaringan Sekolah." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
