# Real-World Engineering Challenge 3: NVIDIA CUDA vLLM Container

## The Challenge Scenario
You are building the inference backend for a new AI startup. You need to host the `meta-llama/Llama-2-7b-chat-hf` Large Language Model. Raw PyTorch is far too slow for concurrent users, so you have chosen to use **vLLM**, a high-throughput memory-efficient inference engine.

You need to deploy this engine on a massive on-premise server with 4 NVIDIA A100 GPUs.

Your task is to write a `docker-compose.yml` to deploy this inference engine with the following strict production requirements:

### Strict Requirements
1. **The Base Image:** Use the official `vllm/vllm-openai:latest` image.
2. **GPU Allocation:** You must give the container access to **all** available GPUs using the `deploy.resources` syntax.
3. **Shared Memory (The Catch):** PyTorch and vLLM use POSIX shared memory (`/dev/shm`) to communicate rapidly between multiple GPU processes. The default Docker shared memory limit is 64MB, which will instantly crash a 7B parameter LLM. You must configure the container to have at least **8GB** of shared memory.
4. **HuggingFace Token:** Llama-2 is a gated model. You must pass a HuggingFace API token to the container securely using an environment variable read from a local `.env` file.
5. **Model Weights Caching:** The Llama-2 model is ~14GB. You must mount a named volume so the model weights are not re-downloaded every time the container restarts.
6. **Command Override:** You must override the default command to serve the `meta-llama/Llama-2-7b-chat-hf` model, and specifically configure it to use tensor parallelism across 2 GPUs (`--tensor-parallel-size 2`).

---

## Starter Template
Create a `docker-compose.yml` file. Use this skeleton:

```yaml
version: '3.8'

services:
  llm-inference:
    image: vllm/vllm-openai:latest
    # TODO: Read environment variables from a .env file (for HF_TOKEN)
    # TODO: Map port 8000
    # TODO: Mount a named volume "hf_cache" to /root/.cache/huggingface
    # TODO: Increase the shared memory size (shm_size) to 8gb
    # TODO: Add the command to run the model with tensor parallel size 2
    # TODO: Add the deploy block to reserve all NVIDIA GPUs

# TODO: Declare the hf_cache volume
```

---

<details>
<summary><b>Click for Full Production Solution & Walkthrough</b></summary>

### The Complete Production docker-compose.yml

```yaml
version: '3.8'

services:
  llm-inference:
    image: vllm/vllm-openai:latest
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - hf_cache:/root/.cache/huggingface

    # CRITICAL: Increase shared memory for PyTorch multi-processing
    shm_size: '8gb'

    # Command override to specify model and GPU distribution
    command: >
      --model meta-llama/Llama-2-7b-chat-hf
      --tensor-parallel-size 2
      --max-model-len 4096

    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

volumes:
  hf_cache:
```

*(Note: You would also need a `.env` file in the same directory containing `HUGGING_FACE_HUB_TOKEN=hf_your_secure_token_here`)*

### Walkthrough & Architecture Notes

1. **The Shared Memory Trap (`shm_size`):** This is the #1 reason AI/ML containers crash in production. When splitting a massive model across multiple GPUs (Tensor Parallelism), the underlying PyTorch processes must exchange gigabytes of tensors instantly. They do this by reading/writing to RAM via `/dev/shm`. Docker limits this to 64MB by default to prevent a single container from freezing the host OS. Bumping `shm_size: '8gb'` removes this bottleneck.
2. **Tensor Parallelism (`--tensor-parallel-size 2`):** This tells vLLM to physically slice the neural network in half. Half of the model weights are loaded into GPU 0, and the other half into GPU 1. This allows you to run models that are larger than the VRAM of a single GPU, and significantly speeds up inference.
3. **Environment Secrets (`env_file`):** By using `env_file: - .env`, Docker will automatically parse your local `.env` file and inject the variables. The vLLM engine is built on top of the HuggingFace `transformers` library, which automatically looks for an environment variable named `HUGGING_FACE_HUB_TOKEN` (or similar, depending on the exact version) to authenticate downloads of gated models like Llama-2.
4. **Volume Caching (`hf_cache`):** Downloading 14GB of safetensors every time you run `docker-compose up` is not viable. By mapping `/root/.cache/huggingface` to a named volume, the model is downloaded once and stored on the host. Subsequent startups take seconds instead of minutes.
</details>
