#!/bin/bash
# CADANGAN RAHASIA SERVER (11 Okt 2026) — dijalankan cron sebelum salin-cadangan-luar.sh.
#
# Kenapa: cadangan harian hanya memuat database & berkas unggahan. Yang membuat cadangan itu BISA DIPAKAI justru tidak ikut:
#   .env                         SESSION_SECRET (kunci pembuka sandi router, kunci Dapodik, token Telegram yang tersimpan
#                                terenkripsi di database), kunci VAPID (semua langganan notifikasi terikat ke sini)
#   kunci rilis aplikasi Android tanpa ini MyAlwis Mobile tidak bisa diperbarui — semua HP harus pasang ulang
#   kunci ADB                    tanpa ini setiap TV sekolah meminta izin debugging ulang
#   Caddyfile                    susunan HTTPS/domain di host
# Semuanya dijadikan SATU arsip terenkripsi (AES-256, gpg simetris). Sandinya ada di $SANDI — berkas itu WAJIB disalin
# pemilik sekolah ke tempat lain (di luar server ini); arsip di Drive tidak bisa dibuka tanpanya.
#
# Membuka:  gpg --decrypt rahasia_<tanggal>.tar.gz.gpg | tar xz
set -uo pipefail
ROOT="/root/backups/smk-almunawwir"
KE="$ROOT/rahasia"
SANDI="/root/kunci-cadangan/sandi-arsip.txt"
SIMPAN=14
TS="$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$KE"; chmod 700 "$KE"
[ -s "$SANDI" ] || { echo "[RAHASIA GAGAL] $SANDI tidak ada"; exit 1; }

KERJA="$(mktemp -d)"; chmod 700 "$KERJA"; trap 'rm -rf "$KERJA"' EXIT
mkdir -p "$KERJA/isi"
cp /root/smk-almunawwir/.env "$KERJA/isi/env-situs" 2>/dev/null
[ -d /root/.cache/android-ujian ] && { mkdir -p "$KERJA/isi/android-ujian"; cp /root/.cache/android-ujian/kunci-rilis.jks /root/.cache/android-ujian/sandi.txt "$KERJA/isi/android-ujian/" 2>/dev/null; }
[ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile "$KERJA/isi/Caddyfile"
docker run --rm -v smk-almunawwir_adb_keys:/data:ro -v "$KERJA/isi":/keluar alpine sh -c 'mkdir -p /keluar/adb-keys && cp -a /data/. /keluar/adb-keys/' 2>/dev/null
cat > "$KERJA/isi/BACA-DULU.txt" <<T
Arsip rahasia server SMK Al-Munawwir IIBS — dibuat $TS.
env-situs      → /root/smk-almunawwir/.env
android-ujian/ → /root/.cache/android-ujian/ (kunci rilis APK + sandinya)
adb-keys/      → isi volume Docker smk-almunawwir_adb_keys
Caddyfile      → /etc/caddy/Caddyfile
T
HASIL="$KE/rahasia_${TS}.tar.gz.gpg"
if tar czf - -C "$KERJA/isi" . | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$SANDI" --symmetric --cipher-algo AES256 -o "$HASIL"; then
  chmod 600 "$HASIL"
  # Arsip yang tidak bisa dibuka lebih buruk daripada tidak ada arsip: buka lagi dan hitung isinya sebelum dianggap berhasil.
  N="$(gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$SANDI" --decrypt "$HASIL" 2>/dev/null | tar tz 2>/dev/null | grep -vc '/$')"
  [ "${N:-0}" -ge 2 ] || { echo "[RAHASIA GAGAL] arsip tidak terbaca ulang"; rm -f "$HASIL"; exit 1; }
  ls -1t "$KE"/rahasia_*.tar.gz.gpg 2>/dev/null | tail -n +$((SIMPAN + 1)) | xargs -r rm -f
  echo "[RAHASIA SUKSES] $HASIL ($N berkas)"
else
  echo "[RAHASIA GAGAL] enkripsi gagal"; rm -f "$HASIL"; exit 1
fi
