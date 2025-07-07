import express from 'express';
import {
    startSession,
    getQR,
    getQRImage,
    getStatus,
    sendMessage,
    sendMedia,
    sendGroupMessage,
    logoutSession,
    listSessions,
    sendBulkMessage
} from '../controllers/whatsappController.js';

const router = express.Router();

router.post('/start', startSession);
router.post('/send', sendMessage); // POST /session/send
router.post('/send-media', sendMedia); // kirim file/gambar
router.post('/send-group', sendGroupMessage); // kirim ke grup
router.get('/status', getStatus); // GET /session/status?session=user1
router.get('/logout', logoutSession);
router.get('/sessions', listSessions);
router.post('/send-bulk', sendBulkMessage);

export default router;
