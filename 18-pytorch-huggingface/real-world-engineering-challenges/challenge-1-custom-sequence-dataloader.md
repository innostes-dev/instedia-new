# Challenge 1: Custom Sequence DataLoader

## The Challenge
You are building an NLP pipeline. You have a dataset of sentences of vastly different lengths. PyTorch DataLoaders require tensors in a batch to have the exact same dimensions. You must create a custom PyTorch `Dataset` to handle the raw text, and a custom `collate_fn` for the `DataLoader` that dynamically pads the sequences to the length of the longest sequence *in that specific batch*.

### Requirements:
1. Use a pre-trained tokenizer (e.g., `bert-base-uncased`) to convert text to input IDs.
2. The `Dataset` should return a dictionary with `input_ids` and `label`.
3. The custom `collate_fn` must pad the `input_ids` with the tokenizer's pad token ID.
4. The custom `collate_fn` must generate an `attention_mask` (1 for real tokens, 0 for pad tokens).
5. All outputs from the DataLoader must be batched PyTorch Tensors.

---

## Starter Template
```python
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer

# 1. Dummy Data
raw_texts = [
    "Short sentence.",
    "This is a significantly longer sentence to test padding.",
    "Medium length sentence here.",
    "Tiny."
]
labels = [0, 1, 0, 1]

# 2. Initialization
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer):
        pass # TODO: Implement

    def __len__(self):
        pass # TODO: Implement

    def __getitem__(self, idx):
        pass # TODO: Implement

def dynamic_padding_collate(batch):
    pass # TODO: Implement padding and mask generation

# 3. Execution
# dataset = TextDataset(...)
# dataloader = DataLoader(...)
# for batch in dataloader:
#     print(batch)
```

---

## Solution Walkthrough

<details>
<summary>View Full Solution</summary>

```python
import torch
from torch.utils.data import Dataset, DataLoader
from torch.nn.utils.rnn import pad_sequence
from transformers import AutoTokenizer

# 1. Dummy Data
raw_texts = [
    "Short sentence.",
    "This is a significantly longer sentence to test padding.",
    "Medium length sentence here.",
    "Tiny."
]
labels = [0, 1, 0, 1]

# 2. Initialization
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
PAD_TOKEN_ID = tokenizer.pad_token_id

class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        # We tokenize on the fly, but do NOT pad here.
        # We want the raw, variable length lists.
        text = self.texts[idx]
        label = self.labels[idx]

        # return_tensors="pt" returns 2D tensor [[ids]], we squeeze to 1D [ids]
        tokens = self.tokenizer(text, return_tensors="pt")
        input_ids = tokens["input_ids"].squeeze(0)

        return {
            "input_ids": input_ids,
            "label": torch.tensor(label, dtype=torch.long)
        }

def dynamic_padding_collate(batch):
    # batch is a list of dictionaries returned by __getitem__

    # 1. Extract inputs and labels
    input_ids_list = [item["input_ids"] for item in batch]
    labels_list = [item["label"] for item in batch]

    # 2. Pad sequences dynamically
    # pad_sequence automatically finds the max length in THIS batch and pads the rest
    padded_input_ids = pad_sequence(
        input_ids_list,
        batch_first=True,
        padding_value=PAD_TOKEN_ID
    )

    # 3. Create Attention Mask (1 where not pad_token, 0 where pad_token)
    attention_mask = (padded_input_ids != PAD_TOKEN_ID).long()

    # 4. Stack labels
    batched_labels = torch.stack(labels_list)

    return {
        "input_ids": padded_input_ids,
        "attention_mask": attention_mask,
        "labels": batched_labels
    }

# 3. Execution
dataset = TextDataset(raw_texts, labels, tokenizer)
# Batch size 2 to see the dynamic padding effect
dataloader = DataLoader(dataset, batch_size=2, collate_fn=dynamic_padding_collate)

for i, batch in enumerate(dataloader):
    print(f"\n--- Batch {i+1} ---")
    print(f"Input IDs Shape: {batch['input_ids'].shape}")
    print(f"Input IDs:\n{batch['input_ids']}")
    print(f"Attention Mask:\n{batch['attention_mask']}")
```

### Why this is production-grade:
* **Dynamic Padding:** If we globally padded the dataset to a max length of 512, every batch would do math on 512 tokens. By dynamically padding, if the longest sentence in batch 1 is 15 tokens, we only compute on a tensor of length 15. This saves massive amounts of compute and memory during training.
* **On-the-fly Tokenization:** In this setup, data is tokenized in the `__getitem__` method (which runs on CPU worker threads). This prevents RAM exhaustion when dealing with massive datasets, as opposed to tokenizing the entire dataset up front.
</details>
