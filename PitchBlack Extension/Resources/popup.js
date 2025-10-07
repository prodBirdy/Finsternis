// Popup script for PitchBlack dark mode extension

class DarkModePopup {
    constructor() {
        this.toggle = document.getElementById('darkModeToggle');
        this.label = document.getElementById('toggleLabel');
        this.status = document.getElementById('statusText');
        this.effectSlider = document.getElementById('effectSlider');
        this.effectValue = document.getElementById('effectValue');

        this.init();
    }

    async init() {
        // Load saved state
        const result = await browser.storage.local.get(['darkModeEnabled', 'effect']);
        const isEnabled = result.darkModeEnabled || false;
        const effect = result.effect || 100;

        // Update UI
        this.toggle.checked = isEnabled;
        this.effectSlider.value = effect;
        this.effectValue.textContent = effect + '%';
        this.updateUI(isEnabled);

        // Add event listeners
        this.toggle.addEventListener('change', this.handleToggle.bind(this));
        this.effectSlider.addEventListener('input', this.handleEffectChange.bind(this));

        // Get current tab and check if dark mode is active
        this.updateStatusForCurrentTab();
    }

    updateUI(isEnabled) {
        this.label.textContent = isEnabled ? 'On' : 'Off';
        this.status.textContent = isEnabled ? 'Dark mode enabled' : 'Click to enable dark mode';
    }

    async handleToggle(event) {
        const isEnabled = event.target.checked;
        const effect = parseInt(this.effectSlider.value);
        this.updateUI(isEnabled);

        try {
            // Save to storage
            await browser.storage.local.set({
                darkModeEnabled: isEnabled,
                effect: effect
            });

            // Send message to content script
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await browser.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDarkMode',
                    enabled: isEnabled,
                    effect: effect
                });
            }

            this.updateStatusForCurrentTab();
        } catch (error) {
            console.error('Error toggling dark mode:', error);
            this.status.textContent = 'Error: Could not apply dark mode';
        }
    }

    async handleEffectChange(event) {
        const effect = parseInt(event.target.value);
        this.effectValue.textContent = effect + '%';

        // Save to storage
        await browser.storage.local.set({ effect: effect });

        // Update filters if dark mode is active
        if (this.toggle.checked) {
            await this.updateFilters();
        }
    }

    async updateFilters() {
        try {
            const effect = parseInt(this.effectSlider.value);

            console.log('PitchBlack Popup: Updating filters with effect:', effect);

            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                console.log('PitchBlack Popup: Sending message to tab:', tabs[0].id);
                await browser.tabs.sendMessage(tabs[0].id, {
                    action: 'updateFilters',
                    effect: effect
                });
                console.log('PitchBlack Popup: Message sent successfully');
            }
        } catch (error) {
            console.error('Error updating filters:', error);
        }
    }

    async updateStatusForCurrentTab() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                const response = await browser.tabs.sendMessage(tabs[0].id, { action: 'getStatus' });
                if (response && response.darkModeActive !== undefined) {
                    this.status.textContent = response.darkModeActive ?
                        'Dark mode active on this page' : 'Dark mode available for this page';
                }
            }
        } catch (error) {
            // Content script might not be loaded yet, which is normal
            this.status.textContent = 'Loading...';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DarkModePopup();
});
