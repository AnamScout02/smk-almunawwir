import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { kirimLatar } from "@/lib/push-server";
import { kabariCalon, kabarTahapan } from "@/lib/spmb-kabar";
import { hapusTtdPakta } from "@/lib/spmb-dokumen";
import { lahirIso, tandaFormulir } from "@/lib/spmb-formulir";
import { ringkasCalon } from "@/lib/spmb-ringkasan";
import { aturanTahapan, daftarSesi, denganBayar, ringkasBayar, setelanBayar, tahapanDari, tautanTahapan } from "@/lib/spmb-tahapan-server";
import {
  ASESMEN_BAWAAN, BERKAS_BAKU, HUBUNGAN_WALI, INFO_TAHAP, PEMERIKSAAN_BAWAAN, bacaIsian, bacaIsiTahap, bacaMpls, bacaPakta, bacaSetelanSeragam, isiPakta, itemSeragamUntuk,
  aktivitasTerakhir, kunciTertahan, tahapBerlaku, tahapSelesai, type IsianTahap, type JawabanTahap, type KodeTahap, type PilihanSeragam,
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
      getSettings(["spmb.seragam", "spmb.asesmen", "spmb.pemeriksaan", "spmb.mpls", "spmb.tautanGrup", "school.name", "spmb.pakta",
        ...BERKAS_BAKU.map(b => `form.require_${b.kunci}`)]),
      setelanBayar(),
      ringkasBayar([id]),
    ]);
    if (!mentah) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    const a = denganBayar(mentah, setBayar, petaBayar);
    const { tahap, tuntas, ditolak } = tahapanDari(a, aturan, a.gelombang?.jadwalTahap, a.sesi);
    const tanda = a.nomor ? tandaFormulir(a.nomor, lahirIso(a.birthDate)) : undefined;
    const [sesiPilihan, langganan, kabar, syaratWajib] = await Promise.all([
      a.gelombangId ? daftarSesi(a.gelombangId) : [],
      prisma.langgananSpmb.count({ where: { admissionId: id } }),
      prisma.kabarSpmb.findMany({ where: { admissionId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, judul: true, isi: true, perangkat: true, createdAt: true } }),
      prisma.dokumenSyaratSpmb.findMany({ where: { aktif: true, wajib: true }, select: { id: true, nama: true } }).catch(() => []),
    ]);
    const pakta = bacaPakta(s["spmb.pakta"]);
    const berkas = [
      ...BERKAS_BAKU.map(b => ({ kunci: b.kunci, label: b.label, url: (a[b.kolom] as string | null) ?? null })),
      ...a.berkasSpmb.map(b => ({ kunci: `syarat:${b.syarat.id}`, label: b.syarat.nama, url: b.berkas })),
    ];
    // Ringkasan satu paragraf (src/lib/spmb-ringkasan.ts) — aturan yang sama dengan daftar Tahapan Calon.
    const berjalan = tahap.find(t => t.status !== "SELESAI") ?? null;
    // "Wajib" mengikuti setelan formulir: "0" = opsional, "off" = disembunyikan (sama dengan isRequired di formulir).
    const wajibBaku = (kunci: string) => !["0", "off"].includes(s[`form.require_${kunci}`] ?? "");
    const ringkasan = ringkasCalon({
      nama: a.fullName, nomor: a.nomor, jurusan: a.chosenMajor, gelombang: a.gelombang?.nama ?? null,
      perujuk: a.perujuk?.nama ?? null, daftar: a.createdAt, tahap, tuntas, ditolak, status: a.status,
      verifikasiStatus: a.verifikasiStatus, perbaikanAt: a.perbaikanAt,
      dimintaUlang: a.verifikasiDokumen.map(k => berkas.find(x => x.kunci === k)?.label ?? k.replace(/^syarat:/, "dokumen syarat")),
      berkasKurang: [
        ...BERKAS_BAKU.filter(b => wajibBaku(b.kunci) && !a[b.kolom]).map(b => b.label),
        ...syaratWajib.filter(x => !a.berkasSpmb.some(y => y.syarat.id === x.id && y.berkas)).map(x => x.nama),
      ],
      tertahan: tuntas || ditolak ? null : kunciTertahan(berjalan, {
        sesiId: a.sesiId, adaSesi: sesiPilihan.length > 0, daftarUlangConfirmedAt: a.daftarUlangConfirmedAt,
        bayarCukup: a.bayar.cukup, paktaPerlu: pakta.aktif && pakta.wajib && !a.paktaAt,
      }),
      diamHari: tuntas || ditolak ? 0 : Math.floor((Date.now() - aktivitasTerakhir(a).getTime()) / 86_400_000),
      bayar: a.bayar, buktiMenunggu: a.pembayaranSpmb.filter(x => x.status === "MENUNGGU").length,
      sesi: a.sesi ? `${a.sesi.tanggal} pukul ${a.sesi.jamMulai}–${a.sesi.jamSelesai}${a.sesi.tempat ? `, ${a.sesi.tempat}` : ""}` : null,
      adaHp: langganan > 0, kabarTerakhir: kabar[0]?.createdAt ?? null, sudahSiswa: !!a.studentId,
    });

    return NextResponse.json({
      ringkasan,
      calon: {
        id: a.id, nomor: a.nomor, nama: a.fullName, jurusan: a.chosenMajor, phone: a.phone, email: a.email,
        lahir: lahirIso(a.birthDate), tempatLahir: a.birthPlace, gender: a.gender, sekolahAsal: a.previousSchool,
        wali: a.guardianName, alamat: a.address, status: a.status, gelombang: a.gelombang?.nama ?? null,
        nik: a.nik, nisn: a.nisn, jalur: a.jalur, wilayah: [a.desa, a.kecamatan, a.kabupaten].filter(Boolean).join(", ") || null,
        perujuk: a.perujuk ? `${a.perujuk.nama} (${a.perujuk.kode})` : a.perujukKode ? `${a.perujukKode} (tidak dikenali)` : null,
        verifikasiStatus: a.verifikasiStatus, verifikasiPesan: a.verifikasiPesan, verifikasiDokumen: a.verifikasiDokumen,
        verifikasiAt: a.verifikasiAt, verifikasiOleh: a.verifikasiOleh, perbaikanAt: a.perbaikanAt,
        seragam: a.seragam, seragamAt: a.seragamAt,
        asesmen: bacaIsiTahap(a.asesmen), asesmenAt: a.asesmenAt, asesmenOleh: a.asesmenOleh,
        pemeriksaan: bacaIsiTahap(a.pemeriksaan), pemeriksaanAt: a.pemeriksaanAt, pemeriksaanOleh: a.pemeriksaanOleh,
        grupDiklik: !!a.grupDiklikAt, grupBergabung: !!a.grupBergabungAt,
        daftarUlangAt: a.daftarUlangConfirmedAt, keteranganPotongan: a.keteranganPotongan, sesiId: a.sesiId,
      },
      pakta: {
        aktif: pakta.aktif, wajib: pakta.wajib,
        sudah: a.paktaAt ? { nama: a.paktaNama, hubungan: a.paktaHubungan, at: a.paktaAt, digital: !!a.paktaTtd } : null,
      },
      bayar: a.bayar,
      sesiPilihan, langganan, kabar,
      pembayaran: a.pembayaranSpmb,
      berkas,
      tahap, tuntas, ditolak,
      isian: {
        asesmen: bacaIsian(s["spmb.asesmen"], ASESMEN_BAWAAN),
        pemeriksaan: bacaIsian(s["spmb.pemeriksaan"], PEMERIKSAAN_BAWAAN),
      },
      setelanSeragam: (() => { const st = bacaSetelanSeragam(s["spmb.seragam"]); return { ...st, item: itemSeragamUntuk(st, a.gender) }; })(),
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
      const pilihan = itemSeragamUntuk(setelan, a.gender).map(i => ({ item: i.nama, ukuran: masuk.find(x => x?.item === i.nama)?.ukuran ?? "" }));
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
        const pakta = bacaPakta((await getSettings(["spmb.pakta"]))["spmb.pakta"]);
        if (pakta.aktif && pakta.wajib && !a.paktaAt) {
          return NextResponse.json({ error: "Surat pernyataan orang tua belum ditandatangani. Bila ditandatangani di kertas, tandai di bagian Surat Pernyataan." }, { status: 409 });
        }
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
    } else if (aksi === "pakta-kertas") {
      // Orang tua tanpa HP menandatangani lembar cetak di sekolah — panitia menandai sudah ditandatangani.
      const nama = String(b?.nama ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
      const hubungan = (HUBUNGAN_WALI as readonly string[]).includes(String(b?.hubungan)) ? String(b.hubungan) : "";
      if (nama.length < 3 || !hubungan) return NextResponse.json({ error: "Isi nama penanda tangan dan hubungannya dengan calon." }, { status: 400 });
      if (a.paktaAt) return NextResponse.json({ error: "Surat pernyataan sudah tercatat ditandatangani." }, { status: 409 });
      const s = await getSettings(["spmb.pakta", "school.name"]);
      await prisma.admission.update({
        where: { id },
        data: { paktaAt: sekarang, paktaNama: nama, paktaHubungan: hubungan, paktaTtd: null, paktaTeks: isiPakta(bacaPakta(s["spmb.pakta"]), s["school.name"] || "SMK Al-Munawwir IIBS") },
      });
      keterangan = "menandai surat pernyataan ditandatangani di kertas";
    } else if (aksi === "pakta-reset") {
      await prisma.admission.update({ where: { id }, data: { paktaAt: null, paktaNama: null, paktaHubungan: null, paktaTtd: null, paktaTeks: null, paktaToken: null } });
      await hapusTtdPakta(a.paktaTtd);
      keterangan = "membuka ulang surat pernyataan";
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
