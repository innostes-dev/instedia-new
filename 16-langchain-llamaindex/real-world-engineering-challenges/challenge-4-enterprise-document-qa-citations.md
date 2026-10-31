# Real-World Engineering Challenge: Enterprise QA with Citations

## Architecture Diagram
```text
[ User Query ] ──► [ Retriever ] ──► [ Nodes (Chunks + Metadata) ]
                                            │
                                            ▼
[ Prompt: "Answer the query using ONLY the context. Cite sources." ]
                                            │
                                            ▼
                                  [ JSON Output Parser ]
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
     { "answer": "PTO is 20 days.",                            "citations": ["doc_01.pdf (pg 4)"] }
```

## Challenge Objective
Build a QA chain that returns structured JSON containing both the answer AND an explicit list of source file names/pages it used to generate that answer.

## Production Solution
```python
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List

# 1. Define Strict Output Schema for Citations
class CitedAnswer(BaseModel):
    answer: str = Field(description="The direct answer to the user's question.")
    citations: List[str] = Field(
        description="A list of the document titles and page numbers used to form the answer. Must be empty if no context used."
    )

def build_citation_chain():
    parser = JsonOutputParser(pydantic_object=CitedAnswer)

    # 2. Construct Prompt forcing strict context adherence
    prompt = PromptTemplate(
        template=(
            "Answer the question based ONLY on the following context.\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}\n\n"
            "{format_instructions}"
        ),
        input_variables=["context", "question"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )

    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)

    # 3. LCEL Pipeline
    chain = prompt | llm | parser
    return chain

if __name__ == "__main__":
    chain = build_citation_chain()

    mock_retrieved_context = (
        "[Source: Employee_Handbook_v2.pdf, Page 12]\n"
        "All full-time employees are entitled to 20 days of Paid Time Off (PTO) annually."
    )

    # result = chain.invoke({
    #    "context": mock_retrieved_context,
    #    "question": "How much PTO do full-time employees get?"
    # })
    # print(result)
    # Expected dict: {'answer': 'Full-time employees get 20 days of PTO annually.', 'citations': ['Employee_Handbook_v2.pdf, Page 12']}
```
