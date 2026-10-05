"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Images, Loader2, Palette, Save, Trash2, Video, FileDown, ExternalLink, QrCode, Plus } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import ImageUpload from "@/components/admin/ImageUpload";
import UnggahBanyakGambar from "@/components/shared/UnggahBanyakGambar";
import FileUpload from "@/components/shared/FileUpload";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import Select from "@/components/admin/Select";
import { TEMA_SPMB, idYoutube, RASIO_GAMBAR, ISI_GAMBAR, rasioGambar, rapikanGaleri, rapikanLogo, rapikanBanding, type NamaTema, type GaleriSpmb, type LogoMitra, type SebelumSesudah } from "@/lib/spmb-konten";

/** Poster & bahan promosi SPMB (permintaan user 1 Oktober 2026: "bisa set poster maupun foto
 *  promosi … jadi nanti di web ketika pilih spmb, tampilannya juga berbeda lebih keren").
 *  Semua yang dipasang di sini langsung mengubah halaman /admissions — tidak ada gambar promosi
 *  yang tertulis mati di kode lagi. */
export default function PromosiSpmbManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [poster, setPoster] = useState("");
  const [posterLain, setPosterLain] = useState<string[]>([]);
  const [foto, setFoto] = useState<string[]>([]);
  const [judulGaleri, setJudulGaleri] = useState("");
  const [posterRasio, setPosterRasio] = useState("auto");
  const [posterIsi, setPosterIsi] = useState("utuh");
  const [fotoRasio, setFotoRasio] = useState("4:3");
  const [fotoIsi, setFotoIsi] = useState("utuh");
  const [galeriLain, setGaleriLain] = useState<GaleriSpmb[]>([]);
  const [logoMitra, setLogoMitra] = useState<LogoMitra[]>([]);
  const [judulLogo, setJudulLogo] = useState("");
  const [banding, setBanding] = useState<SebelumSesudah[]>([]);
  const [brosur, setBrosur] = useState("");
  const [video, setVideo] = useState("");
  const [tema, setTema] = useState<NamaTema>("malam");

  useEffect(() => {
    fetch("/api/spmb/pengaturan")
      .then(r => r.json())
      .then(d => {
        if (!d || d.error) return;
        setPoster(d["spmb.poster"] ?? "");
        try {
          const j = JSON.parse(d["spmb.posterLain"] ?? "[]");
          setPosterLain(Array.isArray(j) ? j.filter((x: unknown) => typeof x === "string") : []);
        } catch { setPosterLain([]); }
        setBrosur(d["spmb.brosur"] ?? "");
        setVideo(d["spmb.video"] ?? "");
        setJudulGaleri(d["spmb.judulGaleri"] ?? "");
        setPosterRasio(d["spmb.posterRasio"] || "auto");
        setPosterIsi(d["spmb.posterIsi"] || "utuh");
        setFotoRasio(d["spmb.fotoRasio"] || "4:3");
        setFotoIsi(d["spmb.fotoIsi"] || "utuh");
        const daftarJson = <T,>(kunci: string, rapi: (x: unknown) => T | null): T[] => {
          try { const j = JSON.parse(d[kunci] ?? "[]"); return Array.isArray(j) ? j.map(rapi).filter((x): x is T => !!x) : []; } catch { return []; }
        };
        setLogoMitra(daftarJson("spmb.logoMitra", rapikanLogo));
        setBanding(daftarJson("spmb.sebelumSesudah", rapikanBanding));
        setJudulLogo(d["spmb.judulLogo"] ?? "");
        try {
          const j = JSON.parse(d["spmb.galeriLain"] ?? "[]");
          setGaleriLain(Array.isArray(j) ? j.map(rapikanGaleri).filter((g): g is GaleriSpmb => !!g) : []);
        } catch { setGaleriLain([]); }
        setTema((d["spmb.tema"] as NamaTema) ?? "malam");
        try {
          const j = JSON.parse(d["spmb.fotoPromosi"] ?? "[]");
          setFoto(Array.isArray(j) ? j.filter((x: unknown) => typeof x === "string") : []);
        } catch { setFoto([]); }
      })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  async function simpan(ubahan: Record<string, string>) {
    setSibuk(true);
    const r = await fetch("/api/spmb/pengaturan", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ubahan),
    }).catch(() => null);
    setSibuk(false);
    if (r?.ok) { toast.success("Tersimpan — halaman SPMB di situs langsung berubah"); return true; }
    const d = await r?.json().catch(() => null);
    toast.error(d?.error ?? "Gagal menyimpan");
    return false;
  }

  async function hapusFoto(url: string) {
    const ya = await confirm("Hapus foto ini dari halaman SPMB? Berkasnya tetap ada di server.");
    if (!ya) return;
    const baru = foto.filter(f => f !== url);
    setFoto(baru);
    await simpan({ "spmb.fotoPromosi": JSON.stringify(baru) });
  }

  const idVideo = idYoutube(video);

  if (memuat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Images size={22} />} title="Poster & Promosi"
        description="Poster, foto suasana, brosur, video, dan tampilan halaman SPMB di situs sekolah" />

      <div className="space-y-6">
        {/* Tampilan halaman publik */}
        <div className="panel p-5">
          <h2 className="font-heading font-semibold text-navy text-sm mb-1 flex items-center gap-2">
            <Palette size={15} className="text-primary-700" /> Tampilan halaman SPMB
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Menentukan warna dan suasana halaman <span className="font-medium">/admissions</span> di situs sekolah —
            halaman SPMB sengaja dibuat berbeda dari halaman lain.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(TEMA_SPMB) as NamaTema[]).map(nama => {
              const t = TEMA_SPMB[nama];
              const dipilih = tema === nama;
              return (
                <button key={nama} type="button" onClick={() => setTema(nama)}
                  className={`relative overflow-hidden rounded-2xl p-4 text-left ring-2 transition sentuh ${dipilih ? "ring-primary-700" : "ring-transparent hover:ring-primary-100"}`}>
                  <span className={`absolute inset-0 bg-gradient-to-br ${t.latar}`} />
                  <span className="relative block">
                    <span className={`block text-sm font-semibold ${t.aksen}`}>{t.label}</span>
                    <span className="mt-6 flex gap-1.5">
                      <span className={`h-2 w-10 rounded-full ${t.aksenBg}`} />
                      <span className="h-2 w-6 rounded-full bg-white/40" />
                      <span className="h-2 w-4 rounded-full bg-white/20" />
                    </span>
                    {dipilih && <span className={`mt-3 block text-xs font-semibold ${t.teks}`}>Dipakai sekarang</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" disabled={sibuk} onClick={() => simpan({ "spmb.tema": tema })} className="btn-modal-save">
              {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Tampilan
            </button>
            <a href="/admissions" className="btn-modal-cancel"><ExternalLink size={16} /> Lihat Halaman SPMB</a>
            <a href="/pusat-spmb/qr" className="btn-modal-cancel btn-teks"><QrCode size={16} /> Kartu QR Pendaftaran</a>
          </div>
        </div>

        {/* Poster utama */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
          <div className="panel p-5">
            <h2 className="font-heading font-semibold text-navy text-sm mb-1">Poster SPMB</h2>
            <p className="text-xs text-gray-500 mb-4">
              Poster yang tampil besar di halaman SPMB — bentuknya (potret, persegi, atau lanskap) diatur di bawah. <span className="font-medium">Satu
              poster tampil diam; dua atau lebih berganti sendiri tiap 6 detik</span> dengan titik penanda yang bisa
              diketuk. Poster utama selalu tampil lebih dulu.
            </p>
            <ImageUpload value={poster} onChange={setPoster} folder="spmb" label="Poster utama" aspect="portrait"
              hint="JPG/PNG/WEBP potret — maks. 5MB" />
            <button type="button" disabled={sibuk} onClick={() => simpan({ "spmb.poster": poster })} className="btn-modal-save mt-4">
              {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Poster Utama
            </button>

            <PilihBentuk judul="Bentuk & ukuran poster" rasio={posterRasio} isi={posterIsi}
              onRasio={setPosterRasio} onIsi={setPosterIsi} sibuk={sibuk}
              ketOtomatis="Kartu mengikuti ukuran asli tiap poster."
              onSimpan={() => simpan({ "spmb.posterRasio": posterRasio, "spmb.posterIsi": posterIsi })} />

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm font-semibold text-primary-900">Poster tambahan</p>
              <p className="mb-4 text-xs text-gray-500">
                Ditampilkan bergantian setelah poster utama. Kosongkan bila sekolah hanya punya satu poster.
              </p>
              {posterLain.length > 0 ? (
                <div className="kisi-kartu kisi-kartu-3 mb-5">
                  {posterLain.map((url, i) => (
                    <div key={url} className="relative overflow-hidden rounded-xl border border-gray-100">
                      <Image src={url} alt={`Poster tambahan ${i + 1}`} width={300} height={400}
                        className="h-36 w-full object-cover" unoptimized />
                      <span className="angka absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 text-xs font-semibold text-white">
                        {i + 2}
                      </span>
                      <button type="button" title="Hapus"
                        onClick={async () => {
                          if (!(await confirm("Hapus poster ini dari halaman SPMB?"))) return;
                          const baru = posterLain.filter(x => x !== url);
                          setPosterLain(baru);
                          await simpan({ "spmb.posterLain": JSON.stringify(baru) });
                        }}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">Belum ada poster tambahan.</p>
              )}
              <div className="max-w-xs">
                <UnggahBanyakGambar folder="spmb" label="Tambah poster (bisa pilih banyak)"
                  hint="JPG/PNG/WEBP potret — maks. 5MB per berkas"
                  onSelesai={alamat => {
                    const baru = [...posterLain, ...alamat];
                    setPosterLain(baru);
                    simpan({ "spmb.posterLain": JSON.stringify(baru) });
                  }} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="panel p-5">
              <h2 className="font-heading font-semibold text-navy text-sm mb-1 flex items-center gap-2">
                <FileDown size={15} className="text-primary-700" /> Brosur
              </h2>
              <p className="text-xs text-gray-500 mb-4">Berkas PDF yang bisa diunduh dari halaman SPMB.</p>
              <FileUpload value={brosur} onChange={setBrosur} folder="spmb" label="Brosur"
                accept="application/pdf" hint="PDF — maks. 5MB" />
              <button type="button" disabled={sibuk} onClick={() => simpan({ "spmb.brosur": brosur })} className="btn-modal-save mt-4">
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Brosur
              </button>
            </div>

            <div className="panel p-5">
              <h2 className="font-heading font-semibold text-navy text-sm mb-1 flex items-center gap-2">
                <Video size={15} className="text-primary-700" /> Video profil
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Tempel tautan YouTube apa pun (watch, youtu.be, shorts) — videonya ditanam di halaman SPMB.
              </p>
              <input className="input-field" value={video} onChange={e => setVideo(e.target.value)}
                placeholder="https://youtu.be/..." />
              {video && !idVideo && <p className="error-msg mt-2">Tautan YouTube belum terbaca. Periksa kembali.</p>}
              {idVideo && (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://img.youtube.com/vi/${idVideo}/mqdefault.jpg`} alt="Pratinjau video" className="w-full" />
                </div>
              )}
              <button type="button" disabled={sibuk || (!!video && !idVideo)}
                onClick={() => simpan({ "spmb.video": video })} className="btn-modal-save mt-4">
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Video
              </button>
            </div>
          </div>
        </div>

        {/* Foto promosi */}
        <div className="panel p-5">
          <h2 className="font-heading font-semibold text-navy text-sm mb-1">Foto promosi</h2>
          <p className="text-xs text-gray-500 mb-4">
            Foto kegiatan, asrama, bengkel praktik, seragam, atau fasilitas — tampil sebagai galeri bergulir di halaman SPMB,
            utuh tanpa dipotong. Urutannya mengikuti urutan unggah.
          </p>

          <div className="baris-alat items-end mb-5">
            <div className="alat-cari">
              <label className="label-field">Judul galeri di halaman SPMB</label>
              <input className="input-field" value={judulGaleri} maxLength={60}
                onChange={e => setJudulGaleri(e.target.value)} placeholder="Galeri Promosi" />
            </div>
            <div className="alat-aksi alat-teks">
              <button type="button" disabled={sibuk} className="btn-modal-save"
                onClick={() => simpan({ "spmb.judulGaleri": judulGaleri.trim() })}>
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Judul
              </button>
            </div>
          </div>

          <div className="mb-5 max-w-2xl">
            <PilihBentuk judul="Bentuk & ukuran bingkai foto" rasio={fotoRasio} isi={fotoIsi}
              onRasio={setFotoRasio} onIsi={setFotoIsi} sibuk={sibuk}
              ketOtomatis="Bingkai 4 × 3, foto tetap ditampilkan utuh."
              onSimpan={() => simpan({ "spmb.fotoRasio": fotoRasio, "spmb.fotoIsi": fotoIsi })} />
          </div>

          {foto.length > 0 ? (
            <div className="kisi-kartu kisi-kartu-4 mb-5">
              {foto.map((url, i) => (
                <div key={url} className="relative overflow-hidden rounded-xl border border-gray-100">
                  <Image src={url} alt={`Foto promosi ${i + 1}`} width={400} height={300}
                    className="h-32 w-full bg-gray-50 object-contain" unoptimized />
                  <button type="button" onClick={() => hapusFoto(url)} title="Hapus"
                    className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Belum ada foto promosi.</p>
          )}

          <div className="max-w-md">
            <UnggahBanyakGambar folder="spmb" label="Tambah foto (bisa pilih banyak)"
              hint="JPG/PNG/WEBP mendatar — maks. 5MB per berkas"
              onSelesai={alamat => {
                const baru = [...foto, ...alamat];
                setFoto(baru);
                simpan({ "spmb.fotoPromosi": JSON.stringify(baru) });
              }} />
          </div>
        </div>

        {/* Galeri tambahan — tiap galeri punya judul, foto, dan bentuknya sendiri. */}
        {galeriLain.map((g, gi) => (
          <GaleriTambahan key={gi} nomor={gi + 2} galeri={g} sibuk={sibuk}
            ubahLokal={baru => setGaleriLain(l => l.map((x, i) => (i === gi ? baru : x)))}
            simpan={async baru => {
              const daftar = galeriLain.map((x, i) => (i === gi ? baru : x));
              setGaleriLain(daftar);
              await simpan({ "spmb.galeriLain": JSON.stringify(daftar) });
            }}
            hapus={async () => {
              if (!(await confirm(`Hapus galeri "${g.judul || `Galeri ${gi + 2}`}" dari halaman SPMB? Berkas fotonya tetap ada di server.`))) return;
              const daftar = galeriLain.filter((_, i) => i !== gi);
              setGaleriLain(daftar);
              await simpan({ "spmb.galeriLain": JSON.stringify(daftar) });
            }} />
        ))}

        <div>
          <button type="button" className="btn-modal-cancel btn-teks"
            onClick={() => setGaleriLain(l => [...l, { judul: "", foto: [], rasio: "4:3", isi: "utuh" }])}>
            <Plus size={16} /> Tambah Galeri Lain
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Mis. &ldquo;Fasilitas Asrama&rdquo;, &ldquo;Kegiatan Santri&rdquo;, &ldquo;Bengkel Praktik&rdquo; — tampil berurutan di bawah galeri pertama.
            Galeri tanpa foto tidak ditampilkan di situs.
          </p>
        </div>

        {/* Logo mitra industri & kampus alumni — deret logo bergulir di halaman SPMB & beranda. */}
        <div className="panel p-5">
          <h2 className="font-heading font-semibold text-navy text-sm mb-1">Logo mitra industri & kampus alumni</h2>
          <p className="text-xs text-gray-500 mb-4">
            Tampil sebagai deret logo yang bergulir pelan di halaman SPMB dan beranda. Pakai logo berlatar transparan (PNG) bila ada.
          </p>
          <div className="baris-alat items-end mb-5">
            <div className="alat-cari">
              <label className="label-field">Judul deret logo</label>
              <input className="input-field" value={judulLogo} maxLength={80} placeholder="Mitra Industri & Kampus Alumni"
                onChange={e => setJudulLogo(e.target.value)} />
            </div>
            <div className="alat-aksi alat-teks">
              <button type="button" disabled={sibuk} className="btn-modal-save" onClick={() => simpan({ "spmb.judulLogo": judulLogo.trim() })}>
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Judul
              </button>
            </div>
          </div>
          {logoMitra.length > 0 ? (
            <div className="kisi-kartu kisi-kartu-4 mb-5">
              {logoMitra.map((l, i) => (
                <div key={l.logo + i} className="rounded-xl border border-gray-100 p-3">
                  <div className="relative mb-2 h-16 w-full">
                    <Image src={l.logo} alt={l.nama || `Logo ${i + 1}`} fill className="object-contain" unoptimized />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input className="input-field min-w-0 flex-1" value={l.nama} maxLength={80} placeholder="Nama mitra / kampus"
                      onChange={e => setLogoMitra(d => d.map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)))}
                      onBlur={() => simpan({ "spmb.logoMitra": JSON.stringify(logoMitra) })} />
                    <button type="button" title="Hapus"
                      onClick={() => { const baru = logoMitra.filter((_, j) => j !== i); setLogoMitra(baru); simpan({ "spmb.logoMitra": JSON.stringify(baru) }); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-gray-400">Belum ada logo.</p>
          )}
          <div className="max-w-md">
            <UnggahBanyakGambar folder="spmb" label="Tambah logo (bisa pilih banyak)" hint="PNG transparan / JPG — maks. 5MB per berkas"
              onSelesai={alamat => {
                const baru = [...logoMitra, ...alamat.map(a => ({ nama: "", logo: a }))];
                setLogoMitra(baru);
                simpan({ "spmb.logoMitra": JSON.stringify(baru) });
              }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">Nama logo tersimpan otomatis saat kotak nama ditinggalkan.</p>
        </div>

        {/* Pasangan foto sebelum & sesudah — penggeser pembanding di halaman SPMB. */}
        <div className="panel p-5">
          <h2 className="font-heading font-semibold text-navy text-sm mb-1">Foto sebelum & sesudah</h2>
          <p className="text-xs text-gray-500 mb-4">
            Mis. sketsa → hasil akhir karya siswa DKV, atau ruang sebelum → sesudah direnovasi. Pengunjung menggeser garis di tengah
            foto untuk membandingkan. Pakai dua foto dengan sudut pengambilan yang sama supaya perbandingannya terasa.
          </p>
          <div className="space-y-5">
            {banding.map((b, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-primary-900">Pasangan {i + 1}{b.judul ? ` — ${b.judul}` : ""}</p>
                  <button type="button" title="Hapus pasangan"
                    onClick={async () => {
                      if (!(await confirm("Hapus pasangan foto ini dari halaman SPMB?"))) return;
                      const baru = banding.filter((_, j) => j !== i); setBanding(baru); simpan({ "spmb.sebelumSesudah": JSON.stringify(baru) });
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["sebelum", "sesudah"] as const).map(kunci => (
                    <div key={kunci} className="min-w-0">
                      <ImageUpload value={b[kunci]} folder="spmb" label={kunci === "sebelum" ? `Foto ${b.labelA}` : `Foto ${b.labelB}`}
                        onChange={url => setBanding(d => d.map((x, j) => (j === i ? { ...x, [kunci]: url } : x)))} />
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className="label-field">Judul</label>
                    <input className="input-field" value={b.judul} maxLength={120} placeholder="Mis. Karya Poster Siswa DKV"
                      onChange={e => setBanding(d => d.map((x, j) => (j === i ? { ...x, judul: e.target.value } : x)))} /></div>
                  <div><label className="label-field">Keterangan (opsional)</label>
                    <input className="input-field" value={b.ket} maxLength={300}
                      onChange={e => setBanding(d => d.map((x, j) => (j === i ? { ...x, ket: e.target.value } : x)))} /></div>
                  <div><label className="label-field">Label kiri</label>
                    <input className="input-field" value={b.labelA} maxLength={30} placeholder="Sebelum"
                      onChange={e => setBanding(d => d.map((x, j) => (j === i ? { ...x, labelA: e.target.value } : x)))} /></div>
                  <div><label className="label-field">Label kanan</label>
                    <input className="input-field" value={b.labelB} maxLength={30} placeholder="Sesudah"
                      onChange={e => setBanding(d => d.map((x, j) => (j === i ? { ...x, labelB: e.target.value } : x)))} /></div>
                </div>
              </div>
            ))}
          </div>
          {banding.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada pasangan foto.</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" className="btn-modal-cancel btn-teks"
              onClick={() => setBanding(d => [...d, { judul: "", ket: "", sebelum: "", sesudah: "", labelA: "Sebelum", labelB: "Sesudah" }])}>
              <Plus size={16} /> Tambah Pasangan
            </button>
            {banding.length > 0 && (
              <button type="button" disabled={sibuk} className="btn-modal-save"
                onClick={() => simpan({ "spmb.sebelumSesudah": JSON.stringify(banding) })}>
                {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Semua Pasangan
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">Pasangan yang fotonya belum lengkap tidak ditampilkan di situs.</p>
        </div>
      </div>
    </div>
  );
}

/** Satu galeri tambahan. Judul & bentuk diubah lalu disimpan dengan tombol; foto tersimpan langsung
 *  saat diunggah/dihapus, sama seperti galeri pertama. */
function GaleriTambahan({ nomor, galeri: g, sibuk, ubahLokal, simpan, hapus }: {
  nomor: number; galeri: GaleriSpmb; sibuk: boolean;
  ubahLokal: (g: GaleriSpmb) => void; simpan: (g: GaleriSpmb) => Promise<void>; hapus: () => void;
}) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-navy text-sm">Galeri {nomor}{g.judul ? ` — ${g.judul}` : ""}</h2>
          <p className="text-xs text-gray-500">Tampil di halaman SPMB dengan judulnya sendiri.</p>
        </div>
        <button type="button" onClick={hapus} title="Hapus galeri"
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="baris-alat items-end mb-5">
        <div className="alat-cari">
          <label className="label-field">Judul galeri</label>
          <input className="input-field" value={g.judul} maxLength={60} placeholder="Mis. Fasilitas Asrama"
            onChange={e => ubahLokal({ ...g, judul: e.target.value })} />
        </div>
        <div className="alat-aksi alat-teks">
          <button type="button" disabled={sibuk} className="btn-modal-save" onClick={() => simpan({ ...g, judul: g.judul.trim() })}>
            {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Judul
          </button>
        </div>
      </div>

      {g.foto.length > 0 ? (
        <div className="kisi-kartu kisi-kartu-4 mb-5">
          {g.foto.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-xl border border-gray-100">
              <Image src={url} alt={`Foto ${i + 1}`} width={400} height={300}
                className="h-32 w-full bg-gray-50 object-contain" unoptimized />
              <button type="button" title="Hapus" onClick={() => simpan({ ...g, foto: g.foto.filter(f => f !== url) })}
                className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-gray-400">Belum ada foto di galeri ini.</p>
      )}

      <div className="max-w-md">
        <UnggahBanyakGambar folder="spmb" label="Tambah foto (bisa pilih banyak)" hint="JPG/PNG/WEBP — maks. 5MB per berkas"
          onSelesai={alamat => simpan({ ...g, foto: [...g.foto, ...alamat] })} />
      </div>

      <div className="max-w-2xl">
        <PilihBentuk judul="Bentuk & ukuran bingkai foto" rasio={g.rasio} isi={g.isi} sibuk={sibuk}
          onRasio={v => ubahLokal({ ...g, rasio: v })}
          onIsi={v => ubahLokal({ ...g, isi: v === "penuh" ? "penuh" : "utuh" })}
          ketOtomatis="Bingkai 4 × 3, foto tetap ditampilkan utuh."
          onSimpan={() => simpan(g)} />
      </div>
    </div>
  );
}

/** Pilihan bentuk bingkai (potret/persegi/lanskap) + cara isi, dengan pratinjau bingkai kecil supaya
 *  panitia langsung melihat bentuk yang dipilih. Dipakai untuk poster & foto promosi. */
function PilihBentuk({ judul, rasio, isi, onRasio, onIsi, onSimpan, sibuk, ketOtomatis }: {
  judul: string; rasio: string; isi: string; sibuk: boolean; ketOtomatis: string;
  onRasio: (v: string) => void; onIsi: (v: string) => void; onSimpan: () => void;
}) {
  const r = rasioGambar(rasio);
  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <p className="text-sm font-semibold text-primary-900">{judul}</p>
      <p className="mb-4 text-xs text-gray-500">
        Pilih potret, persegi, atau lanskap. {r ? "Semua gambar ditampilkan dalam bingkai ini." : ketOtomatis}
      </p>
      <div className="flex items-start gap-4">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3">
          <div>
            <label className="label-field">Bentuk (lebar × tinggi)</label>
            <Select value={rasio} onChange={onRasio}
              options={RASIO_GAMBAR.map(x => ({ value: x.nilai, label: x.label }))} />
          </div>
          <div>
            <label className="label-field">Tampilan gambar</label>
            <Select value={isi} onChange={onIsi}
              options={ISI_GAMBAR.map(x => ({ value: x.nilai, label: x.label }))} />
          </div>
        </div>
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-gray-50">
          <div className="flex items-center justify-center rounded-md border-2 border-dashed border-primary-500 bg-primary-50 text-xs font-semibold text-primary-700"
            style={r ? (r >= 1 ? { width: 88, height: 88 / r } : { height: 88, width: 88 * r }) : { width: 62, height: 88 }}>
            {r ? RASIO_GAMBAR.find(x => x.nilai === rasio)?.nilai.replace(":", "×").replace("a4", "A4") : "Auto"}
          </div>
        </div>
      </div>
      <button type="button" disabled={sibuk} onClick={onSimpan} className="btn-modal-save mt-4">
        {sibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Bentuk
      </button>
    </div>
  );
}
