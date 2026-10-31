// starter code
async function parseSSEStream(readableStream) {
    const reader = readableStream.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    const results = [];

    // TODO: 1. while (true) loop to read()
    // TODO: 2. Append decoded value to buffer
    // TODO: 3. Find indexOf('\n\n')
    // TODO: 4. Extract frame, check for 'data: ' prefix
    // TODO: 5. If [DONE], break and return results.
    // TODO: 6. Parse JSON and push to results array.

    throw new Error('Not implemented');
}

module.exports = { parseSSEStream };
