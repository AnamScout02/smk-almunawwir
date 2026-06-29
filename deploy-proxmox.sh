#!/bin/bash
# ============================================================
# Script Deploy SMK Al-Munawwir ke Proxmox (Ubuntu/Debian LXC)
# Jalankan sebagai root di container Proxmox
# ============================================================

set -e

echo "🚀 Starting SMK Al-Munawwir deployment..."

# === 1. Update sistem ===
apt-get update -y && apt-get upgrade -y

# === 2. Install Docker ===
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed"
fi

# === 3. Install Git ===
apt-get install -y git

# === 4. Clone/pull project ===
APP_DIR="/opt/smk-almunawwir"
if [ -d "$APP_DIR" ]; then
    echo "📂 Updating existing project..."
    cd "$APP_DIR" && git pull
else
    echo "📂 Cloning project..."
    git clone https://github.com/AnamScout02/smk-almunawwir.git "$APP_DIR"
    cd "$APP_DIR"
fi

# === 5. Setup environment ===
if [ ! -f "$APP_DIR/.env" ]; then
    echo "⚠️  Membuat .env dari template..."
    cp "$APP_DIR/.env.production" "$APP_DIR/.env"
    echo ""
    echo "❗ PENTING: Edit file .env sebelum melanjutkan!"
    echo "   nano $APP_DIR/.env"
    echo ""
    read -p "Tekan Enter setelah mengedit .env..."
fi

# === 6. Jalankan dengan Docker Compose ===
cd "$APP_DIR"
echo "🐳 Building & starting containers..."
docker compose up -d --build

# === 7. Tunggu database siap lalu migrate ===
echo "⏳ Menunggu database siap..."
sleep 15
docker compose run --rm migrate

echo ""
echo "✅ DEPLOYMENT BERHASIL!"
echo "🌐 Website berjalan di: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📋 Akun Login:"
echo "  Superadmin     → suadmin@smkalmunawwiriibs.sch.id   / Almunawwir1"
echo "  Kepala Sekolah → admin@smkalmunawwiriibs.sch.id     / Almunawwir1"
echo "  Guru/TAS       → m.anam@smkalmunawwiriibs.sch.id    / Almunawwir1"
echo "  TAS            → lutfiamila@smkalmunawwiriibs.sch.id / Almunawwir1"
echo "  Guru Contoh    → guru-contoh@smkalmunawwiriibs.sch.id / Almunawwir1"
echo "  Siswa Contoh   → siswa-contoh@smkalmunawwiriibs.sch.id / Almunawwir1"
echo ""
echo "⚠️  Segera ganti password setelah login pertama!"
