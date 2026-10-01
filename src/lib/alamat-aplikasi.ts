/** Alamat HTTPS resmi aplikasi untuk DIBAGIKAN — tautan pemasangan PWA, pesan WhatsApp, QR, pratinjau
 * tautan. Situs juga bisa dibuka lewat HTTP di jaringan sekolah (`http://<IP-PUBLIK-SERVER>:3000`), tetapi
 * pemasangan aplikasi, service worker, Clipboard API, kamera pemindai, mikrofon, dan push HANYA
 * berjalan di HTTPS.
 *
 * Domain sekolah aktif 30 September 2026. Port 80/443 IP publik diarahkan ke server ini dan
 * diterminasi Caddy (/etc/caddy/Caddyfile); sertifikat Let's Encrypt otomatis & diperpanjang sendiri.
 *
 * Terowongan Tailscale Funnel (`https://smk-almunawwir.tail984090.ts.net`) SENGAJA tetap hidup sebagai
 * cadangan: QR yang sudah tercetak (sertifikat PKL, piagam, rapor, surat, label aset) dan aplikasi
 * MyAlwis yang sudah terpasang di HP memakai alamat itu. Jangan dimatikan tanpa menyapu semuanya. */
export const ALAMAT_APLIKASI = "https://smkalmunawwiriibs.sch.id";
