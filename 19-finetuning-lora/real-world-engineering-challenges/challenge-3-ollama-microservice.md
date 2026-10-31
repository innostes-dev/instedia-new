# Challenge 3: Production Ollama Microservice

## Architecture Diagram
```text
[ Client (cURL / Frontend) ]
           | (HTTP POST /generate)
           v
[ Express.js / Node.js Microservice ]
           | (HTTP POST /api/generate)
           v
[ Local Ollama Server (Port 11434) ] -> Runs Custom GGUF Model
```

## Challenge Overview
You have exported your GGUF model and built a custom `Modelfile`. Now, you need to expose this model securely to your frontend application. You should not expose the Ollama server directly to the internet.
Your task is to write a Node.js (Express) microservice that accepts user input, constructs a payload, queries the local Ollama instance, and returns the response. Write a basic Jest test to verify the route.

## Starter Template
```javascript
// server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'my_company_model';

app.post('/generate', async (req, res) => {
    // 1. TODO: Extract 'prompt' from req.body

    // 2. TODO: Send a POST request to OLLAMA_URL using axios

    // 3. TODO: Return the response text to the user
});

if (require.main === module) {
    app.listen(3000, () => console.log('Proxy running on port 3000'));
}
module.exports = app;
```

## Solution Walkthrough
<details>
<summary>View the Complete Production Solution</summary>

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// In production, these should be environment variables
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME = process.env.MODEL_NAME || 'my_company_model';

app.post('/generate', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Construct the payload for Ollama
        const ollamaPayload = {
            model: MODEL_NAME,
            prompt: prompt,
            stream: false // For simplicity, we wait for the full response
        };

        // Forward the request to the local Ollama instance
        const response = await axios.post(OLLAMA_URL, ollamaPayload);

        // Return just the generated text to our frontend
        return res.status(200).json({
            reply: response.data.response,
            model_used: MODEL_NAME
        });

    } catch (error) {
        console.error("Ollama Error:", error.message);
        return res.status(500).json({ error: 'Failed to communicate with LLM engine' });
    }
});

if (require.main === module) {
    app.listen(3000, () => console.log('LLM Proxy running on port 3000'));
}

module.exports = app;
```

### Test Suite (Jest & Supertest)
```javascript
// __tests__/server.test.js
const request = require('supertest');
const app = require('../server');
const axios = require('axios');

// Mock axios to prevent actual network calls during testing
jest.mock('axios');

describe('POST /generate', () => {
    it('should return 400 if prompt is missing', async () => {
        const res = await request(app).post('/generate').send({});
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toBe('Prompt is required');
    });

    it('should return 200 and the reply on success', async () => {
        // Mock the Ollama server response
        const mockOllamaResponse = {
            data: { response: 'This is a mocked LLM reply.' }
        };
        axios.post.mockResolvedValue(mockOllamaResponse);

        const res = await request(app)
            .post('/generate')
            .send({ prompt: 'Hello!' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.reply).toBe('This is a mocked LLM reply.');
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
});
```
</details>
