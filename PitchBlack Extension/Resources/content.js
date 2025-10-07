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
        const result = await browser.storage.local.get(['darkModeEnabled', 'effect']);
        console.log('PitchBlack: Loaded saved state:', result);

        if (result.darkModeEnabled) {
            console.log('PitchBlack: Applying dark mode from saved state');
            this.applyDarkMode(result.effect || 100);
        }

        // Listen for messages from popup
        browser.runtime.onMessage.addListener(this.handleMessage.bind(this));
        console.log('PitchBlack: Message listener registered');
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'toggleDarkMode':
                console.log('PitchBlack: toggleDarkMode received, enabled:', request.enabled);
                if (request.enabled) {
                    this.applyDarkMode(request.effect || 100);
                } else {
                    console.log('PitchBlack: Calling removeDarkMode');
                    this.removeDarkMode();
                }
                sendResponse({ success: true });
                break;

            case 'updateFilters':
                this.updateFilters(request.effect || 100);
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

    applyDarkMode(effect = 100) {
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

        // Calculate intensity-based filter
        // Effect 0 = light grey (easier on eyes), Effect 100 = pure black
        const intensity = effect / 100; // Convert to 0-1 range
        const brightness = 50 + (intensity * 50); // 50% to 100% brightness
        const contrast = 50 + (intensity * 50); // 50% to 100% contrast

        // Apply basic invert filter with calculated intensity (temporarily for testing)
        const filterValue = `invert(1) hue-rotate(180deg) brightness(${brightness}%) contrast(${contrast}%)`;
        document.documentElement.style.filter = filterValue;
        console.log('PitchBlack: Applied basic invert filter with effect:', effect, 'brightness:', brightness, 'contrast:', contrast);
        console.log('PitchBlack: Filter value applied:', filterValue);
        console.log('PitchBlack: Current document filter:', document.documentElement.style.filter);

        // Inject CSS to exclude images from the parent filter
        this.injectImageExclusionCSS();

        this.isActive = true;
        console.log('PitchBlack: Dark mode applied successfully');
    }

    removeDarkMode() {
        // Remove hue-preserving filter
        document.documentElement.style.filter = '';
        console.log('PitchBlack: Removed hue-preserving filter');
        console.log('PitchBlack: Current filter after removal:', document.documentElement.style.filter);

        // Remove image exclusion CSS
        const existingStyle = document.getElementById(this.darkModeStyleId);
        if (existingStyle) {
            existingStyle.remove();
            console.log('PitchBlack: Removed image exclusion CSS');
        }

        this.isActive = false;
        console.log('PitchBlack: Dark mode removed, isActive set to:', this.isActive);
    }


    updateFilters(effect) {
        console.log('PitchBlack: updateFilters called with effect:', effect, 'isActive:', this.isActive);

        if (!this.isActive) {
            console.log('PitchBlack: Dark mode not active, skipping filter update');
            return;
        }

        // Calculate intensity-based filter
        // Effect 0 = light grey (easier on eyes), Effect 100 = pure black
        const intensity = effect / 100; // Convert to 0-1 range
        const brightness = 50 + (intensity * 50); // 50% to 100% brightness
        const contrast = 50 + (intensity * 50); // 50% to 100% contrast

        // Update filter with new intensity values using basic invert
        const newFilter = `invert(1) hue-rotate(180deg) brightness(${brightness}%) contrast(${contrast}%)`;
        document.documentElement.style.filter = newFilter;
        console.log('PitchBlack: Updated filters to:', newFilter);
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

    injectImageExclusionCSS() {
        // Remove any existing style element first
        const existingStyle = document.getElementById(this.darkModeStyleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create CSS to exclude images from the parent filter
        const style = document.createElement('style');
        style.id = this.darkModeStyleId;
        style.textContent = `
            /* PitchBlack Image Exclusion - Exclude images from parent filter */

            /* Apply inverse filter to images to cancel out the parent filter */
            img, picture, svg, video, canvas, iframe, object, embed {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Specific selectors for common image elements */
            .image, .img, .photo, .picture, .avatar, .thumbnail,
            .logo, .icon, .brand, .badge, .emblem {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* Background images in pseudo-elements */
            *::before, *::after {
                filter: invert(1) hue-rotate(180deg) !important;
            }

            /* File extension selectors */
            [src*=".png"], [src*=".jpg"], [src*=".jpeg"], [src*=".gif"], [src*=".webp"],
            [src*=".svg"], [style*="background-image"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }
        `;
        document.head.appendChild(style);
        console.log('PitchBlack: Injected image exclusion CSS');
    }

    getDarkModeCSS() {
        // Minimal CSS for any edge cases or specific overrides if needed
        return `
            /* PitchBlack Hue-Preserving Dark Mode */
            /* Using advanced SVG filter for better color preservation */

            /* Optional: Fix any elements that don't look good with the filter */
            /* Add specific overrides here if needed */
        `;
    }
}

// Initialize the content script
new DarkModeContentScript();
