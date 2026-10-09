/** FOTO PAS OTOMATIS (9 Oktober 2026) — berjalan di PERAMBAN calon; fotonya tidak dikirim ke mana pun
 *  sebelum calon menekan "Pakai".
 *
 *  Dari swafoto / foto biasa: wajah dicari (BlazeFace, sudah dipakai pemeriksa pas foto), foto dipotong
 *  3×4 dengan wajah di tengah, lalu latar diganti merah/biru memakai model pemisah orang-latar
 *  MediaPipe Selfie Segmentation (TF.js, ±330 KB di /model/latar — dimuat hanya saat fitur ini dipakai).
 *
 *  Batas yang harus diterima: topeng model hanya 256×256, jadi tepi rambut & jilbab berwarna mirip
 *  latar bisa sedikit tidak rapi. Karena itu hasil SELALU diperlihatkan dulu, "latar asli" (hanya
 *  dipotong 3×4) selalu tersedia, dan panitia tetap bisa meminta pas foto studio.
 *
 *  Fungsi inti bekerja pada larik piksel supaya bisa diuji di luar peramban. */
import type { Piksel } from "@/lib/pindai-dokumen";

export type Kotak = { x: number; y: number; w: number; h: number };
export type WarnaLatar = "merah" | "biru" | "asli";
/** Merah & biru pas foto yang lazim dipakai studio foto di Indonesia. */
export const RGB_LATAR: Record<Exclude<WarnaLatar, "asli">, [number, number, number]> = { merah: [219, 21, 20], biru: [0, 102, 204] };
export const UKURAN_PAS = { W: 600, H: 800 };

/** Bidang potong 3×4: lebar wajah ±40% lebar foto (bahu ikut terlihat), tengah wajah di 43% dari atas (ruang untuk rambut/peci/jilbab).
 *  Boleh keluar dari tepi foto — bagian itu diisi warna latar (atau, untuk latar asli, bidangnya digeser masuk). */
export function kotakPasFoto(wajah: Kotak): Kotak {
  const w = wajah.w * 2.4, h = (w * 4) / 3;
  return { x: wajah.x + wajah.w / 2 - w / 2, y: wajah.y + wajah.h / 2 - h * 0.43, w, h };
}

/** Untuk "latar asli": bidang dikecilkan/digeser supaya seluruhnya di dalam foto (tidak ada yang bisa diisi). */
export function jepitKotak(k: Kotak, W: number, H: number): Kotak {
  const s = Math.min(1, W / k.w, H / k.h);
  const w = k.w * s, h = k.h * s;
  const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
  return { x: Math.min(W - w, Math.max(0, cx - w / 2)), y: Math.min(H - h, Math.max(0, cy - h / 2)), w, h };
}

/** Ambil bidang `k` dari sumber jadi gambar W×H (bilinear). Piksel di luar sumber: alfa 0. */
export function ambilPotongan(src: Piksel, k: Kotak, W: number, H: number): Piksel {
  const out = new Uint8ClampedArray(W * H * 4);
  const { data, w, h } = src;
  for (let y = 0; y < H; y++) {
    const v = k.y + ((y + 0.5) / H) * k.h - 0.5;
    for (let x = 0; x < W; x++) {
      const u = k.x + ((x + 0.5) / W) * k.w - 0.5, o = (y * W + x) * 4;
      if (u < 0 || v < 0 || u > w - 1 || v > h - 1) continue;
      const x0 = Math.min(w - 2, u | 0), y0 = Math.min(h - 2, v | 0), fx = u - x0, fy = v - y0;
      const i = (y0 * w + x0) * 4, j = i + w * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (data[i + c] * (1 - fx) + data[i + 4 + c] * fx) * (1 - fy) + (data[j + c] * (1 - fx) + data[j + 4 + c] * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, w: W, h: H };
}

/** Tempel orang di atas warna latar. `topeng` = peluang "orang" 0..1 berukuran tw×th (dari model), dibesarkan
 *  bilinear lalu ditajamkan (smoothstep) supaya tepinya tidak berkabut. Piksel beralfa 0 (luar foto) = latar. */
export function gabungLatar(p: Piksel, topeng: Float32Array, tw: number, th: number, rgb: [number, number, number]) {
  const { data, w, h } = p;
  for (let y = 0; y < h; y++) {
    const gy = Math.min(th - 1, Math.max(0, ((y + 0.5) / h) * th - 0.5)), y0 = Math.min(th - 2, gy | 0), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(tw - 1, Math.max(0, ((x + 0.5) / w) * tw - 0.5)), x0 = Math.min(tw - 2, gx | 0), fx = gx - x0;
      const i = y0 * tw + x0;
      let a = (topeng[i] * (1 - fx) + topeng[i + 1] * fx) * (1 - fy) + (topeng[i + tw] * (1 - fx) + topeng[i + tw + 1] * fx) * fy;
      a = Math.min(1, Math.max(0, (a - 0.3) / 0.4)); a = a * a * (3 - 2 * a);
      const o = (y * w + x) * 4;
      if (!data[o + 3]) a = 0;
      for (let c = 0; c < 3; c++) data[o + c] = data[o + c] * a + rgb[c] * (1 - a);
      data[o + 3] = 255;
    }
  }
}

/** Bagian foto yang dianggap "orang" — dipakai menolak hasil bila model tidak menemukan orang sama sekali. */
export function porsiOrang(topeng: Float32Array): number {
  let n = 0;
  for (let i = 0; i < topeng.length; i++) if (topeng[i] > 0.5) n++;
  return n / topeng.length;
}

export const SISI_MODEL = 256;

/** Masukan model: RGB 0..1 ukuran 256×256 (piksel luar foto = abu netral). */
export function masukanModel(p: Piksel): Float32Array {
  const kecil = p.w === SISI_MODEL && p.h === SISI_MODEL ? p : ambilPotongan(p, { x: 0, y: 0, w: p.w, h: p.h }, SISI_MODEL, SISI_MODEL);
  const f = new Float32Array(SISI_MODEL * SISI_MODEL * 3);
  for (let i = 0; i < SISI_MODEL * SISI_MODEL; i++) {
    const ada = kecil.data[i * 4 + 3] > 0;
    for (let c = 0; c < 3; c++) f[i * 3 + c] = ada ? kecil.data[i * 4 + c] / 255 : 0.5;
  }
  return f;
}

// ── Pembungkus peramban ──────────────────────────────────────────────────────────────────────────

type ModelLatar = { predict: (x: unknown) => unknown };
let modelLatar: Promise<{ tf: typeof import("@tensorflow/tfjs-core"); model: ModelLatar }> | null = null;
function muatModelLatar() {
  modelLatar ??= (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-cpu");
    await tf.setBackend("cpu");
    await tf.ready();
    const { loadGraphModel } = await import("@tensorflow/tfjs-converter");
    return { tf, model: (await loadGraphModel("/model/latar/model.json")) as unknown as ModelLatar };
  })();
  modelLatar.catch(() => { modelLatar = null; });
  return modelLatar;
}

export type BahanPasFoto = {
  /** Gambar jadi untuk satu pilihan latar. Latar berwarna = null bila model tidak tersedia / tidak menemukan orang. */
  buat: (warna: WarnaLatar) => HTMLCanvasElement | null;
  /** Latar berwarna bisa dibuat? false = hanya "latar asli" (potong 3×4). */
  bisaGanti: boolean;
};

const keKanvas = (p: Piksel) => {
  const c = document.createElement("canvas");
  c.width = p.w; c.height = p.h;
  c.getContext("2d")!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.w, p.h), 0, 0);
  return c;
};

/** Siapkan pas foto dari foto `kanvas` dan kotak `wajah`. Model dijalankan SEKALI; berganti warna hanya menempel ulang. */
export async function siapkanPasFoto(kanvas: HTMLCanvasElement, wajah: Kotak): Promise<BahanPasFoto> {
  const ctx = kanvas.getContext("2d", { willReadFrequently: true })!;
  const src: Piksel = { data: ctx.getImageData(0, 0, kanvas.width, kanvas.height).data, w: kanvas.width, h: kanvas.height };
  const { W, H } = UKURAN_PAS;
  const bidang = kotakPasFoto(wajah);
  const potongan = ambilPotongan(src, bidang, W, H);
  let topeng: Float32Array | null = null;
  try {
    const { tf, model } = await muatModelLatar();
    const keluar = tf.tidy(() => model.predict(tf.tensor4d(masukanModel(potongan), [1, SISI_MODEL, SISI_MODEL, 3])) as import("@tensorflow/tfjs-core").Tensor);
    const arr = await keluar.data();
    keluar.dispose();
    const t = new Float32Array(SISI_MODEL * SISI_MODEL);
    for (let i = 0; i < t.length; i++) t[i] = arr[i * 2 + 1]; // kanal 1 = orang (public/model/latar/SUMBER.txt)
    const porsi = porsiOrang(t);
    // Orang di pas foto mengisi ±35–75% bidang. Di luar itu modelnya gagal (latar ramai, foto bukan orang).
    if (porsi > 0.2 && porsi < 0.9) topeng = t;
  } catch { /* luring / model gagal dimuat → hanya latar asli */ }
  const hasil = new Map<WarnaLatar, HTMLCanvasElement>();
  return {
    bisaGanti: !!topeng,
    buat(warna) {
      const ada = hasil.get(warna);
      if (ada) return ada;
      let p: Piksel;
      if (warna === "asli") p = ambilPotongan(src, jepitKotak(bidang, src.w, src.h), W, H);
      else {
        if (!topeng) return null;
        p = { data: new Uint8ClampedArray(potongan.data), w: W, h: H };
        gabungLatar(p, topeng, SISI_MODEL, SISI_MODEL, RGB_LATAR[warna]);
      }
      const c = keKanvas(p);
      hasil.set(warna, c);
      return c;
    },
  };
}
