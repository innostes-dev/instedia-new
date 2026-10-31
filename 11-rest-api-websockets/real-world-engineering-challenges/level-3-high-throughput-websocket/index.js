const WebSocket = require('ws');

// starter code
function createChatServer(port) {
    const wss = new WebSocket.Server({ port });

    // We need a way to map a User ID to a WebSocket connection
    const clientMap = new Map();

    wss.on('connection', (ws, req) => {
        // Assume the URL is /?userId=123
        const url = new URL(req.url, 'http://localhost');
        const userId = url.searchParams.get('userId');

        if (!userId) return ws.close(1008, "userId required");

        // TODO: 1. Setup heartbeat (isAlive flag and pong listener)
        // TODO: 2. Add to clientMap
        // TODO: 3. Handle incoming 'message' events. Parse JSON.
        //          If type is PRIVATE_MSG, find targetId in clientMap and send text.
        // TODO: 4. Handle 'close' event (remove from clientMap)
    });

    // TODO: 5. Setup setInterval for Ping/Pong checking every 10s.
    //          Terminate dead clients.

    return { wss, clientMap };
}

module.exports = { createChatServer };
