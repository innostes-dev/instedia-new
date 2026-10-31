# Challenge 3: Autocomplete Trie Engine

## 1. The Real-World Engineering Problem
You are tasked with building the backend for a Google-style search bar autocomplete. You have a dictionary of millions of valid search terms.
When a user types "app", you need to instantly return the top 3 most popular search terms starting with "app" (e.g., "apple", "application", "appetizer").
A linear search (`O(N)`) through an array of strings is too slow. A Hash Map (`O(1)`) only works for exact matches, not prefixes. You must build a **Prefix Tree (Trie)**.

## 2. Architecture Diagram (Trie)
```text
Terms: "app" (freq: 5), "apple" (freq: 10), "api" (freq: 3)

       [root]
         | 'a'
        [ ]
         | 'p'
        [ ]
       /   \ 'i'
'p'  [ ]   [ ] (End: "api", freq: 3)
      |
 (End: "app", freq: 5)
      | 'l'
     [ ]
      | 'e'
     [ ] (End: "apple", freq: 10)
```

## 3. Starter Template
```javascript
// starter-template.js

class TrieNode {
  constructor() {
    this.children = new Map(); // Character -> TrieNode
    this.isEndOfWord = false;
    this.frequency = 0;
    this.word = ""; // Store the full word at the end node for easy retrieval
  }
}

class AutocompleteEngine {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * @param {string} word
   * @param {number} frequency
   */
  insert(word, frequency) {
    // TODO: Insert word character by character
  }

  /**
   * @param {string} prefix
   * @return {string[]} Top 3 words matching prefix by frequency
   */
  search(prefix) {
    // TODO: Traverse to prefix end, then run DFS to find all words, then sort
    return [];
  }
}
```

## 4. Production Walkthrough (Full Solution)

<details>
<summary>✅ View Full Production Solution & Tests</summary>

### The Trie Solution
We build the Trie node by node. To search, we travel down the prefix path. Once we reach the end of the prefix, we run a Depth-First Search (DFS) on all children to collect every valid word, sort them by frequency, and return the top 3.

```javascript
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.frequency = 0;
    this.word = "";
  }
}

class AutocompleteEngine {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, frequency) {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
    }
    current.isEndOfWord = true;
    current.frequency = frequency;
    current.word = word;
  }

  search(prefix) {
    let current = this.root;
    // 1. Navigate to the end of the prefix
    for (const char of prefix) {
      if (!current.children.has(char)) {
        return []; // Prefix doesn't exist
      }
      current = current.children.get(char);
    }

    // 2. DFS to find all words branching from this prefix
    const results = [];

    function dfs(node) {
      if (node.isEndOfWord) {
        results.push({ word: node.word, freq: node.frequency });
      }
      for (const childNode of node.children.values()) {
        dfs(childNode);
      }
    }

    dfs(current);

    // 3. Sort by frequency (descending) and return top 3
    results.sort((a, b) => b.freq - a.freq);
    return results.slice(0, 3).map(obj => obj.word);
  }
}
```

### Test Suite (Jest)
```javascript
describe('AutocompleteEngine', () => {
  it('should return top 3 prefix matches by frequency', () => {
    const engine = new AutocompleteEngine();
    engine.insert("apple", 100);
    engine.insert("application", 50);
    engine.insert("app", 200);
    engine.insert("api", 150);
    engine.insert("appetizer", 10);
    engine.insert("banana", 500);

    const results = engine.search("app");

    // "app" (200), "apple" (100), "application" (50)
    expect(results).toHaveLength(3);
    expect(results[0]).toBe("app");
    expect(results[1]).toBe("apple");
    expect(results[2]).toBe("application");

    // "api" shouldn't be in there
    expect(results).not.toContain("api");
  });
});
```
</details>
