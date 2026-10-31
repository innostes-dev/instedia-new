# Challenge 2: Realtime Collaborative Whiteboard

## Architecture Blueprint

This challenge builds a high-concurrency collaborative canvas (like Miro or Figma) using WebSockets, Redis Pub/Sub, and CRDTs (Conflict-free Replicated Data Types) for state merging.

**Core Requirements:**
1. **Room Architecture:** Users only receive updates for the specific whiteboard they are viewing.
2. **Presence & Cursors:** Broadcast live mouse movements and active user lists using ephemeral Redis TTLs.
3. **Horizontal Scalability:** The WebSocket servers must run across multiple Node.js processes, using Redis Pub/Sub as the backplane.
4. **State Synchronization:** Handle simultaneous drawing events without overwriting data (simulated via Operational Transformation or CRDTs).

## Starter Template (TypeScript/Socket.io/Yjs)

### Backend: Socket.io with Redis Adapter

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

// 1. Setup Redis Adapter for multi-server scaling
const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis Adapter connected');
});

io.on('connection', (socket) => {
  const { boardId, userId } = socket.handshake.query;

  if (!boardId || !userId) {
    return socket.disconnect();
  }

  // 2. Room Management
  socket.join(`board:${boardId}`);

  // TODO: Add user to Redis Set with a TTL to track active presence

  // 3. High-Frequency Cursor Broadcast
  socket.on('cursor_move', (pos: { x: number, y: number }) => {
    // Volatile prevents memory buffering if the network is slow
    socket.volatile.to(`board:${boardId}`).emit('cursor_update', {
      userId,
      pos
    });
  });

  // 4. CRDT/State Sync (Yjs or custom logic)
  socket.on('draw_event', (eventData) => {
    // Broadcast to everyone else in the room
    socket.to(`board:${boardId}`).emit('draw_event', eventData);

    // TODO: Persist eventData to database or a Yjs document on the server
  });

  socket.on('disconnect', () => {
    // TODO: Remove user from Redis Presence Set
  });
});

httpServer.listen(3000, () => console.log('WebSocket Server running'));
```

### Frontend: React Canvas

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export default function CollaborativeBoard({ boardId, userId }: { boardId: string, userId: string }) {
  const [cursors, setCursors] = useState<Record<string, {x: number, y: number}>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:3000', { query: { boardId, userId } });
    socketRef.current = socket;

    socket.on('cursor_update', (data) => {
      setCursors(prev => ({ ...prev, [data.userId]: data.pos }));
    });

    socket.on('draw_event', (eventData) => {
      // TODO: Draw the event on the local canvas
      drawOnCanvas(eventData);
    });

    return () => { socket.disconnect(); };
  }, [boardId, userId]);

  const drawOnCanvas = (data: any) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    // ... drawing logic based on data (x, y, color, etc)
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Throttling is necessary here!
    socketRef.current?.emit('cursor_move', { x: e.clientX, y: e.clientY });
  };

  const handleDraw = (e: React.MouseEvent) => {
    const eventData = { x: e.clientX, y: e.clientY, color: 'black' };
    drawOnCanvas(eventData); // Optimistic UI update
    socketRef.current?.emit('draw_event', eventData); // Sync to others
  };

  return (
    <div onMouseMove={handleMouseMove} onClick={handleDraw} style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} style={{ border: '1px solid black' }} />

      {/* Render Remote Cursors */}
      {Object.entries(cursors).map(([id, pos]) => (
        <div key={id} style={{
          position: 'absolute', left: pos.x, top: pos.y,
          width: 10, height: 10, backgroundColor: 'red', borderRadius: '50%',
          pointerEvents: 'none' // Don't block clicks
        }} />
      ))}
    </div>
  );
}
```

## Production Solution Walkthrough

1. **Redis Adapter (Scalability):** By configuring the `createAdapter` with Redis, we ensure that if User A connects to Node Server 1, and User B connects to Node Server 2, they can still communicate. Server 1 receives User A's `cursor_move` event, publishes it to the Redis channel `socket.io#board:123#cursor_move`, Server 2 subscribes to that channel, and forwards it to User B.
2. **Ephemeral Presence:** On connection, the server runs `redis.set(userKey, data, { EX: 30 })` and `redis.sAdd(roomKey, userId)`. The frontend sends a `socket.emit('heartbeat')` every 15 seconds to reset the 30-second TTL. If a user's internet drops, they stop sending heartbeats, their key expires, and a background cron job cleans them out of the active user set, broadcasting the updated presence list to the room.
3. **Cursor Throttling & Volatility:** The React `onMouseMove` event fires hundreds of times per second. We must wrap the `socket.emit` in a throttle function (e.g., `lodash.throttle(emit, 33)` for ~30 FPS). On the server, we use `socket.volatile.emit` so that if TCP buffers fill up, the packets are dropped rather than delayed, ensuring cursors never "rubber-band" or lag behind reality.
4. **State Merging (CRDT):** For drawing lines or adding shapes, naive "last write wins" will cause users to overwrite each other. In production, we integrate a CRDT library like **Yjs**. Instead of emitting custom `draw_event` payloads, we bind Yjs to the canvas. When a user draws, Yjs generates a mathematical delta. We broadcast that delta via WebSockets, and the remote Yjs instances merge it deterministically, guaranteeing all users end up with the exact same final image regardless of network latency or the order messages arrive.
