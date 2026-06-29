import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch {
  // .env not found — env vars set externally
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

function rand(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.grade.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.class.deleteMany();
  await prisma.major.deleteMany();
  await prisma.news.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.contactMessage.deleteMany();
  await prisma.gallery.deleteMany();
  await prisma.heroBanner.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.user.deleteMany();

  // === JURUSAN ===
  const [tkj, ak, atu, dkv, dpib] = await Promise.all([
    prisma.major.create({ data: { name: "Teknik Komputer & Jaringan", code: "TKJ", description: "Jaringan, server, cloud, dan cybersecurity.", icon: "🌐" } }),
    prisma.major.create({ data: { name: "Akuntansi", code: "AK", description: "Akuntansi, perpajakan, dan keuangan bisnis.", icon: "📊" } }),
    prisma.major.create({ data: { name: "Agribisnis Ternak Unggas", code: "ATU", description: "Peternakan modern, produksi, dan manajemen agribisnis.", icon: "🐓" } }),
    prisma.major.create({ data: { name: "Desain Komunikasi Visual", code: "DKV", description: "Desain grafis, branding, dan media digital.", icon: "🎨" } }),
    prisma.major.create({ data: { name: "Desain Pemodelan dan Informasi Bangunan", code: "DPIB", description: "AutoCAD, BIM, dan konstruksi digital.", icon: "🏗️" } }),
  ]);
  console.log("✅ Jurusan created");

  // === ADMIN ===
  await prisma.user.create({
    data: {
      name: "Administrator",
      email: "admin@smk-almunawwir.sch.id",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });

  // === GURU ===
  const teacherData = [
    { name: "Ustadz Ahmad Fauzi, S.Kom.", email: "ahmad.fauzi@smk-almunawwir.sch.id", nip: "197501012003011001", subject: "Jaringan Komputer", phone: "081234567890" },
    { name: "Ustadzah Fatimah Rahmawati, S.T.", email: "fatimah@smk-almunawwir.sch.id", nip: "198003012005012002", subject: "Akuntansi Dasar", phone: "081298765432" },
    { name: "Ustadz Hendra Kusuma, S.Pd.", email: "hendra@smk-almunawwir.sch.id", nip: "198205152007011003", subject: "Matematika", phone: "081356789012" },
  ];

  const teachers = await Promise.all(
    teacherData.map(async (t) => {
      const user = await prisma.user.create({
        data: { name: t.name, email: t.email, password: await bcrypt.hash("guru123", 10), role: "TEACHER" },
      });
      const teacher = await prisma.teacher.create({
        data: { userId: user.id, nip: t.nip, subject: t.subject, phone: t.phone },
      });
      return teacher;
    })
  );
  const [t1, t2, t3] = teachers;
  console.log("✅ Guru created");

  // === KELAS ===
  const [cls12tkj, cls12ak, cls11tkj, cls10tkj] = await Promise.all([
    prisma.class.create({ data: { name: "XII TKJ 1", grade: 12, majorId: tkj.id, homeroomId: t1.id } }),
    prisma.class.create({ data: { name: "XII AK 1", grade: 12, majorId: ak.id, homeroomId: t2.id } }),
    prisma.class.create({ data: { name: "XI TKJ 1", grade: 11, majorId: tkj.id, homeroomId: t3.id } }),
    prisma.class.create({ data: { name: "X TKJ 1", grade: 10, majorId: tkj.id } }),
  ]);
  console.log("✅ Kelas created");

  // === SISWA ===
  const studentNames12tkj = [
    "Muhammad Rizky Firmansyah", "Ahmad Fatihul Ulum", "Fauzan Hakim Al-Rashid",
    "Yusuf Maulana Ibrahim", "Bilal Ramadan Saputra", "Zain Abdullah Pratama",
  ];
  const studentNames12ak = [
    "Siti Aisyah Rahmawati", "Nur Fadhilah Hasanah", "Rina Maulida Azzahra",
    "Khadijah Putri Amalia", "Fatimah Az-Zahra Santoso",
  ];
  const studentNames11tkj = [
    "Daffa Naufal Ramadhan", "Arif Hidayatullah", "Syahrul Mubarok", "Nabil Firdaus Hakim",
  ];
  const studentNames10tkj = [
    "Hafidz Al-Qur'an Rasyid", "Ikhwan Muttaqin", "Zakariya Abdurrahman",
  ];

  async function createStudents(
    names: string[],
    classObj: { id: string },
    majorObj: { id: string },
    prefix: string,
    startNis: number,
    loginName: string | null = null
  ) {
    const password = await bcrypt.hash("siswa123", 10);
    return Promise.all(
      names.map(async (name, i) => {
        const nis = String(startNis + i).padStart(7, "0");
        const emailSlug = name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
        const isMain = i === 0 && loginName;
        const user = await prisma.user.create({
          data: {
            name,
            email: isMain ? `${loginName}@siswa.smk-almunawwir.sch.id` : `${emailSlug}${i + 1}@siswa.smk-almunawwir.sch.id`,
            password,
            role: "STUDENT",
          },
        });
        return prisma.student.create({
          data: { userId: user.id, nis, nisn: `006${rand(1000000, 9999999)}`, classId: classObj.id, majorId: majorObj.id },
        });
      })
    );
  }

  const students12tkj = await createStudents(studentNames12tkj, cls12tkj, tkj, "XII-TKJ", 2024001, "rizky");
  const students12ak  = await createStudents(studentNames12ak,  cls12ak,  ak,  "XII-AK",  2024101, "aisyah");
  const students11tkj = await createStudents(studentNames11tkj, cls11tkj, tkj, "XI-TKJ",  2025001, null);
  const students10tkj = await createStudents(studentNames10tkj, cls10tkj, tkj, "X-TKJ",   2026001, null);

  const mainStudent = students12tkj[0];
  console.log("✅ Siswa created");

  // === NILAI (main student) ===
  const subjects = ["Jaringan Komputer", "Keamanan Jaringan", "Matematika", "Bahasa Inggris", "Agama Islam"];
  const gradeTypes = ["Tugas", "Ulangan Harian", "UTS", "UAS"];
  const semesters = ["Ganjil 2024/2025", "Genap 2024/2025", "Ganjil 2025/2026"];

  for (const semester of semesters) {
    for (const subject of subjects) {
      for (const type of gradeTypes) {
        await prisma.grade.create({
          data: {
            studentId: mainStudent.id,
            teacherId: t1.id,
            subject,
            score: rand(type === "UAS" ? 78 : 72, 97),
            type,
            semester,
          },
        });
      }
    }
  }

  // Nilai untuk siswa lain di kelas XII TKJ (semester terbaru saja)
  for (const student of students12tkj.slice(1)) {
    for (const subject of subjects) {
      await prisma.grade.create({
        data: {
          studentId: student.id,
          teacherId: t1.id,
          subject,
          score: rand(68, 95),
          type: "UAS",
          semester: "Ganjil 2025/2026",
        },
      });
    }
  }
  console.log("✅ Nilai created");

  // === ABSENSI (bulan ini + 2 bulan lalu untuk main student) ===
  const today = new Date();
  const attStatuses = ["HADIR", "HADIR", "HADIR", "HADIR", "IZIN"] as const;

  // 2 bulan kebelakang untuk main student
  for (let daysBack = 60; daysBack >= 0; daysBack--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysBack);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekend
    const status = attStatuses[Math.floor(Math.random() * attStatuses.length)];
    await prisma.attendance.create({
      data: { studentId: mainStudent.id, date: d, status },
    });
  }

  // Absensi hari ini untuk semua siswa kelas XII TKJ
  const allStudents = [...students12tkj, ...students12ak, ...students11tkj, ...students10tkj];
  for (const student of allStudents.slice(1)) {
    const status = attStatuses[Math.floor(Math.random() * attStatuses.length)];
    await prisma.attendance.create({
      data: { studentId: student.id, date: today, status },
    });
  }
  console.log("✅ Absensi created");

  // === PKL (main student) ===
  await prisma.internship.create({
    data: {
      studentId: mainStudent.id,
      company: "PT. Telkom Indonesia Regional Jawa Timur",
      position: "Junior Network Engineer Intern",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-04-15"),
      supervisor: "Bpk. Andi Prayogo, S.T.",
      status: "COMPLETED",
    },
  });
  console.log("✅ PKL created");

  // === HERO BANNERS ===
  await Promise.all([
    prisma.heroBanner.create({ data: { title: "Mendidik Generasi Qurani & Terampil", subtitle: "Memadukan kurikulum vokasional nasional dengan pendidikan Islam intensif — menyiapkan generasi berakhlak mulia dan siap dunia kerja global.", linkUrl: "/admissions", linkText: "Daftar Sekarang", order: 1, active: true } }),
    prisma.heroBanner.create({ data: { title: "Boarding School Berkelas Internasional", subtitle: "Lingkungan pesantren modern yang kondusif, fasilitas lengkap, dan pembinaan karakter 24 jam membentuk pribadi unggul.", linkUrl: "/about", linkText: "Pelajari Lebih Lanjut", order: 2, active: true } }),
    prisma.heroBanner.create({ data: { title: "Tahfidz Al-Qur'an & Teknologi Modern", subtitle: "Program tahfidz terintegrasi dengan keahlian teknis — lulusan kami hafal Al-Qur'an sekaligus menguasai teknologi masa depan.", linkUrl: "/programs", linkText: "Lihat Program", order: 3, active: true } }),
  ]);

  // === GALERI ===
  const PH = "/images/placeholder.svg";
  await Promise.all([
    prisma.gallery.create({ data: { title: "Laboratorium Komputer", category: "Fasilitas", imageUrl: PH, caption: "Lab komputer dengan 40 unit PC terbaru", order: 1 } }),
    prisma.gallery.create({ data: { title: "Masjid Al-Munawwir", category: "Fasilitas", imageUrl: PH, caption: "Masjid 2 lantai kapasitas 1000 jamaah", order: 2 } }),
    prisma.gallery.create({ data: { title: "Upacara Hari Pahlawan", category: "Kegiatan", imageUrl: PH, order: 3 } }),
    prisma.gallery.create({ data: { title: "Wisuda Angkatan XII", category: "Kegiatan", imageUrl: PH, caption: "Wisuda dan pelepasan siswa kelas XII", order: 4 } }),
    prisma.gallery.create({ data: { title: "Juara Olimpiade Komputer", category: "Prestasi", imageUrl: PH, order: 5 } }),
    prisma.gallery.create({ data: { title: "Asrama Putra", category: "Fasilitas", imageUrl: PH, caption: "Asrama modern kapasitas 400 santri", order: 6 } }),
    prisma.gallery.create({ data: { title: "Kegiatan Pramuka", category: "Kegiatan", imageUrl: PH, order: 7 } }),
    prisma.gallery.create({ data: { title: "Seminar Kewirausahaan", category: "Kegiatan", imageUrl: PH, order: 8 } }),
  ]);

  // === BERITA ===
  await Promise.all([
    prisma.news.create({ data: { title: "Siswa TKJ Al-Munawwir Raih Juara 1 Lomba Jaringan Komputer Nasional 2026", slug: "juara-1-lomba-jaringan-nasional", content: "Tim siswa Teknik Komputer & Jaringan SMK Al-Munawwir berhasil meraih juara pertama dalam kompetisi jaringan komputer tingkat nasional yang diikuti 500+ sekolah se-Indonesia. Keberhasilan ini merupakan buah dari dedikasi dan kerja keras siswa yang didukung penuh oleh bimbingan guru-guru berpengalaman di Kabupaten Banyuwangi.", category: "Prestasi", published: true } }),
    prisma.news.create({ data: { title: "PPDB 2026/2027 Resmi Dibuka — Beasiswa Tersedia", slug: "ppdb-2026-2027-resmi-dibuka", content: "Penerimaan Peserta Didik Baru tahun pelajaran 2026/2027 telah resmi dibuka. Tersedia beasiswa prestasi akademik dan beasiswa tahfidz Al-Qur'an. Pendaftaran dapat dilakukan secara online melalui website resmi sekolah.", category: "Pengumuman", published: true } }),
    prisma.news.create({ data: { title: "Ramadan Camp 1447H: Menghidupkan Malam dengan Ibadah", slug: "ramadan-camp-1447h", content: "SMK Al-Munawwir menggelar Ramadan Camp selama 10 hari penuh. Seluruh siswa menghidupkan malam Ramadan dengan tahajud, tilawah, dan berbagi sesama warga sekitar pesantren.", category: "Kegiatan", published: true } }),
    prisma.news.create({ data: { title: "SMK Al-Munawwir Teken MoU dengan 5 Perusahaan Teknologi", slug: "mou-perusahaan-teknologi-2026", content: "Dalam rangka mempersiapkan lulusan yang siap kerja, SMK Al-Munawwir IIBS menandatangani MoU dengan 5 perusahaan teknologi terkemuka di Jawa Timur untuk program magang, rekrutmen langsung, dan pengembangan kurikulum.", category: "Pengumuman", published: true } }),
  ]);

  // === PESAN & PENDAFTARAN CONTOH ===
  await prisma.contactMessage.create({ data: { name: "Bapak Hendra Wijaya", email: "hendra@gmail.com", subject: "Informasi Biaya Pendaftaran", message: "Assalamualaikum, saya ingin mengetahui lebih lanjut mengenai biaya pendaftaran dan beasiswa yang tersedia. Terima kasih." } });
  await prisma.admission.create({ data: { fullName: "Ahmad Rasyid Hamdani", email: "rasyid@gmail.com", phone: "087812345678", birthDate: new Date("2009-05-15"), previousSchool: "MTs Negeri 1 Banyuwangi", chosenMajor: "Teknik Komputer & Jaringan (TKJ)", status: "PENDING" } });
  await prisma.admission.create({ data: { fullName: "Naila Fatimah Zahro", email: "naila@gmail.com", phone: "082345678901", birthDate: new Date("2009-08-22"), previousSchool: "SMP Islam Al-Huda", chosenMajor: "Akuntansi (AK)", status: "WAWANCARA", notes: "Harap hadir Senin 30 Juni jam 09.00 WIB untuk wawancara." } });

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📋 Akun Login:");
  console.log("  Admin   → admin@smk-almunawwir.sch.id     / admin123");
  console.log("  Guru    → ahmad.fauzi@smk-almunawwir.sch.id / guru123");
  console.log("  Siswa   → rizky@siswa.smk-almunawwir.sch.id / siswa123");
  console.log("\n📊 Data:");
  console.log(`  ${students12tkj.length + students12ak.length + students11tkj.length + students10tkj.length} siswa · 4 kelas · 3 guru`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
