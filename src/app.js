import express from 'express';
import fs from 'fs';
import {
    fileURLToPath
} from 'url';
import path from 'path';
import routes from './routes/index.js';
import dotenv from 'dotenv';
import verifyApiSecret from './middleware/verifyApiSecret.js';

dotenv.config(); // ⬅️ Gunakan .env jika diperlukan

const __dirname = path.dirname(fileURLToPath(
    import.meta.url));
const app = express();

// Middleware
app.use(express.json());
app.use(verifyApiSecret);

// Routes
app.use('/session', routes);

// Port dan Executable Chrome dari ENV
const PORT = process.env.PORT || 3000;
const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome';

// Logging informasi saat start
console.log('Puppeteer Chrome path:', chromePath);
console.log('Starting server...');

// Start server
app.listen(PORT, () => {
    console.log(`✅ WA Gateway backend listening at http://localhost:${PORT}`);
});
