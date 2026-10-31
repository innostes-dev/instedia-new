# Challenge 3: Accessible Newsroom Platform

## The Engineering Scenario
You are a Principal Frontend Engineer for the BBC. You are building the core template for all news articles. The template must be flawlessly accessible for screen readers, highly optimized for Google SEO, and structurally sound.
Your task is to build a complete HTML5 document. It must include a skip link, a full set of page landmarks, semantic article structuring, a sandboxed media embed, and a JSON-LD structured data block.

## Acceptance Criteria
- The document must have a `<!DOCTYPE html>` and proper `<head>` boilerplate.
- The `<head>` must include a JSON-LD `NewsArticle` schema block.
- A "Skip to Main Content" link must be the very first thing in the `<body>`, targeting the main content area.
- Must use `<header>`, `<nav>`, `<main>`, and `<footer>` landmarks.
- The `<main>` section must contain an `<article>`.
- The article must include a `<time datetime="...">` tag for the publication date.
- The article must include an `<iframe>` embedding a YouTube video, locked down with a `sandbox` attribute.
- The article must include an `<aside>` for "Related Stories".

---

## Starter Code
```html
<!-- Start from absolute scratch. Build the full HTML structure in your mind. -->
```

---

## Production Solution Walkthrough

<details>
<summary>View the Principal-Level Solution</summary>

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Climate Summit Concludes | BBC News</title>
  <meta name="description" content="World leaders agree to new emissions targets after a historic 3-day summit.">

  <!-- JSON-LD Structured Data for Rich Snippets -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "Global Climate Summit Concludes",
    "datePublished": "2024-11-01T08:00:00Z",
    "author": {
      "@type": "Person",
      "name": "Jane Smith"
    }
  }
  </script>
</head>
<body>

  <!-- WCAG Requirement: Skip Link -->
  <a href="#primary-content" class="skip-link">Skip to main content</a>

  <!-- Global Header -->
  <header>
    <h1>BBC News</h1>
    <nav aria-label="Main Navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/world">World</a></li>
      </ul>
    </nav>
  </header>

  <!-- The Document Core -->
  <main id="primary-content">

    <!-- The Self-Contained Story -->
    <article>
      <header>
        <h2>Global Climate Summit Concludes</h2>
        <p>Published on: <time datetime="2024-11-01T08:00:00Z">November 1, 2024</time></p>
      </header>

      <section>
        <h3>Key Agreements</h3>
        <p>Leaders have agreed to cut carbon output by 20%...</p>
      </section>

      <!-- Sandboxed Third-Party Media -->
      <figure>
        <iframe
          src="https://www.youtube.com/embed/xyz123"
          width="100%"
          height="400"
          title="Video report from the summit floor"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          loading="lazy">
        </iframe>
        <figcaption>Live report from Geneva.</figcaption>
      </figure>

    </article>

    <!-- Tangentially Related Content -->
    <aside>
      <h3>Related Stories</h3>
      <ul>
        <li><a href="/story1">Previous Summit Results</a></li>
      </ul>
    </aside>

  </main>

  <!-- Global Footer -->
  <footer>
    <address>
      Contact the newsroom: <a href="mailto:news@bbc.co.uk">news@bbc.co.uk</a>
    </address>
    <p>&copy; 2024 BBC</p>
  </footer>

</body>
</html>
```

### Why this is production-grade:
1. **WCAG AAA Compliance:** The skip link allows keyboard users to bypass the navigation. The `<iframe>` has a descriptive `title`. Landmarks are properly mapped.
2. **SEO Dominance:** The `<head>` is perfectly constructed with a description and a strict JSON-LD schema, allowing Google to parse this as a verified News Article and potentially place it in the "Top Stories" carousel.
3. **Security:** The YouTube iframe is sandboxed. It can run its internal video scripts, but cannot pop up new windows or access parent cookies.
</details>
