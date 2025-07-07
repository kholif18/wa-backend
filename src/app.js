import express from 'express';
import {
    createServer
} from 'http';
import {
    Server
} from 'socket.io';
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

app.use(express.json());
app.use(verifyApiSecret);
app.use('/session', routes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ WA Gateway backend listening at http://localhost:${PORT}`);
});
