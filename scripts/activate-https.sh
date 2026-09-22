#!/bin/bash
# Aktivasi HTTPS (Caddy reverse proxy) — jalankan HANYA setelah domain smkalmunawwiriibs.sch.id
# dikonfirmasi live (DNS-nya sudah mengarah ke IP publik server ini). Lihat komentar lengkap di
# Caddyfile (root repo) untuk detail.
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="smkalmunawwiriibs.sch.id"

echo "== 1. Cek DNS domain mengarah ke server ini =="
RESOLVED_IP=$(dig +short "$DOMAIN" | tail -1)
SERVER_IP=$(curl -s -4 ifconfig.me || echo "?")
echo "   $DOMAIN -> $RESOLVED_IP"
echo "   IP publik server ini -> $SERVER_IP"
if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
  echo "   PERINGATAN: DNS belum mengarah ke server ini (atau belum propagasi). Aktivasi dibatalkan."
  echo "   Tunggu DNS propagasi (bisa sampai beberapa jam), lalu jalankan skrip ini lagi."
  exit 1
fi
echo "   OK — DNS sudah benar."

echo "== 2. Jalankan Caddy (minta sertifikat HTTPS otomatis) =="
docker compose up -d caddy

echo "== 3. Tunggu sertifikat terbit (~30-60 detik) =="
sleep 45

echo "== 4. Cek HTTPS berhasil =="
if curl -sfI "https://$DOMAIN" > /dev/null; then
  echo "   BERHASIL — https://$DOMAIN sudah aktif."
else
  echo "   Belum berhasil, cek log: docker compose logs caddy --tail=50"
  exit 1
fi

echo "== 5. Update NEXT_PUBLIC_APP_URL & build ulang app =="
echo "   Edit .env: NEXT_PUBLIC_APP_URL=https://$DOMAIN"
echo "   Lalu jalankan: docker compose up -d --build app"
echo "   (Langkah ini SENGAJA tidak otomatis — supaya bisa dicek dulu sertifikatnya benar sebelum app ikut di-restart.)"
