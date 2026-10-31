const express = require('express');
const http = require('http');
const WebSocket = require('ws');

let messages = [
    { id: 2, text: 'Second' },
    { id: 1, text: 'First' }
];

function encodeCursor(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function decodeCursor(str) {
    if (!str) return null;
    return JSON.parse(Buffer.from(str, 'base64').toString('utf-8'));
}

function createServer() {
    const app = express();
    app.use(express.json());
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });

    app.get('/api/messages', (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        let cursorId = null;

        if (req.query.cursor) {
            try {
                const decoded = decodeCursor(req.query.cursor);
                cursorId = decoded.id;
            } catch (err) {
                return res.status(400).json({ error: 'Invalid cursor' });
            }
        }

        let startIndex = 0;
        if (cursorId) {
            const index = messages.findIndex(m => m.id === cursorId);
            startIndex = index >= 0 ? index + 1 : 0;
        }

        const data = messages.slice(startIndex, startIndex + limit);
        const nextCursor = data.length > 0 ? encodeCursor({ id: data[data.length - 1].id }) : null;

        res.json({ data, nextCursor });
    });

    app.post('/api/messages', (req, res) => {
        const text = req.body.text;
        if (!text) return res.status(400).json({ error: 'Missing text' });

        const newId = messages.length > 0 ? messages[0].id + 1 : 1;
        const newMsg = { id: newId, text };

        // Unshift adds to the beginning (newest first)
        messages.unshift(newMsg);

        // Broadcast
        const msgStr = JSON.stringify(newMsg);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msgStr);
            }
        });

        res.location(`/api/messages/${newId}`);
        res.status(201).json(newMsg);
    });

    return { server, wss, app };
}

module.exports = { createServer, messages };
