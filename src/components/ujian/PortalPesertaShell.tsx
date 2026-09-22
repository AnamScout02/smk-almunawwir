"use client";
import { usePathname } from "next/navigation";
import { BookOpen, FileQuestion, LayoutDashboard, LogOut } from "lucide-react";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import { logout } from "@/app/actions/auth";

/** KULIT PORTAL PESERTA UJIAN — gaya "bersih" seperti halaman Buku Tamu publik (/tamu):
 * kepala navy bergradien + motif SMK + garis emas, logo berteks di tengah, lalu kartu putih yang
 * menindih kepalanya di atas latar krem. Permintaan user 13 September 2026: layar yang dilihat
 * peserta harus terasa lapang dan tenang, bukan seperti panel admin.
 *
 * Dua bentuk kepala, dipilih dari alamat halaman:
 *   - MEGAH  : beranda peserta & halaman konfirmasi — peserta belum mengerjakan, ruang layar
 *              boleh dipakai untuk identitas & ketenangan.
 *   - RINGKAS: halaman pengerjaan soal — tiap piksel dipakai soal, kepala tinggi cuma mengganggu
 *              dan mendorong soal turun. */

const NAVY = "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)";

/** Bottom navbar HP (permintaan user 15 Sep 2026) — hanya di kepala MEGAH (beranda, panduan, konfirmasi). Halaman pengerjaan
 * soal sengaja tanpa navigasi: tiap piksel untuk soal dan peserta tidak boleh terdistraksi. */
const NAV_PESERTA: ItemNavBawah[] = [
  { href: "/ujian-online/panduan", label: "Panduan", icon: BookOpen, simbol: "menu_book" },
  { href: "/dashboard/student", label: "Portal Siswa", icon: LayoutDashboard, simbol: "home" },
];

/** Judul kepala mengikuti halaman — kulit ini satu-satunya tempat judul portal ditulis, supaya
 * tiap halaman peserta tidak perlu memasang header sendiri-sendiri. */
function judulUntuk(path: string): { judul: string; sapaan: string; judulTetap?: boolean } | null {
  if (path === "/ujian-online") return { judul: "Ujian Online", sapaan: "Silakan pilih ujian yang akan Anda kerjakan." };
  // Panduan bukan halaman ujian: judulnya tetap "Panduan Peserta", tidak diganti nama kegiatan.
  if (path.startsWith("/ujian-online/panduan")) return { judul: "Panduan Peserta", sapaan: "Cara mengikuti ujian online, dari masuk sampai mengumpulkan.", judulTetap: true };
  if (path.startsWith("/ujian-online/mulai")) return { judul: "Konfirmasi Ujian", sapaan: "Baca petunjuk, masukkan token, lalu mulai mengerjakan." };
  return null;
}

export default function PortalPesertaShell({
  logoUrl, namaSekolah, nama, keterangan, kegiatan, children,
}: {
  logoUrl?: string;
  namaSekolah: string;
  nama: string;
  /** Kelas & NIS peserta — ditampilkan kecil di bawah nama supaya yakin tidak salah akun. */
  keterangan?: string;
  /** Kegiatan ujian yang berlaku untuk tingkat kelas peserta (STS/SAS/PSAJ/...) — diberi nama
   * oleh proktor di Pengaturan Ujian. Kalau ada, namanya menjadi judul besar kepala portal. */
  kegiatan?: { nama: string; keterangan: string } | null;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const megah = judulUntuk(path);

  if (!megah) {
    /* ——— kepala RINGKAS: halaman pengerjaan soal ——— */
    return (
      <div className="min-h-screen flex flex-col bg-cream">
        <header className="relative overflow-hidden print:hidden" style={{ background: NAVY }}>
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", filter: "invert(1)" }} />
          <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={namaSekolah} className="h-7 sm:h-8 w-auto object-contain shrink-0" />
            ) : null}
            <span className="hidden sm:block w-px h-6 bg-white/20 shrink-0" />
            <p className="font-heading font-semibold text-white/90 text-xs sm:text-sm truncate flex-1">{nama}</p>
            <span className="text-gold/80 text-xs font-heading font-semibold uppercase tracking-[0.12em] hidden sm:block shrink-0 truncate max-w-[45%]">
              {kegiatan?.nama ?? "Sedang Ujian"}
            </span>
          </div>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  /* ——— kepala MEGAH: beranda & konfirmasi ——— */
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <header className="relative overflow-hidden text-center px-5 pt-8 pb-20" style={{ background: NAVY }}>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", filter: "invert(1)" }} />
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #3b5bdb 0%, transparent 70%)" }} />

        <form action={logout} className="absolute top-4 right-4 z-10">
          <button type="submit" title="Keluar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-red-500/30 text-xs font-semibold transition">
            <LogOut size={14} /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </form>

        <div className="relative max-w-xl mx-auto">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={namaSekolah} className="mx-auto h-11 w-auto object-contain" />
          ) : null}
          <h1 className="font-heading font-bold text-white text-xl sm:text-2xl uppercase tracking-[0.12em] mt-5 leading-snug">{megah.judulTetap ? megah.judul : (kegiatan?.nama ?? megah.judul)}</h1>
          <div className="mx-auto mt-2 h-[3px] w-20 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent 0%, #F5C842 50%, transparent 100%)" }} />
          <p className="font-heading font-semibold text-gold text-xs uppercase tracking-[0.1em] mt-2">
            {kegiatan && !megah.judulTetap ? (kegiatan.keterangan || "Ujian Online") : namaSekolah}
          </p>
          <p className="text-white/70 text-sm mt-3 leading-relaxed">
            {megah.sapaan}
          </p>
          <p className="text-white/45 text-xs mt-1.5">{nama}{keterangan ? ` · ${keterangan}` : ""}</p>
        </div>
      </header>

      <div className="relative flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="max-w-3xl mx-auto -mt-12">{children}</div>
        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} {namaSekolah}
        </p>
      </div>
      <MobileBottomNav items={NAV_PESERTA} beranda={{ href: "/ujian-online", icon: FileQuestion, simbol: "quiz", label: "Ujian" }} />
    </div>
  );
}
