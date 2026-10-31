# Challenge 2: RoBERTa Sentiment Classifier

## The Challenge
You need to fine-tune a pre-trained `RoBERTa` model for a custom 3-class sentiment analysis task (Negative, Neutral, Positive). Instead of writing the manual PyTorch training loop (which is error-prone for distributed environments), you must utilize the Hugging Face `Trainer` API.

### Requirements:
1. Load a pre-trained `roberta-base` model configured for sequence classification with 3 labels.
2. Prepare a dummy `Dataset` (Hugging Face format) with `text` and `labels`.
3. Create a tokenization function and map it over the dataset.
4. Set up `TrainingArguments` to train for 2 epochs, batch size of 4, saving the model at the end.
5. Create a `compute_metrics` function using `scikit-learn` to calculate accuracy and f1-score.
6. Initialize and run the `Trainer`.

---

## Starter Template
```python
# pip install transformers datasets scikit-learn
import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from transformers import TrainingArguments, Trainer
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score

# 1. Dummy Data
data = {
    "text": [
        "This product is amazing!", "I hate it here.", "It is okay, nothing special.",
        "Worst experience ever.", "Absolutely fantastic service.", "Just average."
    ],
    "labels": [2, 0, 1, 0, 2, 1] # 0: Neg, 1: Neu, 2: Pos
}
hf_dataset = Dataset.from_dict(data)

# 2. Load Model and Tokenizer
model_name = "roberta-base"
# TODO: Initialize tokenizer and model

# 3. Preprocessing
def tokenize_function(examples):
    pass # TODO: Implement tokenization

# TODO: Apply tokenization to hf_dataset

# 4. Metrics
def compute_metrics(eval_pred):
    pass # TODO: Implement accuracy and f1

# 5. Training
# TODO: Setup TrainingArguments and Trainer
# TODO: Call trainer.train()
```

---

## Solution Walkthrough

<details>
<summary>View Full Solution</summary>

```python
import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from transformers import TrainingArguments, Trainer
from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score

# Ensure determinism
torch.manual_seed(42)

# 1. Dummy Data
data = {
    "text": [
        "This product is amazing!", "I hate it here.", "It is okay, nothing special.",
        "Worst experience ever.", "Absolutely fantastic service.", "Just average."
    ],
    "labels": [2, 0, 1, 0, 2, 1]
}
# Using Hugging Face's Dataset library is highly recommended when using the Trainer
hf_dataset = Dataset.from_dict(data)
# Split into train and test sets
split_dataset = hf_dataset.train_test_split(test_size=0.33, seed=42)
train_dataset = split_dataset["train"]
eval_dataset = split_dataset["test"]

# 2. Load Model and Tokenizer
model_name = "roberta-base"
tokenizer = AutoTokenizer.from_pretrained(model_name)
# Specifically request a classification head with 3 outputs
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)

# 3. Preprocessing
def tokenize_function(examples):
    # The Trainer handles batching, but the dataset needs to be tokenized first.
    # truncation=True ensures sequences don't exceed model limits.
    # padding="max_length" ensures all arrays are the same size for the data loader.
    return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=16)

# map() applies the function efficiently across the dataset, often using multi-processing
tokenized_train = train_dataset.map(tokenize_function, batched=True)
tokenized_eval = eval_dataset.map(tokenize_function, batched=True)

# 4. Metrics
def compute_metrics(eval_pred):
    # eval_pred is a tuple of (logits, labels)
    logits, labels = eval_pred

    # Convert logits to predicted class IDs
    predictions = np.argmax(logits, axis=-1)

    # Calculate metrics
    accuracy = accuracy_score(labels, predictions)
    # Average="macro" treats all classes equally, regardless of support
    f1 = f1_score(labels, predictions, average="macro")

    return {"accuracy": accuracy, "f1": f1}

# 5. Training Configuration
training_args = TrainingArguments(
    output_dir="./roberta-sentiment-model",
    num_train_epochs=2,
    per_device_train_batch_size=2,
    per_device_eval_batch_size=2,
    evaluation_strategy="epoch", # Evaluate at the end of every epoch
    logging_dir='./logs',
    logging_steps=2,
    learning_rate=2e-5, # Standard learning rate for fine-tuning Transformers
    weight_decay=0.01,  # Regularization
)

# 6. Trainer Initialization
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_train,
    eval_dataset=tokenized_eval,
    compute_metrics=compute_metrics,
)

# 7. Execute Training
print("Starting training...")
trainer.train()

# 8. Evaluate Final Model
print("\nFinal Evaluation:")
print(trainer.evaluate())
```

### Why this is production-grade:
* **The `Trainer` API:** While writing a 5-step loop manually is good for learning, in production, the HF `Trainer` automatically handles Mixed Precision (`fp16`), multi-GPU distribution (DataParallel), gradient accumulation, and learning rate scheduling (warm-up and decay).
* **Metrics:** Logging loss is not enough. You must track human-interpretable metrics like F1-score (which handles class imbalance better than accuracy). The `compute_metrics` hook allows `scikit-learn` to hook directly into the training loop.
</details>
