import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  console.log("🗑️  Menghapus data terkait...");
  await prisma.grade.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.internship.deleteMany({});
  await prisma.schedule.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("✅ Akun lama dihapus.");

  const password = await bcrypt.hash("Almunawwir1", 10);

  const users: Array<{
    name: string;
    email: string;
    role: "ADMIN" | "TAS" | "TEACHER" | "STUDENT";
    jabatan: string;
    nip?: string;
    subject?: string;
    nis?: string;
  }> = [
    {
      name: "Super Admin",
      email: "suadmin@smkalmunawwiriibs.sch.id",
      role: "ADMIN",
      jabatan: "Superadmin",
    },
    {
      name: "Admin & Kepala Sekolah",
      email: "admin@smkalmunawwiriibs.sch.id",
      role: "ADMIN",
      jabatan: "Kepala Sekolah",
    },
    {
      name: "M. Anam",
      email: "m.anam@smkalmunawwiriibs.sch.id",
      role: "TAS",
      jabatan: "Guru / TAS",
    },
    {
      name: "Lutfi Amila",
      email: "lutfiamila@smkalmunawwiriibs.sch.id",
      role: "TAS",
      jabatan: "TAS",
    },
    {
      name: "Guru Contoh",
      email: "guru-contoh@smkalmunawwiriibs.sch.id",
      role: "TEACHER",
      jabatan: "Guru",
      nip: "199901012023011001",
      subject: "Contoh Mata Pelajaran",
    },
    {
      name: "Siswa Contoh",
      email: "siswa-contoh@smkalmunawwiriibs.sch.id",
      role: "STUDENT",
      jabatan: "Siswa",
      nis: "2024001",
    },
  ];

  // Ambil major pertama yang ada untuk siswa contoh
  let major = await prisma.major.findFirst();
  if (!major) {
    major = await prisma.major.create({
      data: {
        name: "Teknik Komputer dan Jaringan",
        code: "TKJ",
        description: "Program keahlian Teknik Komputer dan Jaringan",
      },
    });
    console.log("📚 Jurusan TKJ dibuat sebagai default.");
  }

  console.log("\n👤 Membuat akun baru...");
  for (const u of users) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password,
        role: u.role,
        jabatan: u.jabatan,
      },
    });

    if (u.role === "TEACHER" && u.nip) {
      await prisma.teacher.create({
        data: {
          userId: user.id,
          nip: u.nip,
          subject: u.subject ?? "Belum diisi",
        },
      });
    }

    if (u.role === "STUDENT" && u.nis) {
      await prisma.student.create({
        data: {
          userId: user.id,
          nis: u.nis,
          majorId: major.id,
          studentStatus: "AKTIF",
        },
      });
    }

    console.log(`  ✅ ${u.jabatan.padEnd(20)} | ${u.email}`);
  }

  console.log("\n🎉 Selesai! Akun yang berhasil dibuat:");
  console.log("┌─────────────────────────────────┬────────────────────────────────────────────────┬─────────────────┐");
  console.log("│ Role/Jabatan                    │ Email                                          │ Password        │");
  console.log("├─────────────────────────────────┼────────────────────────────────────────────────┼─────────────────┤");
  for (const u of users) {
    const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
    console.log(`│ ${pad(u.jabatan, 31)} │ ${pad(u.email, 46)} │ Almunawwir1     │`);
  }
  console.log("└─────────────────────────────────┴────────────────────────────────────────────────┴─────────────────┘");
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
