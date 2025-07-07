import express from 'express';

import {
    startSession,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    logoutSession,
    listSessions,
    getSessionStatus,
    sendBulkMessage
} from '../controllers/whatsappController.js';

const router = express.Router();

router.post('/start', startSession);
router.post('/send', sendMessage); // POST /session/send
router.post('/send-media', sendMedia); // kirim file/gambar
router.post('/send-media-upload', sendMediaUpload);
router.post('/send-group', sendGroupMessage); // kirim ke grup
router.get('/logout', logoutSession);
router.get('/sessions', listSessions);
router.post('/send-bulk', sendBulkMessage);
router.get('/status', getSessionStatus);

export default router;
