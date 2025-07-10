import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import {
    logToGateway
} from '../services/logService.js';
import {
    isValidPhoneNumber
} from 'libphonenumber-js';
import {
    fileURLToPath
} from 'url';
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();

global.sessions = global.sessions || {};

const {
    Client,
    LocalAuth,
    MessageMedia
} = pkg;

const upload = multer({
    storage: multer.memoryStorage()
});
const clients = new Map();
const qrCodes = new Map();
global.qrCodes = qrCodes;
let io = null;

export function setSocketInstance(socketIoInstance) {
    io = socketIoInstance;
}

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
            dataPath: path.join(__dirname, '../../sessions')
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

    if (io) io.to(sessionId).emit('session:update', {
        session: sessionId,
        status: 'starting'
    });

    client.on('message', async (msg) => {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) return;

        const payload = {
            session: sessionId,
            from: msg.from,
            to: msg.to || sessionId,
            body: msg.body,
            type: msg.type,
            timestamp: msg.timestamp,
            isGroupMsg: msg.from.endsWith('@g.us'),
        };

        try {
            await axios.post(webhookUrl, payload);
            console.log(`📬 Webhook dikirim ke ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Gagal kirim webhook:', err.message);
        }
    });

    client.on('qr', async (qr) => {
        try {
            const qrImage = await qrcode.toDataURL(qr);
            if (!global.qrCodes) global.qrCodes = new Map();
            global.qrCodes.set(sessionId, qrImage);

            if (global.sessions[sessionId]) {
                global.sessions[sessionId].status = 'qr';
            }

            if (io) io.to(sessionId).emit('session:qr', {
                session: sessionId,
                qr: qrImage
            });

            console.log(`✅ QR dikirim via socket untuk ${sessionId}`);

            setTimeout(() => {
                global.qrCodes.delete(sessionId);
                console.log(`🗑 QR expired untuk ${sessionId}`);
            }, 60000);
        } catch (err) {
            console.error(`❌ Gagal generate QR:`, err);
        }
    });

    client.on('ready', () => {
        global.sessions[sessionId].status = 'connected';
        console.log(`✅ Status untuk ${sessionId} di-set ke:`, global.sessions[sessionId]);

        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'connected'
        });
    });

    client.on('auth_failure', msg => {
        global.sessions[sessionId].status = 'auth_failure';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'auth_failure'
        });
        clients.delete(sessionId);
        if (global.qrCodes?.has(sessionId)) {
            global.qrCodes.delete(sessionId);
        }
        console.warn(`❌ Auth failure: ${msg}`);
    });

    client.on('disconnected', async (reason) => {
        console.warn(`⚠️ Session ${sessionId} disconnected: ${reason}`);
        try {
            if (global.sessions[sessionId]) {
                global.sessions[sessionId].status = 'disconnected';
            }

            if (io) io.to(sessionId).emit('session:update', {
                session: sessionId,
                status: 'disconnected',
                reason
            });

            await client.destroy();
        } catch (e) {
            console.error(`❌ Gagal destroy client ${sessionId}:`, e);
        }

        clients.delete(sessionId);
        global.qrCodes.delete(sessionId);

        if (reason !== 'LOGOUT') {
            console.log(`🔁 Restarting session ${sessionId} in 5s...`);
            setTimeout(() => {
                startSession({
                    body: {
                        session: sessionId
                    }
                }, {
                    json: () => {}
                });
            }, 5000);
        } else {
            console.log(`🚫 Logout manual oleh user, tidak restart`);
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
            error: 'Gagal memulai sesi',
            detail: err.message || err
        });
    }
}

export async function getSessionStatus(req, res) {
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

    console.log(`🟠 Status session ${sessionId}:`, session.status); // Tambahkan ini

    res.json({
        session: sessionId,
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
        await logToGateway({
            session,
            phone,
            message,
            type: 'text',
            status: 'success'
        });
        res.json({
            success: true
        });
        if (!fs.existsSync('logs')) {
            fs.mkdirSync('logs');
        }
        fs.appendFileSync('logs/messages.log', `[${new Date().toISOString()}] ${session} -> ${phone}: ${message}\n`);
    } catch (err) {
        console.error(`❌ Gagal kirim pesan untuk ${session}:`, err);
        await logToGateway({
            session,
            phone,
            message,
            type: 'text',
            status: 'failed'
        });
        res.status(500).json({
            error: 'Gagal mengirim pesan',
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
        await logToGateway({
            session,
            phone,
            message: caption || '[media]',
            type: 'text',
            status: 'success'
        });
        res.json({
            success: true
        });
    } catch (err) {
        console.error(`❌ Gagal kirim media:`, err);
        await logToGateway({
            session,
            phone,
            message: caption || '[media]',
            type: 'text',
            status: 'failed'
        });
        res.status(500).json({
            error: 'Gagal mengirim media',
            detail: err.message
        });
    }
}

export const sendMediaUpload = [
    upload.single('file'),
    async (req, res) => {
        const {
            session,
            phone,
            caption
        } = req.body;
        const file = req.file;

        if (!session || !phone || !file) {
            return res.status(400).json({
                error: 'Session, phone, dan file wajib diisi'
            });
        }

        if (!clients.has(session)) {
            return res.status(400).json({
                error: 'Session tidak ditemukan'
            });
        }

        try {
            const client = clients.get(session);

            const media = new MessageMedia(
                file.mimetype,
                file.buffer.toString('base64'),
                file.originalname
            );

            await client.sendMessage(`${phone}@c.us`, media, {
                caption
            });

            console.log(`✅ File upload dikirim ke ${phone}: ${file.originalname}`);
            await logToGateway({
                session,
                phone,
                message: caption || `[file: ${file.originalname}]`,
                type: 'file',
                status: 'success'
            });

            res.json({
                success: true
            });
        } catch (err) {
            console.error('❌ Gagal kirim file upload:', err);
            await logToGateway({
                session,
                phone,
                message: caption || '[file]',
                type: 'file',
                status: 'failed'
            });
            res.status(500).json({
                error: 'Gagal mengirim file',
                detail: err.message
            });
        }
    }
];

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
        await logToGateway({
            session,
            phone: groupName,
            message,
            type: 'text',
            status: 'success'
        });
        res.json({
            success: true
        });
    } catch (err) {
        console.error(`❌ Gagal kirim ke grup:`, err);
        await logToGateway({
            session,
            phone: groupName,
            message,
            type: 'text',
            status: 'failed'
        });
        res.status(500).json({
            error: 'Gagal kirim ke grup',
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
        global.qrCodes.delete(sessionId); // hapus QR jika ada
        clients.delete(sessionId); // hapus client dari map

        const sessionPath = path.resolve(__dirname, '../../sessions', sessionId);
        if (fs.existsSync(path.join(sessionPath, 'SingletonLock'))) {
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

export async function listSessions(req, res) {
    const sessions = Object.keys(global.sessions).map((id) => ({
        session: id,
        status: global.sessions[id]?.status || 'unknown'
    }));

    res.json(sessions);
}

export async function sendBulkMessage(req, res) {
    const {
        session,
        messages,
        delay = 1000
    } = req.body;

    if (!session || !Array.isArray(messages)) {
        return res.status(400).json({
            error: 'Session dan daftar messages diperlukan'
        });
    }

    if (!clients.has(session)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    const client = clients.get(session);
    const results = [];

    for (const {
            phone,
            message
        } of messages) {
        if (!isValidPhoneNumber(phone, 'ID')) {
            results.push({
                phone,
                success: false,
                error: 'Nomor tidak valid'
            });
            continue;
        }

        try {
            await client.sendMessage(`${phone}@c.us`, message);
            results.push({
                phone,
                success: true
            });
        } catch (err) {
            results.push({
                phone,
                success: false,
                error: err.message
            });
        }

        // Delay antar pesan
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    res.json({
        results
    });
}
