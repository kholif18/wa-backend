#!/bin/bash

set -e

echo "🚀 Memulai setup WA Backend di Debian/Ubuntu..."

# =========================
# 📦 Update dan install alat dasar
# =========================
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential wget unzip

# =========================
# 📦 Install Node.js 18.x
# =========================
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# =========================
# 🔁 Cek versi
# =========================
echo "📦 Node.js versi: $(node -v)"
echo "📦 NPM versi: $(npm -v)"

# =========================
# 📦 Install PM2
# =========================
sudo npm install -g pm2

# =========================
# 🧱 Install Puppeteer dependencies
# =========================
sudo apt install -y \
    libx11-dev libx11-xcb-dev libxcb-dri3-0 \
    libxcomposite1 libxdamage1 libxi6 libxtst6 \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libdrm2 libgbm1 libxrandr2 libasound2 \
    libpangocairo-1.0-0 libxss1 libgtk-3-0

# =========================
# 📁 Clone project
# =========================
if [ ! -d "$PROJECT_DIR" ]; then
  echo "📦 Clone project wa-backend..."
  git clone https://github.com/kholif18/wa-backend.git "$PROJECT_DIR"
else
  echo "✅ Folder wa-backend sudah ada, skip clone."
fi

cd "$PROJECT_DIR"

# =========================
# ⚙️ Generate .env file
# =========================
API_SECRET=$(openssl rand -base64 32)
PORT=3000
CHROME_PATH="/usr/bin/google-chrome"
SESSION_DIR="./sessions"

# Buat folder session jika belum ada
mkdir -p "$SESSION_DIR"
chmod 755 "$SESSION_DIR"

cat <<EOF > .env
API_SECRET=$API_SECRET
PORT=$PORT
PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH
SESSION_DIR=$SESSION_DIR
R_GATEWAY_URL=http://localhost:7000
# WEBHOOK_URL=https://your-webhook-url.com/wa-incoming
EOF

echo "✅ File .env berhasil dibuat."

# =========================
# 📦 Install dependencies
# =========================
npm install

# =========================
# ▶️ Jalankan dengan PM2
# =========================
pm2 start src/app.js --name wa-backend
pm2 startup systemd
pm2 save

# =========================
# 📣 Informasi akhir
# =========================
IP_ADDR=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ WA Backend berhasil dijalankan!"
echo "🌐 URL     : http://$IP_ADDR:$PORT"
echo "🔐 API Key : $API_SECRET"
echo ""
