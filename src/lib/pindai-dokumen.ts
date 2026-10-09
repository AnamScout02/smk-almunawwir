/** PEMINDAI DOKUMEN (8 Oktober 2026) — berjalan di PERAMBAN calon, tanpa pustaka & tanpa mengirim apa pun ke luar.
 *
 *  Foto KK/ijazah dari HP hampir selalu miring dan menyertakan meja di sekelilingnya. Di sini:
 *   1. `deteksiSudut`  — menduga empat sudut kertas: warna latar diambil dari tepi foto, piksel yang
 *      jauh dari warna itu dianggap kertas, lalu sudut = titik terjauh ke empat arah diagonal.
 *   2. `luruskan`      — menarik keempat sudut itu jadi persegi panjang (homografi + sampel bilinear).
 *   3. `jernihkan`     — meratakan cahaya: bayangan tangan/HP hilang dan kertas kembali putih.
 *
 *  Dugaan sudut BISA SALAH (kertas putih di meja putih, kertas memenuhi foto) — karena itu hasilnya
 *  selalu diperlihatkan dulu dan sudutnya bisa digeser calon; `deteksiSudut` mengembalikan null bila
 *  tidak yakin, dan foto asli selalu bisa dipakai apa adanya.
 *
 *  Fungsi inti bekerja pada larik piksel (bukan kanvas) supaya bisa diuji di luar peramban. */

export type Titik = { x: number; y: number };
/** Urutan TETAP: kiri-atas, kanan-atas, kanan-bawah, kiri-bawah. */
export type Sudut = [Titik, Titik, Titik, Titik];
export type Piksel = { data: Uint8ClampedArray; w: number; h: number };

const luas = (s: Titik[]) => {
  let a = 0;
  for (let i = 0; i < s.length; i++) { const p = s[i], q = s[(i + 1) % s.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
};
const cembung = (s: Sudut) => {
  let tanda = 0;
  for (let i = 0; i < 4; i++) {
    const a = s[i], b = s[(i + 1) % 4], c = s[(i + 2) % 4];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    if (tanda && Math.sign(z) !== tanda) return false;
    tanda = Math.sign(z);
  }
  return true;
};

/** Sudut bawaan saat dugaan gagal: sedikit masuk dari tepi foto, untuk digeser sendiri. */
export function sudutPenuh(w: number, h: number, masuk = 0.06): Sudut {
  const dx = w * masuk, dy = h * masuk;
  return [{ x: dx, y: dy }, { x: w - dx, y: dy }, { x: w - dx, y: h - dy }, { x: dx, y: h - dy }];
}

function median(v: number[]) { v.sort((a, b) => a - b); return v[v.length >> 1] ?? 0; }

/** Dugaan empat sudut kertas pada gambar KECIL (sisi ±320 px). null = tidak yakin. Koordinat dalam piksel gambar itu. */
export function deteksiSudut({ data, w, h }: Piksel): Sudut | null {
  if (w < 40 || h < 40) return null;
  // 1. Warna latar = median piksel di bingkai tepi (4% sisi). Kertas yang menyentuh satu sisi tidak mengubah median.
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= t && x < w - t && y >= t && y < h - t) continue;
    const i = (y * w + x) * 4; r.push(data[i]); g.push(data[i + 1]); b.push(data[i + 2]);
  }
  const lr = median(r), lg = median(g), lb = median(b);

  // 2. Jarak warna tiap piksel ke latar, dihaluskan 3×3 supaya butiran meja tidak ikut.
  const n = w * h, jarak = new Float32Array(n);
  for (let i = 0; i < n; i++) jarak[i] = Math.abs(data[i * 4] - lr) + Math.abs(data[i * 4 + 1] - lg) + Math.abs(data[i * 4 + 2] - lb);
  const halus = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += jarak[yy * w + xx]; c++; }
    }
    halus[y * w + x] = s / c;
  }

  // 3. Ambang Otsu memisahkan "latar" dari "kertas".
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.round(halus[i] / 3))]++;
  let total = 0; for (let i = 0; i < 256; i++) total += i * hist[i];
  let wB = 0, sB = 0, terbaik = 0, ambang = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB, mF = (total - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > terbaik) { terbaik = v; ambang = i; }
  }
  // Kertas dan latar nyaris sewarna → pemisahan tidak bermakna.
  if (ambang * 3 < 36) return null;

  // 4. Gumpalan terbesar dari piksel "kertas" (tetangga 4 arah).
  const tanda = new Int32Array(n);
  const antre = new Int32Array(n);
  let terluas = 0, idTerluas = 0, id = 0;
  for (let awal = 0; awal < n; awal++) {
    if (tanda[awal] || halus[awal] / 3 <= ambang) continue;
    id++; let kepala = 0, ekor = 0; antre[ekor++] = awal; tanda[awal] = id;
    while (kepala < ekor) {
      const p = antre[kepala++], x = p % w, y = (p - x) / w;
      const coba = (q: number) => { if (!tanda[q] && halus[q] / 3 > ambang) { tanda[q] = id; antre[ekor++] = q; } };
      if (x > 0) coba(p - 1); if (x < w - 1) coba(p + 1); if (y > 0) coba(p - w); if (y < h - 1) coba(p + w);
    }
    if (ekor > terluas) { terluas = ekor; idTerluas = id; }
  }
  if (terluas < n * 0.15) return null;
  // Kertas yang memenuhi foto membuat "latar" justru diambil dari kertasnya, dan yang tertangkap hanyalah
  // bayangan di satu sisi. Tandanya: gumpalan itu menempel panjang di bingkai foto.
  let bingkai = 0, kena = 0;
  for (let x = 0; x < w; x++) { bingkai += 2; if (tanda[x] === idTerluas) kena++; if (tanda[(h - 1) * w + x] === idTerluas) kena++; }
  for (let y = 0; y < h; y++) { bingkai += 2; if (tanda[y * w] === idTerluas) kena++; if (tanda[y * w + w - 1] === idTerluas) kena++; }
  if (kena / bingkai > 0.2) return null;

  // 5. Sudut = titik gumpalan terjauh ke empat arah diagonal.
  let tl = { x: 0, y: 0, v: Infinity }, br = { x: 0, y: 0, v: -Infinity }, tr = { x: 0, y: 0, v: -Infinity }, bl = { x: 0, y: 0, v: Infinity };
  // Diagonal dinormalkan ke bentuk gambar supaya foto mendatar & tegak diperlakukan sama.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (tanda[y * w + x] !== idTerluas) continue;
    const a = x / w + y / h, d = x / w - y / h;
    if (a < tl.v) tl = { x, y, v: a };
    if (a > br.v) br = { x, y, v: a };
    if (d > tr.v) tr = { x, y, v: d };
    if (d < bl.v) bl = { x, y, v: d };
  }
  const s: Sudut = [{ x: tl.x, y: tl.y }, { x: tr.x, y: tr.y }, { x: br.x, y: br.y }, { x: bl.x, y: bl.y }];
  if (!cembung(s)) return null;
  const lq = luas(s);
  // Gumpalan harus benar-benar berbentuk segi empat (bukan tangan, bayangan, atau dua kertas).
  if (terluas / lq < 0.8 || terluas / lq > 1.15) return null;
  // Kertas sudah memenuhi foto → tidak ada yang perlu dipotong.
  if (lq > n * 0.94) return null;
  if (lq < n * 0.15) return null;
  return s;
}

/** Selesaikan Ax = b (8×8) dengan eliminasi Gauss berpivot. */
function selesaikan(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) < 1e-10) return null;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/** Homografi dari persegi panjang hasil (0..W, 0..H) ke segi empat sumber. */
export function homografi(W: number, H: number, s: Sudut): number[] | null {
  const dari: Titik[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dari[i], { x: u, y: v } = s[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return selesaikan(A, b);
}

const pjg = (a: Titik, b: Titik) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ukuran hasil = sisi terpanjang tiap pasangan sisi berhadapan, dibatasi `sisiMaks`. */
export function ukuranHasil(s: Sudut, sisiMaks = 2000) {
  let W = Math.max(pjg(s[0], s[1]), pjg(s[3], s[2])), H = Math.max(pjg(s[0], s[3]), pjg(s[1], s[2]));
  const k = Math.min(1, sisiMaks / Math.max(W, H));
  W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));
  return { W, H };
}

/** Tarik segi empat `s` pada gambar sumber menjadi persegi panjang W×H. */
export function luruskan(src: Piksel, s: Sudut, W: number, H: number): Piksel | null {
  const m = homografi(W, H, s);
  if (!m) return null;
  const [a, b, c, d, e, f, g, h] = m;
  const out = new Uint8ClampedArray(W * H * 4);
  const { data, w, h: hs } = src;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = g * x + h * y + 1;
      let u = (a * x + b * y + c) / z, v = (d * x + e * y + f) / z;
      u = Math.min(w - 1.001, Math.max(0, u)); v = Math.min(hs - 1.001, Math.max(0, v));
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        out[o + k] = (data[i00 + k] * (1 - fx) + data[i10 + k] * fx) * (1 - fy) + (data[i01 + k] * (1 - fx) + data[i11 + k] * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, w: W, h: H };
}

/** Meratakan cahaya DI TEMPAT: warna kertas setempat (persentil 85 tiap petak) dijadikan putih.
 *  Warna tetap dipertahankan (stempel, logo, pas foto di ijazah) — bukan dijadikan hitam-putih. */
export function jernihkan({ data, w, h }: Piksel) {
  const N = Math.max(4, Math.round(Math.max(w, h) / 96)); // ±96 px per petak: cukup besar agar tulisan tidak dianggap latar
  const pw = Math.ceil(w / N), ph = Math.ceil(h / N);
  const kx = Math.ceil(w / pw), ky = Math.ceil(h / ph);
  const latar = new Float32Array(kx * ky);
  const hist = new Uint32Array(256);
  for (let ty = 0; ty < ky; ty++) for (let tx = 0; tx < kx; tx++) {
    hist.fill(0); let c = 0;
    const x1 = Math.min(w, (tx + 1) * pw), y1 = Math.min(h, (ty + 1) * ph);
    for (let y = ty * ph; y < y1; y += 2) for (let x = tx * pw; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      hist[(data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8]++; c++;
    }
    let sisa = c * 0.15, v = 255;
    while (v > 0 && (sisa -= hist[v]) > 0) v--;
    latar[ty * kx + tx] = Math.max(60, v);
  }
  for (let y = 0; y < h; y++) {
    const gy = Math.min(ky - 1, Math.max(0, (y + 0.5) / ph - 0.5)), y0 = gy | 0, y1 = Math.min(ky - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(kx - 1, Math.max(0, (x + 0.5) / pw - 0.5)), x0 = gx | 0, x1 = Math.min(kx - 1, x0 + 1), fx = gx - x0;
      const l = (latar[y0 * kx + x0] * (1 - fx) + latar[y0 * kx + x1] * fx) * (1 - fy) + (latar[y1 * kx + x0] * (1 - fx) + latar[y1 * kx + x1] * fx) * fy;
      const k = Math.min(3, 250 / l), i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        // Setelah diratakan, tulisan sedikit digelapkan (kurva lembut) supaya lebih tegas dari kertasnya.
        const p = Math.min(255, data[i + c] * k) / 255;
        data[i + c] = 255 * (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)) * 0.6 + 255 * p * 0.4;
      }
    }
  }
}

// ── Pembungkus kanvas (hanya di peramban) ────────────────────────────────────────────────────────

/** Dugaan sudut pada kanvas ukuran penuh — dihitung di salinan kecil lalu diskalakan kembali. */
export function deteksiDokumen(kanvas: HTMLCanvasElement): Sudut | null {
  try {
    const k = Math.min(1, 320 / Math.max(kanvas.width, kanvas.height));
    const w = Math.max(1, Math.round(kanvas.width * k)), h = Math.max(1, Math.round(kanvas.height * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(kanvas, 0, 0, w, h);
    const s = deteksiSudut({ data: ctx.getImageData(0, 0, w, h).data, w, h });
    return s ? (s.map(p => ({ x: p.x / k, y: p.y / k })) as Sudut) : null;
  } catch {
    return null;
  }
}

/** Potong, luruskan, dan (bila diminta) jernihkan. null bila sudutnya tidak membentuk segi empat yang sah. */
export function pindai(kanvas: HTMLCanvasElement, s: Sudut, jernih: boolean): HTMLCanvasElement | null {
  if (!cembung(s)) return null;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { W, H } = ukuranHasil(s);
  const hasil = luruskan({ data: ctx.getImageData(0, 0, kanvas.width, kanvas.height).data, w: kanvas.width, h: kanvas.height }, s, W, H);
  if (!hasil) return null;
  if (jernih) jernihkan(hasil);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  out.getContext("2d")!.putImageData(new ImageData(hasil.data as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
  return out;
}

export async function kanvasKeFile(kanvas: HTMLCanvasElement, nama: string, mutu = 0.85): Promise<File | null> {
  const blob = await new Promise<Blob | null>(r => kanvas.toBlob(r, "image/jpeg", mutu));
  return blob ? new File([blob], nama.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() }) : null;
}
