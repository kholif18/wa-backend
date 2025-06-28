
# 🤖 WA Backend – WhatsApp Web.js Backend for R Gateway

**WA Backend** adalah backend Node.js berbasis [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) yang bertugas menangani koneksi WhatsApp dan menerima perintah dari aplikasi Laravel (R Gateway) untuk mengirim pesan, memulai sesi, mengambil status, dan QR code.

---

## 🚀 Fitur

- 🔄 Start / stop session WhatsApp
- 📸 Generate dan kirim QR code
- 📥 Terima dan kirim pesan teks atau media
- 🧠 Dukungan multi-session
- 🔐 Verifikasi API menggunakan secret key
- 📦 Terintegrasi dengan R Gateway (Laravel)

---

## ⚙️ Instalasi

### 1. Clone dan install dependencies
```bash
git clone https://github.com/kholif18/wa-backend.git
cd wa-backend
npm install
```

### 2. Buat file konfigurasi `.env`
```env
PORT=3000
API_SECRET=your_api_secret_key
SESSION_DIR=./sessions
```

### 3. Jalankan server
```bash
npm start
```

WA Backend akan berjalan di `http://localhost:3000`.

---

## 📡 API Endpoint (internal use by R Gateway)

### 🔹 Start Session
```
POST /session/start
```
**Body:**
```json
{ "session": "user_1" }
```

### 🔹 Get Status
```
GET /session/status?session=user_1
```

### 🔹 Get QR Code (Base64 Data URL format PNG)
```
GET /session/qr?session=user_1
```

### 🔹 Get QR Code (image)
```
GET /session/qr.png?session=user_1
```

### 🔹 Send Message
```
POST /message/send
```
**Body:**
```json
{
  "session": "user_1",
  "phone": "6281234567890",
  "message": "Halo dari backend"
}
```

---

## 📁 Struktur Direktori

```
src/
  controllers/
    whatsappController.js
  middleware/
    verifyApiSecret.js
  routes/
    index.js
  app.js
.env
sessions/
```

---

## 🧪 Pengujian

Gunakan Postman, Insomnia, atau curl untuk mengetes endpoint saat R Gateway belum aktif. Pastikan API secret sesuai dengan yang digunakan oleh Laravel.

---

## 🛠 Teknologi

- Node.js + Express
- whatsapp-web.js
- qrcode
- dotenv
- lowdb (opsional untuk menyimpan status)

---

## 📄 Lisensi

Dikembangkan oleh [Ravaa Creative](https://ravaa.my.id)  
Lisensi: MIT
