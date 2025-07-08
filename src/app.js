import express from 'express';
import {
    createServer
} from 'http';
import {
    Server
} from 'socket.io';
import {
    setSocketInstance
} from './controllers/whatsappController.js';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import verifyApiSecret from './middleware/verifyApiSecret.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

global.io = io;
setSocketInstance(io); // inject io ke whatsappController

// Tambahkan handler ini setelah setSocketInstance(io)
io.on('connection', (socket) => {
    console.log("🔌 Socket client terhubung");

    const sessionId = socket.handshake.query.session;
    if (!sessionId) {
        console.warn("⚠️ Tidak ada session ID di query socket");
        return;
    }

    socket.join(sessionId);
    console.log(`📡 Socket join room untuk session: ${sessionId}`);

    const currentSession = global.sessions[sessionId];
    if (currentSession) {
        socket.emit('session:update', {
            session: sessionId,
            status: currentSession.status || 'unknown'
        });

        if (currentSession.status === 'qr' && global.qrCodes?.has(sessionId)) {
            socket.emit('session:qr', {
                session: sessionId,
                qr: global.qrCodes.get(sessionId)
            });
        }
    } else {
        socket.emit('session:update', {
            session: sessionId,
            status: 'disconnected'
        });
    }
});

app.use(express.json());
app.use(verifyApiSecret);
app.use('/session', routes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ WA Gateway backend listening at http://0.0.0.0:${PORT}`);
});
