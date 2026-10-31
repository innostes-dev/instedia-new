# Challenge 4: ONNX Runtime Inference

## The Challenge
You have trained a PyTorch model and need to deploy it to a production server (or a mobile device). Deploying the entire PyTorch library (which is gigabytes in size) and relying on Python's slow execution engine is unacceptable for latency-critical applications. You must export the PyTorch model to the **ONNX (Open Neural Network Exchange)** format, and run inference using the highly optimized **ONNX Runtime**.

### Requirements:
1. Create a simple PyTorch `nn.Sequential` model (e.g., a 2-layer MLP).
2. Create a dummy PyTorch input tensor.
3. Use `torch.onnx.export` to save the model to `model.onnx`. Ensure you define dynamic axes for the batch size so the deployed model can handle variable batch sizes!
4. Initialize an `InferenceSession` using `onnxruntime`.
5. Convert the dummy PyTorch tensor to a NumPy array and pass it to the ONNX session for prediction.

---

## Starter Template
```python
# pip install onnx onnxruntime
import torch
import torch.nn as nn
import onnxruntime as ort
import numpy as np

# 1. Define Model
class SimpleMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(10, 20),
            nn.ReLU(),
            nn.Linear(20, 2)
        )
    def forward(self, x):
        return self.layers(x)

model = SimpleMLP()
model.eval() # CRITICAL before export

# TODO: Create dummy input

# TODO: Export to ONNX

# TODO: Load ONNX model and run inference with onnxruntime
```

---

## Solution Walkthrough

<details>
<summary>View Full Solution</summary>

```python
import torch
import torch.nn as nn
import onnxruntime as ort
import numpy as np
import os

# 1. Define the PyTorch Model
class SimpleMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(10, 20),
            nn.ReLU(),
            nn.Linear(20, 2)
        )
    def forward(self, x):
        return self.layers(x)

model = SimpleMLP()
# CRITICAL: Always set model to eval mode before export.
# This disables Dropout and freezes BatchNorm layers.
model.eval()

# 2. Create Dummy Input
# The exporter needs a real tensor to trace the computational graph.
# Here we simulate a batch size of 1, with 10 features.
dummy_input = torch.randn(1, 10)

# 3. Export to ONNX
onnx_file_path = "simple_mlp.onnx"
print("Exporting model to ONNX...")
torch.onnx.export(
    model,                      # The PyTorch model
    dummy_input,                # Dummy input to trace the graph
    onnx_file_path,             # Where to save the file
    export_params=True,         # Store the trained weights inside the file
    opset_version=14,           # ONNX operator set version
    do_constant_folding=True,   # Optimization: pre-calculate constant math
    input_names=['input'],      # Name the input tensor for the production API
    output_names=['output'],    # Name the output tensor
    dynamic_axes={              # Allow the batch size to change in production!
        'input': {0: 'batch_size'},
        'output': {0: 'batch_size'}
    }
)
print(f"Exported successfully to {onnx_file_path}")

# 4. Load with ONNX Runtime (Simulating Production Environment)
print("\nLoading ONNX Runtime Session...")
# In a real C++, Go, or Rust backend, you would use the ONNX API for that language.
# Here we use the Python wrapper.
ort_session = ort.InferenceSession(onnx_file_path)

# 5. Run Inference
# ONNX Runtime doesn't know what PyTorch tensors are. It expects NumPy arrays.
# Notice we are passing a batch size of 4 here, testing our dynamic_axes!
production_data = np.random.randn(4, 10).astype(np.float32)

print("Running ONNX Inference...")
# ort_session.run([output_names], {input_name: numpy_data})
ort_inputs = {ort_session.get_inputs()[0].name: production_data}
ort_outs = ort_session.run(None, ort_inputs)

# The output is a list of NumPy arrays. We grab the first (and only) one.
final_predictions = ort_outs[0]

print(f"Input Shape: {production_data.shape}")
print(f"Output Shape: {final_predictions.shape}")
print(f"Predictions:\n{final_predictions}")

# Cleanup
os.remove(onnx_file_path)
```

### Why this is production-grade:
* **Framework Agnosticism:** ONNX is a universal standard. A model exported from PyTorch can be run in TensorFlow, or more importantly, directly in hardware-accelerated environments like NVIDIA TensorRT, Apple CoreML, or pure C++ servers without the massive Python overhead.
* **Dynamic Axes:** If you do not specify `dynamic_axes`, the exported graph will hardcode the batch size used in the dummy input. If you export with batch size 1, and production sends a batch of 4, the server will crash. Explicitly defining dimension 0 as variable is a mandatory deployment step.
* **Constant Folding:** `do_constant_folding=True` allows the ONNX exporter to pre-compute operations that don't depend on the input (like adding two fixed bias tensors together), permanently deleting them from the graph and speeding up inference.
</details>
