# Markview

**[markview.pankajkumar.xyz](https://markview.pankajkumar.xyz)**

A beautiful, lightning-fast, fully client-side Markdown viewer. Drop in any `.md` file or paste a URL to instantly preview it with premium typography, a dynamic sticky Table of Contents, and pixel-perfect syntax highlighting.

## ✨ Features

- **100% Client-Side:** No servers, no file uploads. Parsing and rendering happen entirely in your browser.
- **Multiple Input Methods:** Drag & drop, file picker, URL loader, or paste raw markdown with `Ctrl+V`.
- **Shareable Links:** Load a document via `?url=` query param — the URL updates automatically so you can bookmark or share any view.
- **Dynamic Table of Contents:** Auto-generated sticky sidebar TOC from `h1`–`h6` headings with active-section highlighting.
- **Pixel-Perfect Syntax Highlighting:** [Shiki](https://shiki.style/) (primary, GitHub Light/Dark themes) with [PrismJS](https://prismjs.com/) as an instant fallback. Languages lazy-loaded on demand.
- **Math Rendering:** Full LaTeX support via [KaTeX](https://katex.org/) — both inline `$...$` and display `$$...$$` blocks.
- **Mermaid Diagrams:** Flowcharts, sequence diagrams, Gantt charts, and more via [Mermaid.js](https://mermaid.js.org/). Theme follows your dark/light toggle in real time.
- **GitHub-style Admonitions:** `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]` rendered as styled callout blocks.
- **Footnotes:** `[^1]` reference-style footnotes collected and rendered at the bottom.
- **GFM Task Lists:** `- [x]` and `- [ ]` render as styled checkboxes.
- **Frontmatter Stripping:** YAML (`---`) and TOML (`+++`) frontmatter is silently removed before rendering.
- **`<details>` / `<summary>`:** Collapsible sections with animated arrow indicators.
- **Inline elements:** `<kbd>`, `<mark>` (`==highlight==`), `<sub>`, `<sup>` all rendered and styled.
- **Smart Theming:** Dark mode by default, respects system preference and localStorage. Code, math, and diagrams all update on toggle.
- **Native PDF Export:** `Ctrl+P` or the PDF button exports a perfectly formatted, text-selectable document.
- **Recent Files:** Last 5 URL-loaded documents remembered in localStorage for one-click re-open.
- **Keyboard Shortcuts:** Press `?` to see all available shortcuts.
- **Secure Rendering:** All HTML sanitized via [DOMPurify](https://github.com/cure53/DOMPurify).

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `?` | Show keyboard shortcuts |
| `Ctrl O` | Open file picker |
| `Ctrl L` | Focus URL input |
| `Ctrl P` | Export PDF |
| `Ctrl V` | Paste markdown directly |
| `Esc` | Return to upload screen |

## 🚀 Running Locally

Markview uses **[Zola](https://www.getzola.org/)** as its static site generator to compile the outer shell (HTML/CSS/JS assets).

1. Install [Zola](https://www.getzola.org/documentation/getting-started/installation/)
2. Clone this repository
3. Start the local development server:
   ```bash
   zola serve
   ```
4. Open `http://127.0.0.1:1111` in your browser.

To test with a sample document, load any raw GitHub markdown URL via the URL input, e.g.:
```
https://raw.githubusercontent.com/ipankajkumar93/markview/main/README.md
```

## 🛠️ Tech Stack

| Layer | Library |
|---|---|
| Markdown Parsing | [Marked.js](https://marked.js.org/) v12 (pinned) |
| Sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) |
| Syntax Highlighting | [Shiki](https://shiki.style/) + [PrismJS](https://prismjs.com/) fallback |
| Math | [KaTeX](https://katex.org/) |
| Diagrams | [Mermaid.js](https://mermaid.js.org/) |
| Icons | [Feather Icons](https://feathericons.com/) |
| Static Site Generator | [Zola](https://www.getzola.org/) |

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
