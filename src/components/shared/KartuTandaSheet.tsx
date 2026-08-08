"use client";
import { useState } from "react";
import Link from "next/link";
import { IdCard, Loader2, Pencil } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import PrintButton from "@/components/shared/PrintButton";
import { KartuTemplate, KartuBox, KartuFieldContext, resolveKartuText, resolveShape } from "@/lib/kartu-tanda-template";

const SHAPE_CLASS: Record<"square" | "rounded" | "circle", string> = { square: "", rounded: "rounded-lg", circle: "rounded-full" };

type CardType = "SISWA" | "GURU" | "PEGAWAI";
interface CardPerson { identifier: string; name: string; avatar: string | null; sub: string | null; kelas: string | null; jurusan: string | null; ttl: string | null; religion: string | null; qr: string }
interface ClassOption { id: string; name: string }

const TYPE_LABEL: Record<CardType, string> = { SISWA: "Pelajar", GURU: "Pendidik", PEGAWAI: "Pegawai" };
const IDENTIFIER_LABEL: Record<CardType, string> = { SISWA: "NIS", GURU: "NIP", PEGAWAI: "ID" };
const CARD_RATIO = "85.6 / 54"; // rasio kartu ID standar CR80/KTP (mirip kartu ATM) buat pratinjau di layar
// Saat DICETAK, ukurannya dipaksa ke fisik SEBENARNYA 85.6mm x 54mm (bukan cuma rasio yang
// ngikut lebar grid) — supaya begitu digunting & dilaminating jadi kartu ID beneran, ukurannya
// pas sama dudukan/plastik laminating standar CR80, bukan lebih besar/kecil dari seharusnya.
const CARD_PRINT_SIZE = "print:w-[85.6mm] print:h-[54mm] print:aspect-auto";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Kartu render lewat Desain Kartu Tanda custom (dibuat admin di /kartu-tanda/editor) — setiap
 * box diposisikan absolut (persen dari kartu, anchor tengah, sama seperti cover editor jurnal).
 * Box teks resolve dari data orang/sekolah; box foto/qr/signature ambil gambar sesuai konteks
 * (foto orang, QR identitas orang, atau QR TTD Kepala Sekolah yg sama utk semua kartu). */
function TemplateCard({ imageUrl, boxes, ctx, avatar, qr, signatureUrl }: {
  imageUrl: string; boxes: KartuBox[]; ctx: KartuFieldContext; avatar?: string | null; qr?: string; signatureUrl?: string;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm break-inside-avoid relative bg-white ${CARD_PRINT_SIZE}`} style={{ aspectRatio: CARD_RATIO }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {boxes.map(box => {
        const style = { left: `${box.xPct}%`, top: `${box.yPct}%`, transform: "translate(-50%, -50%)" };
        if (box.type === "text") {
          return (
            <div key={box.id} className="absolute" style={{
              ...style, fontSize: `${box.fontSize}px`, color: box.color, fontWeight: box.bold ? 700 : 400,
              textAlign: box.align, whiteSpace: "pre-wrap", width: `${box.widthPct}%`,
            }}>
              {resolveKartuText(box, ctx)}
            </div>
          );
        }
        const src = box.type === "photo" ? avatar : box.type === "qr" ? qr : signatureUrl;
        const shapeClass = SHAPE_CLASS[resolveShape(box)];
        if (!src) {
          if (box.type !== "photo") return null;
          return (
            <div key={box.id} className={`absolute bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-400 overflow-hidden ${shapeClass}`}
              style={{ ...style, width: `${box.widthPct}%`, height: `${box.heightPct}%` }}>
              {initials(ctx.nama)}
            </div>
          );
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={box.id} src={src} alt="" className={`absolute object-cover ${shapeClass}`}
            style={{ ...style, width: `${box.widthPct}%`, height: `${box.heightPct}%` }} />
        );
      })}
    </div>
  );
}

function FrontCard({ p, type, logoEmblem }: { p: CardPerson; type: CardType; logoEmblem?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm break-inside-avoid relative text-white ${CARD_PRINT_SIZE}`}
      style={{ aspectRatio: CARD_RATIO, background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 45%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "50px 50px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
      <div className="relative h-full flex flex-col p-3">
        <div className="flex items-center gap-1.5 mb-2">
          {logoEmblem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoEmblem} alt="" className="w-6 h-6 shrink-0" />
          )}
          <div className="leading-tight min-w-0">
            <p className="text-[8px] font-bold text-gold uppercase tracking-wide truncate">SMK Al-Munawwir IIBS</p>
            <p className="text-[7px] text-white/60 uppercase tracking-wide">Kartu Tanda {TYPE_LABEL[type]}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 min-h-0">
          {p.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar} alt="" className="rounded-lg object-cover border-2 border-white/20 shrink-0" style={{ aspectRatio: "3 / 4", width: "26%" }} />
          ) : (
            <div className="rounded-lg bg-white/10 border-2 border-white/20 font-bold flex items-center justify-center text-lg shrink-0" style={{ aspectRatio: "3 / 4", width: "26%" }}>
              {initials(p.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate">{p.name}</p>
            {p.sub && <p className="text-[10px] text-gold/90 mt-0.5 truncate">{p.sub}</p>}
            {p.ttl && <p className="text-[9px] text-white/60 mt-1 truncate">TTL: {p.ttl}</p>}
            {p.religion && <p className="text-[9px] text-white/60 truncate">Agama: {p.religion}</p>}
          </div>
        </div>
        <div className="mt-2 bg-white rounded-lg px-2 py-1.5 flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.qr} alt="QR" className="w-11 h-11 shrink-0" />
          <div className="min-w-0">
            <p className="text-[7px] text-gray-400 uppercase tracking-wide">{IDENTIFIER_LABEL[type]}</p>
            <p className="text-[11px] font-mono font-bold text-primary-900 truncate">{p.identifier}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackCard({ logoEmblem, signatureUrl, principalName, address, phone, email }: {
  logoEmblem?: string; signatureUrl?: string; principalName?: string; address?: string; phone?: string; email?: string;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm break-inside-avoid border border-gray-200 bg-white ${CARD_PRINT_SIZE}`}
      style={{ aspectRatio: CARD_RATIO }}>
      <div className="p-3 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-100 shrink-0">
          {logoEmblem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoEmblem} alt="" className="w-6 h-6 shrink-0" />
          )}
          <div className="leading-tight min-w-0">
            <p className="text-[8px] font-bold text-primary-900 uppercase tracking-wide truncate">SMK Al-Munawwir IIBS</p>
            <p className="text-[7px] text-gray-400 truncate">Islamic International Boarding School</p>
          </div>
        </div>
        <div className="text-[7.5px] text-gray-500 leading-snug space-y-0.5 shrink-0">
          {address && <p className="line-clamp-2">{address}</p>}
          {(phone || email) && <p className="truncate">{[phone, email].filter(Boolean).join(" · ")}</p>}
        </div>
        <p className="text-[6.5px] text-gray-400 italic leading-snug my-1.5 flex-1 min-h-0">
          Kartu ini adalah milik sah SMK Al-Munawwir IIBS. Jika ditemukan, mohon dikembalikan ke alamat di atas.
        </p>
        <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-gray-100 shrink-0">
          <div className="text-right leading-tight">
            <p className="text-[7px] font-semibold text-primary-900 whitespace-nowrap">{principalName || "Kepala Sekolah"}</p>
            <p className="text-[6px] text-gray-400">Kepala Sekolah · Verifikasi Sah</p>
          </div>
          {signatureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureUrl} alt="QR Verifikasi Tanda Tangan Kepala Sekolah" className="h-12 w-12 object-contain shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

/** Kartu Tanda resmi sekolah — generalisasi dari "Kartu Anggota" yang sudah ada di Perpustakaan:
 * identifier (NIS/NIP/potongan email) & QR-nya SAMA PERSIS, jadi kartu ini otomatis juga jalan
 * dipakai scan di Perpustakaan (pinjam buku/kunjungan) maupun Piket, tanpa perlu barcode
 * terpisah — satu orang, satu barcode, dipakai lintas modul. Desain kartu bisa DIKUSTOMISASI
 * penuh lewat /kartu-tanda/editor (upload gambar latar + drag-drop foto/QR/teks, pola sama
 * dengan Desain Cover Absensi & Jurnal) — kalau belum pernah didesain (imageUrl kosong), pakai
 * desain bawaan (FrontCard/BackCard di bawah) supaya tetap langsung bisa dipakai. Cetak: sisi
 * depan semua orang dulu, page-break, baru sisi belakang urutan SAMA — supaya posisi grid per
 * halaman nyambung saat digunting. */
export default function KartuTandaSheet({ classes, template, logoEmblem, signatureUrl, principalName, address, phone, email }: {
  classes: ClassOption[]; template?: KartuTemplate; logoEmblem?: string; signatureUrl?: string; principalName?: string;
  address?: string; phone?: string; email?: string;
}) {
  const [type, setType] = useState<CardType>("SISWA");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState<CardPerson[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ type, ...(type === "SISWA" && classId ? { classId } : {}) });
    await fetch(`/api/admin/kartu-tanda?${qs.toString()}`).then(r => r.json())
      .then((json: CardPerson[]) => setData(Array.isArray(json) ? json : []))
      .catch(() => setData([]));
    setLoading(false);
  }

  const hasFrontTemplate = !!template?.front.imageUrl;
  const hasBackTemplate = !!template?.back.imageUrl;
  const kontakSekolah = [phone, email].filter(Boolean).join(" · ");

  function ctxFor(p: CardPerson): KartuFieldContext {
    return {
      nama: p.name, identifier: p.identifier, sub: p.sub ?? "", kelas: p.kelas ?? "", jurusan: p.jurusan ?? "",
      ttl: p.ttl ?? "", agama: p.religion ?? "", jenisKartu: TYPE_LABEL[type],
      namaSekolah: "SMK Al-Munawwir IIBS", alamatSekolah: address ?? "", kontakSekolah, namaKepsek: principalName ?? "Kepala Sekolah",
    };
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <style>{"@page { size: A4; margin: 1cm; }"}</style>

      <div className="print:hidden">
        <PageHeader icon={<IdCard size={22} />} title="Kartu Tanda" description="Cetak kartu identitas resmi 2 sisi — siswa, guru, dan pegawai" />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5 print:hidden">
        <div>
          <label className="label-field">Jenis</label>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["SISWA", "GURU", "PEGAWAI"] as CardType[]).map(t => (
              <button key={t} type="button" onClick={() => { setType(t); setClassId(""); setData(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === t ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        {type === "SISWA" && (
          <div>
            <label className="label-field">Kelas</label>
            <Select className="w-48" value={classId} onChange={v => { setClassId(v); setData(null); }}
              options={[{ value: "", label: "Semua Kelas" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
          </div>
        )}
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 disabled:opacity-60">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <IdCard size={15} />} Muat Kartu
        </button>
        <Link href="/dashboard/admin/kartu-tanda/editor"
          className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200">
          <Pencil size={14} /> Desain Kartu
        </Link>
        {data && data.length > 0 && <div className="sm:ml-auto"><PrintButton /></div>}
      </div>

      {!data ? (
        <p className="text-center py-16 text-gray-400 text-sm print:hidden">Pilih jenis kartu lalu klik &quot;Muat Kartu&quot;.</p>
      ) : data.length === 0 ? (
        <EmptyState icon={IdCard} title="Tidak Ada Data" description="Tidak ada anggota untuk pilihan ini." />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 print:hidden">Sisi Depan</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 print:flex print:flex-wrap print:gap-[4mm] break-after-page">
              {data.map(p => hasFrontTemplate
                ? <TemplateCard key={p.identifier} imageUrl={template!.front.imageUrl} boxes={template!.front.boxes} ctx={ctxFor(p)} avatar={p.avatar} qr={p.qr} signatureUrl={signatureUrl} />
                : <FrontCard key={p.identifier} p={p} type={type} logoEmblem={logoEmblem} />
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 print:hidden">Sisi Belakang (urutan sama — cocokkan posisi saat digunting)</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 print:flex print:flex-wrap print:gap-[4mm]">
              {data.map(p => hasBackTemplate
                ? <TemplateCard key={p.identifier} imageUrl={template!.back.imageUrl} boxes={template!.back.boxes} ctx={ctxFor(p)} avatar={p.avatar} qr={p.qr} signatureUrl={signatureUrl} />
                : <BackCard key={p.identifier} logoEmblem={logoEmblem} signatureUrl={signatureUrl} principalName={principalName}
                    address={address} phone={phone} email={email} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
