import './style.css';

// ---------------------------------------------------------------------------
// Browser-mockup scan animation (hero section)
// ---------------------------------------------------------------------------
const scanItems = document.querySelectorAll('#hero .scan-item'); // Target only hero mockup items
const scanStatusElement = document.getElementById('scanStatus');
const browserContent = document.querySelector('#hero .browser-content'); // Target hero mockup
const proscanPopup = document.querySelector('#hero .proscan-popup'); // Target hero mockup
const scrapingStatusContainer = document.getElementById('scrapingStatusContainer'); // New element

const popupInitialTop = 15;
let currentScanIndex = 0;
let totalItemsFound = 0;
let isMockupVisible = false;

if (browserContent) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isMockupVisible = entry.isIntersecting;
        });
    }, { threshold: 0 }); // Threshold 0 means any part visible

    observer.observe(browserContent);
}

function scrollToItemView(itemElement) {
    if (itemElement && browserContent && isMockupVisible) { // Check isMockupVisible
        itemElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }
}

if (browserContent && proscanPopup) {
    browserContent.addEventListener('scroll', () => {
        proscanPopup.style.top = (popupInitialTop + browserContent.scrollTop) + 'px';
    });
}

function performScan() {
    if (!scanItems.length) return;

    if (currentScanIndex === 0 && (scanStatusElement.textContent === 'Starting new scan...' || scanStatusElement.textContent === 'Initializing Proscan...')) {
        totalItemsFound = 0;
        scanStatusElement.textContent = 'Scanning...'; // General status
    }

    scanItems.forEach(item => {
        item.classList.remove('scanning');
    });

    const currentItem = scanItems[currentScanIndex];

    if (currentItem && scrapingStatusContainer) {
        currentItem.classList.add('scanning');
        scrollToItemView(currentItem);

        // Extract emoji and title
        const emojiElement = currentItem.querySelector('.item-emoji');
        const titleElement = currentItem.querySelector('.item-title');
        let itemIdentifier = '';
        if (emojiElement && titleElement) {
            itemIdentifier = `${emojiElement.textContent.trim()} ${titleElement.textContent.trim()}`;
            scrapingStatusContainer.textContent = `Scraping ${itemIdentifier}`;
        } else {
            scrapingStatusContainer.textContent = 'Scraping item...'; // Fallback
        }

        setTimeout(() => {
            if (!currentItem.dataset.justCountedInCycle) {
                totalItemsFound++;
                currentItem.dataset.justCountedInCycle = true;
            }

            if (totalItemsFound === scanItems.length) {
                scanStatusElement.textContent = 'Scan complete!';
                setTimeout(() => {
                    scanStatusElement.textContent = 'Starting new scan...';
                    totalItemsFound = 0;
                    scanItems.forEach(item => delete item.dataset.justCountedInCycle);

                    if (browserContent && isMockupVisible) {
                        browserContent.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }, 1500);
            }
            // No "Scanning item X/Y..." anymore, specific item is shown in scrapingStatusContainer

        }, 700);
    }
    currentScanIndex = (currentScanIndex + 1) % scanItems.length;
}
if (scanItems.length > 0) {
    setInterval(performScan, 3000);
}

setTimeout(() => {
    if (proscanPopup && browserContent) {
        proscanPopup.style.top = (popupInitialTop + browserContent.scrollTop) + 'px';
    }
    if (scanItems.length > 0 && scanStatusElement && scrapingStatusContainer) {
        totalItemsFound = 0;
        scanItems.forEach(item => delete item.dataset.justCountedInCycle);
        scanStatusElement.textContent = 'Initializing Proscan...';
        scrapingStatusContainer.textContent = ''; // Clear scraping status initially
        setTimeout(performScan, 500);
    }
}, 1000);

// ---------------------------------------------------------------------------
// Smooth scrolling for in-page anchor links
// ---------------------------------------------------------------------------
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
