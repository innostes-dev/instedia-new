# Challenge 4: Enterprise RAG & Agentic Search

## Architecture Blueprint

This challenge builds a production-grade internal AI Knowledge Base. It handles uploading documents, hybrid vector/keyword search with cross-encoder re-ranking, and streaming the AI's response back to the user via Server-Sent Events (SSE).

**Core Requirements:**
1. **Document Ingestion:** Parse PDFs, split them semantically with overlap, generate embeddings, and store them in PostgreSQL (`pgvector`).
2. **Hybrid Search Pipeline:** Combine BM25 (Keyword) and pgvector (Semantic) search, then use a Cross-Encoder to re-rank the top results for maximum accuracy.
3. **SSE Token Streaming:** Stream the LLM's generated answer token-by-token to a React frontend so the user doesn't have to wait for the entire response to generate.

## Starter Template (Python/FastAPI/LangChain & React)

### Backend: FastAPI RAG Engine

```python
import os
import json
from fastapi import FastAPI, UploadFile, Request
from fastapi.responses import StreamingResponse
import tempfile

# LangChain Imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import PGVector
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.callbacks import AsyncIteratorCallbackHandler
import asyncio

app = FastAPI()

# Required: OPENAI_API_KEY, DATABASE_URL (must support pgvector)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
CONNECTION_STRING = os.environ.get("DATABASE_URL")

@app.post("/api/ingest")
async def ingest_document(file: UploadFile):
    # 1. Parsing & Chunking
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_documents(docs)

        # Add Metadata
        for chunk in chunks:
            chunk.metadata["filename"] = file.filename

        # 2. Store Embeddings in pgvector
        PGVector.from_documents(
            documents=chunks,
            embedding=embeddings,
            collection_name="enterprise_kb",
            connection_string=CONNECTION_STRING
        )
        return {"status": "success", "chunks_processed": len(chunks)}
    finally:
        os.unlink(tmp_path)

@app.post("/api/chat/stream")
async def chat_stream(request: Request):
    data = await request.json()
    query = data.get("query")

    # 3. Retrieval (Hybrid Search & Reranking simplified for template)
    vector_store = PGVector(
        connection_string=CONNECTION_STRING,
        embedding_function=embeddings,
        collection_name="enterprise_kb"
    )
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})
    retrieved_docs = retriever.invoke(query)

    # Construct Context string
    context_text = "\n\n".join([doc.page_content for doc in retrieved_docs])

    # 4. LLM Streaming Setup
    callback_handler = AsyncIteratorCallbackHandler()
    llm = ChatOpenAI(model="gpt-4", streaming=True, callbacks=[callback_handler])

    system_prompt = f"Answer the user's question based ONLY on the following context:\n{context_text}"

    async def generate():
        try:
            await llm.agenerate([[
                SystemMessage(content=system_prompt),
                HumanMessage(content=query)
            ]])
        finally:
            callback_handler.done.set()

    asyncio.create_task(generate())

    async def event_generator():
        # First, send the sources so the UI can display them immediately
        sources = [{"file": doc.metadata.get("filename")} for doc in retrieved_docs]
        yield f"data: {json.dumps({'type': 'sources', 'data': sources})}\n\n"

        # Then, stream the LLM text
        async for token in callback_handler.aiter():
            safe_token = token.replace("\n", "\\n")
            yield f"data: {json.dumps({'type': 'text', 'data': safe_token})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### Frontend: React SSE Consumer

```tsx
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function RAGAgentUI() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [sources, setSources] = useState<{file: string}[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResponse('');
    setSources([]);
    setIsStreaming(true);

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const events = chunk.split('\n\n');

      for (const event of events) {
        if (event.startsWith('data: ')) {
          const dataStr = event.slice(6);
          if (dataStr === '[DONE]') {
            setIsStreaming(false);
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'sources') {
              setSources(parsed.data);
            } else if (parsed.type === 'text') {
              setResponse(prev => prev + parsed.data.replace(/\\n/g, '\n'));
            }
          } catch (err) {
            console.error("Failed to parse SSE JSON", err);
          }
        }
      }
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input value={query} onChange={e => setQuery(e.target.value)} className="border p-2 flex-1" />
        <button type="submit" className="bg-blue-600 text-white p-2">Ask Knowledge Base</button>
      </form>

      {sources.length > 0 && (
        <div className="mb-4 text-sm text-gray-500">
          Sources: {sources.map((s, i) => <span key={i} className="mr-2 px-2 bg-gray-200 rounded">{s.file}</span>)}
        </div>
      )}

      <div className="border p-4 bg-gray-50 min-h-[200px] prose">
        <ReactMarkdown>{response}</ReactMarkdown>
      </div>
    </div>
  );
}
```

## Production Solution Walkthrough

1. **Ingestion & Chunking:** `RecursiveCharacterTextSplitter` is used to ensure chunks break naturally at paragraph ends rather than cutting a sentence in half. The `chunk_overlap=200` ensures that context isn't lost between boundaries. We also append the original `filename` to the metadata, which is critical for the frontend citations.
2. **Vector Retrieval:** The endpoint currently uses pure semantic search (pgvector). In a full production implementation (as seen in module 4.2), this would be augmented with an `EnsembleRetriever` (BM25 + pgvector) and a `CrossEncoder` for extreme precision, especially when searching for exact alphanumeric error codes.
3. **SSE Protocol:** The server uses `AsyncIteratorCallbackHandler` to catch LLM tokens in real-time. Instead of just sending raw strings, we encapsulate our SSE data in JSON `{"type": "text", "data": "token"}`. This allows us to multi-plex different types of data over the same stream (like sending the "sources" array before the text generation even begins).
4. **React Stream Parsing:** The frontend uses `fetch` and `res.body.getReader()` to parse the raw byte stream. It reconstructs the JSON objects, separating the `sources` (rendered as UI pills) from the `text` (rendered continuously via `ReactMarkdown` to handle bolding and formatting smoothly).
