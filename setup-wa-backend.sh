#!/bin/bash
set -e

echo "🚀 Setup WA Backend (tanpa clone) dimulai..."

# =========================
# 📦 Install dependensi dasar
# =========================
sudo apt update && sudo apt install -y curl build-essential libx11-xcb1 libxcomposite1 libxdamage1 libxi6 libxtst6 libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 libgbm1 libxrandr2 libasound2 libpangocairo-1.0-0 libxss1 libgtk-3-0

# =========================
# 📦 Install Node.js LTS (jika belum ada)
# =========================
if ! command -v node >/dev/null 2>&1; then
  echo "📦 Node.js belum ada, menginstal Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# =========================
# 📦 Install PM2
# =========================
if ! command -v pm2 >/dev/null 2>&1; then
  echo "📦 Menginstal PM2..."
  sudo npm install -g pm2
fi

# =========================
# 📁 Masuk ke folder wa-backend (harus sudah ada)
# =========================
cd "$(dirname "$0")"

# =========================
# 📄 Generate .env
# =========================
API_SECRET=$(openssl rand -base64 32)
PORT=3000
CHROME_PATH="/usr/bin/google-chrome"
SESSION_DIR="./sessions"

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
# 📦 Install dependencies (jika belum)
# =========================
if [ ! -d "node_modules" ]; then
  echo "📦 Menjalankan npm install..."
  npm install
else
  echo "✅ node_modules sudah ada, skip npm install."
fi

# =========================
# ▶️ Jalankan pakai PM2
# =========================
pm2 start src/app.js --name wa-backend
pm2StartupCmd=$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1)
eval "$pm2StartupCmd"
pm2 save

# =========================
# ✅ Info akhir
# =========================
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ WA Backend berhasil dijalankan!"
echo "🌐 Akses: http://$IP:$PORT"
echo "🔐 API_SECRET: $API_SECRET"
echo ""
