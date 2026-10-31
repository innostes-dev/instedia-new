const crypto = require('crypto');

function encodeCursor(payload, secret) {
    const payloadStr = JSON.stringify(payload);

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadStr);
    const sig = hmac.digest('hex');

    const combined = { data: payload, sig: sig };

    return Buffer.from(JSON.stringify(combined)).toString('base64');
}

function decodeCursor(cursorBase64, secret) {
    try {
        const decodedStr = Buffer.from(cursorBase64, 'base64').toString('utf-8');
        const combined = JSON.parse(decodedStr);

        if (!combined.data || !combined.sig) {
            throw new Error('Malformed cursor');
        }

        const payloadStr = JSON.stringify(combined.data);
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payloadStr);
        const expectedSig = hmac.digest('hex');

        // Use timingSafeEqual to prevent timing attacks in production
        const isValid = crypto.timingSafeEqual(
            Buffer.from(combined.sig),
            Buffer.from(expectedSig)
        );

        if (!isValid) {
            throw new Error('Invalid cursor signature');
        }

        return combined.data;
    } catch (error) {
        throw new Error('Invalid or tampered cursor');
    }
}

module.exports = { encodeCursor, decodeCursor };
