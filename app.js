
/* =========================================
   HILGAMING MINI APP — OPTIMIZED JAVASCRIPT
   Monetag + Catalog + Search + Mod Details
   ========================================= */

"use strict";

/* =========================================
   1. CONFIGURATION
   ========================================= */

const CONFIG = {
    jsonUrl: "./mods.json",

    // Monetag: use the existing zone function.
    adFunctionName: "show_9590572",

    // In-App Interstitial configuration.
    interstitial: {
        frequency: 2,
        capping: 0.5,  // 0.5 hours = 30 minutes
        interval: 120, // Minimum interval: 120 seconds
        timeout: 10,
        everyPage: false
    },

    // Monetization policy:
    // true = require Monetag's confirmed "valued" event.
    requireConfirmedReward: true,

    // false = do not automatically bypass a failed ad.
    allowDirectDownloadOnAdFailure: false,

    // Set to false if you do not want automatic interstitials.
    enableInterstitial: true,

    // Prevent excessively large catalog downloads.
    requestTimeoutMs: 20000
};

/* =========================================
   2. STATE & DOM
   ========================================= */

let allMods = [];
let isLoadingMods = false;
let interstitialInitialized = false;
let activeDownload = false;
let toastTimer = null;

const gridContainer = document.getElementById("mods-grid");
const searchInput = document.getElementById("searchInput");
const homeView = document.getElementById("home-view");
const detailsView = document.getElementById("details-view");
const loader = document.getElementById("app-loader");
const backBtn = document.getElementById("back-btn");
const modContent = document.getElementById("mod-content");
const toast = document.getElementById("toast");

/* =========================================
   3. SECURITY HELPERS
   ========================================= */

// Escape text before inserting it into HTML.
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Accept only HTTP(S) URLs.
function safeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    try {
        const url = new URL(value.trim(), window.location.href);

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return null;
        }

        return url.href;
    } catch {
        return null;
    }
}

// Accept supported YouTube URL formats.
function getYouTubeEmbedUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    try {
        const url = new URL(value.trim());
        const host = url.hostname.toLowerCase().replace(/^www\./, "");
        let videoId = "";

        if (host === "youtu.be") {
            videoId = url.pathname.split("/").filter(Boolean)[0] || "";
        } else if (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "youtube-nocookie.com"
        ) {
            if (url.pathname === "/watch") {
                videoId = url.searchParams.get("v") || "";
            } else {
                const parts = url.pathname.split("/").filter(Boolean);

                if (["embed", "shorts", "live"].includes(parts[0])) {
                    videoId = parts[1] || "";
                }
            }
        } else {
            return null;
        }

        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return null;
        }

        return `https://www.youtube-nocookie.com/embed/${videoId}`;
    } catch {
        return null;
    }
}

/* =========================================
   4. UI UTILITIES
   ========================================= */

function hideLoader() {
    if (!loader) return;

    loader.style.opacity = "0";

    window.setTimeout(() => {
        loader.style.display = "none";
    }, 300);
}

function showLoader() {
    if (!loader) return;

    loader.style.display = "";
    loader.style.opacity = "1";
}

function showToast(message) {
    if (!toast) {
        console.log("[HilGaming]", message);
        return;
    }

    if (toastTimer !== null) {
        clearTimeout(toastTimer);
    }

    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.style.opacity = "1";

    toastTimer = window.setTimeout(() => {
        toast.style.opacity = "0";

        window.setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, 3000);
}

function renderMessage(container, message, isError = false) {
    if (!container) return;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    paragraph.style.textAlign = "center";
    paragraph.style.color = isError ? "#e53935" : "#777";
    paragraph.style.gridColumn = "1 / -1";

    container.replaceChildren(paragraph);
}

/* =========================================
   5. INITIALIZATION
   ========================================= */

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    if (!gridContainer || !searchInput ||
        !homeView || !detailsView || !modContent) {
        console.error(
            "HilGaming: required HTML elements are missing."
        );
        hideLoader();
        return;
    }

    searchInput.addEventListener("input", handleSearch);

    if (backBtn) {
        backBtn.addEventListener("click", goHome);
    }

    fetchMods();

    // Initialize the automatic ad schedule only once.
    initializeInterstitial();
}

/* =========================================
   6. LOAD MODS
   ========================================= */

async function fetchMods() {
    if (isLoadingMods) return;

    isLoadingMods = true;
    showLoader();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
        () => controller.abort(),
        CONFIG.requestTimeoutMs
    );

    try {
        const response = await fetch(CONFIG.jsonUrl, {
            method: "GET",
            cache: "no-cache",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("mods.json must contain a JSON array.");
        }

        allMods = data
            .filter(mod =>
                mod &&
                typeof mod.title === "string" &&
                mod.title.trim().length > 0
            )
            .map((mod, index) => ({
                ...mod,
                id: String(mod.id ?? `mod-${index + 1}`),
                images: Array.isArray(mod.images)
                    ? mod.images.filter(img => safeHttpUrl(img))
                    : [],
                downloads: Array.isArray(mod.downloads)
                    ? mod.downloads.filter(dl =>
                        dl &&
                        typeof dl.label === "string" &&
                        safeHttpUrl(dl.url)
                    )
                    : []
            }));

        renderMods(allMods);

        console.log(
            `HilGaming: loaded ${allMods.length} mods.`
        );
    } catch (error) {
        console.error("HilGaming: failed to load mods:", error);

        renderMessage(
            gridContainer,
            error.name === "AbortError"
                ? "Loading timed out. Please try again."
                : "Unable to load mods. Check your connection and try again.",
            true
        );

        // Offer a way to retry.
        const retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.className = "dl-btn";
        retryButton.textContent = "Retry loading";
        retryButton.addEventListener("click", fetchMods);
        gridContainer.appendChild(retryButton);
    } finally {
        clearTimeout(timeoutId);
        isLoadingMods = false;
        hideLoader();
    }
}

/* =========================================
   7. SEARCH
   ========================================= */

function handleSearch(event) {
    const term = event.target.value.trim().toLowerCase();

    const filtered = allMods.filter(mod =>
        mod.title.toLowerCase().includes(term) ||
        mod.id.toLowerCase().includes(term)
    );

    renderMods(filtered);
}

/* =========================================
   8. CATALOG
   ========================================= */

function getDisplayTitle(mod) {
    return mod.title.split("|")[0].trim();
}

function getDisplayId(mod) {
    const parts = mod.title.split("|");

    return parts.length > 1
        ? parts.slice(1).join("|").trim()
        : mod.id;
}

function renderMods(mods) {
    if (!gridContainer) return;

    gridContainer.replaceChildren();

    if (mods.length === 0) {
        renderMessage(gridContainer, "No mods found.");
        return;
    }

    const fragment = document.createDocumentFragment();

    mods.forEach(mod => {
        const card = document.createElement("div");
        card.className = "mod-card";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute(
            "aria-label",
            `Open ${getDisplayTitle(mod)}`
        );

        if (mod.tag) {
            const badge = document.createElement("span");
            const tag = String(mod.tag).trim();
            const tagClass =
                tag.toUpperCase() === "NEW" ? "new" : "hot";

            badge.className = `badge ${tagClass}`;
            badge.textContent = tag;
            card.appendChild(badge);
        }

        if (mod.images.length > 0) {
            const img = document.createElement("img");
            img.src = mod.images[0];
            img.alt = getDisplayTitle(mod);
            img.className = "card-img";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            card.appendChild(img);
        }

        const info = document.createElement("div");
        info.className = "card-info";

        const title = document.createElement("h3");
        title.className = "card-title";
        title.textContent = getDisplayTitle(mod);

        const id = document.createElement("span");
        id.className = "card-id";
        id.textContent = getDisplayId(mod);

        info.append(title, id);
        card.appendChild(info);

        card.addEventListener("click", () => openModDetails(mod));

        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openModDetails(mod);
            }
        });

        fragment.appendChild(card);
    });

    gridContainer.appendChild(fragment);
}

/* =========================================
   9. NAVIGATION
   ========================================= */

function goHome() {
    detailsView.classList.add("hidden");
    homeView.classList.remove("hidden");
    window.scrollTo(0, 0);
}

function openModDetails(mod) {
    renderDetails(mod);

    homeView.classList.add("hidden");
    detailsView.classList.remove("hidden");

    window.scrollTo(0, 0);
}

/* =========================================
   10. MOD DETAILS
   ========================================= */

function renderDetails(mod) {
    const imagesHtml = mod.images
        .map(url => `
            <img
                src="${escapeHtml(url)}"
                class="slide-img"
                alt="Screenshot of ${escapeHtml(getDisplayTitle(mod))}"
                loading="lazy"
                referrerpolicy="no-referrer"
            >
        `)
        .join("");

    const videoUrl = getYouTubeEmbedUrl(mod.video);

    const videoHtml = videoUrl
        ? `
            <div class="video-container">
                <iframe
                    src="${escapeHtml(videoUrl)}"
                    title="${escapeHtml(getDisplayTitle(mod))} video"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
            </div>
        `
        : "";

    const instructionsHtml = mod.instructions
        ? `
            <div class="instructions-box">
                <span class="instructions-title">
                    <i class="fa-solid fa-circle-info"></i>
                    How to Install:
                </span>
                <p>${escapeHtml(mod.instructions).replace(/\n/g, "<br>")}</p>
            </div>
        `
        : "";

    const buttonsHtml = mod.downloads.map((dl, index) => `
        <button
            type="button"
            class="dl-btn"
            data-download-index="${index}"
        >
            <span>${escapeHtml(dl.label)}</span>
            <i class="fa-solid fa-download"></i>
        </button>
    `).join("");

    modContent.innerHTML = `
        <h1 class="detail-title">
            ${escapeHtml(mod.title)}
        </h1>

        <div class="slideshow-container">
            ${imagesHtml}
        </div>

        ${videoHtml}
        ${instructionsHtml}

        <div class="download-section">
            <p class="dl-header">Download Links:</p>
            ${buttonsHtml || "<p>No downloads available.</p>"}
        </div>
    `;

    // Bind buttons without inline onclick handlers.
    modContent.querySelectorAll("[data-download-index]")
        .forEach(button => {
            button.addEventListener("click", async () => {
                const index = Number(
                    button.dataset.downloadIndex
                );
                const download = mod.downloads[index];

                if (!download) {
                    showToast("Invalid download link.");
                    return;
                }

                await handleMonetizedDownload(
                    download.url,
                    download.label,
                    button
                );
            });
        });
}

/* =========================================
   11. MONETAG SDK HELPERS
   ========================================= */

function getAdFunction() {
    const fn = window[CONFIG.adFunctionName];

    return typeof fn === "function" ? fn : null;
}

function isSdkReady() {
    return getAdFunction() !== null;
}

/**
 * Configure In-App Interstitials once.
 *
 * The SDK configures automatic ad scheduling.
 * It does not wait for an ad impression to occur.
 */
function initializeInterstitial() {
    if (
        !CONFIG.enableInterstitial ||
        interstitialInitialized
    ) {
        return;
    }

    const showAd = getAdFunction();

    if (!showAd) {
        console.warn(
            "Monetag SDK not ready; interstitial not initialized."
        );
        return;
    }

    interstitialInitialized = true;

    try {
        Promise.resolve(
            showAd({
                type: "inApp",
                inAppSettings: CONFIG.interstitial
            })
        ).catch(error => {
            console.warn(
                "Monetag interstitial setup failed:",
                error
            );
            interstitialInitialized = false;
        });
    } catch (error) {
        console.warn(
            "Monetag interstitial error:",
            error
        );
        interstitialInitialized = false;
    }
}

/* =========================================
   12. MONETIZED DOWNLOADS
   ========================================= */

/**
 * Opens a download only after the required ad check.
 *
 * IMPORTANT:
 * With requireConfirmedReward enabled, a result other
 * than "valued" will not unlock the download.
 */
async function handleMonetizedDownload(
    url,
    label,
    button = null
) {
    if (activeDownload) {
        showToast("Please wait for the current request.");
        return;
    }

    const safeUrl = safeHttpUrl(url);

    if (!safeUrl) {
        showToast("This download link is invalid.");
        return;
    }

    const showAd = getAdFunction();

    if (!showAd) {
        console.warn("Monetag SDK is unavailable.");

        if (CONFIG.allowDirectDownloadOnAdFailure) {
            openDownload(safeUrl);
        } else {
            showToast(
                "Ads are unavailable. Please try again later."
            );
        }

        return;
    }

    activeDownload = true;

    if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    }

    showToast(`Loading ad for ${label}...`);

    try {
        // The default call requests a Rewarded Interstitial.
        const result = await showAd({
            type: "end",
            requestVar: "mod_download",
            timeout: 30
        });

        if (
            CONFIG.requireConfirmedReward &&
            result?.reward_event_type !== "valued"
        ) {
            showToast(
                "The ad reward could not be confirmed. Please try again."
            );
            return;
        }

        showToast("Download starting...");

        openDownload(safeUrl);
    } catch (error) {
        console.warn("Monetag download ad failed:", error);

        if (CONFIG.allowDirectDownloadOnAdFailure) {
            showToast("Ad unavailable. Opening download...");
            openDownload(safeUrl);
        } else {
            showToast(
                "The ad could not be completed. Please try again."
            );
        }
    } finally {
        activeDownload = false;

        if (button) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    }
}

/**
 * Opens a validated HTTP(S) URL in a new tab.
 */
function openDownload(url) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
        showToast(
            "The download tab was blocked. Allow pop-ups and try again."
        );
    }
}

// Keep the existing global function name available if other
// parts of the Mini App call it.
window.handleMonetizedDownload = handleMonetizedDownload;

/* =========================================
   13. OPTIONAL: RETRY SDK INITIALIZATION
   ========================================= */

// Useful if the SDK loads after this file.
window.addEventListener("load", () => {
    if (!interstitialInitialized) {
        initializeInterstitial();
    }
});
