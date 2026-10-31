# Challenge Level 4: Resilient JWT Sliding Sessions

## 1. Scenario
You implemented an Access Token (15 mins) and a Refresh Token (7 days). But you have a UX problem. If an active user works on your dashboard for 8 days straight, on day 8 they are suddenly logged out and forced to re-enter their password, even though they were just clicking buttons! You need to implement a **Sliding Session**.

## 2. The Requirements
Build a `POST /auth/refresh` endpoint that implements a Sliding Window for the Refresh Token.
- The user sends their current Refresh Token.
- If it is valid, issue a new Access Token.
- **The Catch:** Check how close the Refresh Token is to expiring. If it is more than halfway through its 7-day lifespan (i.e., less than 3.5 days remaining), issue a *brand new* Refresh Token as well (resetting the 7-day clock).
- If it has more than 3.5 days remaining, DO NOT issue a new Refresh Token, just issue the Access Token.

## 3. Architecture Diagram
```text
Day 1: Login -> RT expires on Day 8
Day 2: Refresh -> RT expires on Day 8 (Not updated, > 50% time left)
Day 3: Refresh -> RT expires on Day 8 (Not updated, > 50% time left)
...
Day 5: Refresh -> (Time left is 3 days. This is < 3.5 days!)
          |
          V
[ Issues New Access Token ] AND [ Issues New RT (Expires Day 12) ]
```

## 4. Starter Template
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

const REFRESH_SECRET = 'refresh-secret';
const ACCESS_SECRET = 'access-secret';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HALF_LIFE_SEC = (7 * 24 * 60 * 60) / 2; // 3.5 days in seconds

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

    // TODO: Implement Sliding Session Logic
    // 1. Generate new Access Token
    // 2. Check `decoded.exp` (Expiration time in seconds) against current time
    // 3. If remaining time < HALF_LIFE_SEC, generate new Refresh Token
    // 4. Return tokens to client

  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
});

module.exports = app;
```

## 5. Solution Walkthrough

### The Code
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

const REFRESH_SECRET = 'refresh-secret';
const ACCESS_SECRET = 'access-secret';
const HALF_LIFE_SEC = (7 * 24 * 60 * 60) / 2;

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

    // 1. Always generate a new short-lived Access Token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    // 2. Calculate remaining time on the Refresh Token
    // Note: Date.now() is milliseconds, JWT exp is seconds.
    const currentTimeSec = Math.floor(Date.now() / 1000);
    const timeLeftSec = decoded.exp - currentTimeSec;

    let responseTokens = { accessToken: newAccessToken };

    // 3. The Sliding Window logic
    if (timeLeftSec < HALF_LIFE_SEC) {
      // The token is getting old. Issue a new one to extend the session!
      const newRefreshToken = jwt.sign(
        { userId: decoded.userId },
        REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // In a real app, you MUST invalidate the old refreshToken in your DB here!
      // db.blacklists.add(refreshToken);

      responseTokens.refreshToken = newRefreshToken;
    }

    // 4. Return the tokens
    res.json(responseTokens);

  } catch (err) {
    res.status(403).json({ error: 'Session expired, please log in again.' });
  }
});

module.exports = app;
```

### Why this is Principal Level
This perfectly balances Security and User Experience. If you reissue a Refresh Token on *every* request, your DB writes (for blacklisting old tokens) will skyrocket, crippling performance. By waiting until the token is halfway expired, you only write to the DB every 3.5 days per user, while guaranteeing active users NEVER get logged out unexpectedly.

## 6. Test Suite (Jest & Supertest)
```javascript
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('./app');

const REFRESH_SECRET = 'refresh-secret';

describe('Level 4: Sliding Sessions', () => {
  it('should reject missing token', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('should issue new access token but NO new refresh token if > 3.5 days remain', async () => {
    // Create token expiring in 6 days
    const validToken = jwt.sign({ userId: 1 }, REFRESH_SECRET, { expiresIn: '6d' });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: validToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined(); // Should not issue new RT
  });

  it('should issue new access token AND new refresh token if < 3.5 days remain', async () => {
    // Create token expiring in 2 days
    const oldToken = jwt.sign({ userId: 1 }, REFRESH_SECRET, { expiresIn: '2d' });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: oldToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined(); // SHOULD issue new RT
  });
});
```
