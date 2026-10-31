# Challenge 2: Multi-Turn Support Bot with Context Sliding

## Problem Statement
You are building a customer support chatbot. Users can talk to the bot for hours. However, the LLM has a context window limit (e.g., 4000 tokens), and every token costs money. If you send the entire chat history on every turn, you will run out of memory and bankrupt the company. You need to implement a "sliding window" that only keeps the system prompt and the N most recent messages.

## Architecture Diagram
```text
User Input -> [System Prompt + Last 4 Messages + New Input] -> Token Counter -> LLM -> Output
                                      |
                                      +--> (Older messages are dropped)
```

## Starter Template

```python
import tiktoken

class SupportBot:
    def __init__(self, max_history_tokens=1000):
        self.system_prompt = {"role": "system", "content": "You are a helpful assistant."}
        self.history = []
        self.max_tokens = max_history_tokens
        self.enc = tiktoken.encoding_for_model("gpt-3.5-turbo")

    def count_tokens(self, text):
        return len(self.enc.encode(text))

    def get_response(self, user_text):
        # TODO: Add user_text to history
        # TODO: Implement sliding window logic to ensure history fits within max_history_tokens
        # TODO: Construct final payload (System Prompt + Trimmed History)
        # TODO: Mock LLM call and return response
        pass
```

<details>
<summary>Full Production Solution Walkthrough</summary>

```python
import tiktoken

class SupportBot:
    def __init__(self, max_history_tokens=1000):
        self.system_prompt = {"role": "system", "content": "You are a helpful assistant."}
        self.history = []
        self.max_tokens = max_history_tokens
        self.enc = tiktoken.encoding_for_model("gpt-3.5-turbo")

    def count_tokens(self, message):
        # Rough estimation for formatting
        return len(self.enc.encode(message["content"])) + 4

    def get_response(self, user_text):
        # 1. Add new user message
        new_msg = {"role": "user", "content": user_text}
        self.history.append(new_msg)

        # 2. Sliding Window Logic
        # Always reserve tokens for the system prompt
        sys_tokens = self.count_tokens(self.system_prompt)
        available_tokens = self.max_tokens - sys_tokens

        trimmed_history = []
        current_tokens = 0

        # Iterate backwards from the most recent messages
        for msg in reversed(self.history):
            msg_tokens = self.count_tokens(msg)
            if current_tokens + msg_tokens <= available_tokens:
                trimmed_history.insert(0, msg) # Prepend to keep chronological order
                current_tokens += msg_tokens
            else:
                break # We hit the limit, stop adding older messages

        # Update actual history to only hold what we kept
        self.history = trimmed_history

        # 3. Construct Payload
        payload = [self.system_prompt] + self.history

        # 4. Mock LLM Call
        print(f"[DEBUG] Sending {len(payload)} messages using ~{current_tokens + sys_tokens} tokens.")
        mock_reply = f"I hear you saying: {user_text[:10]}..."

        # 5. Append Assistant Reply
        self.history.append({"role": "assistant", "content": mock_reply})
        return mock_reply

# Test Suite
def test_sliding_window():
    bot = SupportBot(max_history_tokens=50) # Very small window for testing

    bot.get_response("Hello, my name is Alice and I need help with my account.")
    assert len(bot.history) == 2 # 1 User, 1 Assistant

    bot.get_response("This is a very long message designed to push older messages out of the context window. " * 5)

    # The history should now be trimmed!
    # The exact number depends on token counts, but it should not contain the first message anymore.
    assert "Alice" not in bot.history[0]["content"]
    print("Sliding window test passed!")

test_sliding_window()
```
</details>
