# Challenge 5: Global Multi-Region Serverless AI Architecture with Fallback Routing

## 1. Scenario
Your enterprise application serves AI generation to users globally. You are using Serverless GPU endpoints (like RunPod or Modal) because traffic is unpredictable.
However, deploying to only one region (e.g., US-East) means users in Tokyo experience 400ms of network latency *before* generation even starts. Furthermore, if the US-East serverless platform goes down, your app crashes entirely.
You need to build a robust Express.js API Gateway that implements:
1. **Latency-based Routing:** Routes users to the closest available serverless GPU (US vs EU vs Asia).
2. **High-Availability Fallback:** If the primary Serverless GPU platform (e.g., your custom Llama-3) is down or returns a 500 error, automatically fallback to a managed SaaS API (e.g., OpenAI/Anthropic) to ensure the user gets an answer.

## 2. Architecture Diagram
```text
                          [Global User Request]
                                   | (Headers: User-Location: EU)
                                   v
                      [Express.js Global API Gateway]
                                   |
             +---------------------+---------------------+
             | (Routing Logic based on Location)         |
             v                                           v
    [Primary: EU Serverless GPU]             [Primary: US Serverless GPU]
      (Modal / RunPod - Llama 3)               (Modal / RunPod - Llama 3)
             |                                           |
             +-> If SUCCESS: Return                      +-> If SUCCESS: Return
             |                                           |
             +-> If ERROR/TIMEOUT: ----------------------+
                                   |
                                   v
                    [FALLBACK: OpenAI SaaS API]
             (Expensive, but guarantees 99.99% uptime)
```

## 3. Starter Template
`gateway.js`
```javascript
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Dictionary of our Serverless GPU endpoints globally
const SERVERLESS_ENDPOINTS = {
    'US': 'https://us-east.runpod.ai/v2/your-endpoint/runsync',
    'EU': 'https://eu-west.runpod.ai/v2/your-endpoint/runsync',
    'ASIA': 'https://jp-tokyo.runpod.ai/v2/your-endpoint/runsync'
};

app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body;
    // Assume a Geo-IP load balancer injected this header
    const userRegion = req.headers['x-user-region'] || 'US';

    try {
        // TODO: 1. Determine the correct Serverless GPU URL based on userRegion

        // TODO: 2. Attempt to call the Serverless GPU with a strict timeout (e.g., 5 seconds)
        // If successful, return the response.

    } catch (error) {
        // TODO: 3. Fallback Logic
        // If the serverless GPU timed out or crashed, log the error.
        // Fallback to OpenAI's GPT-4o-mini using the OpenAI SDK.
        // Return the OpenAI response to the user.
    }
});

module.exports = app;
```

## 4. Production Solution Walkthrough

### The Code (`gateway.js`)
```javascript
const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SERVERLESS_ENDPOINTS = {
    'US': 'https://us-east.runpod.ai/v2/custom-llama/runsync',
    'EU': 'https://eu-west.runpod.ai/v2/custom-llama/runsync',
    'ASIA': 'https://jp-tokyo.runpod.ai/v2/custom-llama/runsync'
};

app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body;

    // 1. Identify Region (Default to US if missing)
    const userRegion = req.headers['x-user-region'] ? req.headers['x-user-region'].toUpperCase() : 'US';
    const primaryUrl = SERVERLESS_ENDPOINTS[userRegion] || SERVERLESS_ENDPOINTS['US'];

    try {
        console.log(`[ROUTING] Attempting Primary Serverless in ${userRegion}`);

        // 2. Primary Serverless Call (with strict timeout)
        const response = await axios.post(
            primaryUrl,
            { input: { prompt: prompt } },
            {
                headers: { 'Authorization': `Bearer ${process.env.RUNPOD_KEY}` },
                timeout: 5000 // 5-second timeout is critical. Users won't wait forever.
            }
        );

        // Assume RunPod returns { output: { text: "..." } }
        return res.json({
            source: `Serverless-${userRegion}`,
            text: response.data.output.text
        });

    } catch (error) {
        // 3. Fallback Logic triggered by Timeout or 5xx Error
        console.warn(`[FALLBACK] Primary failed (${error.message}). Falling back to OpenAI...`);

        try {
            const fallbackResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }]
            });

            return res.json({
                source: "Fallback-OpenAI",
                text: fallbackResponse.choices[0].message.content
            });

        } catch (fallbackError) {
            // Absolute worst-case scenario: both our infrastructure AND OpenAI are down.
            console.error("[CRITICAL] Fallback also failed!", fallbackError);
            return res.status(500).json({ error: "Service currently unavailable." });
        }
    }
});

if (require.main === module) {
    app.listen(3000, () => console.log('Global API Gateway running.'));
}
module.exports = app;
```

## 5. Test Suite (Jest + Supertest)

`package.json`
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

`gateway.test.js`
```javascript
const request = require('supertest');
const axios = require('axios');
const app = require('./gateway');

// Mock Axios for the Serverless calls
jest.mock('axios');

// Mock OpenAI SDK
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => {
            return {
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: "OpenAI Fallback Answer" } }]
                        })
                    }
                }
            };
        })
    };
});

describe('Global API Gateway Routing & Fallback', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should route to EU serverless based on headers and return success', async () => {
        // Mock successful RunPod response
        axios.post.mockResolvedValueOnce({
            data: { output: { text: "Serverless EU Answer" } }
        });

        const res = await request(app)
            .post('/api/generate')
            .set('x-user-region', 'EU')
            .send({ prompt: "Hello" });

        expect(res.status).toBe(200);
        expect(res.body.source).toBe('Serverless-EU');
        expect(res.body.text).toBe('Serverless EU Answer');

        // Assert Axios was called with the EU URL
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('eu-west'),
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('should fallback to OpenAI when Serverless times out', async () => {
        // Mock Axios throwing a Timeout Error
        axios.post.mockRejectedValueOnce(new Error("timeout of 5000ms exceeded"));

        const res = await request(app)
            .post('/api/generate')
            .set('x-user-region', 'US')
            .send({ prompt: "Hello" });

        expect(res.status).toBe(200);
        // Ensure the response came from the fallback
        expect(res.body.source).toBe('Fallback-OpenAI');
        expect(res.body.text).toBe('OpenAI Fallback Answer');
    });
});
```