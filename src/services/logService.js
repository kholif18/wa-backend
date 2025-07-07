import axios from 'axios';

const gatewayUrl = process.env.R_GATEWAY_URL;

export async function logToGateway(session, phone, message, status) {
    if (!gatewayUrl) {
        console.error('❌ R_GATEWAY_URL belum diset di .env!');
        return;
    }

    try {
        await axios.post(`${gatewayUrl}/api/wa-log`, {
            session,
            phone,
            message,
            type,
            status
        }, {
            headers: {
                Authorization: `Bearer ${process.env.RGATEWAY_TOKEN}`
            }
        });
        console.log(`✅ Log dikirim ke r-gateway`);
    } catch (error) {
        console.error(`❌ Gagal kirim log ke r-gateway`, error.message);
    }
}
