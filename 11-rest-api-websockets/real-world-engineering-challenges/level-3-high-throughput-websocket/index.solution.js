const WebSocket = require('ws');

function createChatServer(port) {
    const wss = new WebSocket.Server({ port });
    const clientMap = new Map(); // userId -> ws instance

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, 'http://localhost');
        const userId = url.searchParams.get('userId');

        if (!userId) {
            ws.close(1008, "userId required");
            return;
        }

        // 1. Setup Heartbeat properties
        ws.isAlive = true;
        ws.userId = userId;
        ws.on('pong', () => { ws.isAlive = true; });

        // 2. Map the client
        clientMap.set(userId, ws);

        // 3. Handle messages
        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'PRIVATE_MSG' && parsed.targetId) {
                    const targetWs = clientMap.get(parsed.targetId);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify({
                            from: userId,
                            text: parsed.text
                        }));
                    }
                }
            } catch (err) {
                // Ignore malformed JSON
            }
        });

        // 4. Cleanup on close
        ws.on('close', () => {
            clientMap.delete(userId);
        });
    });

    // 5. Ping Interval
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                clientMap.delete(ws.userId);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 10000);

    wss.on('close', () => clearInterval(interval));

    return { wss, clientMap };
}

module.exports = { createChatServer };
