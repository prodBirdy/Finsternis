// Popup script for PitchBlack dark mode extension

class DarkModePopup {
    constructor() {
        this.toggle = document.getElementById('darkModeToggle');
        this.label = document.getElementById('toggleLabel');
        this.status = document.getElementById('statusText');

        this.init();
    }

    async init() {
        // Load saved state
        const result = await browser.storage.local.get(['darkModeEnabled']);
        const isEnabled = result.darkModeEnabled || false;

        // Update UI
        this.toggle.checked = isEnabled;
        this.updateUI(isEnabled);

        // Add event listener
        this.toggle.addEventListener('change', this.handleToggle.bind(this));

        // Get current tab and check if dark mode is active
        this.updateStatusForCurrentTab();
    }

    updateUI(isEnabled) {
        this.label.textContent = isEnabled ? 'On' : 'Off';
        this.status.textContent = isEnabled ? 'Dark mode enabled' : 'Click to enable dark mode';
    }

    async handleToggle(event) {
        const isEnabled = event.target.checked;
        this.updateUI(isEnabled);

        try {
            // Save to storage
            await browser.storage.local.set({ darkModeEnabled: isEnabled });

            // Send message to content script
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await browser.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDarkMode',
                    enabled: isEnabled
                });
            }

            this.updateStatusForCurrentTab();
        } catch (error) {
            console.error('Error toggling dark mode:', error);
            this.status.textContent = 'Error: Could not apply dark mode';
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
