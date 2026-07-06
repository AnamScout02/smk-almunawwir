import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const UMUM = [
  "Pendidikan Agama Islam Dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Pendidikan Jasmani Olahraga dan Kesehatan",
  "Sejarah",
  "Seni Budaya",
  "Muatan Lokal",
];

const KEJURUAN = [
  "Matematika",
  "Bahasa Inggris",
  "Informatika",
  "Projek Ilmu Pengetahuan Alam dan Sosial",
  "a. Projek Ilmu Pengetahuan Alam dan Sosial",
  "a. Dasar Program Keahlian 1",
  "b. Dasar Program Keahlian 2",
  "c. Dasar Program Keahlian 3",
  "d. Dasar Program Keahlian 4",
  "a. Konsentrasi Keahlian 1",
  "b. Konsentrasi Keahlian 2",
  "c. Konsentrasi Keahlian 3",
  "d. Konsentrasi Keahlian 4",
  "Koding dan Kecerdasan Artifisial",
  "Produk Kreatif Dan Kewirausahaan",
];

const DINIYAH = [
  "Qowaid Imla'",
  "Al - Qur'an",
  "Fiqih",
  "Bahasa Arab",
  "Tauhid",
];

const NASIONAL = [
  "Pendidikan Agama Islam dan Budi Pekerti",
  "Pendidikan Pancasila dan Kewarganegaraan",
  "Bahasa Indonesia",
  "Matematika",
  "Bahasa Inggris",
];

const KEWILAYAHAN = [
  "Pendidikan Jasmani, Olahraga dan Kesehatan",
];

const KONSENTRASI: Record<string, string[]> = {
  TKJ: [
    "Teknologi Jaringan Berbasis Luas (Wan)",
    "Administrasi Infrastruktur Jaringan",
    "Administrasi Sistem Jaringan",
    "Teknologi Layanan Jaringan",
    "Produk Kreatif Dan Kewirausahaan",
  ],
  AK: [
    "Praktikum Akuntansi Perusahaan Jasa, Dagang dan Manufaktur",
    "Praktikum Akuntansi Lembaga/Instansi Pemerintah",
    "Akuntansi Keuangan",
    "Komputer Akuntansi",
    "Administrasi Pajak",
    "Produk Kreatif dan Kewirausahaan",
  ],
  ATU: [
    "Agribisnis Ternak Unggas Pedaging",
    "Agribisnis Ternak Unggas Petelur",
    "Agribisnis Pakan Ternak Unggas",
    "Agribisnis Pembibitan Ternak Unggas",
    "Agribisnis Aneka Ternak",
    "Produk Kreatif dan Kewirausahaan",
  ],
  DKV: [
    "Desain Publikasi",
    "Komputer Grafis",
    "Fotografi",
    "Videografi",
    "Produk Kreatif dan Kewirausahaan",
  ],
};

async function main() {
  await prisma.subject.deleteMany({});

  let code = 1;
  const rows: { code: number; name: string; category: string; gradeScope: string; majorId?: string | null; order: number }[] = [];

  let order = 0;
  for (const name of UMUM) rows.push({ code: code++, name, category: "Kelompok Mata Pelajaran Umum", gradeScope: "X_XI", order: order++ });
  for (const name of KEJURUAN) rows.push({ code: code++, name, category: "Kelompok Mata Pelajaran Kejuruan", gradeScope: "X_XI", order: order++ });
  for (const name of DINIYAH) rows.push({ code: code++, name, category: "Mapel Diniyah", gradeScope: "X_XI", order: order++ });

  code = 1;
  order = 0;
  for (const name of NASIONAL) rows.push({ code: code++, name, category: "Muatan Nasional", gradeScope: "XII", order: order++ });
  for (const name of KEWILAYAHAN) rows.push({ code: code++, name, category: "Muatan Kewilayahan", gradeScope: "XII", order: order++ });

  const majors = await prisma.major.findMany({ select: { id: true, code: true } });
  for (const [majorCode, subjects] of Object.entries(KONSENTRASI)) {
    const major = majors.find(m => m.code === majorCode);
    if (!major) { console.warn(`Jurusan dengan kode ${majorCode} tidak ditemukan, dilewati.`); continue; }
    for (const name of subjects) {
      rows.push({ code: code++, name, category: `C3 Kompetensi Keahlian ${majorCode}`, gradeScope: "XII", majorId: major.id, order: order++ });
    }
  }

  await prisma.subject.createMany({ data: rows });
  console.log(`Berhasil menambahkan ${rows.length} kode mata pelajaran.`);
}

main().finally(() => prisma.$disconnect());
