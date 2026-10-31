# Challenge 1: Domain-Specific LoRA Adapter Training

## Architecture Diagram
```text
[ Raw Financial Contracts (PDFs) ]
           | (Parsing & Formatting)
           v
[ JSONL ChatML Dataset ]
           |
+----------+-----------+
| Base: Mistral-7B (4-bit) |
| Adapter: LoRA (r=16)     |
+----------+-----------+
           | (SFTTrainer / PEFT)
           v
[ Output: adapter_model.safetensors ]
```

## Challenge Overview
You are building an AI tool for a law firm. The firm needs to extract specific clauses (like "Governing Law" and "Termination Date") from complex financial contracts. Base models fail because they hallucinate clauses that aren't there or output conversational text instead of raw JSON.
Your task is to write a script that configures a QLoRA training pipeline to fine-tune Mistral-7B to output strict JSON extractions.

## Starter Template
```python
import torch
from peft import LoraConfig
from transformers import BitsAndBytesConfig, TrainingArguments

def get_financial_lora_pipeline():
    """Configure the QLoRA setup for financial contract extraction."""
    # 1. TODO: Define BitsAndBytesConfig for 4-bit NF4 training
    bnb_config = None

    # 2. TODO: Define LoraConfig (r=16, target all linear layers)
    lora_config = None

    # 3. TODO: Define TrainingArguments (batch size 2, 100 steps)
    training_args = None

    return bnb_config, lora_config, training_args
```

## Solution Walkthrough
<details>
<summary>View the Complete Production Solution</summary>

```python
import torch
from peft import LoraConfig
from transformers import BitsAndBytesConfig, TrainingArguments

def get_financial_lora_pipeline():
    """Configure the QLoRA setup for financial contract extraction."""

    # 1. BitsAndBytesConfig for 4-bit NF4 training
    # Crucial for fitting 7B/8B models on consumer hardware
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 # Use bfloat16 to prevent gradient spikes
    )

    # 2. LoraConfig (r=16, target all linear layers)
    # Targeting all linear layers provides the most robust domain adaptation
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32, # Rule of thumb: alpha = 2 * r
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )

    # 3. TrainingArguments
    training_args = TrainingArguments(
        output_dir="./financial_lora_weights",
        per_device_train_batch_size=2, # Keep low to prevent OOM
        gradient_accumulation_steps=4, # effectively batch size 8
        learning_rate=2e-4,
        max_steps=100,
        logging_steps=10,
        fp16=False,
        bf16=True, # Modern standard for training
        optim="paged_adamw_8bit" # Saves even more memory on optimizer states!
    )

    return bnb_config, lora_config, training_args

# Test the pipeline config
bnb, lora, args = get_financial_lora_pipeline()
print(f"Quantization Type: {bnb.bnb_4bit_quant_type}")
print(f"LoRA Target Modules: {lora.target_modules}")
print(f"Optimizer: {args.optim}")
```
</details>
