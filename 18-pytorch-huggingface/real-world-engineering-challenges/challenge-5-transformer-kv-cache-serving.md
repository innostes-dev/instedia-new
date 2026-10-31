# Challenge 5: Transformer KV-Cache Inference

## The Challenge
You are building the backend for a ChatGPT-like application. If you re-compute the attention mechanism for the entire conversation history every time you generate a single new word, your server will grind to a halt. You must implement a generation loop that utilizes the **Key-Value Cache (KV-Cache)** to only compute attention for the *newest* token, rather than the entire sequence.

### Requirements:
1. Load a pre-trained `gpt2` model and tokenizer.
2. Initialize `past_key_values = None`.
3. Write a `while` loop to generate tokens one by one (greedy decoding).
4. In the forward pass, pass the `past_key_values` into the model.
5. Crucially, on the next loop iteration, pass *only the newest generated token* into the model, NOT the whole sequence, while supplying the updated `past_key_values`.
6. Stop generating when the model outputs the `eos_token_id`.

---

## Starter Template
```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# Load Model
tokenizer = AutoTokenizer.from_pretrained("gpt2")
model = AutoModelForCausalLM.from_pretrained("gpt2")

prompt = "The secret to writing good code is"
# TODO: Tokenize prompt

# Initialize variables
past_key_values = None
generated_tokens = []
max_new_tokens = 20

# TODO: Write generation loop utilizing past_key_values
# Hint: If past_key_values is not None, input_ids should only contain the LAST generated token!

# TODO: Decode and print result
```

---

## Solution Walkthrough

<details>
<summary>View Full Solution</summary>

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import time

def fast_kv_cache_generation():
    # 1. Initialization
    model_name = "gpt2"
    print(f"Loading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)

    prompt = "The secret to writing good code is"

    # input_ids shape: (1, seq_len)
    inputs = tokenizer(prompt, return_tensors="pt")
    input_ids = inputs["input_ids"]
    attention_mask = inputs["attention_mask"]

    past_key_values = None
    generated_tokens = []
    max_new_tokens = 30
    eos_token_id = tokenizer.eos_token_id

    print("\nGenerating text...")
    start_time = time.time()

    with torch.no_grad():
        for i in range(max_new_tokens):
            # 2. Forward Pass
            # We pass the past_key_values to the model.
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                past_key_values=past_key_values,
                use_cache=True # Explicitly enable KV-caching
            )

            # 3. Extract the new token
            # Get logits for the very last token in the sequence
            next_token_logits = outputs.logits[:, -1, :]
            next_token_id = torch.argmax(next_token_logits, dim=-1)

            generated_tokens.append(next_token_id.item())

            # Check for End of Sequence
            if next_token_id.item() == eos_token_id:
                break

            # 4. Update state for the NEXT loop iteration
            # The model returns the updated KV-cache!
            past_key_values = outputs.past_key_values

            # CRITICAL OPTIMIZATION:
            # We do NOT pass the whole sequence back in. We ONLY pass the new token!
            input_ids = next_token_id.unsqueeze(0)

            # We must also expand the attention mask by 1 to account for the new token
            attention_mask = torch.cat(
                [attention_mask, torch.ones((1, 1), dtype=torch.long)],
                dim=-1
            )

    generation_time = time.time() - start_time

    # 5. Decode Result
    # Combine original prompt IDs with generated IDs
    full_sequence = torch.cat([inputs["input_ids"][0], torch.tensor(generated_tokens)])
    final_text = tokenizer.decode(full_sequence, skip_special_tokens=True)

    print(f"\nResult: {final_text}")
    print(f"Generated {len(generated_tokens)} tokens in {generation_time:.4f} seconds.")

if __name__ == "__main__":
    fast_kv_cache_generation()
```

### Why this is production-grade:
* **$O(N^2)$ vs $O(N)$ Complexity:** Attention scales quadratically. If your prompt is 1000 tokens long, generating the 1001st token requires $1000^2$ operations. If you don't use KV-caching, generating the 1002nd token requires recalculating all $1001^2$ operations from scratch.
* **KV-Cache:** The Key-Value cache stores the intermediate matrix math from previous tokens in RAM. By passing `past_key_values` and *only the single new token* (`input_ids = next_token`), generating the 1002nd token only requires doing math for that 1 specific token against the cache, making the generation time per token constant ($O(1)$) instead of scaling quadratically. This is the foundational technology that makes LLM APIs commercially viable.
</details>
