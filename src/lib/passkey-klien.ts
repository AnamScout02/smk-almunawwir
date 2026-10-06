/** Pembantu PASSKEY di BROWSER (5 Oktober 2026) — dipakai kartu Profil (`KelolaPasskey`), tawaran setelah login
 *  (`TawaranPasskey`), dan tombol halaman login (`MasukPasskey`).
 *
 *  PENANDA "HP ini punya passkey" (localStorage) ada karena temuan user: tombol sidik jari tampil di HP yang belum
 *  mendaftar, lalu Android hanya memunculkan lembar "Login dengan cara lain" — membingungkan. Peramban tidak memberi
 *  tahu situs apakah perangkat menyimpan passkey (sengaja, demi privasi), jadi situs mengingatnya sendiri: dipasang
 *  saat berhasil mendaftar / masuk dengan passkey, dihapus saat server menolak passkey perangkat ini. */
const KUNCI = "myalwis-passkey-hp";

export const passkeyDidukung = () =>
  typeof window !== "undefined" && window.isSecureContext && typeof window.PublicKeyCredential === "function";

export function adaPenandaPasskey(): boolean {
  try { return localStorage.getItem(KUNCI) === "1"; } catch { return false; }
}
export function pasangPenandaPasskey(ada: boolean) {
  try { if (ada) localStorage.setItem(KUNCI, "1"); else localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
}

/** Nama perangkat bawaan, mis. "HP Android · 5 Okt 2026" — pengguna boleh menggantinya di Profil. */
export function namaPerangkatBawaan(): string {
  const ua = navigator.userAgent;
  const jenis = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "HP Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Komputer Windows" : "Perangkat";
  return `${jenis} · ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
}

/** Daftarkan passkey perangkat ini. Mengembalikan null bila berhasil, atau pesan galat untuk ditampilkan. */
export async function daftarkanPasskey(nama: string): Promise<string | null> {
  try {
    const { startRegistration } = await import("@simplewebauthn/browser");
    const r1 = await fetch("/api/passkey/daftar", { cache: "no-store" });
    const opsi = await r1.json().catch(() => null);
    if (!r1.ok) return opsi?.error || "Gagal menyiapkan passkey.";
    const respons = await startRegistration({ optionsJSON: opsi });
    const r2 = await fetch("/api/passkey/daftar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respons, nama: nama.trim() || namaPerangkatBawaan() }),
    });
    const d = await r2.json().catch(() => null);
    if (!r2.ok) return d?.error || "Gagal menyimpan passkey.";
    pasangPenandaPasskey(true);
    return null;
  } catch (e) {
    const n = e instanceof Error ? e.name : "";
    if (n === "InvalidStateError") { pasangPenandaPasskey(true); return "Perangkat ini sudah terdaftar."; }
    return n === "NotAllowedError" ? "Dibatalkan." : "Gagal mendaftarkan passkey.";
  }
}
