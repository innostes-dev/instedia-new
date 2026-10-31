const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Mock Database (Newest first)
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

    // TODO: Implement GET /api/messages with cursor pagination

    // TODO: Implement POST /api/messages
    // - Assign ID (messages[0].id + 1)
    // - Unshift to messages array
    // - Broadcast to all wss.clients
    // - Return 201 with Location header

    return { server, wss, app };
}

module.exports = { createServer, messages };
