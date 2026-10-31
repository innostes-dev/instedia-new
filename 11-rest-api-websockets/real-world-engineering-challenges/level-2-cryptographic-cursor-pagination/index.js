const crypto = require('crypto');

// starter code
function encodeCursor(payload, secret) {
    // 1. Stringify the payload
    // 2. Create HMAC-SHA256 of the string using the secret
    // 3. Create an object { data: payload, sig: signature }
    // 4. Base64 encode the stringified object

    throw new Error('Not implemented');
}

function decodeCursor(cursorBase64, secret) {
    // 1. Base64 decode to string
    // 2. Parse the JSON to get { data, sig }
    // 3. Re-calculate the HMAC-SHA256 of the stringified 'data'
    // 4. Compare the re-calculated sig with the provided sig using crypto.timingSafeEqual (or standard === for simplicity here)
    // 5. If match, return data. Else throw Error.

    throw new Error('Not implemented');
}

module.exports = { encodeCursor, decodeCursor };
