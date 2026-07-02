# Markview

**[markview.pankajkumar.xyz](https://markview.pankajkumar.xyz)**

A beautiful, lightning-fast, fully client-side Markdown viewer. Drop in any `.md` file to instantly preview it with a beautiful typography, a dynamic sticky Table of Contents, and vibrant syntax highlighting.

## ✨ Features

- **100% Client-Side:** No servers, no file uploads. The Markdown parsing and rendering happen entirely in your browser.
- **Dynamic Table of Contents:** Automatically generates a sticky, clickable sidebar TOC based on your document's `h1` - `h6` headings.
- **Flawless Syntax Highlighting:** Powered by Highlight.js with the Dracula theme. Explicit support included for `toml`, `yaml`, `rust`, `dockerfile`, and dozens of standard languages.
- **Premium Typography:** Clean, muted colors and tailored fonts seamlessly integrated from a shared design system.
- **Native PDF Export:** Export your document instantly to a perfectly formatted, text-selectable PDF that strictly mirrors your screen's content layout.
- **Smart Theming:** Defaults to a sleek Dark Mode, but fully respects local storage and system theme preferences via a built-in toggle.
- **Secure Rendering:** All rendered HTML is strictly sanitized through DOMPurify to prevent XSS.

## 🚀 Running Locally

Markview uses **[Zola](https://www.getzola.org/)** as its static site generator to compile the outer shell (the HTML/CSS/JS assets). 

1. Install Zola
2. Clone this repository
3. Start the local development server:
   ```bash
   zola serve
   ```
4. Open `http://127.0.0.1:1111` in your browser.

## 🛠️ Tech Stack

- **Markdown Parsing:** [Marked.js](https://marked.js.org/)
- **Sanitization:** [DOMPurify](https://github.com/cure53/DOMPurify)
- **Syntax Highlighting:** [Highlight.js](https://highlightjs.org/)
- **Icons:** [Feather](https://feathericons.com/)
- **Static Site Generator:** [Zola](https://www.getzola.org/)

## 📄 License
This project is open-source and available under standard licenses.
