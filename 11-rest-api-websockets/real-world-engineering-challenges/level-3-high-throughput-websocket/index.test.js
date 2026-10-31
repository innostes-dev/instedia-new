const { createChatServer } = require('./index.solution.js');
const WebSocket = require('ws');

describe('High-Throughput WebSocket Server', () => {
    let serverObj;
    const PORT = 8092;

    beforeAll((done) => {
        serverObj = createChatServer(PORT);
        serverObj.wss.on('listening', done);
    });

    afterAll((done) => {
        serverObj.wss.clients.forEach(client => client.close());
        serverObj.wss.close(done);
    });

    it('should route private messages correctly', (done) => {
        const client1 = new WebSocket(`ws://localhost:${PORT}/?userId=alice`);
        const client2 = new WebSocket(`ws://localhost:${PORT}/?userId=bob`);

        // Wait for both to be open
        let openCount = 0;
        const checkOpen = () => {
            openCount++;
            if (openCount === 2) {
                client1.send(JSON.stringify({
                    type: 'PRIVATE_MSG',
                    targetId: 'bob',
                    text: 'Hello Bob!'
                }));
            }
        };

        client1.on('open', checkOpen);
        client2.on('open', checkOpen);

        client2.on('message', (data) => {
            // ws module sometimes returns buffer, convert to string
            const dataStr = data.toString();
            const parsed = JSON.parse(dataStr);
            expect(parsed.from).toBe('alice');
            expect(parsed.text).toBe('Hello Bob!');

            client1.close();
            client2.close();
            done();
        });
    });
});
