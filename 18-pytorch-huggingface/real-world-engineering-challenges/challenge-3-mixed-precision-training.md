# Challenge 3: Mixed Precision Training

## The Challenge
You are training a large neural network (e.g., a Vision Transformer or LLM). You run into a `CUDA Out Of Memory (OOM)` error because default PyTorch tensors use 32-bit floats (`fp32`). You need to implement **Automatic Mixed Precision (AMP)** to cast certain operations to 16-bit floats (`fp16`). This halves memory usage and utilizes specialized Tensor Cores on NVIDIA GPUs to double training speed, without crashing the model via numeric underflow.

### Requirements:
1. Write a standard manual training loop (Forward, Loss, Zero Grad, Backward, Step) for a dummy `nn.Linear` model.
2. Initialize a `torch.cuda.amp.GradScaler`.
3. Wrap the forward pass and loss calculation in an `autocast` context manager.
4. Scale the loss before calling `.backward()` to prevent gradient underflow.
5. Use the scaler to step the optimizer and update the scaler afterwards.

---

## Starter Template
```python
import torch
import torch.nn as nn
import torch.optim as optim

def run_training():
    if not torch.cuda.is_available():
        print("GPU required for this challenge.")
        return

    device = torch.device("cuda")

    # Large model and data to simulate memory pressure
    model = nn.Sequential(
        nn.Linear(4096, 4096),
        nn.ReLU(),
        nn.Linear(4096, 1)
    ).to(device)

    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCEWithLogitsLoss()

    # TODO: Initialize GradScaler

    for step in range(5):
        inputs = torch.randn(256, 4096, device=device)
        targets = torch.randint(0, 2, (256, 1), dtype=torch.float32, device=device)

        optimizer.zero_grad()

        # TODO: Implement AMP autocast and scaler logic
        # outputs = model(inputs)
        # loss = criterion(outputs, targets)
        # loss.backward()
        # optimizer.step()

        print(f"Step {step} Complete.")

if __name__ == "__main__":
    run_training()
```

---

## Solution Walkthrough

<details>
<summary>View Full Solution</summary>

```python
import torch
import torch.nn as nn
import torch.optim as optim

def run_mixed_precision_training():
    if not torch.cuda.is_available():
        print("GPU required for AMP (Automatic Mixed Precision).")
        return

    device = torch.device("cuda")

    # 1. Model and Data Setup
    model = nn.Sequential(
        nn.Linear(4096, 4096),
        nn.ReLU(),
        nn.Linear(4096, 1)
    ).to(device)

    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.BCEWithLogitsLoss()

    # 2. Initialize the Gradient Scaler
    # This prevents gradients with small magnitudes from flushing to zero in fp16.
    scaler = torch.cuda.amp.GradScaler()

    print("Starting AMP Training Loop...")

    for step in range(5):
        inputs = torch.randn(256, 4096, device=device)
        targets = torch.randint(0, 2, (256, 1), dtype=torch.float32, device=device)

        # Clear gradients
        optimizer.zero_grad(set_to_none=True) # Minor optimization

        # 3. Autocast Context
        # Only the forward pass and loss computation should be inside autocast.
        # PyTorch automatically decides which operations are safe to downcast to fp16
        # (like matmuls) and which must remain fp32 (like Softmax).
        with torch.autocast(device_type="cuda", dtype=torch.float16):
            outputs = model(inputs)
            loss = criterion(outputs, targets)

        # 4. Scaled Backward Pass
        # Multiply loss by a scaling factor to keep gradients in a safe numerical range
        scaler.scale(loss).backward()

        # 5. Scaled Optimizer Step
        # Unscales the gradients. If gradients are infinite/NaN, scaler.step() skips
        # the optimizer.step() to prevent model corruption.
        scaler.step(optimizer)

        # 6. Update Scaler
        # Adjusts the scaling factor for the next iteration (increases if no NaNs, decreases if NaNs)
        scaler.update()

        print(f"Step {step} | Loss: {loss.item():.4f} | Scaler factor: {scaler.get_scale()}")

if __name__ == "__main__":
    run_mixed_precision_training()
```

### Why this is production-grade:
* **The Float16 Underflow Problem:** $FP16$ can only represent numbers down to about $6 	imes 10^{-5}$. Gradients are often much smaller than this. Without the `GradScaler`, those gradients become exactly `0.0`, and the network stops learning. The Scaler artificially multiplies the loss by a huge number (e.g., $65536$), computes the backward pass in $FP16$ (so the gradients don't vanish), and then divides the gradients by $65536$ before updating the $FP32$ master weights.
* **Speed & Memory:** AMP is standard practice in all modern LLM and Vision training. It nearly halves VRAM usage, allowing for double the batch size, and utilizes NVIDIA's hardware Tensor Cores for massive speedups.
</details>
