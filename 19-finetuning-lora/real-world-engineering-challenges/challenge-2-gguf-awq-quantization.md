# Challenge 2: Quantization Pipeline: Exporting to GGUF

## Architecture Diagram
```text
[ Base Model Weights ] + [ LoRA Adapter Weights ]
           | (Merging)
           v
[ Full 16-bit Model (.safetensors) ]
           | (llama.cpp Quantization Pipeline)
           v
[ Q4_K_M GGUF File ] ---> Ready for Ollama/LM Studio
```

## Challenge Overview
You finished training your LoRA adapter in PyTorch. However, you can't load an adapter directly into Ollama; you need a single, quantized file.
Your task is to write a bash script that simulates the process of:
1. Merging the LoRA adapter into the base model (conceptual Python step).
2. Cloning `llama.cpp`.
3. Converting the merged model to GGUF format.
4. Quantizing the GGUF file to a 4-bit format (`Q4_K_M`).

## Starter Template
```bash
#!/bin/bash
# quantize_pipeline.sh

MODEL_NAME="my_custom_model"

echo "1. Assume python merge_peft.py has run, creating ./merged_model_16bit"

# 2. TODO: Clone llama.cpp and build it (make)

# 3. TODO: Run convert_hf_to_gguf.py to create an unquantized F16 GGUF

# 4. TODO: Run ./llama-quantize to compress the F16 GGUF to Q4_K_M
```

## Solution Walkthrough
<details>
<summary>View the Complete Production Solution</summary>

```bash
#!/bin/bash
# quantize_pipeline.sh
# Note: This is a simulation script for educational purposes.

MODEL_NAME="financial_assistant"
MERGED_DIR="./merged_model_16bit"

echo "1. (Conceptual) Python script ran: merged base weights with LoRA -> $MERGED_DIR"
# In reality, this is done via peft_model.merge_and_unload()

echo "2. Setting up llama.cpp..."
if [ ! -d "llama.cpp" ]; then
    git clone https://github.com/ggerganov/llama.cpp.git
fi
cd llama.cpp
# Build the quantization tools
make quantize -j4

echo "3. Converting HuggingFace model to F16 GGUF..."
# This requires python dependencies: pip install -r requirements.txt
python convert_hf_to_gguf.py ../$MERGED_DIR --outfile ../${MODEL_NAME}_f16.gguf --outtype f16

echo "4. Quantizing F16 GGUF to 4-bit (Q4_K_M)..."
# Q4_K_M is the recommended balance between quality and file size
./llama-quantize ../${MODEL_NAME}_f16.gguf ../${MODEL_NAME}_q4_k_m.gguf Q4_K_M

echo "Done! You can now load ../${MODEL_NAME}_q4_k_m.gguf into Ollama."
```

**Testing the pipeline mentally:**
*   **Input:** 16GB PyTorch model folder.
*   **Intermediate:** 16GB `.gguf` file (F16).
*   **Output:** ~4.5GB `.gguf` file (Q4_K_M). You just reduced the deployment cost by 75% without losing noticeable quality.
</details>
