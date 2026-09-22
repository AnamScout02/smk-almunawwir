#!/bin/bash
# Restore database dari file dump hasil backup-db.sh. DEFAULT aman: restore ke database SEMENTARA
# terpisah (smk_almunawwir_restore_test) untuk verifikasi/tes, BUKAN menimpa database produksi
# secara langsung — supaya tidak ada risiko "salah pencet" menghapus data yang sedang jalan.
#
# Pemakaian:
#   scripts/restore-db.sh <path-ke-file.dump>                 # restore ke DB tes (aman, default)
#   scripts/restore-db.sh <path-ke-file.dump> --production    # timpa DB produksi (BERBAHAYA,
#                                                                 konfirmasi ketik "YA" dulu)
set -uo pipefail

DB_CONTAINER="smk_almunawwir_db"
DB_USER="smk_user"
DB_NAME="smk_almunawwir"
TEST_DB_NAME="smk_almunawwir_restore_test"

DUMP_FILE="${1:-}"
MODE="${2:-}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Pemakaian: $0 <path-ke-file.dump> [--production]"
  echo "File dump tidak ditemukan: $DUMP_FILE"
  exit 1
fi

DUMP_BASENAME="$(basename "$DUMP_FILE")"
docker cp "$DUMP_FILE" "${DB_CONTAINER}:/tmp/${DUMP_BASENAME}"

if [ "$MODE" = "--production" ]; then
  echo "!!! PRODUKSI: seluruh isi database \"$DB_NAME\" akan DITIMPA oleh $DUMP_FILE !!!"
  read -r -p "Ketik YA (huruf kapital) untuk lanjut: " CONFIRM
  if [ "$CONFIRM" != "YA" ]; then
    echo "Dibatalkan."
    exit 1
  fi
  docker exec "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "/tmp/${DUMP_BASENAME}"
  STATUS=$?
else
  echo "-- Restore ke database TES \"$TEST_DB_NAME\" (produksi tidak disentuh) --"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};"
  docker exec "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TEST_DB_NAME" "/tmp/${DUMP_BASENAME}"
  STATUS=$?
  echo "-- Verifikasi: hitung baris tabel \"Student\" & \"User\" di DB tes --"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB_NAME" -c "select count(*) as total_user from \"User\";" -c "select count(*) as total_student from \"Student\";"
  echo "-- Bersihkan DB tes --"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
fi

docker exec "$DB_CONTAINER" rm -f "/tmp/${DUMP_BASENAME}"

if [ "$STATUS" -eq 0 ]; then
  echo "[RESTORE OK]"
else
  echo "[RESTORE GAGAL — exit code $STATUS]" >&2
fi
exit "$STATUS"
