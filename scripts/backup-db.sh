#!/bin/bash
# Backup harian PostgreSQL (dump custom-format, bisa di-restore parsial/seluruhnya) + folder
# upload (public/uploads — foto siswa, dokumen PKL, dll, tersimpan di Docker volume terpisah dari
# Postgres jadi tidak ikut ke-backup kalau cuma dump DB saja). Retensi otomatis supaya disk tidak
# penuh (lihat RETENTION_DAYS). Dipanggil dari cron (lihat scripts/install-backup-cron.sh) —
# JANGAN dijalankan manual dengan asumsi container selalu bernama sama kalau docker-compose.yml
# diubah nama service/project-nya.
set -uo pipefail

BACKUP_ROOT="/root/backups/smk-almunawwir"
DB_CONTAINER="smk_almunawwir_db"
DB_USER="smk_user"
DB_NAME="smk_almunawwir"
UPLOADS_VOLUME="smk-almunawwir_uploads_data"
RETENTION_DAYS=14

TS="$(date +%Y-%m-%d_%H%M%S)"
DB_FILE="$BACKUP_ROOT/db/smk_almunawwir_${TS}.dump"
UPLOADS_FILE="$BACKUP_ROOT/uploads/uploads_${TS}.tar.gz"
LOG_FILE="$BACKUP_ROOT/logs/backup_${TS}.log"

mkdir -p "$BACKUP_ROOT/db" "$BACKUP_ROOT/uploads" "$BACKUP_ROOT/logs"

run_backup() {
  echo "=== Backup mulai: $(date -u) ==="

  echo "-- Dump database ($DB_NAME) --"
  if ! docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc -d "$DB_NAME" > "$DB_FILE"; then
    echo "GAGAL: pg_dump error"
    return 1
  fi
  echo "Selesai: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

  echo "-- Arsip folder uploads --"
  if ! docker run --rm \
    -v "${UPLOADS_VOLUME}:/data:ro" \
    -v "$BACKUP_ROOT/uploads:/backup" \
    alpine sh -c "tar czf /backup/uploads_${TS}.tar.gz -C /data ."; then
    echo "GAGAL: arsip uploads error"
    return 1
  fi
  echo "Selesai: $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"

  echo "-- Retensi: hapus backup lebih tua dari $RETENTION_DAYS hari --"
  find "$BACKUP_ROOT/db" -name "*.dump" -mtime "+${RETENTION_DAYS}" -print -delete
  find "$BACKUP_ROOT/uploads" -name "*.tar.gz" -mtime "+${RETENTION_DAYS}" -print -delete
  find "$BACKUP_ROOT/logs" -name "*.log" -mtime "+${RETENTION_DAYS}" -print -delete

  echo "=== Backup selesai: $(date -u) ==="
  return 0
}

if run_backup > "$LOG_FILE" 2>&1; then
  echo "[BACKUP SUKSES] $DB_FILE"
  exit 0
else
  echo "[BACKUP GAGAL] Lihat log: $LOG_FILE" >&2
  tail -20 "$LOG_FILE" >&2
  exit 1
fi
