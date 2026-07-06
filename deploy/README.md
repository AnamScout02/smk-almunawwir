# Deploy — SMK Al-Munawwir Website

Folder ini berisi tooling untuk deploy & operasional harian aplikasi di Proxmox CT.

| File | Fungsi |
|---|---|
| `deploy.sh` | Update kode dari GitHub + rebuild & restart container (dipakai berulang) |
| `CHEATSHEET.md` | Panduan operasional harian: start/stop, cek log, troubleshooting |

Stack: Next.js + PostgreSQL, dijalankan via Docker Compose (bukan Apache/systemd).
