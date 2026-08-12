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

const masterData = [
  { category: "bulan", label: "Bulan", items: ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"] },
  { category: "jenis_kelamin", label: "Jenis Kelamin", items: ["Laki-Laki","Perempuan"] },
  { category: "jumlah_saudara", label: "Jumlah Saudara", items: ["01 (Satu)","02 (Dua)","03 (Tiga)","04 (Empat)","05 (Lima)","06 (Enam)","07 (Tujuh)","08 (Delapan)","09 (Sembilan)","10 (Sepuluh)"] },
  { category: "bahasa", label: "Bahasa", items: ["Oseng","Madura","Bali","Jawa","Bahasa Indonesia"] },
  { category: "golongan_darah", label: "Golongan Darah", items: ["A","B","AB","O","Tidak Tahu"] },
  { category: "kesenian", label: "Kesenian", items: ["Seni Tari","Seni Melukis","Seni Menyanyi","Seni Teater"] },
  { category: "olahraga", label: "Olahraga", items: ["Sepak Bola","Bola Voly","Badminton","Tenis Meja","Pencak Silat","Basket"] },
  { category: "organisasi", label: "Organisasi", items: ["OSIS","Pramuka","PMII","IPPNU/IPNU"] },
  { category: "lama_belajar", label: "Lama Belajar", items: ["3 (Tiga) Tahun","4 (Empat) Tahun"] },
  { category: "tingkat_masuk", label: "Diterima di Tingkat", items: ["X (Sepuluh)","XI (Sebelas)","XII (Dua Belas)"] },
  { category: "rt", label: "RT", items: ["RT/01","RT/02","RT/03","RT/04","RT/05","RT/06","RT/07","RT/08","RT/09","RT/10"] },
  { category: "rw", label: "RW", items: ["RW/01","RW/02","RW/03","RW/04","RW/05","RW/06","RW/07","RW/08","RW/09","RW/10"] },
  { category: "agama", label: "Agama", items: ["Islam","Kristen","Hindu","Budha","Katolik","Konghucu"] },
  { category: "kewarganegaraan", label: "Kewarganegaraan", items: ["Indonesia","Asing"] },
  { category: "yatim_piatu", label: "Yatim/Piatu", items: ["Yatim","Piatu","Yatim Piatu"] },
  { category: "status_ortu", label: "Status (Hidup/Meninggal)", items: ["Masih Hidup","Sudah Meninggal"] },
  { category: "tinggal_dengan", label: "Tinggal Dengan", items: ["Orang Tua","Nenek/Kakek","Tinggal di Asrama","Mondok"] },
  { category: "jarak_sekolah", label: "Jarak ke Sekolah", items: ["Kurang Dari 1 Km","Lebih Dari 1 Km"] },
  { category: "pendidikan_akhir", label: "Pendidikan Akhir", items: ["Tidak Tamat SD","Tamat SD Sederajat","Tamat SMP Sederajat","Tamat SMA Sederajat","Tamat D1","Tamat D2","Tamat D3","Tamat S1","Tamat S2","Tamat S3"] },
  { category: "pekerjaan", label: "Pekerjaan", items: ["Wirausaha","Wiraswasta","Buruh","Petani","Buruh Tani","Nelayan","Tidak Bekerja","Ibu Rumah Tangga","PNS","TNI/Polri","Karyawan Swasta"] },
  { category: "pengeluaran", label: "Pengeluaran Bulanan", items: ["Kurang Dari Rp.1.000.000","Rp.1.000.000 s/d Rp.1.500.000","Rp.1.500.000 s/d Rp.2.000.000","Rp.2.000.000 s/d Rp.2.500.000","Rp.2.500.000 s/d Rp.3.000.000","Lebih Dari Rp.3.000.000"] },
  { category: "alasan_pindah", label: "Alasan Pindah", items: ["Permintaan Orang Tua","Kurang Cocok dengan Lingkungan","Jarak Terlalu Jauh","Tidak Mampu Biaya"] },
  // bidang_keahlian/program_keahlian/kompetensi_keahlian SENGAJA dihapus dari sini 2026-08-12 —
  // dulu daftar statis terpisah dari tabel Major, sekarang live dari kolom bidangKeahlian/
  // programKeahlian/kompetensiKeahlian di Major (isi lewat Kelola Jurusan). Jangan tambah lagi.
  { category: "pendidikan_guru", label: "Pendidikan (Guru)", items: ["D3","S1","S2","S3","Lainnya"] },
  { category: "status_kepegawaian", label: "Status Kepegawaian (Guru)", items: ["Guru Tetap Yayasan","Guru Tidak Tetap (GTT)","PNS","PPPK","Honorer"] },
];

async function main() {
  console.log("🌱 Mulai seed Master Data...\n");

  for (const data of masterData) {
    await prisma.masterData.upsert({
      where: { category: data.category },
      update: { label: data.label, items: data.items },
      create: { category: data.category, label: data.label, items: data.items },
    });
    console.log(`  ✅ ${data.category.padEnd(25)} → ${data.label}`);
  }

  console.log(`\n🎉 Selesai! ${masterData.length} kategori master data berhasil di-seed.`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
