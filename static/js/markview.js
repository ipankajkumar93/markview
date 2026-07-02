document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('markdown-upload');
    const uploadContainer = document.getElementById('upload-container');
    const viewerContainer = document.getElementById('viewer-container');
    const markdownContent = document.getElementById('markdown-content');
    const tocNav = document.getElementById('toc-nav');
    
    const sidebar = document.getElementById('toc-sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar');
    const expandSidebarBtn = document.getElementById('expand-sidebar');

    // Sidebar Toggle Logic
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        expandSidebarBtn.classList.remove('hidden');
    });

    expandSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        expandSidebarBtn.classList.add('hidden');
    });

    const headerUploadInput = document.getElementById('header-markdown-upload');
    const headerUploadContainer = document.getElementById('header-upload-container');

    let currentFileName = 'markview-export.pdf';

    // Handle File Upload
    function processFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const markdownText = event.target.result;
            
            // Set filename based on original file
            if (file.name) {
                currentFileName = file.name.replace(/\.(md|markdown)$/i, '.pdf');
            } else {
                currentFileName = 'markview-export.pdf';
            }
            
            // Clear existing content to be safe
            markdownContent.innerHTML = '';
            tocNav.innerHTML = '';
            
            // Reset sidebar state if collapsed
            sidebar.classList.remove('collapsed');
            expandSidebarBtn.classList.add('hidden');
            
            renderMarkdown(markdownText);
            
            // Hide upload, show viewer and header upload button
            uploadContainer.classList.add('hidden');
            viewerContainer.classList.remove('hidden');
            if (headerUploadContainer) {
                headerUploadContainer.classList.remove('hidden');
            }
            
            // Re-initialize feather icons for new content if needed
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            // Scroll back to top for both main window and sidebar
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (sidebar) {
                sidebar.scrollTop = 0;
            }
        };
        reader.readAsText(file);
    }

    uploadInput.addEventListener('change', (e) => {
        processFile(e.target.files[0]);
        e.target.value = ''; // Reset input
    });
    
    if (headerUploadInput) {
        headerUploadInput.addEventListener('change', (e) => {
            processFile(e.target.files[0]);
            e.target.value = ''; // Reset input
        });
    }

    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!markdownContent || markdownContent.innerHTML.trim() === '') return;
            window.print();
        });
    }

    function renderMarkdown(markdown) {
        // Parse markdown to HTML
        let rawHtml = marked.parse(markdown);
        
        // Sanitize
        let safeHtml = DOMPurify.sanitize(rawHtml);
        
        markdownContent.innerHTML = safeHtml;

        // Remove existing Table of Contents from main content if present
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
        
        // Apply syntax highlighting to code blocks
        if (typeof hljs !== 'undefined') {
            markdownContent.querySelectorAll('pre code').forEach((block) => {
                try {
                    hljs.highlightElement(block);
                } catch (err) {
                    console.error("Syntax highlighting error:", err);
                }
            });
        }

        // Add Copy Code Buttons
        markdownContent.querySelectorAll('pre').forEach(block => {
            if (block.querySelector('.copy-code-btn') || !block.querySelector('code')) return;

            const button = document.createElement('button');
            button.className = 'copy-code-btn';
            button.setAttribute('aria-label', 'Copy code');
            button.setAttribute('title', 'Copy to clipboard');
            button.innerHTML = '<i data-feather="copy"></i>';

            button.addEventListener('click', () => {
                const code = block.querySelector('code');
                if (!code) return;

                const textToCopy = code.textContent.trimEnd();

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
                    navigator.clipboard.writeText(textToCopy).then(showSuccess).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = textToCopy;
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

            block.appendChild(button);
        });

        // Re-initialize feather icons if any were in the text (optional) and for copy buttons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        buildTOC();
    }

    function buildTOC() {
        // Find all headings inside markdown-content
        const headings = markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
        tocNav.innerHTML = ''; // Clear existing TOC
        
        if (headings.length === 0) {
            tocNav.innerHTML = '<p class="no-toc">No headings found.</p>';
            return;
        }

        const ul = document.createElement('ul');
        tocNav.appendChild(ul);

        headings.forEach((heading, index) => {
            // Ensure heading has an ID
            if (!heading.id) {
                heading.id = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `heading-${index}`;
            }

            const li = document.createElement('li');
            li.className = `toc-${heading.tagName.toLowerCase()}`;
            
            const a = document.createElement('a');
            a.href = `#${heading.id}`;
            a.textContent = heading.textContent;
            
            // Smooth scroll listener
            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth' });
                // Update URL hash without jumping
                history.pushState(null, null, `#${heading.id}`);
            });

            li.appendChild(a);
            ul.appendChild(li);
        });
    }
});
