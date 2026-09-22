#!/bin/bash
# SALIN CADANGAN KE LUAR SERVER — dijalankan cron 30 menit setelah backup-db.sh.
#
# Kenapa: cadangan harian (scripts/backup-db.sh) tersimpan di disk yang SAMA dengan database.
# Kalau disk VM 150 rusak, data dan cadangannya hilang bersamaan. Skrip ini menyalin folder
# cadangan ke satu atau lebih tujuan di luar server lewat rclone.
#
# Tujuan diatur di $ROOT/tujuan-luar.conf — satu tujuan rclone per baris:
#   gdrive:SMK-Almunawwir-Cadangan      ← Google Drive sekolah (sementara, keputusan user 14 Sep 2026)
#   nas:backup/smk-almunawwir           ← NAS/storage lain nanti: buat remote rclone (smb/sftp/nfs) lalu tambah barisnya
# Tujuan yang remote-nya belum dikonfigurasi dilewati dan dicatat, tidak menggagalkan tujuan lain.
#
# Setiap tujuan: salin yang belum ada → cek ulang (ukuran & hash) → hapus salinan > SIMPAN_HARI hari.
# Ringkasan terakhir ditulis ke $ROOT/status-salin-luar.json.
set -uo pipefail

ROOT="/root/backups/smk-almunawwir"
CONF="$ROOT/tujuan-luar.conf"
SIMPAN_HARI="${SIMPAN_HARI:-30}"
TS="$(date +%Y-%m-%d_%H%M%S)"
LOG="$ROOT/logs/salin-luar_${TS}.log"
STATUS="$ROOT/status-salin-luar.json"
mkdir -p "$ROOT/logs"

exec > >(tee -a "$LOG") 2>&1
echo "=== Salin cadangan ke luar: $(date -u) ==="

if ! command -v rclone >/dev/null; then echo "GAGAL: rclone belum terpasang"; exit 1; fi
if [ ! -f "$CONF" ]; then echo "GAGAL: $CONF tidak ada"; exit 1; fi

REMOTE_ADA="$(rclone listremotes 2>/dev/null)"
HASIL=()
GAGAL=0

while IFS= read -r tujuan || [ -n "$tujuan" ]; do
  tujuan="$(echo "$tujuan" | sed 's/#.*//' | xargs)"
  [ -z "$tujuan" ] && continue
  remote="${tujuan%%:*}:"
  if ! grep -qx "$remote" <<<"$REMOTE_ADA"; then
    echo "LEWATI $tujuan — remote '$remote' belum dikonfigurasi (rclone config)"
    HASIL+=("{\"tujuan\":\"$tujuan\",\"hasil\":\"belum-dikonfigurasi\"}")
    continue
  fi
  ok=1
  for jenis in db uploads; do
    [ -d "$ROOT/$jenis" ] || continue
    echo "-- $jenis → $tujuan/$jenis"
    rclone copy "$ROOT/$jenis" "$tujuan/$jenis" --transfers 2 --retries 3 --low-level-retries 10 || ok=0
    rclone check "$ROOT/$jenis" "$tujuan/$jenis" --one-way || ok=0
    rclone delete "$tujuan/$jenis" --min-age "${SIMPAN_HARI}d" || true
  done
  jumlah="$(rclone lsf -R --files-only "$tujuan" 2>/dev/null | wc -l)"
  ukuran="$(rclone size "$tujuan" --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
  if [ "$ok" = 1 ]; then
    echo "[SALIN SUKSES] $tujuan — $jumlah berkas"
    HASIL+=("{\"tujuan\":\"$tujuan\",\"hasil\":\"sukses\",\"berkas\":$jumlah,\"bytes\":${ukuran:-0}}")
  else
    echo "[SALIN GAGAL] $tujuan"
    HASIL+=("{\"tujuan\":\"$tujuan\",\"hasil\":\"gagal\"}")
    GAGAL=1
  fi
done < "$CONF"

( IFS=,; echo "{\"waktu\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"simpanHari\":$SIMPAN_HARI,\"tujuan\":[${HASIL[*]}]}" ) > "$STATUS"
find "$ROOT/logs" -name 'salin-luar_*.log' -mtime +30 -delete 2>/dev/null
exit $GAGAL
