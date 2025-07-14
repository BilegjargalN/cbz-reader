export const elements = {
    fileInput: document.getElementById('file-input'),
    viewerArea: document.getElementById('viewer-area'),
    viewer: document.getElementById('viewer'),
    welcomeMessage: document.getElementById('welcome-message'),
    readerControls: document.getElementById('reader-controls'),
    pagedControls: document.getElementById('paged-controls'),
    pageJumpControls: document.getElementById('page-jump-controls'),
    comicFilename: document.getElementById('comic-filename'),
    prevButton: document.getElementById('prev-button'),
    nextButton: document.getElementById('next-button'),
    pageCounter: document.getElementById('page-counter'),
    pageInput: document.getElementById('page-input'),
    pageGoButton: document.getElementById('page-go-button'),
    modeRadios: document.querySelectorAll('input[name="reading-mode"]'),
    doublePanelToggle: document.getElementById('double-panel-toggle'),
    themeSelector: document.getElementById('theme-selector'),
    autoscrollToggle: document.getElementById('autoscroll-toggle'),
    autoscrollIntervalInput: document.getElementById('autoscroll-interval'),
    sidebarLeft: document.getElementById('sidebar-left'),
    sidebarRight: document.getElementById('sidebar-right'),
    sidebarToggles: document.querySelectorAll('.sidebar-toggle'),
    thumbnailContainer: document.getElementById('thumbnail-container'),
};

export function applyTheme(themeName) {
    document.body.className = themeName;
    localStorage.setItem('comicReaderTheme', themeName);
}

export function loadPreferences() {
    const savedTheme = localStorage.getItem('comicReaderTheme') || 'theme-antique-paper';
    elements.themeSelector.value = savedTheme;
    applyTheme(savedTheme);
}

export function updateNavigation(comicBook, currentPage, readingMode, isDoublePanel) {
    const isPagedMode = readingMode !== 'webtoon';
    elements.pagedControls.style.display = isPagedMode ? 'block' : 'none';
    elements.pageJumpControls.style.display = 'block';

    if (isPagedMode) {
        const step = isDoublePanel ? 2 : 1;
        const pageDisplay = isDoublePanel && currentPage + 1 < comicBook.pageCount
            ? `${currentPage + 1}-${currentPage + 2}`
            : `${currentPage + 1}`;
        elements.pageCounter.textContent = `Page ${pageDisplay} of ${comicBook.pageCount}`;
        elements.prevButton.disabled = currentPage === 0;
        elements.nextButton.disabled = currentPage >= comicBook.pageCount - step;
    } else {
        elements.pageCounter.textContent = `Webtoon Mode`;
    }

    const thumbs = elements.thumbnailContainer.querySelectorAll('img');
    thumbs.forEach((thumb, index) => {
        const step = isDoublePanel && isPagedMode ? 2 : 1;
        thumb.classList.toggle('active', index >= currentPage && index < currentPage + step);
    });
}

export async function populateThumbnails(comicBook, goToPageCallback) {
    elements.thumbnailContainer.innerHTML = '';
    if (!comicBook || comicBook.pageCount === 0) {
        return;
    }
    for (let i = 0; i < comicBook.pageCount; i++) {
        const imageUrl = await comicBook.getPageBlob(i);
        if (imageUrl) {
            const thumb = document.createElement('img');
            thumb.src = imageUrl;
            thumb.alt = `Page ${i + 1}`;
            thumb.classList.add('thumbnail');
            thumb.addEventListener('click', () => goToPageCallback(i));
            elements.thumbnailContainer.appendChild(thumb);
        }
    }
}
