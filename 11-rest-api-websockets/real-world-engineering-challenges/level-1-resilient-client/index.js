// starter code
async function resilientPut(url, data, maxRetries = 3) {
    // TODO: Implement the resilient PUT client
    // 1. Use the global `fetch` API.
    // 2. Wrap it in a retry loop.
    // 3. Catch errors and non-OK responses.
    // 4. Implement exponential backoff: await new Promise(r => setTimeout(r, delay))
    // 5. Throw the final error if all retries fail.

    throw new Error('Not implemented');
}

module.exports = { resilientPut };
