async function resilientPut(url, data, maxRetries = 3) {
    let delay = 100;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error; // Throw on final failure
            }

            // Wait with exponential backoff before next attempt
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

module.exports = { resilientPut };
