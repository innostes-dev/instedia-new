const { encodeCursor, decodeCursor } = require('./index.solution.js'); // Point to solution

describe('Cryptographic Cursor', () => {
    const SECRET = 'super-secret-key-123';

    it('should encode and decode a valid cursor', () => {
        const payload = { id: 105, sortBy: 'createdAt' };
        const cursor = encodeCursor(payload, SECRET);

        expect(typeof cursor).toBe('string');

        const decoded = decodeCursor(cursor, SECRET);
        expect(decoded).toEqual(payload);
    });

    it('should throw an error if the cursor was tampered with', () => {
        const payload = { id: 105 };
        const cursor = encodeCursor(payload, SECRET);

        // Tamper with the base64 string directly
        const decodedStr = Buffer.from(cursor, 'base64').toString('utf-8');
        const combined = JSON.parse(decodedStr);

        // Malicious user changes ID
        combined.data.id = 999;

        const tamperedCursor = Buffer.from(JSON.stringify(combined)).toString('base64');

        expect(() => {
            decodeCursor(tamperedCursor, SECRET);
        }).toThrow('Invalid or tampered cursor');
    });

    it('should throw an error if parsed with wrong secret', () => {
        const payload = { id: 105 };
        const cursor = encodeCursor(payload, SECRET);

        expect(() => {
            decodeCursor(cursor, 'wrong-secret');
        }).toThrow('Invalid or tampered cursor');
    });
});
