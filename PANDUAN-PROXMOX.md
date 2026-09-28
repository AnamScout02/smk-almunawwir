# Panduan Deploy ke Proxmox

## Arsitektur di Proxmox

```
Proxmox VE
└── LXC Container (Ubuntu 22.04)
    ├── Docker Engine
    │   ├── Container: smk_almunawwir_app  (Next.js :3000)
    │   └── Container: smk_almunawwir_db   (PostgreSQL :5432)
    └── Volume: postgres_data (data persisten)
```

## Langkah 1 — Buat LXC Container di Proxmox

Di Proxmox web UI:
1. Create CT → pilih template **Ubuntu 22.04**
2. Resources: **2 CPU core, 2GB RAM, 20GB disk** (minimal)
3. Network: bridge ke LAN, **catat IP-nya** (misal: 192.168.1.100)
4. Start container

## Langkah 2 — Upload Kode ke Server

**Opsi A — via Git (direkomendasikan):**
```bash
# Di komputer Anda, push ke GitHub dulu
git init
git add .
git commit -m "Initial commit SMK Al-Munawwir"
git remote add origin https://github.com/AnamScout02/smk-almunawwir.git
git push -u origin main
```

**Opsi B — via SCP (langsung upload):**
```bash
# Dari CMD/terminal Windows Anda:
scp -r "C:\Users\anamr\OneDrive\Dokumen\SMK\smk-almunawwir" root@192.168.1.100:/opt/
```

## Langkah 3 — Deploy di Container Proxmox

SSH ke container:
```bash
ssh root@192.168.1.100
```

Jalankan script deploy otomatis:
```bash
# Upload script dulu (dari Windows):
scp deploy-proxmox.sh root@192.168.1.100:/root/

# Di container Proxmox:
chmod +x /root/deploy-proxmox.sh
bash /root/deploy-proxmox.sh
```

**Atau manual:**
```bash
# Install Docker
apt-get update && apt-get install -y docker.io docker-compose-plugin

# Masuk ke folder project
cd /opt/smk-almunawwir

# Buat .env production
cp .env.production .env
nano .env   # Edit password & IP

# Jalankan
docker compose up -d --build

# Migrate & seed database
docker compose run --rm migrate
```

## Langkah 4 — Setup .env Production

Edit `/opt/smk-almunawwir/.env`:
```env
DATABASE_URL="postgresql://smk_user:PASSWORD_KUAT@postgres:5432/smk_almunawwir"
SESSION_SECRET="string-acak-minimal-32-karakter-unik"
NEXT_PUBLIC_APP_URL="http://192.168.1.100:3000"
POSTGRES_PASSWORD="PASSWORD_KUAT"
```

Generate SESSION_SECRET:
```bash
openssl rand -base64 32
```

## Langkah 5 — Akses Website

Buka browser: `http://192.168.1.100:3000`

---

## Perintah Berguna

```bash
# Cek status container
docker compose ps

# Lihat log aplikasi
docker compose logs -f app

# Lihat log database
docker compose logs -f postgres

# Restart aplikasi
docker compose restart app

# Update aplikasi (setelah git pull)
docker compose up -d --build app

# Backup database
docker compose exec postgres pg_dump -U smk_user smk_almunawwir > backup.sql

# Restore database
docker compose exec -T postgres psql -U smk_user smk_almunawwir < backup.sql

# Stop semua
docker compose down

# Stop + hapus data (HATI-HATI!)
docker compose down -v
```

## Menghubungkan VS Code (Remote-SSH) dari IP Publik ke Proxmox Ini

Server ini sudah expose SSH ke internet lewat port forwarding MikroTik:

| Tujuan | Dari luar (IP publik) | Diteruskan ke |
|---|---|---|
| SSH / VS Code | `<IP-PUBLIK-SERVER>:<PORT-SSH-SERVER>` | `<IP-SERVER>:22` (CT ini) |

Jadi dari laptop mana pun (bukan cuma dari LAN sekolah), VS Code bisa connect langsung ke port **<PORT-SSH-SERVER>** di IP publik **<IP-PUBLIK-SERVER>**.

### Langkah 1 — Install extension Remote-SSH

Di VS Code: buka **Extensions** (Ctrl+Shift+X) → cari **"Remote - SSH"** (by Microsoft) → Install.

### Langkah 2 — Buat/pakai SSH key (kalau belum ada)

Di laptop (PowerShell/Terminal):
```bash
ssh-keygen -t ed25519 -C "nama-laptop-anda"
```
Tekan Enter di semua prompt (lokasi default `~/.ssh/id_ed25519`, boleh kosongkan passphrase atau isi sesuai selera).

### Langkah 3 — Daftarkan public key ke server

Copy isi public key (`~/.ssh/id_ed25519.pub`) dari laptop, lalu di server ini (Proxmox CT) tambahkan ke `~/.ssh/authorized_keys`:
```bash
echo "isi-public-key-anda" >> ~/.ssh/authorized_keys
```
Atau lebih gampang, dari laptop langsung pakai `ssh-copy-id` (kalau masih login pakai password):
```bash
ssh-copy-id -p <PORT-SSH-SERVER> root@<IP-PUBLIK-SERVER>
```

### Langkah 4 — Buat SSH config di laptop

Edit/tambahkan di `~/.ssh/config` (laptop, buat file kalau belum ada):
```
Host smk-almunawwir
    HostName <IP-PUBLIK-SERVER>
    Port <PORT-SSH-SERVER>
    User root
    IdentityFile ~/.ssh/id_ed25519
```

Tes dulu dari terminal biasa: `ssh smk-almunawwir` — harus langsung masuk tanpa diminta password.

### Langkah 5 — Connect dari VS Code

1. Buka Command Palette (Ctrl+Shift+P) → ketik **"Remote-SSH: Connect to Host..."**
2. Pilih **smk-almunawwir** (otomatis terbaca dari `~/.ssh/config`)
3. VS Code buka window baru, tunggu proses install VS Code Server di server (sekali saja, beberapa menit pertama)
4. Setelah connect, **File → Open Folder** → pilih `/root/smk-almunawwir`

Selesai — bisa edit file, buka terminal terintegrasi (otomatis di server, bukan di laptop), langsung jalankan `docker compose` dll seperti biasa.

### Catatan keamanan

- Port SSH ini sudah terbuka ke internet — pastikan **login password dimatikan** (hanya SSH key) dan lihat catatan keamanan lain di `deploy/CHEATSHEET.md` bagian 10.
- Jangan share private key (`id_ed25519` tanpa `.pub`) ke siapa pun.

---

## Nginx Reverse Proxy (Opsional, untuk domain custom)

Jika ingin pakai domain (misal: smk-almunawwir.sch.id):

```nginx
# /etc/nginx/sites-available/smk-almunawwir
server {
    listen 80;
    server_name smk-almunawwir.sch.id;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
apt-get install -y nginx
ln -s /etc/nginx/sites-available/smk-almunawwir /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
