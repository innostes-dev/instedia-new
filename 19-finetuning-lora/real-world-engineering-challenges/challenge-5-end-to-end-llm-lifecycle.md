# Challenge 5: End-to-End LLM Lifecycle

## Architecture Diagram
```text
[ 1. Data Collection & Formatting (ChatML) ]
                    |
                    v
[ 2. Parameter-Efficient Tuning (QLoRA) ]
                    |
                    v
[ 3. Evaluation & Checkpointing ]
                    |
                    v
[ 4. Merge & Quantization (AWQ/GGUF) ]
                    |
                    v
[ 5. High-Throughput Serving (vLLM/Ollama) ]
```

## Challenge Overview
This is the Boss Level. You are tasked with designing the architecture and standard operating procedure (SOP) for taking an open-source model (Llama-3 8B) and deploying a fine-tuned version for a healthcare client.
Your task is to write a Markdown-formatted SOP document (conceptual code) that stitches together the concepts from Modules 1, 2, and 3.

Define:
1. The exact dataset format (ChatML) mapping script.
2. The exact LoRA/QLoRA VRAM calculation to prove to the CFO that you only need a 24GB GPU, not a $30,000 A100.
3. The training configuration (BitsAndBytes + LoraConfig).
4. The deployment command using vLLM for production.

## Solution Walkthrough
<details>
<summary>View the Complete Production SOP</summary>

# Standard Operating Procedure: Healthcare AI Lifecycle

### Phase 1: Data Formatting
We will use the HuggingFace `tokenizer.apply_chat_template` to ensure our raw medical Q&A pairs perfectly match Llama-3's expected token structure, preventing hallucination.

```python
# SOP Script 1: formatting.py
def format_healthcare_data(raw_db_records, tokenizer):
    formatted_dataset = []
    for record in raw_db_records:
        messages = [
            {"role": "system", "content": "You are a clinical assistant. Output strictly in JSON format."},
            {"role": "user", "content": record["patient_symptoms"]},
            {"role": "assistant", "content": record["doctor_diagnosis_json"]}
        ]
        # Applies model-specific tokens (e.g., <|start_header_id|>)
        text = tokenizer.apply_chat_template(messages, tokenize=False)
        formatted_dataset.append({"text": text})
    return formatted_dataset
```

### Phase 2: CFO VRAM Justification
We will use QLoRA.
*   **Base Weights (4-bit NF4):** 8B * 0.5 = 4.0 GB
*   **LoRA Adapter (r=16, ~0.5% params):** ~0.04B params.
*   **Gradients (16-bit):** 0.04 * 2 = 0.08 GB
*   **Optimizer States (8-bit Adam):** 0.04 * 1 * 2 = 0.08 GB
*   **Activations:** ~4 GB (depending on batch size)
**Total VRAM Required:** ~8.16 GB.
**Hardware Request:** We can train this on a standard RTX 3090/4090 or a cheap AWS `g4dn.xlarge` instance ($0.52/hour), saving the company thousands of dollars compared to full fine-tuning.

### Phase 3: The Training Configuration
```python
# SOP Script 2: train.py
from peft import LoraConfig
from transformers import BitsAndBytesConfig, TrainingArguments

# 4-bit Quantization of base model
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16
)

# LoRA targeting all linear layers for maximum domain adaptation
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules="all-linear",
    bias="none",
    task_type="CAUSAL_LM"
)

# Training args optimized for single consumer GPU
training_args = TrainingArguments(
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    optim="paged_adamw_8bit",
    bf16=True,
    output_dir="./healthcare_lora"
)
# Pass to TRL SFTTrainer and run trainer.train()
```

### Phase 4: High-Concurrency Deployment
Once trained, we merge the `.safetensors` and deploy via vLLM. Because we expect high traffic during clinic hours, we must use PagedAttention to prevent OOM errors.

```bash
# SOP Script 3: deploy.sh
# We allocate 95% of GPU memory to maximize the KV Cache
# for continuous batching of concurrent physician requests.

python -m vllm.entrypoints.openai.api_server \
    --model ./healthcare_merged_model \
    --gpu-memory-utilization 0.95 \
    --max-model-len 4096 \
    --port 8080
```
This API server perfectly mimics the OpenAI API, meaning our frontend developers can use standard OpenAI SDKs by just pointing the `base_url` to `http://our-server-ip:8080/v1`.
</details>
