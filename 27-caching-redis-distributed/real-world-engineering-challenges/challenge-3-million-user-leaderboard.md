# Challenge 3: Million-User Real-Time Leaderboard

## Business Scenario
You are developing a wildly popular mobile puzzle game. During weekly tournaments, over 1 million concurrent players are completing puzzles, scoring points, and checking their global ranking.

The product requirements state:
1. When a player completes a puzzle, their score must instantly update.
2. Players must be able to view the Top 10 leaderboard instantly.
3. Players must be able to see their *own* specific rank (e.g., "You are rank #42,109"), along with the 2 players directly above them and 2 players directly below them (the "Surrounding Leaderboard").
4. Tied scores must be resolved so that the player who achieved the score *first* gets the higher rank.

You must design a Redis architecture utilizing Sorted Sets (`ZADD`, `ZRANGE`, `ZREVRANK`) to accomplish this with O(log(N)) performance.

## The Architecture Diagram

```text
    Player Data Storage                     Sorting Engine
    +-----------------+                  +-----------------+
    |   Redis Hashes  |                  | Redis Sorted Set|
    |                 |                  |                 |
    | user:101        |                  |                 |
    |  - name: "Alice"|                  |                 |
    |  - avatar: "a.png"                 | 101: 5000.xxx   |
    |                 |                  | 105: 4950.xxx   |
    | user:105        | <--- Maps to --- | 992: 4800.xxx   |
    |  - name: "Bob"  |                  |                 |
    |  - avatar: "b.png"                 |                 |
    +-----------------+                  +-----------------+
             |                                    ^
             v                                    |
     [ Node.js Aggregation ] <--- ZRANGE (Top 10) +
             |
     [ JSON to Client ]
```

## Starter Code Template (Node.js/Express)

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();
app.use(express.json());

const LEADERBOARD_KEY = 'tournament:weekly:scores';

app.post('/api/score', async (req, res) => {
    const { userId, points, username, avatar } = req.body;

    // TODO: Update user's metadata hash
    // TODO: Generate tie-breaking score
    // TODO: Add to Sorted Set

    res.json({ message: 'Score updated' });
});

app.get('/api/leaderboard/surrounding/:userId', async (req, res) => {
    const { userId } = req.params;

    // TODO: Find the user's exact rank
    // TODO: Fetch the 2 users above and 2 users below
    // TODO: Fetch metadata for those 5 users and return

    res.json({ surrounding: [] });
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Game Server running on 3000'));
};
start();
```

---

## Full Production Solution Walkthrough

### The Complete Implementation

```javascript
const express = require('express');
const { createClient } = require('redis');

const app = express();
const redisClient = createClient();
app.use(express.json());

const LEADERBOARD_KEY = 'tournament:weekly:scores';
// E.g., year 2100. Used to calculate tie-breakers.
const MAX_TIMESTAMP = 4102444800000;

// Helper: Generates score with time-based decimal for tie-breaking (older = higher decimal)
const generateTieBreakingScore = (baseScore) => {
    const now = Date.now();
    const timeFraction = (MAX_TIMESTAMP - now) / MAX_TIMESTAMP;
    return baseScore + timeFraction;
};

// Helper: strips the decimal for display to the user
const displayScore = (redisScore) => Math.floor(redisScore);

app.post('/api/score', async (req, res) => {
    const { userId, points, username, avatar } = req.body;

    try {
        // We use a transaction (MULTI) to ensure both Hash and Set update atomically
        const multi = redisClient.multi();

        // 1. Store/Update Metadata
        const userHashKey = `user:${userId}`;
        multi.hSet(userHashKey, {
            username: username,
            avatar: avatar
        });

        // 2. We don't use ZINCRBY because we need to recalculate the time fraction based on *now*.
        // First we get the current score (if it exists)
        const currentData = await redisClient.zScore(LEADERBOARD_KEY, userId);
        let newBaseScore = points;

        if (currentData) {
            newBaseScore += Math.floor(currentData);
        }

        const finalScore = generateTieBreakingScore(newBaseScore);

        // Update the sorted set
        multi.zAdd(LEADERBOARD_KEY, { score: finalScore, value: userId });

        await multi.exec();

        res.json({ message: 'Score updated successfully', newTotal: newBaseScore });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/api/leaderboard/surrounding/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // 1. Find the user's exact Rank (0-indexed)
        const userRank = await redisClient.zRevRank(LEADERBOARD_KEY, userId);

        if (userRank === null) {
            return res.status(404).json({ message: 'User not on leaderboard' });
        }

        // 2. Calculate the slice boundaries (2 above, 2 below)
        // If rank is 1 (index 1), start = max(0, 1-2) = 0.
        const startIndex = Math.max(0, userRank - 2);
        const endIndex = userRank + 2;

        // 3. Fetch the surrounding IDs and their Scores
        const surroundingData = await redisClient.zRangeWithScores(
            LEADERBOARD_KEY,
            startIndex,
            endIndex,
            { REV: true }
        );

        // 4. Fetch the Metadata for these users concurrently
        const enrichedPromises = surroundingData.map(async (item, index) => {
            const uid = item.value;
            const metadata = await redisClient.hGetAll(`user:${uid}`);

            return {
                rank: startIndex + index + 1, // +1 because ranks are 1-based to the user
                userId: uid,
                username: metadata.username,
                avatar: metadata.avatar,
                score: displayScore(item.score)
            };
        });

        const enrichedLeaderboard = await Promise.all(enrichedPromises);

        res.json({
            myRank: userRank + 1,
            surrounding: enrichedLeaderboard
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

const start = async () => {
    await redisClient.connect();
    app.listen(3000, () => console.log('Game Server running on 3000'));
};
start();
```

### Test Suite (Jest + Supertest)

```javascript
// __tests__/leaderboard.test.js
const request = require('supertest');
const { app, redisClient } = require('../app');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Million-User Leaderboard', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.flushAll();
        await redisClient.quit();
    });

    it('should correctly rank users and resolve ties based on time', async () => {
        // 1. Alice scores 100 at T=0
        await request(app).post('/api/score').send({ userId: 'u1', points: 100, username: 'Alice', avatar: 'a.png' });

        await delay(100); // 100ms later

        // 2. Bob scores 100 at T=100
        await request(app).post('/api/score').send({ userId: 'u2', points: 100, username: 'Bob', avatar: 'b.png' });

        // 3. Charlie scores 50
        await request(app).post('/api/score').send({ userId: 'u3', points: 50, username: 'Charlie', avatar: 'c.png' });

        // Fetch surrounding for Bob (who should be rank 2)
        const res = await request(app).get('/api/leaderboard/surrounding/u2');

        expect(res.status).toBe(200);

        const board = res.body.surrounding;

        // Assertions
        expect(board.length).toBe(3); // Only 3 users exist

        // Rank 1: Alice (Achieved 100 first)
        expect(board[0].username).toBe('Alice');
        expect(board[0].rank).toBe(1);
        expect(board[0].score).toBe(100);

        // Rank 2: Bob (Achieved 100 second)
        expect(board[1].username).toBe('Bob');
        expect(board[1].rank).toBe(2);
        expect(board[1].score).toBe(100);

        // Rank 3: Charlie
        expect(board[2].username).toBe('Charlie');
        expect(board[2].rank).toBe(3);
        expect(board[2].score).toBe(50);
    });
});
```

### Pro-Tips for Production
1. **Pipeline over Promise.all:** In the `surrounding/:userId` route, we use `Promise.all` with `hGetAll`. This sends 5 separate network requests to Redis. In production, use `redisClient.multi()` to queue up all 5 `hGetAll` commands and execute them in a single network round-trip.
2. **Cleanup/Archiving:** A Sorted Set with 5 million users uses significant RAM. At the end of the weekly tournament, rename the key (`RENAME tournament:weekly:scores archive:week42`), set an expiration on the archive key, and let next week's requests naturally recreate the `tournament:weekly:scores` key.
