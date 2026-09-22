#!/bin/bash
# Pasang jadwal backup harian ke crontab root — jalan 02:00 WIB (19:00 UTC, server ini pakai UTC)
# setiap hari, waktu paling sepi. Idempotent — aman dijalankan ulang, tidak akan dobel baris.
set -euo pipefail

SCRIPT_PATH="/root/smk-almunawwir/scripts/backup-db.sh"
CRON_LINE="0 19 * * * ${SCRIPT_PATH} >> /root/backups/smk-almunawwir/logs/cron.log 2>&1"

( crontab -l 2>/dev/null | grep -vF "$SCRIPT_PATH" || true; echo "$CRON_LINE" ) | crontab -

echo "Terpasang. Jadwal saat ini:"
crontab -l | grep -F "$SCRIPT_PATH"
