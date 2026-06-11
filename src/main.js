import './style.css';

// ---------------------------------------------------------------------------
// Browser-mockup scan animation (hero section)
// ---------------------------------------------------------------------------
const scanItems = document.querySelectorAll('#hero .scan-item'); // Target only hero mockup items
const scanStatusElement = document.getElementById('scanStatus');
const browserContent = document.querySelector('#hero .browser-content'); // Target hero mockup
const scrapingStatusContainer = document.getElementById('scrapingStatusContainer'); // New element

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

// Scroll ONLY the mockup's inner container — never the page. (scrollIntoView
// scrolls every scrollable ancestor, which hijacked the user's page scroll.)
function scrollToItemView(itemElement) {
    if (itemElement && browserContent && isMockupVisible) { // Check isMockupVisible
        const containerRect = browserContent.getBoundingClientRect();
        const itemRect = itemElement.getBoundingClientRect();
        const targetTop = browserContent.scrollTop
            + (itemRect.top - containerRect.top)
            - (browserContent.clientHeight - itemElement.clientHeight) / 2;
        browserContent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
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
