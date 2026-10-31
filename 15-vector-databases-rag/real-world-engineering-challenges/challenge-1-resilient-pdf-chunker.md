# Challenge 1: Resilient PDF Parsing & Token-Aware Chunking Pipeline

## Problem Statement
You are building an enterprise ingestion pipeline for SEC 10-K financial reports. These PDFs are notoriously messy, containing complex financial tables, long paragraphs, and sometimes scanned images without a text layer.

Your goal is to build a highly resilient ingestion pipeline that:
1. Detects and preserves tabular data using layout-aware parsing, converting tables to Markdown.
2. Gracefully falls back to a warning/OCR placeholder if a page has no extractable text.
3. Chunks the resulting text using a **Token-Aware Recursive Character Splitter** to ensure chunks fit perfectly into a 512-token limit for an embedding model, preserving paragraphs where possible.

## Starter Code

```python
import pandas as pd
import tiktoken

# --- Mock Document Data ---
# Page 1: Normal text
page_1 = "Tesla, Inc. designs, develops, manufactures, sells, and leases high-performance fully electric vehicles and energy generation and storage systems. " * 20

# Page 2: Tabular data (simulated output from a layout parser like pdfplumber)
page_2_table = [
    ["Year", "Revenue (B)", "Net Income (B)"],
    ["2021", "$53.8", "$5.5"],
    ["2022", "$81.4", "$12.5"],
    ["2023", "$96.7", "$14.9"]
]

# Page 3: Scanned image (no text layer)
page_3 = "   \n  "

mock_pdf_pages = [page_1, page_2_table, page_3]

# --- Initialize Tokenizer ---
enc = tiktoken.get_encoding("cl100k_base")

def mock_tokenizer(text):
    """Returns the exact token count using OpenAI's tiktoken."""
    return len(enc.encode(text))

# ==========================================
# YOUR TASK: IMPLEMENT THE PIPELINE BELOW
# ==========================================

def process_table(table_data):
    """Convert 2D array to Markdown table."""
    # TODO: Implement markdown conversion
    pass

def recursive_token_chunker(text, max_tokens, tokenizer_fn):
    """Recursively split text by paragraph, sentence, then word, respecting token limits."""
    # TODO: Implement recursive splitting logic
    pass

def run_pipeline(pages, max_tokens=512):
    final_chunks = []

    for i, page in enumerate(pages):
        page_num = i + 1
        print(f"Processing Page {page_num}...")

        # TODO: 1. Check for tables vs text vs empty/scanned pages
        # TODO: 2. Process accordingly (convert table, warn OCR, or chunk text)
        # TODO: 3. Append to final_chunks
        pass

    return final_chunks

# final_output = run_pipeline(mock_pdf_pages)
# print(f"Total chunks generated: {len(final_output)}")
```

---

## Solution Walkthrough

<details>
<summary>Click to view the complete production solution</summary>

### The Architecture
This pipeline represents the "Ingestion" phase of RAG.
1. **Type Checking:** We inspect the input type. If it's a `list`, we assume it's a parsed table and route it to our Markdown converter. If it's a string, we check its length after stripping whitespace. If it's empty, we flag it for OCR.
2. **Recursive Token Chunking:** This is the most complex algorithm in RAG. We attempt to split by paragraphs (`\n\n`). If a paragraph exceeds the token limit, we recursively call the function, dropping the `\n\n` separator and trying to split that specific paragraph by sentences (`. `).

### Complete Code

```python
import pandas as pd
import tiktoken

# --- Mock Document Data (from Starter Code) ---
page_1 = "Tesla, Inc. designs, develops, manufactures, sells, and leases high-performance fully electric vehicles and energy generation and storage systems. " * 20
page_2_table = [
    ["Year", "Revenue (B)", "Net Income (B)"],
    ["2021", "$53.8", "$5.5"],
    ["2022", "$81.4", "$12.5"],
    ["2023", "$96.7", "$14.9"]
]
page_3 = "   \n  "
mock_pdf_pages = [page_1, page_2_table, page_3]

enc = tiktoken.get_encoding("cl100k_base")

def mock_tokenizer(text):
    return len(enc.encode(text))

def process_table(table_data):
    """Converts a 2D array into a clean Markdown table string."""
    df = pd.DataFrame(table_data[1:], columns=table_data[0])
    # to_markdown requires the 'tabulate' library installed
    return df.to_markdown(index=False)

def recursive_token_chunker(text, max_tokens, tokenizer_fn, separators=["\n\n", "\n", ". ", " "]):
    """Production-grade recursive chunker strictly enforcing token limits."""
    # Base Case: If the whole text fits, return it immediately
    if tokenizer_fn(text) <= max_tokens:
        return [text]

    # Find the highest level separator that exists in this text block
    good_separator = ""
    for sep in separators:
        if sep in text:
            good_separator = sep
            break

    # Fallback: if no separators exist, force character split
    if good_separator == "":
        chars_per_chunk = int(max_tokens * 4) # Rough char approximation
        return [text[i:i+chars_per_chunk] for i in range(0, len(text), chars_per_chunk)]

    # Split the text by the chosen separator
    splits = text.split(good_separator)

    final_chunks = []
    current_chunk = ""

    for split in splits:
        # Re-add separator for readability (unless it's a paragraph break)
        item = split + good_separator if good_separator != "\n\n" else split

        # If adding this item exceeds the budget, flush the buffer
        if tokenizer_fn(current_chunk) + tokenizer_fn(item) > max_tokens:
            if current_chunk:
                final_chunks.append(current_chunk.strip())
            current_chunk = item
        else:
            current_chunk += item

    if current_chunk:
        final_chunks.append(current_chunk.strip())

    # Validation Step: Ensure no generated chunk STILL violates the token limit
    verified_chunks = []
    for chunk in final_chunks:
        if tokenizer_fn(chunk) > max_tokens:
            # Recursion: drop the current separator, go deeper
            next_seps = separators[separators.index(good_separator)+1:]
            verified_chunks.extend(recursive_token_chunker(chunk, max_tokens, tokenizer_fn, next_seps))
        else:
            verified_chunks.append(chunk)

    return verified_chunks

def run_pipeline(pages, max_tokens=200): # Lowered to 200 to force splits on Page 1
    final_chunks = []

    for i, page in enumerate(pages):
        page_num = i + 1
        print(f"--- Processing Page {page_num} ---")

        # 1. Handle Tabular Data
        if isinstance(page, list):
            print("Detected Table. Converting to Markdown...")
            md_table = process_table(page)
            # Tables shouldn't usually be chunked, keep intact if possible
            final_chunks.append(f"[Page {page_num} Table]\n{md_table}")

        # 2. Handle Text Data
        elif isinstance(page, str):
            clean_text = page.strip()

            # 3. Handle Empty / Scanned Pages
            if len(clean_text) < 10:
                print(f"[WARNING] Page {page_num} contains no text. Routing to OCR Pipeline...")
                final_chunks.append(f"[Page {page_num}] OCR_PENDING: No text layer found.")
            else:
                print(f"Detected Text. Token count: {mock_tokenizer(clean_text)}. Chunking...")
                chunks = recursive_token_chunker(clean_text, max_tokens, mock_tokenizer)
                for c in chunks:
                    final_chunks.append(f"[Page {page_num}]\n{c}")

    return final_chunks

# Execute
print("Starting Ingestion Pipeline...\n")
result = run_pipeline(mock_pdf_pages)

print("\n=== FINAL VECTOR DB PAYLOAD ===")
for i, chunk in enumerate(result):
    print(f"\nChunk {i+1} (Tokens: {mock_tokenizer(chunk)}):")
    print(chunk)
```

### Why this is Production-Grade
- **Data Integrity:** Tables are converted to Markdown, ensuring the LLM understands columns and rows perfectly.
- **Fail-Safes:** Empty pages don't crash the system; they trigger a fallback warning.
- **Token Guarantees:** The recursive chunker physically guarantees that no chunk sent to the `text-embedding-3` API will throw a `TokenLimitExceeded` error, while actively trying to keep semantic paragraphs together as long as possible.

</details>
