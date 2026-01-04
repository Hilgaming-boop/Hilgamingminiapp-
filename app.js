/* =========================================
   GLOBAL STATE & CONFIG
   ========================================= */
let allMods = [];
const JSON_URL = 'mods.json';

// DOM Elements
const gridContainer = document.getElementById('mods-grid');
const searchInput = document.getElementById('searchInput');
const homeView = document.getElementById('home-view');
const detailsView = document.getElementById('details-view');
const loader = document.getElementById('app-loader');
const backBtn = document.getElementById('back-btn');
const modContent = document.getElementById('mod-content');

/* =========================================
   INIT
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    fetchMods();

    // Search Listener
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allMods.filter(mod => 
            mod.title.toLowerCase().includes(term) || 
            mod.id.toLowerCase().includes(term)
        );
        renderMods(filtered);
    });

    // Navigation Listener
    backBtn.addEventListener('click', goHome);
});

/* =========================================
   DATA HANDLING
   ========================================= */
async function fetchMods() {
    try {
        const response = await fetch(JSON_URL);
        if (!response.ok) throw new Error('Failed to load data');
        
        allMods = await response.json();
        
        // Add ID if not in JSON for testing, strictly adhering to user JSON format
        // We assume ID is part of title string or added manually. 
        // For safer logic, let's parse ID from title if needed or use a generated one.
        
        renderMods(allMods);
        
        // Hide Loader
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }, 800);

    } catch (error) {
        console.error(error);
        gridContainer.innerHTML = '<p style="text-align:center; color:red">Error loading mods. Please refresh.</p>';
    }
}

/* =========================================
   RENDERING
   ========================================= */
function renderMods(mods) {
    gridContainer.innerHTML = '';
    
    if (mods.length === 0) {
        gridContainer.innerHTML = '<p style="text-align:center; color:#777; grid-column: 1/-1;">No mods found.</p>';
        return;
    }

    mods.forEach(mod => {
        // Extrai ID e Título
        const displayId = mod.title.split('|')[1] ? mod.title.split('|')[1].trim() : 'MOD';
        const displayTitle = mod.title.split('|')[0].trim();

        // Lógica da Etiqueta (Badge)
        let badgeHtml = '';
        if (mod.tag) {
            // Se a tag for "NOVO", usa a classe .novo, senão usa .hot
            const tagClass = mod.tag.toUpperCase() === 'NEW' ? 'new' : 'hot';
            badgeHtml = `<span class="badge ${tagClass}">${mod.tag}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'mod-card';
        // Inserimos o badgeHtml antes da imagem
        card.innerHTML = `
            ${badgeHtml}
            <img src="${mod.images[0]}" alt="${displayTitle}" class="card-img" loading="lazy">
            <div class="card-info">
                <h3 class="card-title">${displayTitle}</h3>
                <span class="card-id">${displayId}</span>
            </div>
        `;
        
        card.addEventListener('click', () => openModDetails(mod));
        gridContainer.appendChild(card);
    });
}


/* =========================================
   NAVIGATION & DETAILS
   ========================================= */
function goHome() {
    detailsView.classList.add('hidden');
    homeView.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function openModDetails(mod) {
    // 1. Render Content
    renderDetails(mod);
    
    // 2. Switch View
    homeView.classList.add('hidden');
    detailsView.classList.remove('hidden');
    window.scrollTo(0, 0);

    // 3. 💰 TRIGGER: In-App Interstitial
    triggerInAppInterstitial();
}

function renderDetails(mod) {
    // Generate Slideshow HTML
    const imagesHtml = mod.images.map(img => `<img src="${img}" class="slide-img">`).join('');
    
    // Generate Buttons HTML
    const buttonsHtml = mod.downloads.map(dl => `
        <button class="dl-btn" onclick="handleMonetizedDownload('${dl.url}', '${dl.label}')">
            <span>${dl.label}</span>
            <i class="fa-solid fa-download"></i>
        </button>
    `).join('');

    // Safe YouTube Embed
    let videoHtml = '';
    if (mod.video) {
        // Convert watch link to embed if necessary, or assume embed link is provided
        const videoId = mod.video.split('v=')[1] || mod.video.split('/').pop();
        videoHtml = `
            <div class="video-container">
                <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
            </div>
        `;
    }

    modContent.innerHTML = `
        <h1 style="margin-bottom:15px; font-size:1.4rem;">${mod.title}</h1>
        
        <div class="slideshow-container">
            ${imagesHtml}
        </div>
        
        ${videoHtml}

        <div class="download-section">
            <p style="color:#aaa; font-size:0.9rem; margin-bottom:5px;">Download Links:</p>
            ${buttonsHtml}
        </div>
    `;
}

/* =========================================
   💰 MONETIZATION LOGIC (CRITICAL)
   ========================================= */

// Wrapper to safely check if SDK is loaded
function isSdkReady() {
    return typeof show_9590572 === 'function';
}

/**
 * Trigger In-App Interstitial
 * Rules: Frequency 2, Interval 30s
 */
function triggerInAppInterstitial() {
    if (isSdkReady()) {
        try {
            show_9590572({
                type: 'inApp',
                inAppSettings: {
                    frequency: 2,
                    capping: 0.1,
                    interval: 30,
                    timeout: 5,
                    everyPage: false
                }
            });
            console.log("Monetag: In-App Interstitial requested");
        } catch (e) {
            console.warn("Monetag Error:", e);
        }
    }
}

/**
 * Handle Rewarded Download
 * Rules: Must watch ad before download starts
 */
window.handleMonetizedDownload = function(url, label) {
    showToast(`Preparing download for ${label}...`);

    if (isSdkReady()) {
        // Call the Rewarded Interstitial
        show_9590572().then(() => {
            // SUCCESS: Ad watched or skipped (depending on network/availability)
            showToast('Download Starting...');
            
            // Small delay for UX
            setTimeout(() => {
                window.open(url, '_blank');
            }, 500);
            
        }).catch((e) => {
            // ERROR: Ad failed to load or user closed it early (if SDK throws error)
            // Fallback: Still allow download to not lose user
            console.warn("Ad failed or skipped", e);
            window.open(url, '_blank');
        });
    } else {
        // SDK not loaded (AdBlocker?) -> Direct Download fallback
        console.log("SDK not ready, direct download");
        window.open(url, '_blank');
    }
};

/* =========================================
   UTILITIES
   ========================================= */
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}
