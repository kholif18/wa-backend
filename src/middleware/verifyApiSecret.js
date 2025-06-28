import dotenv from 'dotenv';
dotenv.config();

export default function verifyApiSecret(req, res, next) {
    const apiSecret = req.headers['x-api-secret'];
    if (!apiSecret || apiSecret !== process.env.API_SECRET) {
        return res.status(401).json({
            error: 'Unauthorized'
        });
    }
    next();
}
