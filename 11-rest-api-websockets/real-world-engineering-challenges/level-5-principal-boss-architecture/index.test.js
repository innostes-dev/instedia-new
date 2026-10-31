const request = require('supertest');
const WebSocket = require('ws');
const { createServer, messages } = require('./index.solution.js');

describe('Principal Boss Architecture', () => {
    let serverObj;
    const PORT = 8095; // Avoid conflicts

    beforeAll((done) => {
        serverObj = createServer();
        serverObj.server.listen(PORT, done);
    });

    afterAll((done) => {
        serverObj.wss.clients.forEach(client => client.close());
        serverObj.wss.close(() => {
            serverObj.server.close(done);
        });
    });

    it('should paginate messages using a base64 cursor', async () => {
        // Fetch first page (limit 1)
        const res1 = await request(serverObj.app)
            .get('/api/messages?limit=1');

        expect(res1.status).toBe(200);
        expect(res1.body.data).toHaveLength(1);
        expect(res1.body.data[0].id).toBe(2);
        expect(res1.body.nextCursor).toBeDefined();

        // Fetch second page using cursor
        const res2 = await request(serverObj.app)
            .get(`/api/messages?limit=1&cursor=${res1.body.nextCursor}`);

        expect(res2.status).toBe(200);
        expect(res2.body.data).toHaveLength(1);
        expect(res2.body.data[0].id).toBe(1);
    });

    it('should create a message and broadcast it via WebSocket', (done) => {
        const client = new WebSocket(`ws://localhost:${PORT}`);

        client.on('open', async () => {
            // Trigger REST POST
            const postRes = await request(serverObj.app)
                .post('/api/messages')
                .send({ text: 'Third' });

            expect(postRes.status).toBe(201);
            expect(postRes.headers.location).toBeDefined();
            expect(postRes.body.text).toBe('Third');
            expect(postRes.body.id).toBe(3);
        });

        client.on('message', (data) => {
            const dataStr = data.toString();
            const parsed = JSON.parse(dataStr);
            expect(parsed.text).toBe('Third');
            expect(parsed.id).toBe(3);
            client.close();
            done();
        });
    });
});
