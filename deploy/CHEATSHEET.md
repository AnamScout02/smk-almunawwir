# SMK Al-Munawwir Website — Cheat Sheet Harian

CT Proxmox: `website-smk` — IP lokal `172.15.0.3` — IP publik `<IP-PUBLIK-SERVER>`
SSH: `ssh smk-almunawwir` (dari laptop, sudah pakai SSH key, tanpa password)

---

## 1. Akses aplikasi

- Dari LAN sekolah: `http://172.15.0.3:3000`
- Dari internet: `http://<IP-PUBLIK-SERVER>:3000`

---

## 2. Login ke CT

```bash
ssh smk-almunawwir
cd /root/smk-almunawwir
```

(Config sudah ada di `~/.ssh/config` laptop, tinggal `ssh smk-almunawwir`, tidak perlu ketik IP/port/password.)

---

## 3. Update kode dari GitHub (workflow rutin)

**Di laptop**, setelah selesai edit & push:
```bash
git add .
git commit -m "Deskripsi perubahan"
git push origin main
```

**Di CT**:
```bash
cd /root/smk-almunawwir
bash deploy/deploy.sh
```

Script ini otomatis: `git pull` → `docker compose up -d --build` → bersihkan image lama → tampilkan status.

---

## 4. Cek status & log

```bash
docker compose ps                        # status semua container
docker compose logs app --tail 50        # log aplikasi Next.js
docker compose logs postgres --tail 50   # log database
docker compose logs -f app               # log realtime (Ctrl+C keluar)
```

---

## 5. Restart / Start / Stop

```bash
docker compose restart app       # restart aplikasi saja
docker compose down              # matikan semua container
docker compose up -d             # nyalakan lagi (tanpa rebuild)
```

---

## 6. Reboot CT penuh

Dari Proxmox web UI atau:
```bash
reboot
```
Docker & container akan otomatis nyala lagi setelah CT boot (asal Docker service `enabled`, cek dengan `systemctl is-enabled docker`).

---

## 7. Backup database

```bash
docker exec smk_almunawwir_db pg_dump -U smk_user smk_almunawwir > ~/backup-$(date +%Y%m%d-%H%M).sql
```

Download ke laptop (dari PowerShell laptop):
```powershell
scp smk-almunawwir:~/backup-*.sql "C:\Backup\"
```

---

## 8. Akses dari luar jaringan (sudah aktif)

Port forwarding di MikroTik (comment: "Website SMK Almunawwir" & "SSH Website SMK Almunawwir"):

| Tujuan | Dari luar | Diteruskan ke |
|---|---|---|
| Web app | `<IP-PUBLIK-SERVER>:3000` | `172.15.0.3:3000` |
| SSH / VS Code | `<IP-PUBLIK-SERVER>:<PORT-SSH-SERVER>` | `172.15.0.3:22` |

Lihat/ubah rule NAT (Winbox → Terminal MikroTik):
```
/ip firewall nat print
```

---

## 9. Troubleshooting

| Masalah | Cek |
|---|---|
| Website tidak bisa diakses | `docker compose ps` — pastikan `app` & `postgres` statusnya `Up`/`healthy` |
| Error database di log app | `docker compose logs postgres --tail 50`, cek `DATABASE_URL` di `.env` cocok dengan `POSTGRES_PASSWORD` |
| `docker pull`/build gagal: `i/o timeout` ke `registry-1.docker.io` | DNS timeout sesaat (jaringan CT ini kadang flaky ke Docker Hub) — tinggal ulangi command yang sama 1-2 kali |
| Push dari laptop tidak muncul di server | Cek branch: `git branch -vv` di laptop, pastikan push ke `main` bukan branch lain |
| Lupa command | Baca ulang file ini: `cat deploy/CHEATSHEET.md` |

---

## 10. Catatan keamanan

- Password root & `.env` (`POSTGRES_PASSWORD`, `SESSION_SECRET`) jangan dibagikan ke chat/publik.
- SSH root ke CT ini sudah expose ke internet (`<IP-PUBLIK-SERVER>:<PORT-SSH-SERVER>`) — login sudah pakai SSH key, disarankan matikan password login sepenuhnya kalau belum:
  ```bash
  sudo sed -i "s/^#\?PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config
  sudo systemctl restart ssh
  ```
  (Lakukan ini HANYA setelah pastikan SSH key sudah bisa login dengan lancar dari laptop.)
