import QR from "qrcode";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import TombolKembali from "@/components/shared/TombolKembali";
import Link from "next/link";

const hp = (kunci: string) => (kunci.startsWith("62") ? `0${kunci.slice(2)}` : kunci);

/** KARTU AKTIVASI ORANG TUA (11 Okt 2026) — 8 kartu per A4 untuk dibagikan saat pengambilan rapor/pertemuan wali.
 *  Akun orang tua sudah dibuat otomatis dari nomor HP di Buku Induk (612 akun), tetapi hampir tidak ada yang pernah masuk:
 *  alamat akunnya `ortu62…@…` terlalu panjang untuk diketik. Sejak hari ini orang tua boleh masuk dengan NOMOR HP, dan QR di
 *  kartu membuka halaman Masuk dengan nomornya sudah terisi.
 *  Sandi awal dicetak hanya untuk akun yang BELUM PERNAH masuk (belum ada catatan sesi) — akun yang sudah dipakai
 *  kemungkinan sandinya sudah diganti, jadi kartunya menyuruh memakai sandi sendiri. Penjagaan akses dilakukan pemanggil. */
export default async function KartuOrtuCetak({ daftarKelas, kelas, basePath, kembaliHref }: { daftarKelas: { id: string; name: string }[]; kelas?: string; basePath: string; kembaliHref: string }) {
  const dipilih = daftarKelas.find(k => k.id === kelas) ?? daftarKelas[0];
  const judul = <PageHeader icon={<Users size={22} />} title="Kartu Aktivasi Orang Tua" description="Cara masuk Portal Orang Tua — dicetak per kelas, satu kartu per siswa" printHidden />;
  if (!dipilih) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<div className="mb-5 print:hidden"><TombolKembali href={kembaliHref} /></div><p className="py-10 text-center text-sm text-gray-400">Tidak ada kelas yang bisa dicetak.</p></div>;
  const [siswa, s] = await Promise.all([
    prisma.student.findMany({
      where: { classId: dipilih.id, studentStatus: "AKTIF" }, orderBy: { user: { name: "asc" } },
      select: { id: true, user: { select: { name: true } }, parentLinks: { orderBy: { createdAt: "asc" }, select: { parent: { select: { phoneKey: true, userId: true, user: { select: { name: true } } } } } } },
    }),
    getSettings(["school.name"]),
  ]);
  const ortuIds = siswa.flatMap(x => x.parentLinks.map(l => l.parent.userId));
  const pernah = new Set((await prisma.userSession.findMany({ where: { userId: { in: ortuIds } }, select: { userId: true }, distinct: ["userId"] }).catch(() => [])).map(x => x.userId));
  const kartu = await Promise.all(siswa.filter(x => x.parentLinks.length).map(async x => {
    const p = x.parentLinks[0].parent, nomor = hp(p.phoneKey);
    return { id: x.id, siswa: x.user.name, ortu: p.user.name, nomor, baru: !pernah.has(p.userId), qr: await QR.toDataURL(`${ALAMAT_APLIKASI}/login?akun=${nomor}`, { width: 260, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F1A45", light: "#FFFFFF" } }) };
  }));
  const tanpa = siswa.filter(x => !x.parentLinks.length);
  const sekolah = s["school.name"] || "SMK Al Munawwir IIBS";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 portrait; margin: 8mm; }`}</style>
      {judul}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <TombolKembali href={kembaliHref} />
        <div className="alat-aksi"><PrintButton /></div>
      </div>
      {daftarKelas.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5 print:hidden">
          {daftarKelas.map(k => <Link key={k.id} href={`${basePath}?kelas=${k.id}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${k.id === dipilih.id ? "bg-primary-900 text-white" : "border border-gray-100 bg-white text-gray-500 hover:bg-gray-50"}`}>{k.name}</Link>)}
        </div>
      )}
      <p className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 print:hidden">
        <b>{dipilih.name}</b>: <b className="angka">{kartu.length}</b> kartu, <b className="angka">{kartu.filter(k => k.baru).length}</b> di antaranya untuk orang tua yang belum pernah masuk.
        {tanpa.length > 0 && <> <b className="angka">{tanpa.length}</b> siswa belum punya akun orang tua karena nomor HP orang tuanya kosong di Buku Induk: {tanpa.map(t => t.user.name).join(", ")}.</>}
      </p>
      <div className="print-doc bg-white mx-auto grid w-full max-w-[210mm] grid-cols-2 text-[11px] leading-snug">
        {kartu.map(k => (
          <section key={k.id} className="flex break-inside-avoid items-start gap-3 border border-dashed border-gray-400 p-3" style={{ minHeight: "68mm" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL */}
            <img src={k.qr} alt={`QR masuk Portal Orang Tua untuk orang tua ${k.siswa}`} className="h-[30mm] w-[30mm] shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{sekolah} · Portal Orang Tua</p>
              <p className="mt-0.5 text-[13px] font-bold leading-tight">{k.siswa}</p>
              <p className="text-gray-600">{dipilih.name}{k.ortu && k.ortu !== "Orang Tua/Wali" ? ` · Bapak/Ibu ${k.ortu}` : ""}</p>
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                <li>Pindai QR ini dengan kamera HP, atau buka <b>{ALAMAT_APLIKASI.replace(/^https?:\/\//, "")}</b> lalu pilih Masuk.</li>
                <li>Nomor HP: <b className="tabular-nums">{k.nomor}</b></li>
                <li>{k.baru ? <>Kata sandi awal: <b>{DEFAULT_PASSWORD}</b> — segera ganti di menu Profil.</> : <>Kata sandi: yang sudah Bapak/Ibu pakai. Lupa? Hubungi wali kelas.</>}</li>
              </ol>
              <p className="mt-1.5 text-[10px] text-gray-600">Di sana Bapak/Ibu melihat kehadiran, nilai &amp; rapor, poin, kegiatan, dan bisa mengajukan izin/sakit.</p>
            </div>
          </section>
        ))}
      </div>
      {kartu.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada akun orang tua di kelas ini.</p>}
    </div>
  );
}
