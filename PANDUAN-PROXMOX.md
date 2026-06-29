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
git remote add origin https://github.com/AKUN_ANDA/smk-almunawwir.git
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
