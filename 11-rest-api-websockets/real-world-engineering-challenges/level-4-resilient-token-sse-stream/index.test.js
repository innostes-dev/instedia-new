const { parseSSEStream } = require('./index.solution.js'); // Point to solution

// Utility to mock a ReadableStream emitting byte chunks over time
function createMockStream(chunks) {
    return new ReadableStream({
        async start(controller) {
            for (const chunk of chunks) {
                const encoded = new TextEncoder().encode(chunk);
                controller.enqueue(encoded);
                // Tiny artificial delay
                await new Promise(r => setTimeout(r, 10));
            }
            controller.close();
        }
    });
}

describe('SSE Stream Parser', () => {
    it('should correctly parse fragmented SSE data', async () => {
        // We simulate a network splitting a frame exactly in the middle of a JSON object
        const mockChunks = [
            'data: {"token":"He',
            'llo"}\n\n',
            'data: {"token":" World"}\n\ndata: [DONE]\n\n'
        ];

        const stream = createMockStream(mockChunks);
        const results = await parseSSEStream(stream);

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ token: "Hello" });
        expect(results[1]).toEqual({ token: " World" });
    });

    it('should handle missing [DONE] gracefully if stream closes', async () => {
        const mockChunks = [
            'data: {"token":"AI"}\n\n'
        ];

        const stream = createMockStream(mockChunks);
        const results = await parseSSEStream(stream);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ token: "AI" });
    });
});
