/** OLAH FOTO SEBELUM UNGGAH (7 Oktober 2026) — berjalan di PERAMBAN calon, tanpa mengirim apa pun ke luar.
 *
 *  1. `kecilkanFoto`: foto kamera HP 4–8 MB diubah jadi JPEG ±200–500 KB (sisi terpanjang 2000 px untuk
 *     dokumen, 1000 px untuk pas foto) supaya unggahan tidak gagal di sinyal lemah. Putaran EXIF diikuti.
 *     PDF, GIF, atau foto yang tidak bisa dibaca peramban (HEIC di sebagian peramban) dikirim apa adanya.
 *  2. `periksaMutu`: buram & gelap/silau dihitung dari gambar yang sudah dikecilkan — hanya PERINGATAN.
 *  3. `periksaPasFoto`: BlazeFace (TensorFlow.js, prosesor HP, model ±466 KB di /model/wajah) memeriksa
 *     ada tepat satu wajah, cukup besar, dan tidak miring — juga hanya SARAN, tidak pernah menolak.
 *     Pustakanya dimuat hanya saat pas foto dipilih. */

export type HasilOlah = { file: File; ukuranAsal: number; dikecilkan: boolean; kanvas: HTMLCanvasElement | null };

const BISA_DIOLAH = /^image\/(jpeg|jpg|png|webp|bmp|heic|heif)$/i;

async function bacaGambar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function kecilkanFoto(file: File, sisiMaks = 2000, mutu = 0.82): Promise<HasilOlah> {
  const asal: HasilOlah = { file, ukuranAsal: file.size, dikecilkan: false, kanvas: null };
  if (!BISA_DIOLAH.test(file.type)) return asal;
  let gbr: ImageBitmap | HTMLImageElement;
  try { gbr = await bacaGambar(file); } catch { return asal; }
  const w0 = "naturalWidth" in gbr ? gbr.naturalWidth : gbr.width;
  const h0 = "naturalHeight" in gbr ? gbr.naturalHeight : gbr.height;
  if (!w0 || !h0) return asal;
  const s = Math.min(1, sisiMaks / Math.max(w0, h0));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(w0 * s);
  kanvas.height = Math.round(h0 * s);
  const ctx = kanvas.getContext("2d");
  if (!ctx) return asal;
  ctx.fillStyle = "#ffffff"; // PNG transparan → latar putih, bukan hitam
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);
  ctx.drawImage(gbr, 0, 0, kanvas.width, kanvas.height);
  if ("close" in gbr) gbr.close();
  const blob = await new Promise<Blob | null>(r => kanvas.toBlob(r, "image/jpeg", mutu));
  // Foto yang memang sudah kecil tidak "dikecilkan" jadi lebih besar.
  if (!blob || (blob.size >= file.size && s === 1 && /jpe?g/i.test(file.type))) return { ...asal, kanvas };
  const nama = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { file: new File([blob], nama, { type: "image/jpeg", lastModified: Date.now() }), ukuranAsal: file.size, dikecilkan: true, kanvas };
}

/** Kecerahan rata-rata, bagian silau, dan ketajaman (variansi Laplacian per petak, persentil 90 —
 *  latar polos pas foto tidak membuat foto tajam dianggap buram, karena yang dinilai petak tertajamnya). */
export function ukurMutu(kanvas: HTMLCanvasElement) {
  const L = 512;
  const s = Math.min(1, L / Math.max(kanvas.width, kanvas.height));
  const w = Math.max(8, Math.round(kanvas.width * s)), h = Math.max(8, Math.round(kanvas.height * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(kanvas, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const abu = new Float32Array(w * h);
  let jumlah = 0, silau = 0;
  for (let i = 0; i < w * h; i++) {
    const y = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    abu[i] = y; jumlah += y; if (y > 248) silau++;
  }
  const N = 6, petak: number[] = [];
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
    const x0 = Math.max(1, Math.floor((tx * w) / N)), x1 = Math.min(w - 1, Math.floor(((tx + 1) * w) / N));
    const y0 = Math.max(1, Math.floor((ty * h) / N)), y1 = Math.min(h - 1, Math.floor(((ty + 1) * h) / N));
    let n = 0, sm = 0, sm2 = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const lap = abu[i - 1] + abu[i + 1] + abu[i - w] + abu[i + w] - 4 * abu[i];
      n++; sm += lap; sm2 += lap * lap;
    }
    if (n) petak.push(sm2 / n - (sm / n) ** 2);
  }
  petak.sort((a, b) => a - b);
  return { terang: jumlah / (w * h), silau: silau / (w * h), tajam: petak[Math.floor(petak.length * 0.9)] ?? 0 };
}

export const AMBANG = { gelap: 60, silau: 0.35, buram: 120 };

export function periksaMutu(kanvas: HTMLCanvasElement, lang: "id" | "en" = "id"): string[] {
  const m = ukurMutu(kanvas);
  const id = lang === "id", p: string[] = [];
  if (m.terang < AMBANG.gelap) p.push(id ? "Foto tampak gelap. Coba foto ulang di tempat yang lebih terang." : "The photo looks dark. Try again in better light.");
  if (m.silau > AMBANG.silau) p.push(id ? "Sebagian besar foto putih terang (silau/pantulan cahaya). Hindari lampu atau sinar matahari langsung." : "Much of the photo is washed out by glare.");
  // Foto gelap otomatis berkontras rendah — saran "buram" ditahan supaya calon tidak menerima dua sebab untuk satu masalah.
  if (m.tajam < AMBANG.buram && m.terang >= AMBANG.gelap) p.push(id ? "Foto tampak buram. Tahan HP sampai tidak bergoyang dan ketuk layar agar kamera fokus." : "The photo looks blurry. Hold the phone steady and tap to focus.");
  return p;
}

type Wajah = { topLeft: [number, number]; bottomRight: [number, number]; landmarks: [number, number][]; probability: number[] };
let modelWajah: Promise<{ estimateFaces: (x: HTMLCanvasElement, r: boolean) => Promise<unknown[]> }> | null = null;
function muatModelWajah() {
  modelWajah ??= (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-cpu");
    await tf.setBackend("cpu");
    await tf.ready();
    const bf = await import("@tensorflow-models/blazeface");
    return bf.load({ modelUrl: "/model/wajah/model.json", maxFaces: 5, scoreThreshold: 0.8 });
  })();
  modelWajah.catch(() => { modelWajah = null; });
  return modelWajah;
}

async function cariWajah(kanvas: HTMLCanvasElement): Promise<Wajah[]> {
  const model = await muatModelWajah();
  // BlazeFace melihat gambar 128×128 — dikecilkan dulu ke ±400 px supaya cepat di HP.
  const s = Math.min(1, 400 / Math.max(kanvas.width, kanvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(kanvas.width * s); c.height = Math.round(kanvas.height * s);
  c.getContext("2d")!.drawImage(kanvas, 0, 0, c.width, c.height);
  const wajah = (await model.estimateFaces(c, false)) as Wajah[];
  for (const f of wajah) { f.topLeft = [f.topLeft[0] / s, f.topLeft[1] / s]; f.bottomRight = [f.bottomRight[0] / s, f.bottomRight[1] / s]; f.landmarks = f.landmarks.map(([x, y]) => [x / s, y / s]); }
  return wajah;
}

/** Wajah terbesar di foto sebagai kotak piksel — untuk Foto Pas Otomatis. null = tidak ada wajah / model gagal dimuat. */
export async function wajahUtama(kanvas: HTMLCanvasElement): Promise<{ x: number; y: number; w: number; h: number } | null> {
  try {
    const wajah = await cariWajah(kanvas);
    if (!wajah.length) return null;
    const f = wajah.sort((a, b) => (b.bottomRight[0] - b.topLeft[0]) - (a.bottomRight[0] - a.topLeft[0]))[0];
    return { x: f.topLeft[0], y: f.topLeft[1], w: f.bottomRight[0] - f.topLeft[0], h: f.bottomRight[1] - f.topLeft[1] };
  } catch {
    return null;
  }
}

/** Foto ini potret orang (satu wajah besar), bukan dokumen? Dipakai pengenal jenis dokumen untuk menegur
 *  pas foto yang diunggah di kotak KK/ijazah. Wajah kecil (pas foto DI DALAM ijazah, foto di KTP) tidak dihitung.
 *  Model gagal dimuat = false (tidak ada teguran). */
export async function wajahDominan(kanvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const wajah = await cariWajah(kanvas);
    return wajah.some(f => f.bottomRight[0] - f.topLeft[0] >= kanvas.width * 0.3);
  } catch {
    return false;
  }
}

/** Saran untuk pas foto. Kosong = tidak ada catatan. Model gagal dimuat (luring) = tidak ada saran wajah. */
export async function periksaPasFoto(kanvas: HTMLCanvasElement, lang: "id" | "en" = "id"): Promise<string[]> {
  const id = lang === "id", p: string[] = [];
  if (kanvas.height < kanvas.width * 1.05) p.push(id ? "Pas foto sebaiknya tegak (potret), bukan mendatar." : "A passport photo should be portrait, not landscape.");
  let wajah: Wajah[];
  try {
    wajah = await cariWajah(kanvas);
  } catch {
    return p;
  }
  if (wajah.length === 0) {
    p.push(id ? "Wajah tidak terdeteksi. Pastikan wajah menghadap kamera, terlihat jelas, dan cukup terang." : "No face detected. Face the camera in good light.");
    return p;
  }
  if (wajah.length > 1) p.push(id ? `Terlihat ${wajah.length} wajah. Pas foto hanya berisi calon siswa sendiri.` : `${wajah.length} faces detected. Only the applicant should appear.`);
  const f = wajah.sort((a, b) => (b.bottomRight[0] - b.topLeft[0]) - (a.bottomRight[0] - a.topLeft[0]))[0];
  const lebar = f.bottomRight[0] - f.topLeft[0];
  if (lebar < kanvas.width * 0.22) p.push(id ? "Wajah terlalu kecil. Dekatkan kamera atau potong foto sebatas bahu." : "The face is too small. Move closer or crop to the shoulders.");
  const tengah = (f.topLeft[0] + f.bottomRight[0]) / 2;
  if (Math.abs(tengah - kanvas.width / 2) > kanvas.width * 0.18) p.push(id ? "Wajah tidak di tengah foto." : "The face is not centred.");
  const [ma, mb] = f.landmarks;
  if (ma && mb) {
    let sudut = Math.abs((Math.atan2(mb[1] - ma[1], mb[0] - ma[0]) * 180) / Math.PI);
    if (sudut > 90) sudut = 180 - sudut;
    if (sudut > 10) p.push(id ? "Kepala atau foto tampak miring. Tegakkan kepala dan pegang HP lurus." : "The head or photo looks tilted.");
  }
  return p;
}

export const ukuranTeks = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
