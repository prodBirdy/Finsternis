// Content script for PitchBlack dark mode extension

class DarkModeContentScript {
    constructor() {
        this.darkModeStyleId = 'pitchblack-dark-mode-styles';
        this.isActive = false;
        this.init();
    }

    async init() {
        console.log('PitchBlack: Content script initialized on', window.location.href);

        // Load saved state and apply if enabled
        const result = await browser.storage.local.get(['darkModeEnabled']);
        console.log('PitchBlack: Loaded saved state:', result);

        if (result.darkModeEnabled) {
            console.log('PitchBlack: Applying dark mode from saved state');
            this.applyDarkMode();
        }

        // Listen for messages from popup
        browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
        console.log('PitchBlack: Message listener registered');
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'toggleDarkMode':
                if (request.enabled) {
                    this.applyDarkMode();
                } else {
                    this.removeDarkMode();
                }
                sendResponse({ success: true });
                break;

            case 'getStatus':
                sendResponse({ darkModeActive: this.isActive });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }
        return true; // Keep message channel open for async response
    }

    applyDarkMode() {
        if (this.isActive) return;

        // Remove existing styles if any
        this.removeDarkMode();

        // Check if page is already in dark mode
        if (this.isPageAlreadyDark()) {
            console.log('PitchBlack: Page is already in dark mode, skipping filter');
            // Still mark as active to maintain toggle state
            this.isActive = true;
            return;
        }

        // Apply luminance-preserving filter to html element
        document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)';
        console.log('PitchBlack: Applied luminance-preserving filter');

        // Inject CSS to handle images and other media
        this.injectMediaOverrides();

        // Force re-application of styles after a short delay to ensure they take effect
        setTimeout(() => {
            this.injectMediaOverrides();
            console.log('PitchBlack: Re-applied media override styles');
        }, 100);

        // Set up mutation observer to handle dynamically loaded images
        this.setupImageObserver();

        this.isActive = true;
        console.log('PitchBlack: Dark mode applied successfully');
    }

    removeDarkMode() {
        // Remove luminance-preserving filter
        document.documentElement.style.filter = '';
        console.log('PitchBlack: Removed luminance-preserving filter');

        // Remove media overrides
        const existingStyle = document.getElementById(this.darkModeStyleId);
        if (existingStyle) {
            existingStyle.remove();
            console.log('PitchBlack: Removed media override styles');
        }

        // Clean up mutation observer
        if (this.imageObserver) {
            this.imageObserver.disconnect();
            this.imageObserver = null;
            console.log('PitchBlack: Disconnected image observer');
        }

        this.isActive = false;
        console.log('PitchBlack: Dark mode removed');
    }

    isPageAlreadyDark() {
        // Check for common dark mode indicators

        // 1. Check for dark background on body or html
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;

        // Check if background is dark (RGB values below 100)
        const isDarkBackground = (bgColor) => {
            if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') return false;
            const rgb = bgColor.match(/\d+/g);
            if (!rgb || rgb.length < 3) return false;
            const [r, g, b] = rgb.map(Number);
            // Consider dark if all RGB values are below 100
            return r < 100 && g < 100 && b < 100;
        };

        if (isDarkBackground(bodyBg) || isDarkBackground(htmlBg)) {
            console.log('PitchBlack: Detected dark background');
            return true;
        }

        // 2. Check for CSS custom properties that indicate dark mode
        const rootStyles = getComputedStyle(document.documentElement);
        const darkModeVars = ['--dark-mode', '--theme-dark', '--color-scheme'];

        for (const varName of darkModeVars) {
            const value = rootStyles.getPropertyValue(varName).trim();
            if (value && (value.includes('dark') || value.includes('true') || value.includes('1'))) {
                console.log(`PitchBlack: Detected dark mode via CSS variable: ${varName}`);
                return true;
            }
        }

        // 3. Check for meta tag indicating dark mode preference
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            const themeColor = metaTheme.getAttribute('content');
            if (themeColor && isDarkBackground(`rgb(${themeColor})`)) {
                console.log('PitchBlack: Detected dark theme via meta theme-color');
                return true;
            }
        }

        // 4. Check for common dark mode class names on body
        const darkClasses = ['dark', 'dark-mode', 'theme-dark', 'night-mode'];
        for (const className of darkClasses) {
            if (document.body.classList.contains(className) || document.documentElement.classList.contains(className)) {
                console.log(`PitchBlack: Detected dark mode via class: ${className}`);
                return true;
            }
        }

        return false;
    }

    injectMediaOverrides() {
        // Create and inject CSS to handle images and other media that shouldn't be inverted
        const style = document.createElement('style');
        style.id = this.darkModeStyleId;
        style.textContent = `
            /* PitchBlack Media Overrides - Cancel parent filter on images and media */

            /* Images should not be inverted - apply inverse filter to cancel parent */
            img, picture img, svg, image {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Video elements */
            video {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Canvas elements */
            canvas {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Embedded objects and iframes */
            object, embed, iframe {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Specific overrides for common media elements */
            .image, .img, .photo, .picture, .avatar, .thumbnail,
            .logo, .icon, .brand, .badge, .emblem {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Code syntax highlighting and similar */
            .highlight, .syntax, .code-block, pre code {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Background images in pseudo-elements */
            *::before, *::after {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Additional specific selectors for stubborn images */
            [src*=".png"], [src*=".jpg"], [src*=".jpeg"], [src*=".gif"], [src*=".webp"],
            [src*=".svg"], [style*="background-image"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }
        `;
        document.head.appendChild(style);
        console.log('PitchBlack: Injected media override styles');
    }

    setupImageObserver() {
        // Wait for body to be available
        if (!document.body) {
            setTimeout(() => this.setupImageObserver(), 100);
            return;
        }

        // Create a mutation observer to handle dynamically loaded images
        this.imageObserver = new MutationObserver((mutations) => {
            let hasNewImages = false;

            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added element is an image or contains images
                        const images = node.querySelectorAll ?
                            node.querySelectorAll('img, picture, svg, video, canvas, iframe') : [];

                        if (node.tagName === 'IMG' || node.tagName === 'PICTURE' ||
                            node.tagName === 'SVG' || node.tagName === 'VIDEO' ||
                            node.tagName === 'CANVAS' || node.tagName === 'IFRAME') {
                            // Apply filter directly to the element
                            if (!node.style.filter || node.style.filter === '') {
                                node.style.filter = 'invert(1) hue-rotate(180deg)';
                            }
                            hasNewImages = true;
                        }

                        // Apply to found images
                        images.forEach((img) => {
                            if (!img.style.filter || img.style.filter === '') {
                                img.style.filter = 'invert(1) hue-rotate(180deg)';
                                hasNewImages = true;
                            }
                        });
                    }
                });
            });

            if (hasNewImages) {
                console.log('PitchBlack: Applied filter to dynamically loaded images');
            }
        });

        // Start observing
        this.imageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('PitchBlack: Started image observer');
    }

    getDarkModeCSS() {
        // Minimal CSS for any edge cases or specific overrides if needed
        return `
            /* PitchBlack Luminance-Preserving Dark Mode */
            /* Using CSS filter: invert(1) hue-rotate(180deg) on html element */

            /* Optional: Fix any elements that don't look good with the filter */
            /* Add specific overrides here if needed */
        `;
    }
}

// Initialize the content script
new DarkModeContentScript();
