import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
    isValidPhoneNumber
} from 'libphonenumber-js';

dotenv.config();

global.sessions = global.sessions || {};

const {
    Client,
    LocalAuth,
    MessageMedia
} = pkg;

const clients = new Map();
const qrCodes = new Map();

export async function startSession(req, res) {
    const sessionId = req.body.session;
    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID diperlukan'
        });
    }

    if (clients.has(sessionId)) {
        return res.json({
            message: 'Session sudah aktif'
        });
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionId,
            dataPath: '/sessions'
        }),
        puppeteer: {
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=site-per-process',
                '--window-size=1920,1080'
            ]
        },
    });

    global.sessions[sessionId] = {
        client,
        qr: null,
        status: 'starting'
    };

    client.on('qr', async (qr) => {
        try {
            const qrImage = await qrcode.toDataURL(qr);
            qrCodes.set(sessionId, qrImage);

            // ✅ Update status session
            if (global.sessions[sessionId]) {
                global.sessions[sessionId].status = 'qr';
            }

            console.log(`✅ QR disimpan untuk ${sessionId}`);
            setTimeout(() => {
                qrCodes.delete(sessionId);
                console.log(`🗑 QR expired untuk ${sessionId}`);
            }, 60000);
        } catch (err) {
            console.error(`❌ Gagal generate QR:`, err);
        }
    });
    

    client.on('ready', () => {
        global.sessions[sessionId].status = 'connected';
    });

    client.on('auth_failure', msg => {
        global.sessions[sessionId].status = 'auth_failure';
        clients.delete(sessionId);
        qrCodes.delete(sessionId);
    });

    client.on('disconnected', async (reason) => {
        console.warn(`⚠️ Session ${sessionId} disconnected: ${reason}`);
        try {
            if (global.sessions[sessionId]) {
                global.sessions[sessionId].status = 'disconnected';
            }
            await client.destroy();
        } catch (e) {
            console.error(`❌ Gagal destroy client ${sessionId}:`, e);
        }
        clients.delete(sessionId);
        qrCodes.delete(sessionId);

        // Auto-restart jika logout bukan karena user
        if (reason !== 'LOGOUT') {
            setTimeout(() => {
                startSession({
                    query: {
                        session: sessionId
                    }
                }, {
                    json: () => {}
                });
            }, 5000);
        } else {
            console.log(`🚫 Tidak restart karena user logout manual`);
        }
    });

    try {
        await client.initialize();
        clients.set(sessionId, client);
        res.json({
            message: 'Session starting...'
        });
    } catch (err) {
        console.error(`❌ Gagal initialize session ${sessionId}:`, err);
        res.status(500).json({
            error: 'Gagal memulai sesi'
        });
    }
}

export async function getQR(req, res) {
    const sessionId = req.query.session;
    const qr = qrCodes.get(sessionId);
    if (!qr) return res.status(400).json({
        error: 'QR tidak tersedia'
    });
    res.json({
        qr
    });
}

export const getQRImage = async (req, res) => {
    const sessionId = req.query.session;
    const qr = qrCodes.get(sessionId);

    console.log(`📷 Get QR image for ${sessionId}`);

    if (!qr) return res.status(400).send('QR tidak tersedia');

    const base64Data = qr.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.send(imgBuffer);
};

export async function getStatus(req, res) {
    const sessionId = req.query.session;
    const session = global.sessions[sessionId];

    if (!session) return res.json({
        status: 'offline'
    });

    res.json({
        status: session.status || 'unknown'
    });
}

export async function sendMessage(req, res) {
    const {
        session,
        phone,
        message
    } = req.body;
    
    // Validasi input
    if (!session || !phone || !message) {
        return res.status(400).json({
            error: 'Session, phone, dan message diperlukan'
        });
    }
    if (!isValidPhoneNumber(phone, 'ID')) { // Ganti 'ID' dengan kode negara yang sesuai
        return res.status(400).json({
            error: 'Nomor telepon tidak valid'
        });
    }

    if (!clients.has(session)) return res.status(400).json({
        error: 'Session tidak ditemukan'
    });

    try {
        const client = clients.get(session);
        await client.sendMessage(`${phone}@c.us`, message);
        res.json({
            success: true
        });
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs');
        }
        fs.appendFileSync('logs/messages.log', `[${new Date().toISOString()}] ${session} -> ${phone}: ${message}\n`);
    } catch (err) {
        console.error(`❌ Gagal kirim pesan untuk ${session}:`, err);
        res.status(500).json({
            error: 'Gagal mengirim pesan',
            detail: err.message
        });
    }
}

export async function logoutSession(req, res) {
    const sessionId = req.query.session;

    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID diperlukan'
        });
    }

    const session = global.sessions[sessionId];

    if (!session) {
        return res.status(404).json({
            error: 'Session tidak ditemukan'
        });
    }

    if (session.status !== 'connected') {
        return res.status(400).json({
            error: 'Session belum login, tidak bisa logout'
        });
    }

    try {
        await session.client.logout(); // logout dari WhatsApp
        await session.client.destroy(); // matikan client

        delete global.sessions[sessionId]; // hapus dari memory
        qrCodes.delete(sessionId); // hapus QR jika ada
        clients.delete(sessionId); // hapus client dari map

        const sessionPath = path.resolve('/sessions', sessionId);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            console.log(`📁 Folder sesi ${sessionId} dihapus`);
        }

        res.json({
            message: `Session ${sessionId} berhasil logout dan dihapus`
        });
    } catch (err) {
        console.error(`❌ Gagal logout session ${sessionId}:`, err);
        res.status(500).json({
            error: 'Gagal logout session',
            detail: err.message
        });
    }
}

export async function sendMedia(req, res) {
    const {
        session,
        phone,
        fileUrl,
        caption
    } = req.body;

    // Validasi input
    if (!session || !phone || !fileUrl) {
        return res.status(400).json({
            error: 'Session, phone, dan fileUrl diperlukan'
        });
    }
    if (!isValidPhoneNumber(phone, 'ID')) { // Ganti 'ID' dengan kode negara yang sesuai
        return res.status(400).json({
            error: 'Nomor telepon tidak valid'
        });
    }

    if (!clients.has(session)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    try {
        const client = clients.get(session);

        const media = await MessageMedia.fromUrl(fileUrl);
        await client.sendMessage(`${phone}@c.us`, media, {
            caption
        });

        // Simpan log pengiriman jika perlu
        console.log(`📎 Media dikirim ke ${phone}: ${fileUrl}`);

        res.json({
            success: true
        });
    } catch (err) {
        console.error(`❌ Gagal kirim media:`, err);
        res.status(500).json({
            error: 'Gagal mengirim media',
            detail: err.message
        });
    }
}

export async function sendGroupMessage(req, res) {
    const {
        session,
        groupName,
        message
    } = req.body;

    // Validasi input
    if (!session || !groupName || !message) {
        return res.status(400).json({
            error: 'Session, groupName, dan message diperlukan'
        });
    }

    if (!clients.has(session)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    try {
        const client = clients.get(session);
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === groupName);

        if (!group) {
            return res.status(404).json({
                error: `Grup "${groupName}" tidak ditemukan`
            });
        }

        await group.sendMessage(message);

        console.log(`💬 Pesan dikirim ke grup "${groupName}": ${message}`);
        res.json({
            success: true
        });
    } catch (err) {
        console.error(`❌ Gagal kirim ke grup:`, err);
        res.status(500).json({
            error: 'Gagal kirim ke grup',
            detail: err.message
        });
    }
}
