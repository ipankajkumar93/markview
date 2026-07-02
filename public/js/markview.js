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

    // Handle File Upload
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const markdownText = event.target.result;
            renderMarkdown(markdownText);
            
            // Hide upload, show viewer
            uploadContainer.classList.add('hidden');
            viewerContainer.classList.remove('hidden');
        };
        reader.readAsText(file);
    });

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
        
        // Re-initialize feather icons if any were in the text (optional)
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // Apply syntax highlighting to code blocks
        if (typeof hljs !== 'undefined') {
            markdownContent.querySelectorAll('pre code').forEach((block) => {
                try {
                    const match = block.className.match(/language-([a-z0-9\-]+)/i);
                    let highlighted = false;
                    
                    if (match && hljs.getLanguage(match[1])) {
                        const result = hljs.highlight(block.textContent, { language: match[1] });
                        block.innerHTML = result.value;
                        highlighted = true;
                    } else {
                        const result = hljs.highlightAuto(block.textContent);
                        block.innerHTML = result.value;
                        highlighted = true;
                    }
                    
                    if (highlighted) {
                        block.classList.add('hljs');
                    }
                } catch (err) {
                    console.error("Syntax highlighting error:", err);
                }
            });
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
