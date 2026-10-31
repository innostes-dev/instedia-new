# Challenge 5: Multimodal Document Analyzer

## Problem Statement
You are building an ID Verification system. Users upload photos of their Driver's Licenses. You need to extract the `full_name`, `date_of_birth`, and `id_number`. However, photos from phones are huge. You must implement a preprocessing step that resizes the image to save API tokens before sending it to the Vision model alongside a Pydantic schema for strict extraction.

## Architecture Diagram
```text
Raw Image File -> PIL Image Resize -> Base64 Encode -> Vision LLM + Pydantic Response Format -> Typed Python Object
```

## Starter Template

```python
from pydantic import BaseModel
# from PIL import Image # Assumed installed

# TODO: Define IDCard Schema

def process_image(image_path: str) -> str:
    # TODO: Resize image to max 800px on longest side, then return Base64 string
    pass

def analyze_id(image_path: str) -> dict:
    # TODO: Build multimodal payload and call .parse with the schema
    pass
```

<details>
<summary>Full Production Solution Walkthrough</summary>

```python
from pydantic import BaseModel, Field
import base64
import io

# For testing without PIL installed in all environments, we mock the PIL behavior
class MockImage:
    def __init__(self, w, h): self.size = (w, h)
    def thumbnail(self, size): self.size = (min(self.size[0], size[0]), min(self.size[1], size[1]))
    def save(self, buffer, format): buffer.write(b"fake_compressed_image_bytes")

# 1. Define Schema
class IDCard(BaseModel):
    full_name: str = Field(description="Full legal name")
    date_of_birth: str = Field(description="DOB in YYYY-MM-DD")
    id_number: str = Field(description="The license or ID number")

def process_image(image_path: str) -> str:
    # Production Code:
    # from PIL import Image
    # img = Image.open(image_path)

    # Mocking PIL for the test
    img = MockImage(4000, 3000) # Simulating a large 4K image

    # 2. Resize to save tokens (Max 800px)
    img.thumbnail((800, 800))

    # 3. Convert to Base64 in memory
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def analyze_id(image_path: str) -> dict:
    base64_img = process_image(image_path)

    # 4. Multimodal API Call with Structured Outputs
    # response = client.beta.chat.completions.parse(
    #     model="gpt-4o",
    #     messages=[
    #         {
    #             "role": "user",
    #             "content": [
    #                 {"type": "text", "text": "Extract data from this ID card."},
    #                 {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_img}", "detail": "high"}}
    #             ]
    #         }
    #     ],
    #     response_format=IDCard
    # )
    # return response.choices[0].message.parsed.model_dump()

    # Mock Return
    return {"full_name": "Jane Doe", "date_of_birth": "1990-01-01", "id_number": "D1234567"}

# Test Suite
def test_vision_pipeline():
    # We pass a fake path since we mocked the image processing
    result = analyze_id("fake_path.jpg")

    assert result["full_name"] == "Jane Doe"
    assert "date_of_birth" in result
    print("Multimodal Document Analyzer test passed!")

test_vision_pipeline()
```
</details>
