import axios from 'axios';

const gatewayUrl = process.env.R_GATEWAY_URL;
const token = process.env.RGATEWAY_TOKEN;

export async function logToGateway({
    session,
    phone,
    message,
    type = 'text',
    status = 'success'
}) {
    if (!gatewayUrl || !token) {
        console.error('❌ R_GATEWAY_URL atau RGATEWAY_TOKEN belum diset di .env!');
        return;
    }

    try {
        await axios.post(`${gatewayUrl}/api/wa-log`, {
            session,
            phone,
            message,
            type,
            status,
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        console.log(`✅ Log dikirim ke r-gateway`);
    } catch (error) {
        console.error(`❌ Gagal kirim log ke r-gateway:`, error.message);
    }
}
