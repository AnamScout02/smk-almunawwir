import { verifyRole } from "@/lib/dal";
import { bacaWord } from "@/lib/soal-word";
import { bacaExcelUjian } from "@/lib/soal-excel";
import { terapkanKunci } from "@/lib/soal-kunci";
import { cocokMapel } from "@/lib/cocok-mapel";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** PRATINJAU impor: baca naskah Word (+ opsional Excel kunci), kembalikan butir-butir hasil
 * bacaan beserta peringatannya. TIDAK menyimpan apa pun - guru memeriksa dulu di layar, lalu
 * mengirim hasil koreksinya ke `simpan-banyak`. */
export async function POST(req: NextRequest) {
  try {
    await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const form = await req.formData();
    const word = form.get("word") as File | null;
    const excel = form.get("excel") as File | null;
    if (!word) return Response.json({ error: "Berkas Word (.docx) wajib diunggah." }, { status: 400 });
    if (!/\.(docx|docm)$/i.test(word.name)) {
      return Response.json({ error: "Hanya .docx/.docm yang didukung. Berkas .doc lama: buka di Word lalu Save As .docx." }, { status: 400 });
    }

    const hasil = await bacaWord(Buffer.from(await word.arrayBuffer()));
    let pengaturan = null;
    const catatan = [...hasil.catatan];

    if (excel) {
      const ex = bacaExcelUjian(Buffer.from(await excel.arrayBuffer()));
      pengaturan = ex.pengaturan;
      catatan.push(...ex.catatan);
      const perNomor = new Map(ex.kunci.map(k => [k.nomor, k]));
      let cocok = 0;
      for (const b of hasil.butir) {
        const k = perNomor.get(b.nomor);
        if (!k) { b.peringatan.push("Tidak ada baris kunci di Excel untuk nomor ini"); continue; }
        cocok += 1;
        const t = terapkanKunci(b, k.kunci, k.pedoman);
        b.opsi = t.opsi; b.kunci = t.kunci; b.peringatan.push(...t.peringatan);
        (b as unknown as { skor: number; kd: string | null; lockN: number | null; grouping: number | null }).skor = k.skor;
        (b as unknown as { kd: string | null }).kd = k.kd;
        Object.assign(b, { materi: k.materi, indikator: k.indikator, levelKognitif: k.levelKognitif });
        (b as unknown as { lockN: number | null }).lockN = k.lockN;
        (b as unknown as { grouping: number | null }).grouping = k.grouping;
      }
      catatan.push(`${cocok} dari ${hasil.butir.length} soal cocok dengan tabel kunci Excel.`);
    }

    // Mata Pelajaran (Word) & Kode Test (Excel) dicocokkan dengan mapel yang dipilih guru. Pratinjau
    // tidak ditolak, tetapi perbedaan ditaruh PALING ATAS supaya berkas tertukar langsung ketahuan.
    const mapel = String(form.get("mapel") ?? "").trim();
    const peringatanMapel: string[] = [];
    if (mapel) {
      const w = cocokMapel(hasil.kepala.mapel, mapel);
      if (w === "BEDA") peringatanMapel.push(`PERHATIAN: Mata Pelajaran di Word "${hasil.kepala.mapel}" berbeda dengan mapel yang dipilih (${mapel}).`);
      else if (w === "MIRIP") peringatanMapel.push(`Mata Pelajaran di Word tertulis "${hasil.kepala.mapel}" — sebaiknya sama persis: ${mapel}.`);
      else if (w === "KOSONG") peringatanMapel.push(`Kepala naskah Word belum berisi "Mata Pelajaran : ${mapel}".`);
      const kodeTest = (pengaturan as { kodeTest?: string | null } | null)?.kodeTest;
      if (excel) {
        const x = cocokMapel(kodeTest, mapel);
        if (x === "BEDA") peringatanMapel.push(`PERHATIAN: Kode Test di Excel "${kodeTest}" berbeda dengan mapel yang dipilih (${mapel}).`);
        else if (x === "MIRIP") peringatanMapel.push(`Kode Test di Excel tertulis "${kodeTest}" — sebaiknya sama persis: ${mapel}.`);
        else if (x === "KOSONG") peringatanMapel.push(`Kode Test di Excel kosong — isi "${mapel}".`);
      }
    }
    return Response.json({ ...hasil, catatan: [...peringatanMapel, ...catatan], pengaturan });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal membaca berkas." }, { status: 500 });
  }
}
