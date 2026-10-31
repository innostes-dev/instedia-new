# Challenge 1: Deterministic JSON Extraction Pipeline

## Problem Statement
You are building an automated invoice processing pipeline. Invoices arrive as unstructured text (via OCR). You must extract the `invoice_id` (string), `total_amount` (float), and `items` (list of dictionaries with `name` and `price`). If the LLM returns invalid JSON, your downstream database will crash.

## Architecture Diagram
```text
Unstructured Text -> LLM (GPT-4o) + Pydantic Schema -> JSON Output -> Validation Layer -> Database
                                                             |
                                                       (Retry Loop if Invalid)
```

## Starter Template

```python
import json
from pydantic import BaseModel, Field

# TODO: Define your Pydantic schema here

def extract_invoice_data(text: str) -> dict:
    # TODO: Implement the LLM call using openai.beta.chat.completions.parse
    # TODO: Handle potential validation errors
    pass

# Mock LLM Client (Replace with real openai client for production)
class MockClient:
    class beta:
        class chat:
            class completions:
                @staticmethod
                def parse(model, messages, response_format):
                    # Mocking a successful parse
                    data = {"invoice_id": "INV-123", "total_amount": 150.0, "items": [{"name": "Widget", "price": 150.0}]}
                    class MockResponse:
                        class choices:
                            class _item:
                                class message:
                                    parsed = response_format(**data)
                            _list = [_item()]
                            def __getitem__(self, i): return self._list[i]
                    return MockResponse()
client = MockClient()
```

<details>
<summary>Full Production Solution Walkthrough</summary>

```python
import json
from pydantic import BaseModel, Field, ValidationError

# 1. Define the Strict Schema
class Item(BaseModel):
    name: str = Field(description="Name of the purchased item")
    price: float = Field(description="Price of the item")

class Invoice(BaseModel):
    invoice_id: str = Field(description="The unique invoice identifier")
    total_amount: float = Field(description="The total cost of all items")
    items: list[Item] = Field(description="List of items on the invoice")

def extract_invoice_data(text: str) -> dict:
    try:
        # 2. Call the API using the parse method
        response = client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=[
                {"role": "system", "content": "Extract invoice details exactly as specified."},
                {"role": "user", "content": text}
            ],
            response_format=Invoice
        )
        # 3. Retrieve the parsed Pydantic object
        parsed_invoice = response.choices[0].message.parsed

        # 4. Convert to safe dict for downstream use
        return parsed_invoice.model_dump()

    except ValidationError as e:
        # 5. Production-grade error handling
        print(f"Schema Validation Failed: {e}")
        # In a real system, you would implement a retry loop here, feeding the error back to the LLM.
        raise

# Test Suite
def test_extractor():
    text = "Invoice INV-123. Widget: $150.00. Total: 150.0"
    result = extract_invoice_data(text)
    assert result["invoice_id"] == "INV-123"
    assert result["total_amount"] == 150.0
    assert len(result["items"]) == 1
    assert result["items"][0]["name"] == "Widget"
    print("All tests passed!")

test_extractor()
```
</details>
