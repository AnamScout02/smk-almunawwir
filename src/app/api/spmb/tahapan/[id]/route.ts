import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { kirimLatar } from "@/lib/push-server";
import { kabariCalon, kabarTahapan } from "@/lib/spmb-kabar";
import { lahirIso, tandaFormulir } from "@/lib/spmb-formulir";
import { aturanTahapan, daftarSesi, denganBayar, ringkasBayar, setelanBayar, tahapanDari, tautanTahapan } from "@/lib/spmb-tahapan-server";
import {
  ASESMEN_BAWAAN, BERKAS_BAKU, INFO_TAHAP, PEMERIKSAAN_BAWAAN, bacaIsian, bacaIsiTahap, bacaMpls, bacaSetelanSeragam,
  tahapBerlaku, tahapSelesai, type IsianTahap, type JawabanTahap, type KodeTahap, type PilihanSeragam,
} from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

async function sesiPanitia() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertSpmb(session);
  return session;
}

/** Detail satu calon untuk panitia: berkas, tahapan, seragam, asesmen & pemeriksaan (sensitif — hanya panitia). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await sesiPanitia();
    const { id } = await params;
    const [mentah, aturan, s, setBayar, petaBayar] = await Promise.all([
      prisma.admission.findUnique({
        where: { id },
        include: {
          pembayaranSpmb: { orderBy: { tanggal: "desc" } },
          sesi: true,
          perujuk: { select: { nama: true, kode: true } },
          gelombang: { select: { id: true, nama: true, tautanGrup: true, jadwalTahap: true } },
          berkasSpmb: { select: { id: true, berkas: true, syarat: { select: { id: true, nama: true } } } },
        },
      }),
      aturanTahapan(),
      getSettings(["spmb.seragam", "spmb.asesmen", "spmb.pemeriksaan", "spmb.mpls", "spmb.tautanGrup", "school.name"]),
      setelanBayar(),
      ringkasBayar([id]),
    ]);
    if (!mentah) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    const a = denganBayar(mentah, setBayar, petaBayar);
    const { tahap, tuntas, ditolak } = tahapanDari(a, aturan, a.gelombang?.jadwalTahap, a.sesi);
    const tanda = a.nomor ? tandaFormulir(a.nomor, lahirIso(a.birthDate)) : undefined;

    return NextResponse.json({
      calon: {
        id: a.id, nomor: a.nomor, nama: a.fullName, jurusan: a.chosenMajor, phone: a.phone, email: a.email,
        lahir: lahirIso(a.birthDate), tempatLahir: a.birthPlace, gender: a.gender, sekolahAsal: a.previousSchool,
        wali: a.guardianName, alamat: a.address, status: a.status, gelombang: a.gelombang?.nama ?? null,
        nik: a.nik, nisn: a.nisn, jalur: a.jalur, wilayah: [a.kecamatan, a.kabupaten].filter(Boolean).join(", ") || null,
        perujuk: a.perujuk ? `${a.perujuk.nama} (${a.perujuk.kode})` : a.perujukKode ? `${a.perujukKode} (tidak dikenali)` : null,
        verifikasiStatus: a.verifikasiStatus, verifikasiPesan: a.verifikasiPesan, verifikasiDokumen: a.verifikasiDokumen,
        verifikasiAt: a.verifikasiAt, verifikasiOleh: a.verifikasiOleh, perbaikanAt: a.perbaikanAt,
        seragam: a.seragam, seragamAt: a.seragamAt,
        asesmen: bacaIsiTahap(a.asesmen), asesmenAt: a.asesmenAt, asesmenOleh: a.asesmenOleh,
        pemeriksaan: bacaIsiTahap(a.pemeriksaan), pemeriksaanAt: a.pemeriksaanAt, pemeriksaanOleh: a.pemeriksaanOleh,
        grupDiklik: !!a.grupDiklikAt, grupBergabung: !!a.grupBergabungAt,
        daftarUlangAt: a.daftarUlangConfirmedAt, keteranganPotongan: a.keteranganPotongan, sesiId: a.sesiId,
      },
      bayar: a.bayar,
      sesiPilihan: a.gelombangId ? await daftarSesi(a.gelombangId) : [],
      langganan: await prisma.langgananSpmb.count({ where: { admissionId: id } }),
      kabar: await prisma.kabarSpmb.findMany({ where: { admissionId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, judul: true, isi: true, perangkat: true, createdAt: true } }),
      pembayaran: a.pembayaranSpmb,
      berkas: [
        ...BERKAS_BAKU.map(b => ({ kunci: b.kunci, label: b.label, url: (a[b.kolom] as string | null) ?? null })),
        ...a.berkasSpmb.map(b => ({ kunci: `syarat:${b.syarat.id}`, label: b.syarat.nama, url: b.berkas })),
      ],
      tahap, tuntas, ditolak,
      isian: {
        asesmen: bacaIsian(s["spmb.asesmen"], ASESMEN_BAWAAN),
        pemeriksaan: bacaIsian(s["spmb.pemeriksaan"], PEMERIKSAAN_BAWAAN),
      },
      setelanSeragam: bacaSetelanSeragam(s["spmb.seragam"]),
      mpls: bacaMpls(s["spmb.mpls"]),
      sekolah: s["school.name"] || "SMK Al-Munawwir IIBS",
      tautan: a.nomor ? tautanTahapan(a.nomor, tanda) : null,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Tahap sebelumnya yang belum selesai — urutan tahapan berjenjang (keputusan user 6 Okt 2026). */
function kurangSebelum(kode: KodeTahap, b: Parameters<typeof tahapSelesai>[1], aturan: Parameters<typeof tahapSelesai>[2]): string | null {
  for (const k of tahapBerlaku(aturan)) {
    if (k === kode) return null;
    if (tahapSelesai(k, b, aturan) === false) return INFO_TAHAP[k].judul;
  }
  return null;
}

/** Salinan jawaban dari daftar isian sekarang + jawaban lama yang isiannya sudah dihapus panitia. */
function susunJawaban(isian: IsianTahap[], masuk: Record<string, unknown>, lama: JawabanTahap[]): JawabanTahap[] {
  const hasil: JawabanTahap[] = isian.map(i => ({
    id: i.id, label: i.label, nilai: String(masuk[i.id] ?? "").trim().slice(0, 2000),
    ...(i.satuan ? { satuan: i.satuan } : {}), ...(i.kelompok ? { kelompok: i.kelompok } : {}), ...(i.bukuInduk ? { bukuInduk: i.bukuInduk } : {}),
  }));
  for (const j of lama) if (!isian.some(i => i.id === j.id) && j.nilai) hasil.push(j);
  return hasil;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await sesiPanitia();
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const aksi = String(b?.aksi ?? "");
    const [a, aturan] = await Promise.all([prisma.admission.findUnique({ where: { id } }), aturanTahapan()]);
    if (!a) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    const sekarang = new Date();
    let keterangan = "";
    // Kabar ke HP calon (6 Okt 2026): `tahapan` = peristiwa + tahap berikutnya; `langsung` = tanpa ekor tahap.
    let kabar: { kunci: string; judul: string; isi: string; langsung?: boolean } | null = null;
    const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

    if (aksi === "verifikasi") {
      await prisma.admission.update({
        where: { id },
        data: { verifikasiStatus: "TERVERIFIKASI", verifikasiAt: sekarang, verifikasiOleh: session.name, verifikasiDokumen: [] },
      });
      keterangan = "memverifikasi berkas";
      kabar = { kunci: `spmb-verif:${id}:${sekarang.getTime()}`, judul: "Berkas terverifikasi", isi: "Berkas pendaftaran Anda sudah diperiksa panitia dan dinyatakan lengkap." };
    } else if (aksi === "perbaikan") {
      const pesan = String(b?.pesan ?? "").trim().slice(0, 1000);
      const dokumen = (Array.isArray(b?.dokumen) ? b.dokumen : []).map(String).filter((k: string) =>
        BERKAS_BAKU.some(x => x.kunci === k) || /^syarat:[a-z0-9]+$/i.test(k)).slice(0, 20);
      if (!pesan) return NextResponse.json({ error: "Tulis pesan untuk calon: apa yang kurang atau salah." }, { status: 400 });
      await prisma.admission.update({
        where: { id },
        data: { verifikasiStatus: "PERBAIKAN", verifikasiPesan: pesan, verifikasiDokumen: dokumen, verifikasiAt: null, verifikasiOleh: session.name },
      });
      keterangan = "meminta perbaikan berkas";
      kabar = { kunci: `spmb-perbaikan:${id}:${sekarang.getTime()}`, judul: "Berkas perlu diperbaiki", isi: pesan, langsung: true };
    } else if (aksi === "batal-verifikasi") {
      await prisma.admission.update({ where: { id }, data: { verifikasiStatus: "BELUM", verifikasiAt: null, verifikasiDokumen: [] } });
      keterangan = "membatalkan verifikasi berkas";
    } else if (aksi === "seragam") {
      // Panitia boleh mengisi/mengubah atas nama calon (mis. calon datang langsung ke sekolah).
      const setelan = bacaSetelanSeragam((await getSettings(["spmb.seragam"]))["spmb.seragam"]);
      const masuk = (Array.isArray(b?.pilihan) ? b.pilihan : []) as PilihanSeragam[];
      const pilihan = setelan.item.map(i => ({ item: i.nama, ukuran: masuk.find(x => x?.item === i.nama)?.ukuran ?? "" }));
      if (pilihan.some(p => !p.ukuran)) return NextResponse.json({ error: "Pilih semua ukuran seragam." }, { status: 400 });
      const kurang = kurangSebelum("SERAGAM", a, aturan);
      if (kurang) return NextResponse.json({ error: `Selesaikan tahap "${kurang}" dulu.` }, { status: 409 });
      await prisma.admission.update({
        where: { id }, data: { seragam: { pilihan, catatan: String(b?.catatan ?? "").trim().slice(0, 300) }, seragamAt: a.seragamAt ?? sekarang },
      });
      keterangan = "mengisi ukuran seragam";
    } else if (aksi === "asesmen" || aksi === "pemeriksaan") {
      const kunciSetel = aksi === "asesmen" ? "spmb.asesmen" : "spmb.pemeriksaan";
      const isian = bacaIsian((await getSettings([kunciSetel]))[kunciSetel], aksi === "asesmen" ? ASESMEN_BAWAAN : PEMERIKSAAN_BAWAAN);
      const masuk = (b?.jawaban && typeof b.jawaban === "object" ? b.jawaban : {}) as Record<string, unknown>;
      const jawaban = susunJawaban(isian, masuk, bacaIsiTahap(aksi === "asesmen" ? a.asesmen : a.pemeriksaan).jawaban);
      const isi = { jawaban, catatan: String(b?.catatan ?? "").trim().slice(0, 2000) };
      const selesai = b?.selesai === true;
      const kode: KodeTahap = aksi === "asesmen" ? "ASESMEN" : "PEMERIKSAAN";
      if (selesai) {
        const kurang = kurangSebelum(kode, a, aturan);
        if (kurang) return NextResponse.json({ error: `Belum bisa diselesaikan: tahap "${kurang}" belum selesai. Isian tetap bisa disimpan sebagai draf.` }, { status: 409 });
        const kosong = isian.filter(i => i.wajib && !String(masuk[i.id] ?? "").trim()).map(i => i.label);
        if (kosong.length) return NextResponse.json({ error: `Isian wajib belum diisi: ${kosong.join(", ")}` }, { status: 400 });
      }
      const sudah = aksi === "asesmen" ? a.asesmenAt : a.pemeriksaanAt;
      const at = selesai ? sudah ?? sekarang : sudah;
      const data = aksi === "asesmen"
        ? { asesmen: isi, asesmenAt: at, asesmenOleh: session.name }
        : {
            pemeriksaan: isi, pemeriksaanAt: at, pemeriksaanOleh: session.name,
            // Tanpa tahap seleksi, calon yang menuntaskan cek kesehatan langsung berstatus diterima
            // supaya daftar ulang & konversi ke Buku Induk tetap berjalan (keduanya menyaring DITERIMA).
            ...(selesai && !aturan.seleksi && !["DITOLAK", "REJECTED", "DITERIMA", "ACCEPTED"].includes(a.status) ? { status: "DITERIMA" } : {}),
          };
      await prisma.admission.update({ where: { id }, data });
      keterangan = `${selesai ? "menyelesaikan" : "menyimpan draf"} ${INFO_TAHAP[kode].judul.toLowerCase()}`;
      if (selesai && !sudah) kabar = { kunci: `spmb-${aksi}:${id}`, judul: `${INFO_TAHAP[kode].judul} selesai`, isi: `Tahap ${INFO_TAHAP[kode].judul} sudah tercatat selesai.` };
    } else if (aksi === "bayar-tambah") {
      // Dicatat panitia (mis. bayar tunai di sekolah) → langsung SAH.
      const jumlah = Math.round(Number(b?.jumlah) || 0);
      if (jumlah < 1 || jumlah > 200_000_000) return NextResponse.json({ error: "Jumlah tidak sah" }, { status: 400 });
      const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.tanggal ?? "")) ? new Date(`${b.tanggal}T12:00:00+07:00`) : sekarang;
      await prisma.pembayaranSpmb.create({
        data: {
          admissionId: id, jumlah, tanggal: tgl, metode: b?.metode === "TRANSFER" ? "TRANSFER" : "TUNAI",
          catatan: String(b?.catatan ?? "").trim().slice(0, 300) || null, status: "SAH",
          dicatatOleh: session.name, disahkanOleh: session.name, disahkanAt: sekarang,
        },
      });
      keterangan = `mencatat pembayaran Rp${jumlah.toLocaleString("id-ID")}`;
      kabar = { kunci: `spmb-bayar-catat:${id}:${sekarang.getTime()}`, judul: "Pembayaran diterima", isi: `Pembayaran ${rp(jumlah)} sudah dicatat dan disahkan panitia.` };
    } else if (aksi === "bayar-sahkan" || aksi === "bayar-tolak" || aksi === "bayar-hapus") {
      const p = await prisma.pembayaranSpmb.findFirst({ where: { id: String(b?.pembayaranId ?? ""), admissionId: id } });
      if (!p) return NextResponse.json({ error: "Pembayaran tidak ditemukan" }, { status: 404 });
      if (aksi === "bayar-hapus") await prisma.pembayaranSpmb.delete({ where: { id: p.id } });
      else if (aksi === "bayar-sahkan") {
        await prisma.pembayaranSpmb.update({ where: { id: p.id }, data: { status: "SAH", alasanTolak: null, disahkanOleh: session.name, disahkanAt: sekarang } });
      } else {
        const alasan = String(b?.alasan ?? "").trim().slice(0, 300);
        if (!alasan) return NextResponse.json({ error: "Tulis alasan penolakan untuk calon." }, { status: 400 });
        await prisma.pembayaranSpmb.update({ where: { id: p.id }, data: { status: "DITOLAK", alasanTolak: alasan, disahkanOleh: session.name, disahkanAt: sekarang } });
      }
      keterangan = `${aksi === "bayar-sahkan" ? "mengesahkan" : aksi === "bayar-tolak" ? "menolak" : "menghapus"} pembayaran Rp${p.jumlah.toLocaleString("id-ID")}`;
      if (aksi === "bayar-sahkan") kabar = { kunci: `spmb-bayar:${p.id}:sah`, judul: "Pembayaran disahkan", isi: `Pembayaran ${rp(p.jumlah)} sudah disahkan panitia.` };
      if (aksi === "bayar-tolak") kabar = { kunci: `spmb-bayar:${p.id}:tolak`, judul: "Bukti pembayaran ditolak", isi: `Bukti ${rp(p.jumlah)} ditolak: ${String(b?.alasan ?? "").trim()}`, langsung: true };
    } else if (aksi === "potongan") {
      const jumlah = Math.max(0, Math.round(Number(b?.jumlah) || 0));
      await prisma.admission.update({ where: { id }, data: { potonganBiaya: jumlah, keteranganPotongan: String(b?.keterangan ?? "").trim().slice(0, 200) || null } });
      keterangan = `mengatur potongan biaya Rp${jumlah.toLocaleString("id-ID")}`;
    } else if (aksi === "daftar-ulang") {
      const konfirmasi = b?.konfirmasi !== false;
      if (konfirmasi) {
        const kurang = kurangSebelum("DAFTAR_ULANG", a, aturan);
        if (kurang) return NextResponse.json({ error: `Selesaikan tahap "${kurang}" dulu.` }, { status: 409 });
      }
      await prisma.admission.update({ where: { id }, data: { daftarUlangConfirmedAt: konfirmasi ? a.daftarUlangConfirmedAt ?? sekarang : null } });
      keterangan = konfirmasi ? "mengonfirmasi daftar ulang" : "membatalkan konfirmasi daftar ulang";
      if (konfirmasi && !a.daftarUlangConfirmedAt) kabar = { kunci: `spmb-du:${id}`, judul: "Daftar ulang dikonfirmasi", isi: "Konfirmasi daftar ulang sudah dicatat panitia." };
    } else if (aksi === "sesi") {
      // Panitia memindahkan calon antarsesi (mis. lewat telepon) — kuota tetap dijaga, kosong = lepas sesi.
      const sesiId = String(b?.sesiId ?? "");
      if (sesiId) {
        const sesi = await prisma.sesiSpmb.findFirst({ where: { id: sesiId, gelombangId: a.gelombangId ?? "" }, include: { _count: { select: { pendaftar: true } } } });
        if (!sesi) return NextResponse.json({ error: "Sesi tidak ditemukan di gelombang calon ini." }, { status: 404 });
        if (sesi._count.pendaftar - (a.sesiId === sesi.id ? 1 : 0) >= sesi.kuota) return NextResponse.json({ error: "Sesi itu sudah penuh." }, { status: 409 });
      }
      await prisma.admission.update({ where: { id }, data: { sesiId: sesiId || null } });
      keterangan = sesiId ? "menetapkan sesi kedatangan" : "melepas sesi kedatangan";
      if (sesiId) kabar = { kunci: `spmb-sesi:${id}:${sesiId}`, judul: "Jadwal kedatangan ditetapkan", isi: "Panitia menetapkan sesi kedatangan Anda. Lihat jadwalnya di halaman tahapan.", langsung: true };
    } else if (aksi === "buka-ulang") {
      const kode = String(b?.tahap ?? "");
      const data = kode === "ASESMEN" ? { asesmenAt: null } : kode === "PEMERIKSAAN" ? { pemeriksaanAt: null } : kode === "SERAGAM" ? { seragamAt: null } : null;
      if (!data) return NextResponse.json({ error: "Tahap tidak dikenal" }, { status: 400 });
      await prisma.admission.update({ where: { id }, data });
      keterangan = `membuka ulang tahap ${kode.toLowerCase()}`;
    } else {
      return NextResponse.json({ error: "Tindakan tidak dikenal" }, { status: 400 });
    }

    await logActivity(session, { action: "UPDATE", entity: "Admission", entityId: id, description: `SPMB: ${keterangan} ${a.fullName}` }).catch(() => null);
    if (kabar) { const k = kabar; kirimLatar(() => (k.langsung ? kabariCalon(id, k) : kabarTahapan(id, k))); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
