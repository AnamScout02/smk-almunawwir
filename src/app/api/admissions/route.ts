import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { gelombangDibuka, nomorPendaftaranBaru } from "@/lib/spmb";
import { bacaKontenSpmb, cocokJurusan } from "@/lib/spmb-konten";
import { periksaFormulirSpmb, rapikanNomorWa, type IsianSpmb } from "@/lib/spmb-form";
import { cocokkanPerujuk } from "@/lib/spmb-perujuk";
import { rapikanWilayah } from "@/lib/spmb-wilayah";
import { getSettings } from "@/lib/site-settings";
import { bakuNamaSekolah } from "@/lib/nama-sekolah";
import { lahirIso, tandaFormulir } from "@/lib/spmb-formulir";

export const dynamic = "force-dynamic";

/** Jalur berkas hasil `/api/admissions/upload` — SELALU relatif (`/api/uploads/admissions/...`).
 *  JANGAN memakai `z.string().url()` di sini: sampai 1 Oktober 2026 kolom dokumen diperiksa
 *  `.url()`, sedangkan endpoint unggahnya mengembalikan jalur relatif — akibatnya SETIAP pendaftar
 *  yang mengunggah satu dokumen pun ditolak dengan pesan samar "Periksa kembali isian Anda."
 *  (tabel Admission 0 baris). Yang benar diperiksa adalah BENTUK JALURNYA. */
const berkasUnggahan = z.string()
  .regex(/^\/(api\/)?uploads\/(?!.*\.\.)[A-Za-z0-9_\-./]{1,200}$/, "Jalur berkas tidak dikenali")
  .optional().or(z.literal(""));

/** Skema ini hanya memeriksa BENTUK kiriman (tipe & panjang kasar). Aturan isi — wajib/opsional,
 *  jumlah digit NIK & NISN, format e-mail, usia wajar — ada di `periksaFormulirSpmb` supaya
 *  pesannya per-isian dan SAMA dengan yang tampil di browser. */
const admissionSchema = z.object({
  fullName: z.string().max(200).optional().default(""),
  birthPlace: z.string().max(200).optional().default(""),
  birthDate: z.string().max(40).optional().default(""),
  gender: z.string().max(40).optional().default(""),
  nik: z.string().max(40).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  nisn: z.string().max(40).optional().default(""),
  address: z.string().max(600).optional().default(""),
  previousSchool: z.string().max(200).optional().default(""),
  email: z.string().max(200).optional().default(""),
  guardianName: z.string().max(200).optional().default(""),
  chosenMajor: z.string().max(200).optional().default(""),
  jalur: z.string().max(60).optional().default(""),
  perujukKode: z.string().max(40).optional().default(""),
  kabupatenKode: z.string().max(10).optional().default(""),
  kecamatanKode: z.string().max(10).optional().default(""),
  // Dokumen
  ijazah: berkasUnggahan,
  kk: berkasUnggahan,
  ktp_wali: berkasUnggahan,
  foto: berkasUnggahan,
  dokumen_lain: berkasUnggahan,
  // Dokumen syarat yang didaftarkan panitia (DokumenSyaratSpmb).
  berkas: z.array(z.object({
    syaratId: z.string().min(1).max(40),
    berkas: z.string().regex(/^\/(api\/)?uploads\/(?!.*\.\.)[A-Za-z0-9_\-./]{1,200}$/),
  })).max(30).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Request tidak valid" }, { status: 400 });
  }

  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) {
    // Bentuk kiriman salah (mis. bukan JSON yang diharapkan). Isi per-isian diperiksa di bawah.
    const sebab = parsed.error.issues.slice(0, 3).map(i => `${i.path.join(".") || "isian"}: ${i.message}`).join("; ");
    return Response.json({
      error: `Kiriman formulir tidak dikenali (${sebab}). Muat ulang halaman lalu coba lagi.`,
    }, { status: 400 });
  }

  try {
    const d = parsed.data;

    // PEMERIKSAAN ISIAN — fungsi yang SAMA dipakai browser, jadi pesannya identik dan tidak ada
    // isian yang lolos hanya karena komponen custom (DatePicker/Select) tidak ikut validasi HTML.
    const setelan = await getSettings([
      "form.require_nik", "form.require_nisn", "form.require_address", "form.require_guardian", "spmb.jalur",
    ]);
    const longgar = {
      wajib: (k: string) => setelan[`form.require_${k}`] !== "0" && setelan[`form.require_${k}`] !== "off",
      tampil: (k: string) => setelan[`form.require_${k}`] !== "off",
    };
    const kodeJalur = bacaKontenSpmb(setelan).jalur.map(j => j.kode);
    const kolom = periksaFormulirSpmb(d as unknown as Partial<IsianSpmb>, { longgar, kodeJalur });
    if (Object.keys(kolom).length) {
      const daftar = Object.values(kolom);
      return Response.json({
        error: daftar.length === 1 ? daftar[0] : `Ada ${daftar.length} isian yang perlu diperbaiki.`,
        kolom,
      }, { status: 400 });
    }

    // Pendaftaran hanya terbuka selama ada GELOMBANG yang tanggalnya berjalan (keputusan user
    // 1 Oktober 2026: SPMB bergelombang). Tanpa gelombang, formulir ditolak dengan alasan yang
    // jelas — bukan menyimpan baris tanpa gelombang yang nanti tidak bisa diseleksi.
    const gelombang = await gelombangDibuka();
    if (!gelombang) {
      return Response.json({ error: "Pendaftaran sedang tutup. Pantau halaman SPMB untuk gelombang berikutnya." }, { status: 409 });
    }

    // Kuota jurusan: bila gelombang ini memberi kuota untuk jurusan yang dipilih dan sudah penuh,
    // pendaftar diarahkan memilih jurusan lain daripada masuk daftar yang pasti tidak tertampung.
    const pilihan = (d.chosenMajor ?? "").trim();
    if (pilihan) {
      // Formulir menyimpan LABEL "Nama (KODE)", jadi pencocokannya lewat cocokJurusan.
      const semuaMajor = await prisma.major.findMany({ select: { id: true, name: true, code: true } });
      const major = semuaMajor.find(m => cocokJurusan(pilihan, m));
      const kuota = major ? gelombang.kuota.find(k => k.majorId === major.id) : undefined;
      if (kuota && kuota.kuota > 0) {
        // Hitungan terisi juga tidak boleh bergantung pada satu bentuk tulisan jurusan.
        const sekelompok = await prisma.admission.findMany({
          where: { gelombangId: gelombang.id, status: { notIn: ["DITOLAK", "REJECTED"] } },
          select: { chosenMajor: true },
        });
        const terisi = sekelompok.filter(a => cocokJurusan(a.chosenMajor, major!)).length;
        if (terisi >= kuota.kuota) {
          return Response.json({ error: `Kuota ${major?.name ?? pilihan} pada ${gelombang.nama} sudah penuh. Silakan pilih jurusan lain.` }, { status: 409 });
        }
      }
    }

    // Dokumen syarat WAJIB diperiksa di server juga — atribut `required` di <input> hanya
    // menghalangi di browser.
    const syarat = await prisma.dokumenSyaratSpmb.findMany({
      where: { aktif: true }, select: { id: true, nama: true, wajib: true },
    });
    const dikirim = new Map((d.berkas ?? []).map(b => [b.syaratId, b.berkas]));
    const kurang = syarat.filter(sy => sy.wajib && !dikirim.get(sy.id)?.trim()).map(sy => sy.nama);
    if (kurang.length) {
      return Response.json({ error: `Dokumen wajib belum diunggah: ${kurang.join(", ")}` }, { status: 400 });
    }

    // Kode referral dicocokkan ULANG di server — kode yang salah TIDAK menggagalkan pendaftaran,
    // hanya membuat tautan perujuknya kosong (salah ketik kode bukan alasan menolak anak orang).
    const perujuk = await cocokkanPerujuk(d.perujukKode);
    const wilayah = await rapikanWilayah(d.kabupatenKode, d.kecamatanKode);

    const nomor = await nomorPendaftaranBaru(gelombang.id, gelombang.urutan);

    const admission = await prisma.admission.create({
      data: {
        nomor,
        gelombangId: gelombang.id,
        fullName: d.fullName,
        birthPlace: d.birthPlace,
        birthDate: new Date(d.birthDate),
        gender: d.gender,
        nik: d.nik ?? null,
        phone: rapikanNomorWa(d.phone),
        nisn: d.nisn ?? null,
        address: d.address ?? null,
        // Penulisan baku ("SMPN 1 songgon" → "SMP Negeri 1 Songgon") — src/lib/nama-sekolah.ts.
        previousSchool: bakuNamaSekolah(d.previousSchool),
        email: d.email,
        guardianName: d.guardianName ?? null,
        chosenMajor: d.chosenMajor ?? "",
        jalur: d.jalur || "REGULER",
        ...wilayah,
        perujukKode: perujuk.perujukKode,
        perujukId: perujuk.perujukId,
        ijazahUrl: d.ijazah || null,
        kkUrl: d.kk || null,
        ktpWaliUrl: d.ktp_wali || null,
        fotoUrl: d.foto || null,
        dokumenLainUrl: d.dokumen_lain || null,
        // Hanya syarat yang BENAR-BENAR aktif disimpan — id asing dari browser dibuang.
        berkasSpmb: {
          create: syarat
            .filter(sy => dikirim.get(sy.id)?.trim())
            .map(sy => ({ syaratId: sy.id, berkas: dikirim.get(sy.id)!.trim() })),
        },
      },
    });
    return Response.json({
      success: true, id: admission.id,
      nomor: admission.nomor,
      gelombang: gelombang.nama,
      // Tanda halaman tahapan (nomor + tanggal lahir, HMAC) — calon langsung bisa membuka tahapannya
      // tanpa mengetik ulang, dan tautan grup WA gelombangnya tampil tepat setelah daftar (user 6 Okt 2026).
      tanda: admission.nomor ? tandaFormulir(admission.nomor, lahirIso(admission.birthDate)) : null,
      tautanGrup: gelombang.tautanGrup || null,
      // Nomor pendaftaran + tanggal lahir adalah kunci calon membuka statusnya nanti.
      pesan: `Simpan nomor pendaftaran Anda: ${admission.nomor}. Status pendaftaran dibuka dengan nomor itu dan tanggal lahir.`,
    }, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan data, coba lagi." }, { status: 500 });
  }
}

