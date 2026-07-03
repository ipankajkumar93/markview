import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
import renderMathInElement from 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.mjs';
import { getHighlighter, bundledLanguages } from 'https://esm.sh/shiki@1.0.0';

document.addEventListener('DOMContentLoaded', async () => {
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

    // Initialize Mermaid
    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    // Initialize Shiki with all supported languages preloaded
    let highlighter = null;
    getHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: Object.keys(bundledLanguages)
    }).then(h => {
        highlighter = h;
        if (markdownContent.innerHTML.trim() !== '') {
            applyShikiHighlighting();
        }
    }).catch(err => console.error("Failed to load Shiki", err));

    // Marked Config for GFM
    window.marked.setOptions({
        gfm: true,
        breaks: true,
    });

    const renderer = new window.marked.Renderer();
    const originalCodeRenderer = renderer.code.bind(renderer);
    
    renderer.code = function(code, language, isEscaped) {
        if (language === 'mermaid') {
            return `<div class="mermaid">${code}</div>`;
        }
        if (language === 'math') {
            return `\\[${code}\\]`;
        }
        return originalCodeRenderer(code, language, isEscaped);
    };

    window.marked.use({ renderer });

    // Intersect Observer for TOC Active Highlighting
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -80% 0px',
        threshold: 1.0
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
        try {
            // Support GitHub normal URLs by converting to raw
            if (url.includes('github.com') && url.includes('/blob/')) {
                url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            currentFileName = url.split('/').pop().replace(/\.(md|markdown)$/i, '.pdf') || 'markview-export.pdf';
            renderMarkdown(text);
            showViewer();
        } catch (error) {
            alert(`Failed to load URL: ${error.message}\nMake sure the URL is publicly accessible and allows CORS (like raw.githubusercontent.com).`);
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
            const url = prompt("Enter Markdown URL (e.g., GitHub raw URL):");
            if (url) {
                loadFromUrl(url.trim());
            }
        });
    }

    // Local File Processing
    function processFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            currentFileName = file.name ? file.name.replace(/\.(md|markdown)$/i, '.pdf') : 'markview-export.pdf';
            renderMarkdown(event.target.result);
            showViewer();
        };
        reader.readAsText(file);
    }

    function showViewer() {
        uploadContainer.classList.add('hidden');
        viewerContainer.classList.remove('hidden');
        if (headerUploadContainer) {
            headerUploadContainer.classList.remove('hidden');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (sidebar) sidebar.scrollTop = 0;
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
            window.print();
        });
    }

    // Markdown Rendering Pipeline
    function renderMarkdown(markdown) {
        currentRawMarkdown = markdown;
        markdownContent.innerHTML = '';
        tocNav.innerHTML = '';
        sidebar.classList.remove('collapsed');
        expandSidebarBtn.classList.add('hidden');

        // Pre-process math blocks that might not be caught by marked
        let processedMarkdown = markdown.replace(/\$\$(.*?)\$\$/gs, (_, math) => `\\[${math}\\]`);
        processedMarkdown = processedMarkdown.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, math) => `\\(${math}\\)`);

        let rawHtml = window.marked.parse(processedMarkdown);
        
        // DOMPurify Sanitization - configure to allow MathML and SVGs safely
        const sanitizeConfig = {
            ADD_TAGS: ['math', 'mi', 'mn', 'mo', 'ms', 'mspace', 'mtext', 'merror', 'mfrac', 'mpadded', 'mphantom', 'mroot', 'mrow', 'msqrt', 'mstyle', 'mmultiscripts', 'mover', 'mprescripts', 'msub', 'msubsup', 'msup', 'munder', 'munderover', 'none', 'semantics', 'annotation', 'annotation-xml', 'svg', 'path', 'g', 'circle', 'line', 'text', 'polygon', 'rect'],
            ADD_ATTR: ['display', 'xmlns', 'mathvariant', 'mathcolor', 'mathbackground', 'mathsize', 'dir', 'viewBox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'transform', 'class', 'id', 'x', 'y', 'width', 'height', 'r', 'cx', 'cy'],
        };
        
        const safeHtml = window.DOMPurify.sanitize(rawHtml, sanitizeConfig);
        
        markdownContent.innerHTML = safeHtml;

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

        // 1. Render Math
        renderMathInElement(markdownContent, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '\\[', right: '\\]', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
            ],
            throwOnError: false
        });

        // 2. Render Mermaid
        const mermaidNodes = markdownContent.querySelectorAll('.mermaid');
        if (mermaidNodes.length > 0) {
            try {
                // Ensure nodes have unique IDs for mermaid
                mermaidNodes.forEach((node, i) => {
                    const id = `mermaid-${Date.now()}-${i}`;
                    node.id = id;
                });
                mermaid.run({ nodes: Array.from(mermaidNodes) }).catch(e => console.error("Mermaid error", e));
            } catch(e) {
                console.error("Mermaid sync error", e);
            }
        }

        // 3. Fallback Highlighting: PrismJS
        if (window.Prism) {
            window.Prism.highlightAllUnder(markdownContent);
        }
        
        // 4. Add Copy Buttons
        addCopyButtons();

        // 5. High-fidelity Highlighting: Shiki
        applyShikiHighlighting();
        
        if (typeof feather !== 'undefined') feather.replace();
    }

    function applyShikiHighlighting() {
        if (!highlighter) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const theme = isDark ? 'github-dark' : 'github-light';

        markdownContent.querySelectorAll('pre').forEach((pre) => {
            // Ignore if it's already highlighted by shiki in this theme
            if (pre.classList.contains('shiki') && pre.getAttribute('data-theme-applied') === theme) return;
            
            let rawCode = '';
            let lang = 'text';
            
            if (pre.classList.contains('shiki')) {
                rawCode = pre.getAttribute('data-raw-code');
                lang = pre.getAttribute('data-lang');
            } else {
                const code = pre.querySelector('code');
                if (!code) return;
                
                // Temporarily detach copy button so it doesn't get swept into raw code
                const btn = pre.querySelector('.copy-code-btn');
                if (btn) btn.remove();
                
                rawCode = code.textContent.trimEnd();
                
                if (btn) pre.appendChild(btn); // put it back
                
                const classMatch = code.className.match(/language-([^\s]+)/);
                if (classMatch) lang = classMatch[1];
            }
            
            if (!rawCode) return;
            
            try {
                // Resolve common aliases
                const aliases = {
                    'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
                    'sh': 'bash', 'yml': 'yaml', 'md': 'markdown', 'c++': 'cpp',
                    'golang': 'go', 'rs': 'rust', 'html': 'html', 'css': 'css'
                };
                let canonicalLang = aliases[lang] || lang;

                if (!highlighter.getLoadedLanguages().includes(canonicalLang)) {
                    // If language is not supported by Shiki at all, do NOT replace Prism fallback.
                    return; 
                }
                
                const html = highlighter.codeToHtml(rawCode, { lang: canonicalLang, theme });
                const temp = document.createElement('div');
                temp.innerHTML = html;
                const newPre = temp.firstElementChild;
                
                newPre.setAttribute('data-raw-code', rawCode);
                newPre.setAttribute('data-lang', lang);
                newPre.setAttribute('data-theme-applied', theme);
                newPre.style.position = 'relative';
                
                // Preserve copy button
                const existingBtn = pre.querySelector('.copy-code-btn');
                if (existingBtn) {
                    newPre.appendChild(existingBtn);
                }
                
                pre.replaceWith(newPre);
            } catch (err) {
                console.error("Shiki highlighting error:", err);
            }
        });
    }

    // Watch for theme toggles to re-highlight Shiki blocks dynamically
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                if (highlighter && markdownContent.innerHTML.trim() !== '') {
                    applyShikiHighlighting();
                }
                // also update mermaid theme if possible, but mermaid requires re-render
                // For simplicity, Mermaid will stay in its initialized theme unless reloaded
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

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
                    navigator.clipboard.writeText(codeText).then(showSuccess).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = codeText;
                    textArea.style.position = "fixed";
                    textArea.style.opacity = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        showSuccess();
                    } catch (err) {
                        console.error('Fallback copy failed', err);
                    }
                    document.body.removeChild(textArea);
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

        const ul = document.createElement('ul');
        tocNav.appendChild(ul);

        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `heading-${index}`;
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
