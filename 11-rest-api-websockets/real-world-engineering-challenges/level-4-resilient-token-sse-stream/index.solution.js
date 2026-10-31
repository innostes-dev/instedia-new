async function parseSSEStream(readableStream) {
    const reader = readableStream.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    const results = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            if (chunk.startsWith('data: ')) {
                const dataStr = chunk.substring(6); // remove 'data: '

                if (dataStr.trim() === '[DONE]') {
                    return results;
                }

                try {
                    const parsed = JSON.parse(dataStr);
                    results.push(parsed);
                } catch (e) {
                    // Ignore parse errors on malformed specific chunks
                }
            }

            boundary = buffer.indexOf('\n\n');
        }
    }

    return results;
}

module.exports = { parseSSEStream };
