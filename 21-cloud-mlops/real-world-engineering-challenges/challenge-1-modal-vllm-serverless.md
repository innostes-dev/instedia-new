# Challenge 1: Serverless vLLM Inference Engine on Modal with Warm Container Pool

## 1. Scenario
Your startup has developed a custom fine-tuned Llama-3 model for financial analysis. Traffic is highly sporadic: heavy usage during market open (9:30 AM EST) and close (4:00 PM EST), but almost zero overnight.
Running a dedicated A100 instance on AWS costs $3,000/month. You need to migrate this model to Modal, utilizing a serverless architecture to reduce costs by 80%, while maintaining a "Warm Pool" of 1 container to ensure zero cold-start latency for the first burst of morning traffic.

## 2. Architecture Diagram
```text
[Client / API Gateway]
        |
        | (HTTP POST /generate)
        v
============================================================
| MODAL SERVERLESS PLATFORM                                |
|                                                          |
|  [Volume: llama-3-finetune-weights] (Cached on disk)     |
|         |                                                |
|         +--> [Container 1 (Warm Pool)] <- Always ON      |
|         |        (vLLM Engine Loaded in VRAM)            |
|         |                                                |
|         +--> [Container 2 (Cold Start)] <- Scales up     |
|         |        (Takes ~10s to boot & load weights)     |
|         |                                                |
|         +--> [Container N (Max 10)]                      |
============================================================
```

## 3. Starter Template
`app.py`
```python
import modal
from pydantic import BaseModel

# TODO: Define the Modal Image (Debian, install vLLM)
# TODO: Define the Modal Volume

# app = modal.App("fin-llama-api")

class GenerationRequest(BaseModel):
    prompt: str
    max_tokens: int = 100

# TODO: Create a class with @app.cls(...)
# Ensure it uses an A10G GPU, keeps 1 container warm, and limits concurrency to 10.
# Inside the class, use @modal.enter() to load the vLLM engine ONCE per container.
# Create a @modal.web_endpoint to handle HTTP POST requests.
```

## 4. Production Solution Walkthrough

### The Code (`app.py`)
```python
import modal
from pydantic import BaseModel

# 1. Image Definition
# We use vLLM for high-throughput inference
image = modal.Image.debian_slim().pip_install(
    "vllm==0.4.0",
    "huggingface_hub"
)

# 2. Volume for Weights Cache
# This prevents downloading 15GB from HF on every cold start
volume = modal.Volume.from_name("fin-llama-weights", create_if_missing=True)

app = modal.App("fin-llama-api")

# Optional: A function to pre-download weights to the volume if needed
def download_weights():
    from huggingface_hub import snapshot_download
    snapshot_download("meta-llama/Meta-Llama-3-8B-Instruct", local_dir="/data/model")

class GenerationRequest(BaseModel):
    prompt: str
    max_tokens: int = 100
    temperature: float = 0.2 # Low temp for financial facts

# 3. The Serverless Class Definition
@app.cls(
    image=image.run_function(download_weights, volumes={"/data": volume}),
    gpu="A10G",
    keep_warm=1,                # The Warm Pool (Always pay for 1 GPU)
    concurrency_limit=10,       # Max scale up
    container_idle_timeout=120, # Scale down after 2 minutes of idle
    volumes={"/data": volume}
)
class FinancialLLM:
    @modal.enter()
    def setup(self):
        """Runs once when the container boots. Loads model to VRAM."""
        from vllm import LLM
        print("Initializing vLLM Engine...")
        # We load from the local volume, NOT the internet
        self.llm = LLM(model="/data/model", tensor_parallel_size=1)
        print("Engine Ready.")

    @modal.web_endpoint(method="POST")
    def generate(self, req: GenerationRequest):
        """Runs on every HTTP request."""
        from vllm import SamplingParams

        sampling_params = SamplingParams(
            temperature=req.temperature,
            max_tokens=req.max_tokens
        )

        outputs = self.llm.generate([req.prompt], sampling_params)
        return {"result": outputs[0].outputs[0].text}
```

## 5. Test Suite (Jest + Supertest for Node.js API Gateway)
If you are building a Node.js API Gateway in front of this Modal app, here is how you test it.

`package.json`
```json
{
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

`modal.test.js`
```javascript
const axios = require('axios');

// Replace with your deployed Modal URL
const MODAL_URL = process.env.MODAL_API_URL || "https://your-workspace--fin-llama-api-financialllm-generate.modal.run";

describe('Serverless vLLM Inference API', () => {

    // Increase timeout because if the warm pool is occupied, we might hit a cold start (~15s)
    jest.setTimeout(30000);

    it('should return a generated financial summary', async () => {
        const payload = {
            prompt: "Summarize the impact of rising interest rates on tech stocks.",
            max_tokens: 50,
            temperature: 0.1
        };

        const response = await axios.post(MODAL_URL, payload);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('result');
        expect(typeof response.data.result).toBe('string');
        expect(response.data.result.length).toBeGreaterThan(10);
    });

    it('should reject invalid payloads', async () => {
        try {
            // Missing prompt
            await axios.post(MODAL_URL, { max_tokens: 10 });
        } catch (error) {
            expect(error.response.status).toBe(422); // FastAPI/Modal Validation Error
        }
    });
});
```