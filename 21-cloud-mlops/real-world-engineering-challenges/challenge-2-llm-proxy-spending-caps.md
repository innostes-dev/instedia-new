# Challenge 2: Production LLM Proxy with Semantic Caching & Per-User Spend Quotas

## 1. Scenario
You manage a platform where 5,000 independent users access a custom AI writing tool backed by OpenAI's `gpt-4o`.
Two problems are threatening to bankrupt the company:
1. Users frequently click "Generate" multiple times for the exact same prompt, causing duplicate API charges.
2. A small group of power users are consuming 90% of the API budget.
You need to implement an LLM Proxy (using Helicone as the backend service) within a Node.js/Express application. It must implement caching and enforce a strict $5.00 monthly spend limit per user.

## 2. Architecture Diagram
```text
[User Client]
     | (POST /api/write)
     v
[Express.js Backend API]
     |
     | 1. Intercepts request
     | 2. Appends Helicone Headers (User ID, Cache Rules)
     | 3. Appends Helicone Rate Limit / Spend Quota Headers
     |
     v
[Helicone Proxy Gateway (oai.hconeai.com)]
     |
     +-- Checks Cache -> HIT? -> Return instantly ($0)
     |
     +-- Checks Quota -> Over $5? -> Return 429 Error
     |
     +-- MISS & UNDER QUOTA -> Forward to OpenAI
     v
[OpenAI API (api.openai.com)]
```

## 3. Starter Template
`server.js`
```javascript
const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// TODO: Initialize the OpenAI client to point to Helicone's Base URL

app.post('/api/write', async (req, res) => {
    const { userId, topic } = req.body;

    if (!userId || !topic) {
        return res.status(400).json({ error: "Missing userId or topic" });
    }

    const prompt = `Write a short professional email about: ${topic}`;

    try {
        // TODO: Call the chat completions API.
        // You MUST pass extraHeaders to Helicone to:
        // 1. Authenticate with Helicone
        // 2. Enable Caching
        // 3. Track the specific userId
        // 4. Enforce a $5 limit per month using Helicone's Prompts feature (or headers)

        // res.json({ result: response.choices[0].message.content });
    } catch (error) {
        // TODO: Handle 429 quota exceeded errors gracefully
    }
});

module.exports = app;
```

## 4. Production Solution Walkthrough

### The Code (`server.js`)
```javascript
const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. Point the SDK to the Helicone Proxy
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://oai.hconeai.com/v1"
});

app.post('/api/write', async (req, res) => {
    const { userId, topic } = req.body;

    if (!userId || !topic) {
        return res.status(400).json({ error: "Missing userId or topic" });
    }

    const prompt = `Write a short professional email about: ${topic}`;

    try {
        // 2. Execute the call with dynamically injected headers
        const response = await openai.chat.completions.create(
            {
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
            },
            {
                // These headers control the proxy's behavior
                headers: {
                    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
                    "Helicone-User-Id": userId,
                    "Helicone-Cache-Enabled": "true",

                    // Advanced: Helicone Rate Limiting & Spend Quotas
                    // Syntax: [quota_amount] USD per [time_window]
                    "Helicone-Property-Plan": "Free",
                    "Helicone-RateLimit-Policy": "5.00;w=2592000;s=user" // $5 per 30 days (2592000s) segmented by User ID
                }
            }
        );

        res.json({ result: response.choices[0].message.content });

    } catch (error) {
        // 3. Graceful Error Handling for Quotas
        if (error.status === 429) {
            return res.status(429).json({
                error: "Monthly AI budget exceeded or rate limit hit. Please upgrade your plan."
            });
        }
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Only start the server if not imported in a test
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
```

## 5. Test Suite (Jest + Supertest)

`package.json`
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "openai": "^4.20.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

`server.test.js`
```javascript
const request = require('supertest');
const app = require('./server');

// Mock the OpenAI library so we don't actually hit the proxy during unit tests
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => {
            return {
                chat: {
                    completions: {
                        create: jest.fn((body, options) => {

                            // Extract headers to assert they were constructed correctly
                            const headers = options.headers;

                            // Simulate Quota Exceeded for a specific test user
                            if (headers['Helicone-User-Id'] === 'power_user_99') {
                                const error = new Error('Rate limit');
                                error.status = 429;
                                throw error;
                            }

                            // Simulate a successful response
                            return Promise.resolve({
                                choices: [{ message: { content: "Here is your email..." } }]
                            });
                        })
                    }
                }
            };
        })
    };
});

describe('POST /api/write (Proxy Gateway)', () => {

    it('should return 400 if userId is missing', async () => {
        const res = await request(app)
            .post('/api/write')
            .send({ topic: "Project Update" });
        expect(res.status).toBe(400);
    });

    it('should successfully route via proxy and return an email', async () => {
        const res = await request(app)
            .post('/api/write')
            .send({ userId: "normal_user_1", topic: "Project Update" });

        expect(res.status).toBe(200);
        expect(res.body.result).toContain("Here is your email");
    });

    it('should handle 429 Quota Exceeded gracefully based on proxy response', async () => {
        const res = await request(app)
            .post('/api/write')
            .send({ userId: "power_user_99", topic: "Project Update" });

        expect(res.status).toBe(429);
        expect(res.body.error).toContain("budget exceeded");
    });
});
```