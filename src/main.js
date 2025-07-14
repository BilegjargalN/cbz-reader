import '@fortawesome/fontawesome-free/css/all.css';
import './style.css';
import { elements, applyTheme, loadPreferences, updateNavigation, populateThumbnails } from './ui.js';
import { ComicBook } from './comic-book.js';

document.addEventListener('DOMContentLoaded', () => {
    let comicBook = null;
    let currentPage = 0;
    let readingMode = 'comic';
    let isDoublePanel = false;
    let autoscrollInterval = null;
    let autoscrollPaused = false;
    let isPageChanging = false;
    const keysDown = {};
    let scrollAnimation;
    let webtoonScrollTimeout;

    function smoothScroll(targetPosition) {
        cancelAnimationFrame(scrollAnimation);
        const startPosition = elements.viewerArea.scrollTop;
        const distance = targetPosition - startPosition;
        const duration = 100;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const run = Math.min(timeElapsed / duration, 1);
            elements.viewerArea.scrollTop = startPosition + distance * run;
            if (timeElapsed < duration) {
                scrollAnimation = requestAnimationFrame(animation);
            }
        }
        scrollAnimation = requestAnimationFrame(animation);
    }

    async function loadComic(file) {
        try {
            comicBook = await ComicBook.loadFromFile(file);
            elements.comicFilename.textContent = comicBook.name;
            elements.welcomeMessage.classList.add('hidden');
            elements.readerControls.classList.remove('hidden');
            document.getElementById('sidebar-right-toggle').classList.remove('hidden');
            elements.sidebarRight.classList.remove('hidden');
            elements.sidebarRight.classList.add('collapsed');
            elements.pageInput.max = comicBook.pageCount;
            
            const lastRead = getLastRead();
            if (lastRead && lastRead.name === comicBook.name) {
                currentPage = lastRead.page || 0;
                readingMode = lastRead.mode || 'comic';
                isDoublePanel = lastRead.isDoublePanel || false;

                document.querySelector(`input[name="reading-mode"][value="${readingMode}"]`).checked = true;
                elements.doublePanelToggle.checked = isDoublePanel;
            } else {
                currentPage = 0;
                readingMode = 'comic';
                isDoublePanel = false;
            }

            await render();
            populateThumbnails(comicBook, goToPage);
        } catch (error) {
            console.error('Error loading CBZ file:', error);
            alert(`Error loading CBZ file: ${error.message}`);
        }
    }

    function setupLastReadPrompt() {
        const lastRead = getLastRead();
        const lastReadPrompt = document.getElementById('last-read-prompt');
        if (lastRead && lastRead.name) {
            lastReadPrompt.innerHTML = `Continue reading <strong>${lastRead.name}</strong>?`;
            lastReadPrompt.classList.remove('hidden');
            lastReadPrompt.addEventListener('click', () => {
                elements.fileInput.click();
            });
        }
    }

    elements.fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.cbz')) return;
        await loadComic(file);
    });

    elements.modeRadios.forEach(radio => radio.addEventListener('change', (e) => {
        readingMode = e.target.value;
        render();
    }));

    elements.doublePanelToggle.addEventListener('change', (e) => {
        isDoublePanel = e.target.checked;
        render();
    });

    elements.pageGoButton.addEventListener('click', () => {
        const pageNum = parseInt(elements.pageInput.value, 10);
        if (pageNum > 0 && pageNum <= comicBook.pageCount) {
            goToPage(pageNum - 1);
        }
    });

    elements.themeSelector.addEventListener('change', (e) => applyTheme(e.target.value));

    elements.sidebarToggles.forEach(button => button.addEventListener('click', () => {
        const sidebarId = button.dataset.sidebar;
        document.getElementById(sidebarId).classList.toggle('collapsed');
    }));

    elements.autoscrollToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoscroll();
        } else {
            stopAutoscroll();
        }
    });

    elements.prevButton.addEventListener('click', () => navigatePrev());
    elements.nextButton.addEventListener('click', () => navigateNext());

    elements.viewerArea.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            const rect = elements.viewerArea.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const halfWidth = rect.width / 2;
            
            let isNext = clickX > halfWidth;
            if (readingMode === 'manga') isNext = !isNext;

            if (isNext) {
                if (elements.viewerArea.scrollTop + elements.viewerArea.clientHeight >= elements.viewerArea.scrollHeight - 2) navigateNext();
                else elements.viewerArea.scrollTop += elements.viewerArea.clientHeight * 0.8;
            } else {
                if (elements.viewerArea.scrollTop === 0) navigatePrev();
                else elements.viewerArea.scrollTop -= elements.viewerArea.clientHeight * 0.8;
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!comicBook || e.target === elements.pageInput || keysDown[e.key]) return;
        
        if (isPageChanging) {
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'ArrowRight' || e.key === 'd') {
                isPageChanging = false;
            } else {
                return;
            }
        }

        keysDown[e.key] = true;

        if (autoscrollInterval) {
            autoscrollPaused = true;
            setTimeout(() => autoscrollPaused = false, 4000);
        }

        const step = isDoublePanel ? 2 : 1;

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
                e.preventDefault();
                if (readingMode !== 'webtoon') readingMode === 'manga' ? navigateNext(step) : navigatePrev(step);
                break;
            case 'ArrowRight':
            case 'd':
                e.preventDefault();
                if (readingMode !== 'webtoon') readingMode === 'manga' ? navigatePrev(step) : navigateNext(step);
                break;
            case 'ArrowUp':
            case 'w':
                e.preventDefault();
                if (readingMode === 'webtoon') {
                    smoothScroll(elements.viewerArea.scrollTop - elements.viewerArea.clientHeight * 0.7);
                } else {
                    if (elements.viewerArea.scrollTop > 0) {
                        smoothScroll(0);
                    } else {
                        navigatePrev(step);
                    }
                }
                break;
            case 'ArrowDown':
            case 's':
                e.preventDefault();
                if (readingMode === 'webtoon') {
                    smoothScroll(elements.viewerArea.scrollTop + elements.viewerArea.clientHeight * 0.7);
                } else {
                    if (elements.viewerArea.scrollTop + elements.viewerArea.clientHeight < elements.viewerArea.scrollHeight - 2) {
                        smoothScroll(elements.viewerArea.scrollHeight);
                    } else {
                        navigateNext(step);
                    }
                }
                break;
        }
    });

    document.addEventListener('keyup', (e) => {
        delete keysDown[e.key];
    });

    async function render() {
        if (!comicBook) return;
        isPageChanging = true;
        elements.viewer.innerHTML = '';
        
        elements.viewer.className = 'viewer';
        if (readingMode === 'webtoon') {
            elements.viewer.classList.add('webtoon-view');
            elements.viewerArea.addEventListener('scroll', handleWebtoonScroll);
        } else {
            elements.viewer.classList.add(isDoublePanel ? 'double-panel' : 'single-panel');
            elements.viewerArea.removeEventListener('scroll', handleWebtoonScroll);
        }
        
        updateNavigation(comicBook, currentPage, readingMode, isDoublePanel);

        if (readingMode === 'webtoon') {
            await displayWebtoonView();
            const targetImage = elements.viewer.querySelector(`[data-page-number="${currentPage}"]`);
            if (targetImage) {
                elements.viewerArea.scrollTop = targetImage.offsetTop - elements.viewerArea.offsetTop;
            }
        } else {
            await displayPagedView();
            elements.viewerArea.scrollTop = 0;
        }
        
        isPageChanging = false;
        saveLastRead();
    }

    async function displayPagedView() {
        const pageStep = isDoublePanel ? 2 : 1;
        const imageLoadPromises = [];
        for (let i = 0; i < pageStep; i++) {
            const pageNum = currentPage + i;
            const imageUrl = await comicBook.getPageBlob(pageNum);
            if (imageUrl) {
                const img = document.createElement('img');
                const loadPromise = new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                imageLoadPromises.push(loadPromise);
                img.src = imageUrl;
                elements.viewer.style.flexDirection = (readingMode === 'manga' && isDoublePanel) ? 'row-reverse' : 'row';
                elements.viewer.appendChild(img);
            }
        }
        await Promise.all(imageLoadPromises);
    }

    async function displayWebtoonView() {
        elements.viewer.style.flexDirection = 'column';
        const imageLoadPromises = [];
        for (let i = 0; i < comicBook.pageCount; i++) {
            const imageUrl = await comicBook.getPageBlob(i);
            const img = document.createElement('img');
             const loadPromise = new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            imageLoadPromises.push(loadPromise);
            img.src = imageUrl;
            img.dataset.pageNumber = i;
            elements.viewer.appendChild(img);
        }
        await Promise.all(imageLoadPromises);
    }

    async function goToPage(pageNumber) {
        if (isPageChanging) return;

        if (readingMode === 'webtoon') {
            const targetImage = elements.viewer.querySelector(`[data-page-number="${pageNumber}"]`);
            if (targetImage) {
                smoothScroll(targetImage.offsetTop - elements.viewerArea.offsetTop);
            }
        } else {
            const step = isDoublePanel ? 2 : 1;
            currentPage = Math.max(0, Math.min(pageNumber, comicBook.pageCount - step));
            await render();
        }
    }

    function navigatePrev(step = isDoublePanel ? 2 : 1) {
        goToPage(currentPage - step);
    }

    function navigateNext(step = isDoublePanel ? 2 : 1) {
        goToPage(currentPage + step);
    }

    function startAutoscroll() {
        stopAutoscroll();
        elements.autoscrollToggle.checked = true;
        const intervalSeconds = parseInt(elements.autoscrollIntervalInput.value, 10) || 3;
        autoscrollInterval = setInterval(() => {
            if (autoscrollPaused) return;

            const scrollAmount = elements.viewerArea.clientHeight * 0.8;
            if (elements.viewerArea.scrollTop + elements.viewerArea.clientHeight >= elements.viewerArea.scrollHeight - 2) {
                if (readingMode !== 'webtoon' && currentPage < comicBook.pageCount - 1) {
                    navigateNext();
                } else {
                    stopAutoscroll();
                }
            } else {
                elements.viewerArea.scrollTop += scrollAmount;
            }
        }, intervalSeconds * 1000);
    }

    function stopAutoscroll() {
        clearInterval(autoscrollInterval);
        autoscrollInterval = null;
        elements.autoscrollToggle.checked = false;
    }

    function saveLastRead() {
        if (comicBook) {
            const lastRead = {
                name: comicBook.name,
                page: currentPage,
                mode: readingMode,
                isDoublePanel: isDoublePanel
            };
            localStorage.setItem('lastReadComic', JSON.stringify(lastRead));
        }
    }

    function getLastRead() {
        const lastRead = localStorage.getItem('lastReadComic');
        return lastRead ? JSON.parse(lastRead) : null;
    }

    function updateCurrentPageFromScroll() {
        const viewerTop = elements.viewerArea.offsetTop;
        for (const img of elements.viewer.children) {
            if (img.offsetTop + img.offsetHeight - viewerTop > elements.viewerArea.scrollTop) {
                const newPage = parseInt(img.dataset.pageNumber, 10);
                if (newPage !== currentPage) {
                    currentPage = newPage;
                    updateNavigation(comicBook, currentPage, readingMode, isDoublePanel);
                    saveLastRead();
                }
                break;
            }
        }
    }

    function handleWebtoonScroll() {
        clearTimeout(webtoonScrollTimeout);
        webtoonScrollTimeout = setTimeout(updateCurrentPageFromScroll, 150);
    }
    
    loadPreferences();
    setupLastReadPrompt();
});

