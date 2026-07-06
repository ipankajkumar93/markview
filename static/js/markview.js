// Heavy dependencies will be loaded dynamically
let mermaid = null;
let renderMathInElement = null;
let getHighlighter = null;
let bundledLanguages = null;
let highlighter = null;

// Top languages loaded eagerly — covers 95%+ of real-world usage.
// Unknown languages are lazy-loaded on demand by applyShikiHighlighting().
const EAGER_LANGS = [
    'javascript', 'typescript', 'python', 'bash', 'json', 'yaml',
    'css', 'html', 'sql', 'rust', 'go', 'java', 'cpp', 'c',
    'markdown', 'toml', 'dockerfile', 'ruby', 'php', 'kotlin', 'swift'
];

let preloadPromise = null;
function preloadHeavyDependencies() {
    if (preloadPromise) return preloadPromise;
    
    preloadPromise = Promise.all([
        import('https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs'),
        import('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.mjs'),
        import('https://esm.sh/shiki@1.29.2')
    ]).then(async ([mermaidMod, katexMod, shikiMod]) => {
        mermaid = mermaidMod.default;
        renderMathInElement = katexMod.default;
        getHighlighter = shikiMod.getHighlighter;
        bundledLanguages = shikiMod.bundledLanguages;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
        
        // Load only common languages eagerly; rare ones are loaded on demand
        highlighter = await getHighlighter({
            themes: ['github-light', 'github-dark'],
            langs: EAGER_LANGS,
        });
        // Note: applyShikiHighlighting() is called by renderMarkdown() after this
        // promise resolves — no need to call it here.
    }).catch(err => console.error("Failed to preload dependencies", err));
    
    return preloadPromise;
}

document.addEventListener('DOMContentLoaded', () => {
    // Preload heavy deps eagerly if rendering will happen immediately.
    // Otherwise, preload them in the background after the page has fully loaded
    // so they are ready by the time the user uploads a file, without blocking initial render.
    if (new URLSearchParams(window.location.search).has('url')) {
        preloadHeavyDependencies();
    } else {
        window.addEventListener('load', () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => preloadHeavyDependencies(), { timeout: 2000 });
            } else {
                setTimeout(preloadHeavyDependencies, 500);
            }
        });
    }
    // UI Elements
    const uploadInput = document.getElementById('markdown-upload');
    const urlInput = document.getElementById('markdown-url');
    const loadUrlBtn = document.getElementById('load-url-btn');
    const uploadContainer = document.getElementById('upload-container');
    const uploadDropzone = document.getElementById('upload-dropzone');
    
    const viewerContainer = document.getElementById('viewer-container');
    const markdownContent = document.getElementById('markdown-content');
    const tocNav = document.getElementById('toc-nav');
    
    const sidebar = document.getElementById('toc-sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const expandSidebarBtn = document.getElementById('expand-sidebar');

    const headerUploadInput = document.getElementById('header-markdown-upload');
    const headerUploadContainer = document.getElementById('header-upload-container');
    const headerLoadUrlBtn = document.getElementById('header-load-url-btn');

    let currentFileName = 'markview-export.pdf';
    let currentRawMarkdown = '';
    let currentRawMermaidSources = []; // raw source for mermaid theme re-render

    // ── Toast Notification System ────────────────────────────────────────────
    (function initToastContainer() {
        if (!document.getElementById('mv-toast-container')) {
            const c = document.createElement('div');
            c.id = 'mv-toast-container';
            c.className = 'mv-toast-container';
            document.body.appendChild(c);
        }
    })();

    function showToast(title, message, type = 'error', duration = 5000) {
        const icons = { error: '⚠️', success: '✅', info: 'ℹ️', warning: '💡' };
        const container = document.getElementById('mv-toast-container');
        const toast = document.createElement('div');
        toast.className = `mv-toast mv-toast-${type}`;
        toast.innerHTML =
            `<span class="mv-toast-icon">${icons[type] || 'ℹ️'}</span>` +
            `<div class="mv-toast-body"><div class="mv-toast-title">${title}</div>` +
            `<div class="mv-toast-msg">${message}</div></div>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    // ── URL ?url= Parameter (“shareable links”) ─────────────────────────────
    // e.g. markview.pankajkumar.xyz/?url=https://raw.githubusercontent.com/...
    const urlParam = new URLSearchParams(window.location.search).get('url');
    if (urlParam) setTimeout(() => loadFromUrl(urlParam), 0);

    // ── Recent Files History (localStorage) ──────────────────────────────────
    const RECENT_KEY = 'mv_recent_files';
    const RECENT_MAX = 5;

    function getRecentFiles() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
        catch { return []; }
    }

    function saveRecentFile(url, title) {
        const list = getRecentFiles().filter(f => f.url !== url); // deduplicate
        list.unshift({ url, title, ts: Date.now() });
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
        renderRecentFiles();
    }

    function removeRecentFile(url) {
        const list = getRecentFiles().filter(f => f.url !== url);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
        renderRecentFiles();
    }

    // ── Recent Files — shared DOM builder (XSS-safe, deduplicates logic) ────
    function buildRecentItemsInto(container, onLoad, onDelete) {
        const list = getRecentFiles();
        container.innerHTML = '';
        if (list.length === 0) return false;

        const label = document.createElement('p');
        label.className = 'mv-recent-label';
        label.textContent = 'Recently viewed';
        container.appendChild(label);

        list.forEach(f => {
            const domain = (() => { try { return new URL(f.url).hostname; } catch { return ''; } })();
            const age    = formatAge(f.ts);
            const isLocal = !f.url.startsWith('http');

            const item = document.createElement('div');
            item.className = 'mv-recent-item';

            const content = document.createElement('div');
            content.className = 'mv-recent-content';
            content.addEventListener('click', () => onLoad(f.url));

            const icon = document.createElement('span');
            icon.className = 'mv-recent-icon';
            icon.textContent = isLocal ? '\uD83D\uDCBB' : '\uD83D\uDCC4';
            icon.title = isLocal ? 'Local file — re-upload to view' : '';

            const info = document.createElement('span');
            info.className = 'mv-recent-info';

            const title = document.createElement('span');
            title.className = 'mv-recent-title';
            title.textContent = f.title || f.url.split('/').pop() || 'Document';

            const meta = document.createElement('span');
            meta.className = 'mv-recent-meta';
            meta.textContent = (isLocal ? 'local file' : domain) + (age ? ' \u00B7 ' + age : '');

            info.appendChild(title);
            info.appendChild(meta);
            content.appendChild(icon);
            content.appendChild(info);

            const del = document.createElement('button');
            del.className = 'mv-recent-delete';
            del.title = 'Remove from history';
            del.setAttribute('aria-label', 'Remove from history');
            del.innerHTML = '<i data-feather="x"></i>';
            del.addEventListener('click', e => { e.stopPropagation(); onDelete(f.url); });

            item.appendChild(content);
            item.appendChild(del);
            container.appendChild(item);
        });
        if (typeof feather !== 'undefined') feather.replace();
        return true;
    }

    function renderRecentFiles() {
        const container = document.getElementById('mv-recent-files');
        if (!container) return;
        const hasItems = buildRecentItemsInto(
            container,
            url => loadFromUrl(url),
            url => removeRecentFile(url)
        );
        container.classList.toggle('hidden', !hasItems);
    }

    function formatAge(ts) {
        const diff = Date.now() - ts;
        const m = Math.floor(diff / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h ago';
        return Math.floor(h / 24) + 'd ago';
    }

    renderRecentFiles(); // show on page load


    // Marked Config for GFM
    window.marked.setOptions({
        gfm: true,
        breaks: true,
    });

    // Use a marked extension to intercept ONLY mermaid fenced blocks.
    // We cannot override renderer.code because modern marked (v9+) passes a
    // token object internally and calling the original renderer with plain
    // strings causes "Cannot read properties of undefined (reading 'replace')".
    window.marked.use({
        extensions: [{
            name: 'mermaid',
            level: 'block',
            start(src) { return src.indexOf('```mermaid'); },
            tokenizer(src) {
                const match = src.match(/^```mermaid\n([\s\S]*?)```[ \t]*(?:\n|$)/);
                if (match) {
                    return { type: 'mermaid', raw: match[0], text: match[1].trim() };
                }
            },
            renderer(token) {
                return `<div class="mermaid">${token.text}</div>\n`;
            }
        }]
    });

    // Intersect Observer for TOC Active Highlighting
    // threshold:0 fires as soon as any part of heading enters the zone.
    // threshold:1.0 would never fire for tall headings on mobile.
    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -75% 0px',
        threshold: 0
    };
    
    const headingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                document.querySelectorAll('.toc-nav a').forEach(a => a.classList.remove('active'));
                const activeLink = document.querySelector(`.toc-nav a[href="#${id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, observerOptions);

    // Sidebar Logic
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        expandSidebarBtn.classList.remove('hidden');
    });

    expandSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        expandSidebarBtn.classList.add('hidden');
    });

    // Drag and Drop Logic
    if (uploadDropzone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadDropzone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadDropzone.addEventListener(eventName, () => uploadDropzone.classList.add('drag-active'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadDropzone.addEventListener(eventName, () => uploadDropzone.classList.remove('drag-active'), false);
        });

        uploadDropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                processFile(files[0]);
            }
        }, false);
    }

    // URL Loading Logic
    async function loadFromUrl(url) {
        if (!url) return;
        showLoadingState('Fetching ' + (url.split('/').pop() || 'document') + '…');
        try {
            if (url.includes('github.com') && url.includes('/blob/')) {
                url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const text = await response.text();
            currentFileName = url.split('/').pop().replace(/\.(md|markdown)$/i, '.pdf') || 'markview-export.pdf';
            // Update URL so this view is shareable/bookmarkable
            const shareUrl = new URL(window.location.href);
            shareUrl.searchParams.set('url', url);
            history.replaceState(null, '', shareUrl.toString());
            await renderMarkdown(text);
            // Save to recent history — extract title from first H1 or use filename
            const titleMatch = text.match(/^#\s+(.+)$/m);
            const docTitle = (titleMatch ? titleMatch[1].replace(/[*_`]/g, '') : null)
                || url.split('/').pop().replace(/\.(md|markdown)$/i, '');
            saveRecentFile(url, docTitle);
            showViewer();
        } catch (error) {
            hideLoadingState();
            const isCors = error.message.includes('Failed to fetch') || error.message.includes('NetworkError');
            if (isCors) {
                showToast(
                    'CORS Blocked',
                    'The server does not allow cross-origin requests. Try a GitHub raw URL (raw.githubusercontent.com) or any CORS-friendly host.',
                    'error'
                );
            } else {
                showToast('Load Failed', 'Could not load URL: ' + error.message, 'error');
            }
        }
    }

    if (loadUrlBtn && urlInput) {
        loadUrlBtn.addEventListener('click', () => loadFromUrl(urlInput.value));
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadFromUrl(urlInput.value);
        });
    }

    if (headerLoadUrlBtn) {
        headerLoadUrlBtn.addEventListener('click', () => {
            showUrlModal();
        });
    }

    function showUrlModal() {
        let modal = document.getElementById('mv-url-modal');
        if (modal) { modal.remove(); return; }

        modal = document.createElement('div');
        modal.id = 'mv-url-modal';
        modal.className = 'mv-modal';

        const box = document.createElement('div');
        box.className = 'mv-modal-box';

        const h3 = document.createElement('h3');
        h3.textContent = 'Load Markdown from URL';
        box.appendChild(h3);

        const desc = document.createElement('p');
        desc.style.cssText = 'margin-bottom:1.5rem;color:var(--color-text-muted);font-size:0.9rem';
        desc.textContent = 'Enter a public URL, e.g., a GitHub raw URL.';
        box.appendChild(desc);

        const inputGroup = document.createElement('div');
        inputGroup.className = 'url-input-group';
        inputGroup.style.cssText = 'max-width:100%;display:flex;gap:0.5rem';

        const input = document.createElement('input');
        input.type = 'url';
        input.id = 'mv-modal-url-input';
        input.placeholder = 'https://...';
        input.style.cssText = 'flex-grow:1;padding:0.75rem 1rem;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)';

        const loadBtn = document.createElement('button');
        loadBtn.id = 'mv-modal-url-btn';
        loadBtn.className = 'upload-btn';
        loadBtn.style.cssText = 'padding:0.5rem 1.25rem';
        loadBtn.textContent = 'Load';

        inputGroup.appendChild(input);
        inputGroup.appendChild(loadBtn);
        box.appendChild(inputGroup);

        // Recent files via shared builder
        const recentSection = document.createElement('div');
        recentSection.className = 'mv-recent-files';
        recentSection.style.cssText = 'display:block;margin-top:1.5rem;max-width:100%';
        const hasRecent = buildRecentItemsInto(
            recentSection,
            url => { modal.remove(); loadFromUrl(url); },
            url => { removeRecentFile(url); modal.remove(); showUrlModal(); }
        );
        if (hasRecent) box.appendChild(recentSection);

        modal.appendChild(box);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);

        input.focus();
        const submit = () => { const url = input.value.trim(); if (url) { modal.remove(); loadFromUrl(url); } };
        loadBtn.addEventListener('click', submit);
        input.addEventListener('keypress', e => { if (e.key === 'Enter') submit(); });
    }

    // Local File Processing
    function processFile(file) {
        if (!file) return;

        const validExtensions = ['.md', '.markdown', '.mdx', '.txt', '.mdown', '.mkd', '.mkdn' ];
        const fileName = file.name || '';
        const isValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
        const isValidMime = file.type === 'text/markdown' || file.type === 'text/plain';

        if (!isValidExtension && !isValidMime) {
            showToast('Invalid File', 'The uploaded file is not a valid markdown file.', 'error');
            return;
        }

        showLoadingState('Reading ' + file.name + '…');
        const reader = new FileReader();
        reader.onload = async (event) => {
            currentFileName = file.name ? file.name.replace(/\.(md|markdown)$/i, '.pdf') : 'markview-export.pdf';
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('url');
            history.replaceState(null, '', cleanUrl.toString());
            await renderMarkdown(event.target.result);
            showViewer();
        };
        reader.readAsText(file);
    }

    function showViewer() {
        hideLoadingState();
        uploadContainer.classList.add('hidden');
        viewerContainer.classList.remove('hidden');
        if (headerUploadContainer) headerUploadContainer.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (sidebar) sidebar.scrollTop = 0;
    }

    function showLoadingState(msg) {
        msg = msg || 'Rendering…';
        let overlay = document.getElementById('mv-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mv-loading-overlay';
            overlay.innerHTML = '<div class="mv-loading-spinner"></div><span class="mv-loading-msg"></span>';
            document.querySelector('main').appendChild(overlay);
        }
        overlay.querySelector('.mv-loading-msg').textContent = msg;
        overlay.classList.add('visible');
    }

    function hideLoadingState() {
        const o = document.getElementById('mv-loading-overlay');
        if (o) o.classList.remove('visible');
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            processFile(e.target.files[0]);
            e.target.value = '';
        });
    }
    
    if (headerUploadInput) {
        headerUploadInput.addEventListener('change', (e) => {
            processFile(e.target.files[0]);
            e.target.value = '';
        });
    }

    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!markdownContent || markdownContent.innerHTML.trim() === '') return;
            // Set a meaningful document title so the PDF export has proper metadata
            const originalTitle = document.title;
            const docTitle = currentFileName.replace(/\.pdf$/i, '') || 'Markview Export';
            document.title = docTitle;
            window.print();
            document.title = originalTitle;
        });
    }

    // ── Share Button ────────────────────────────────────────────────────────
    const shareBtn = document.getElementById('share-btn');
    function updateShareButton() {
        if (!shareBtn) return;
        const hasUrl = new URLSearchParams(window.location.search).has('url');
        shareBtn.classList.toggle('hidden', !hasUrl);
    }
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href)
                .then(() => showToast('Link Copied', 'Shareable link is in your clipboard.', 'success', 3000))
                .catch(() => showToast('Copy Failed', 'Could not copy link. Copy the URL from your address bar.', 'warning'));
        });
    }
    updateShareButton();

    // Markdown Rendering Pipeline
    async function renderMarkdown(markdown) {
        currentRawMarkdown = markdown;
        markdownContent.innerHTML = '';
        tocNav.innerHTML = '';
        sidebar.classList.remove('collapsed');
        expandSidebarBtn.classList.add('hidden');

        // Strip YAML/TOML frontmatter — anchored to string start (no 'm' flag)
        // The 'm' flag would make ^ match start of any line, accidentally matching
        // '---' horizontal rules mid-document and deleting content between them.
        let processedMarkdown = markdown
            .replace(/^---[\s\S]*?---[ \t]*\n/, '')
            .replace(/^\+\+\+[\s\S]*?\+\+\+[ \t]*\n/, '');

        // ==highlight== => <mark>highlight</mark>
        processedMarkdown = processedMarkdown.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

        // [[WikiLinks]] => [WikiLinks](WikiLinks)  (Obsidian/Foam compatibility)
        processedMarkdown = processedMarkdown.replace(/\[\[([^\]]+)\]\]/g, '[$1]($1)');

        // Subscript: H~2~O => H<sub>2</sub>O
        processedMarkdown = processedMarkdown.replace(/~([^~\n]+?)~/g, '<sub>$1</sub>');

        // Superscript: E=mc^2^ => E=mc<sup>2</sup>
        processedMarkdown = processedMarkdown.replace(/\^([^\^\n]+?)\^/g, '<sup>$1</sup>');

        // Definition lists: Term\n: Definition
        processedMarkdown = processedMarkdown.replace(
            /^([^\n:][^\n]*)\n(?::\s+(.+)\n?)+/gm,
            (match, term) => {
                const defs = [...match.matchAll(/^:\s+(.+)/gm)].map(m => `<dd>${m[1]}</dd>`).join('');
                return `<dl><dt>${term.trim()}</dt>${defs}</dl>\n`;
            }
        );

        // ── Math Extraction ──────────────────────────────────────────────────────
        // We CANNOT use \[...\] or \(...\) as pre-processing output because
        // marked.js treats \[ as an escaped bracket and outputs a literal '[',
        // destroying the KaTeX delimiter before KaTeX ever sees it.
        //
        // Strategy: extract math blocks now → replace with unique opaque tokens
        // (which marked won't touch) → parse markdown → restore tokens as
        // <span class="math-block">...</span> which KaTeX renderMathInElement finds.
        const mathStore = [];

        // Display math: $$...$$  (extract before inline to avoid double-match)
        processedMarkdown = processedMarkdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
            const idx = mathStore.length;
            mathStore.push({ tex: tex.trim(), display: true });
            return `MATHPLACEHOLDER${idx}END`;
        });

        // Inline math: $...$  (single line only, no leading/trailing space)
        processedMarkdown = processedMarkdown.replace(/(?<![\\$])\$([^$\n]+?)\$(?!\$)/g, (_, tex) => {
            const idx = mathStore.length;
            mathStore.push({ tex: tex.trim(), display: false });
            return `MATHPLACEHOLDER${idx}END`;
        });

        let rawHtml = window.marked.parse(processedMarkdown);

        // Restore math placeholders as annotated spans (KaTeX auto-render will pick these up)
        rawHtml = rawHtml.replace(/MATHPLACEHOLDER(\d+)END/g, (_, idx) => {
            const { tex, display } = mathStore[+idx];
            if (display) {
                return `<span class="math-display" data-tex="display">$$${tex}$$</span>`;
            } else {
                return `<span class="math-inline" data-tex="inline">$${tex}$</span>`;
            }
        });

        // GitHub-style Admonitions: > [!NOTE], [!TIP], [!WARNING], [!IMPORTANT], [!CAUTION]
        // Captures ALL content inside the blockquote, not just the first <p>
        rawHtml = rawHtml.replace(
            /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi,
            (_, type, firstBody, rest) => {
                const t = type.toLowerCase();
                const icons = { note: '\u{1F4DD}', tip: '\u{1F4A1}', warning: '\u26A0\uFE0F', important: '\u2757', caution: '\u{1F525}' };
                const icon = icons[t] || '\u{1F4DD}';
                const label = type.charAt(0) + type.slice(1).toLowerCase();
                const body = (firstBody + rest).trim();
                return `<div class="admonition admonition-${t}"><div class="admonition-title">${icon} ${label}</div><div class="admonition-body">${body}</div></div>`;
            }
        );

        // Footnotes: [^1] definitions and references
        const footnoteRefs = {};
        let footnoteCounter = 0;
        // Collect footnote definitions
        rawHtml = rawHtml.replace(/<p>\[\^([^\]]+)\]:\s*([\s\S]*?)<\/p>/g, (_, id, def) => {
            footnoteRefs[id] = def.trim();
            return '';
        });
        // Replace footnote references
        rawHtml = rawHtml.replace(/\[\^([^\]]+)\]/g, (_, id) => {
            footnoteCounter++;
            const def = footnoteRefs[id] || id;
            return `<sup class="footnote-ref"><a href="#fn-${id}" id="fnref-${id}" title="${def}">[${footnoteCounter}]</a></sup>`;
        });
        // Build footnote list at the bottom
        if (Object.keys(footnoteRefs).length > 0) {
            let fnHtml = '<hr><section class="footnotes"><ol>';
            Object.entries(footnoteRefs).forEach(([id, def]) => {
                fnHtml += `<li id="fn-${id}">${def} <a href="#fnref-${id}">↩</a></li>`;
            });
            fnHtml += '</ol></section>';
            rawHtml += fnHtml;
        }
        
        // DOMPurify Sanitization
        // Allows MathML, full Mermaid SVG output, details/summary, mark, sub, sup, kbd
        const sanitizeConfig = {
            ADD_TAGS: [
                'math', 'mi', 'mn', 'mo', 'ms', 'mspace', 'mtext', 'merror', 'mfrac',
                'mpadded', 'mphantom', 'mroot', 'mrow', 'msqrt', 'mstyle', 'mmultiscripts',
                'mover', 'mprescripts', 'msub', 'msubsup', 'msup', 'munder', 'munderover',
                'none', 'semantics', 'annotation', 'annotation-xml',
                // Core SVG
                'svg', 'path', 'g', 'circle', 'line', 'text', 'polygon', 'rect', 'defs',
                'marker', 'use', 'clipPath', 'linearGradient', 'stop', 'tspan',
                // Mermaid v10 extended SVG
                'foreignObject', 'textPath', 'switch', 'image', 'polyline', 'ellipse',
                'feGaussianBlur', 'feDropShadow', 'filter', 'feMerge', 'feMergeNode',
                // HTML extensions
                'details', 'summary', 'mark', 'kbd', 'sub', 'sup', 'dl', 'dt', 'dd'
            ],
            ADD_ATTR: [
                'display', 'xmlns', 'mathvariant', 'mathcolor', 'mathbackground', 'mathsize',
                'dir', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray',
                'transform', 'class', 'id', 'x', 'y', 'width', 'height', 'r', 'cx', 'cy',
                'open', 'checked', 'disabled', 'type', 'marker-end', 'marker-start',
                'refX', 'refY', 'orient', 'markerWidth', 'markerHeight', 'markerUnits',
                'x1', 'x2', 'y1', 'y2', 'points', 'rx', 'ry', 'gradientUnits', 'offset',
                'stdDeviation', 'flood-color', 'flood-opacity', 'result', 'in', 'in2'
            ],
            FORCE_BODY: true,
        };
        
        const safeHtml = window.DOMPurify.sanitize(rawHtml, sanitizeConfig);
        
        markdownContent.innerHTML = safeHtml;

        // Handle broken images: attach onerror before browser paints.
        // The 404 network request still fires (unavoidable), but the broken-image
        // icon is replaced with a clean inline notice.
        markdownContent.querySelectorAll('img').forEach(img => {
            img.loading = 'lazy'; // #16: defer off-screen images
            img.onerror = function() {
                const notice = document.createElement('span');
                notice.className = 'img-broken';
                notice.textContent = `\u26A0 Image not found: ${this.alt || this.src}`;
                this.replaceWith(notice);
            };
        });

        // Strip TOC if generated by markdown
        const mainHeadings = Array.from(markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const tocHeadingIndex = mainHeadings.findIndex(h => {
            const text = h.textContent.trim().toLowerCase();
            return text === 'table of contents' || text === 'toc';
        });
        
        if (tocHeadingIndex !== -1) {
            let node = mainHeadings[tocHeadingIndex];
            while (node.nextElementSibling && !['H1','H2','H3','H4','H5','H6'].includes(node.nextElementSibling.tagName)) {
                node.nextElementSibling.remove();
            }
            node.remove();
        }

        buildTOC();
        
        // 1. Fallback Highlighting: PrismJS (Instant)
        showLoadingState('Applying syntax highlighting\u2026');
        if (window.Prism) {
            window.Prism.highlightAllUnder(markdownContent);
        }
        
        // 2. Add Copy Buttons
        addCopyButtons();
        if (typeof feather !== 'undefined') feather.replace();

        // 3. Wait for heavy dependencies to finish loading before rendering Math/Mermaid/Shiki
        showLoadingState('Loading math & diagram engines\u2026');
        await preloadHeavyDependencies();

        // 4. Render Math via KaTeX
        if (renderMathInElement) {
            renderMathInElement(markdownContent, {
                delimiters: [
                    { left: '$$', right: '$$', display: true  },
                    { left: '$',  right: '$',  display: false },
                    { left: '\\[', right: '\\]', display: true  },
                    { left: '\\(', right: '\\)', display: false },
                ],
                throwOnError: false,
                ignoredTags: ['script', 'noscript', 'style', 'pre', 'code'],
            });
        }

        // 5. Render Mermaid — with per-node error boundary
        currentRawMermaidSources = [];
        const mermaidNodes = markdownContent.querySelectorAll('.mermaid:not([data-processed="true"])');
        if (mermaidNodes.length > 0 && mermaid) {
            try {
                const isDarkForMermaid = document.documentElement.getAttribute('data-theme') === 'dark';
                mermaid.initialize({ startOnLoad: false, theme: isDarkForMermaid ? 'dark' : 'default' });
                mermaidNodes.forEach((node, i) => {
                    currentRawMermaidSources[i] = node.textContent.trim();
                    node.id = 'mermaid-' + Date.now() + '-' + i;
                });
                mermaid.run({ nodes: Array.from(mermaidNodes) }).catch(e => {
                    console.error('Mermaid render error', e);
                    mermaidNodes.forEach(node => {
                        if (!node.querySelector('svg')) {
                            node.innerHTML = `<pre style="color:#f85149;font-size:0.85rem">\u26A0 Diagram error: ${e.message}</pre>`;
                        }
                    });
                });
            } catch(e) {
                console.error('Mermaid sync error', e);
            }
        }

        // 6. High-fidelity Highlighting: Shiki
        showLoadingState('Rendering code blocks\u2026');
        applyShikiHighlighting();

        // 7. Word count + reading time
        updateDocumentStats(markdown);
        updateShareButton();
    }

    function updateDocumentStats(markdown) {
        const cleanText = markdown
            .replace(/^---[\s\S]*?---[ \t]*\n/, '')    // strip frontmatter
            .replace(/```[\s\S]*?```/g, '')              // strip fenced code
            .replace(/`[^`]+`/g, '')                    // strip inline code
            .replace(/[#*`_~\[\]()>|]/g, ' ')
            .trim();
        const words = cleanText.split(/\s+/).filter(Boolean).length;
        const readingMin = Math.max(1, Math.round(words / 200));

        // Write to the dedicated stats bar inside the viewer — never touch the header
        const bar = document.getElementById('mv-doc-stats-bar');
        if (bar) {
            bar.textContent = words.toLocaleString() + ' words  ~ ' + readingMin + ' min read';
            bar.classList.remove('hidden');
        }
    }

    function applyShikiHighlighting() {
        if (!highlighter) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const theme = isDark ? 'github-dark' : 'github-light';
        const aliases = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
            'sh': 'bash', 'yml': 'yaml', 'md': 'markdown', 'c++': 'cpp',
            'golang': 'go', 'rs': 'rust'
        };

        // Collect any languages not yet loaded, then lazy-load them
        const pendingLangs = new Set();
        markdownContent.querySelectorAll('pre').forEach((pre) => {
            const code = pre.querySelector('code');
            let lang = (pre.getAttribute('data-lang')) || '';
            if (!lang && code) {
                const m = code.className.match(/language-([^\s]+)/);
                if (m) lang = m[1];
            }
            const canon = aliases[lang] || lang;
            if (canon && !highlighter.getLoadedLanguages().includes(canon) && bundledLanguages && bundledLanguages[canon]) {
                pendingLangs.add(canon);
            }
        });

        const doHighlight = () => {
            const loaded = highlighter.getLoadedLanguages();
            markdownContent.querySelectorAll('pre').forEach((pre) => {
                if (pre.classList.contains('shiki') && pre.getAttribute('data-theme-applied') === theme) return;
                let rawCode = '', lang = 'text';
                if (pre.classList.contains('shiki')) {
                    rawCode = pre.getAttribute('data-raw-code') || '';
                    lang = pre.getAttribute('data-lang') || 'text';
                } else {
                    const code = pre.querySelector('code');
                    if (!code) return;
                    const btn = pre.querySelector('.copy-code-btn');
                    if (btn) btn.remove();
                    rawCode = code.textContent.trimEnd();
                    if (btn) pre.appendChild(btn);
                    const m = code.className.match(/language-([^\s]+)/);
                    if (m) lang = m[1];
                }
                if (!rawCode) return;
                const canon = aliases[lang] || lang;
                if (!loaded.includes(canon)) return;
                try {
                    const html = highlighter.codeToHtml(rawCode, { lang: canon, theme });
                    const temp = document.createElement('div');
                    temp.innerHTML = html;
                    const newPre = temp.firstElementChild;
                    newPre.setAttribute('data-raw-code', rawCode);
                    newPre.setAttribute('data-lang', lang);
                    newPre.setAttribute('data-theme-applied', theme);
                    newPre.style.position = 'relative';
                    const btn = pre.querySelector('.copy-code-btn');
                    if (btn) newPre.appendChild(btn);
                    pre.replaceWith(newPre);
                } catch (err) {
                    console.error('Shiki highlighting error:', err);
                }
            });
        };

        if (pendingLangs.size > 0) {
            Promise.all(Array.from(pendingLangs).map(l => highlighter.loadLanguage(l)))
                .then(doHighlight).catch(doHighlight);
        } else {
            doHighlight();
        }
    }

    // Theme toggle observer — batched DOM updates to prevent per-element repaints
    let themeDebounce = null;
    const observer = new MutationObserver((mutations) => {
        if (!mutations.some(m => m.attributeName === 'data-theme')) return;
        clearTimeout(themeDebounce);
        themeDebounce = setTimeout(() => {
            requestAnimationFrame(() => {
                // ── Shiki re-highlight ──────────────────────────────────────
                // Collect ALL replacements first, then apply in one synchronous
                // pass so the browser composites a single repaint, not N reflows.
                if (highlighter && markdownContent.innerHTML.trim() !== '') {
                    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    const theme  = isDark ? 'github-dark' : 'github-light';

                    // Save scroll positions before any DOM surgery
                    const pageScrollY    = window.scrollY;
                    const tocScrollTop   = sidebar ? sidebar.scrollTop : 0;

                    const aliases = {
                        'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
                        'sh': 'bash', 'yml': 'yaml', 'md': 'markdown', 'c++': 'cpp',
                        'golang': 'go', 'rs': 'rust'
                    };
                    const loaded = highlighter.getLoadedLanguages();

                    // Phase 1: build all new nodes in memory (no DOM writes yet)
                    const replacements = []; // [ { oldPre, newPre } ]
                    markdownContent.querySelectorAll('pre').forEach((pre) => {
                        if (pre.classList.contains('shiki') &&
                            pre.getAttribute('data-theme-applied') === theme) return;

                        let rawCode = '', lang = 'text';
                        if (pre.classList.contains('shiki')) {
                            rawCode = pre.getAttribute('data-raw-code') || '';
                            lang    = pre.getAttribute('data-lang') || 'text';
                        } else {
                            const code = pre.querySelector('code');
                            if (!code) return;
                            const btn = pre.querySelector('.copy-code-btn');
                            if (btn) btn.remove();
                            rawCode = code.textContent.trimEnd();
                            if (btn) pre.appendChild(btn);
                            const m = code.className.match(/language-([^\s]+)/);
                            if (m) lang = m[1];
                        }
                        if (!rawCode) return;
                        const canon = aliases[lang] || lang;
                        if (!loaded.includes(canon)) return;

                        try {
                            const html = highlighter.codeToHtml(rawCode, { lang: canon, theme });
                            const temp = document.createElement('div');
                            temp.innerHTML = html;
                            const newPre = temp.firstElementChild;
                            newPre.setAttribute('data-raw-code', rawCode);
                            newPre.setAttribute('data-lang', lang);
                            newPre.setAttribute('data-theme-applied', theme);
                            newPre.style.position = 'relative';
                            const btn = pre.querySelector('.copy-code-btn');
                            if (btn) newPre.appendChild(btn);
                            replacements.push({ oldPre: pre, newPre });
                        } catch (err) {
                            console.error('Shiki theme-switch error:', err);
                        }
                    });

                    // Phase 2: apply all DOM swaps in one synchronous batch
                    replacements.forEach(({ oldPre, newPre }) => oldPre.replaceWith(newPre));

                    // Phase 3: restore scroll positions (DOM surgery can shift them)
                    window.scrollTo({ top: pageScrollY, behavior: 'instant' });
                    if (sidebar) sidebar.scrollTop = tocScrollTop;
                }

                // ── Mermaid re-render ───────────────────────────────────────
                if (mermaid && currentRawMermaidSources.length > 0) {
                    const isDarkM = document.documentElement.getAttribute('data-theme') === 'dark';
                    mermaid.initialize({ startOnLoad: false, theme: isDarkM ? 'dark' : 'default' });
                    markdownContent.querySelectorAll('.mermaid').forEach((node, i) => {
                        if (currentRawMermaidSources[i]) {
                            node.removeAttribute('data-processed');
                            node.innerHTML = currentRawMermaidSources[i];
                            node.id = 'mermaid-theme-' + Date.now() + '-' + i;
                        }
                    });
                    const freshNodes = Array.from(markdownContent.querySelectorAll('.mermaid'));
                    if (freshNodes.length) mermaid.run({ nodes: freshNodes }).catch(() => {});
                }
            });
        }, 0); // Fire immediately — DOM changes happen while viewport is opacity:0
    });
    observer.observe(document.documentElement, { attributes: true });

    // ── Global Paste: Ctrl+V raw markdown ─────────────────────────────
    document.addEventListener('paste', async (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        const text = e.clipboardData.getData('text/plain');
        if (text && text.includes('\n')) {
            e.preventDefault();
            showLoadingState('Rendering pasted markdown…');
            currentFileName = 'pasted-document.pdf';
            await renderMarkdown(text);
            showViewer();
        }
    });

    // ── Keyboard Shortcuts ────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault(); showShortcutsHelp();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            (headerUploadInput || uploadInput) && (headerUploadInput || uploadInput).click();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            const inp = document.getElementById('markdown-url');
            if (inp) inp.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            if (markdownContent && markdownContent.innerHTML.trim() !== '') {
                e.preventDefault(); window.print();
            }
        }
        if (e.key === 'Escape') {
            // Close any open modal first — don't lose the document
            const openModal = document.querySelector('.mv-modal');
            if (openModal) { openModal.remove(); return; }
            if (!viewerContainer.classList.contains('hidden')) {
                viewerContainer.classList.add('hidden');
                uploadContainer.classList.remove('hidden');
                if (headerUploadContainer) headerUploadContainer.classList.add('hidden');
                const cu = new URL(window.location.href);
                cu.searchParams.delete('url');
                history.replaceState(null, '', cu.toString());
            }
        }
    });

    function showShortcutsHelp() {
        let modal = document.getElementById('mv-shortcuts-modal');
        if (modal) { modal.remove(); return; }
        modal = document.createElement('div');
        modal.id = 'mv-shortcuts-modal';
        modal.className = 'mv-modal';
        modal.innerHTML = '<div class="mv-modal-box">' +
            '<h3>Keyboard Shortcuts</h3>' +
            '<table>' +
            '<tr><td><kbd>?</kbd></td><td>Show / hide this panel</td></tr>' +
            '<tr><td><kbd>Ctrl O</kbd></td><td>Open file picker</td></tr>' +
            '<tr><td><kbd>Ctrl L</kbd></td><td>Focus URL input</td></tr>' +
            '<tr><td><kbd>Ctrl P</kbd></td><td>Export PDF</td></tr>' +
            '<tr><td><kbd>Esc</kbd></td><td>Return to upload screen</td></tr>' +
            '<tr><td><kbd>Ctrl+V</kbd></td><td>Paste markdown directly</td></tr>' +
            '</table>' +
            '<p class="mv-shortcuts-hint">Press <kbd>?</kbd> or click outside to close</p>' +
            '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function addCopyButtons() {
        markdownContent.querySelectorAll('pre').forEach(block => {
            if (block.querySelector('.copy-code-btn')) return;
            
            const button = document.createElement('button');
            button.className = 'copy-code-btn';
            button.setAttribute('aria-label', 'Copy code');
            button.setAttribute('title', 'Copy to clipboard');
            button.innerHTML = '<i data-feather="copy"></i>';

            button.addEventListener('click', () => {
                // If Shiki block, we saved raw code in dataset
                let codeText = block.getAttribute('data-raw-code');
                
                if (!codeText) {
                    const code = block.querySelector('code');
                    if (code) {
                        codeText = code.textContent.trimEnd();
                    } else {
                        const clone = block.cloneNode(true);
                        const btn = clone.querySelector('.copy-code-btn');
                        if (btn) btn.remove();
                        codeText = clone.textContent.trimEnd();
                    }
                }

                const showSuccess = () => {
                    button.innerHTML = '<i data-feather="check"></i>';
                    button.classList.add('copied');
                    if (typeof feather !== 'undefined') feather.replace();

                    setTimeout(() => {
                        button.innerHTML = '<i data-feather="copy"></i>';
                        button.classList.remove('copied');
                        if (typeof feather !== 'undefined') feather.replace();
                    }, 2000);
                };

                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(codeText).then(showSuccess).catch(() => {
                        console.warn('Clipboard write failed.');
                    });
                } else {
                    console.warn('Clipboard API unavailable in non-secure context.');
                }
            });

            block.style.position = 'relative';
            block.appendChild(button);
        });
    }

    function buildTOC() {
        headingObserver.disconnect();
        
        const headings = markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
        tocNav.innerHTML = ''; 
        
        if (headings.length === 0) {
            tocNav.innerHTML = '<p class="no-toc">No headings found.</p>';
            return;
        }

        // Slug map tracks duplicates: 'intro' seen twice → 'intro' + 'intro-1'
        const slugMap = new Map();
        function slugify(text, index) {
            const base = text
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
                .toLowerCase()
                .replace(/[^\w\s-]/g, '')            // strip non-word chars
                .replace(/[\s_]+/g, '-')             // spaces to hyphens
                .replace(/(^-|-$)/g, '')             // trim hyphens
                || `heading-${index}`;
            const count = slugMap.get(base) || 0;
            slugMap.set(base, count + 1);
            return count === 0 ? base : `${base}-${count}`;
        }

        const ul = document.createElement('ul');
        tocNav.appendChild(ul);

        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = slugify(heading.textContent.trim(), index);
            }
            
            headingObserver.observe(heading);

            const li = document.createElement('li');
            li.className = `toc-${heading.tagName.toLowerCase()}`;
            
            const a = document.createElement('a');
            a.href = `#${heading.id}`;
            a.textContent = heading.textContent;
            
            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth' });
                history.pushState(null, null, `#${heading.id}`);
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
    }
});
