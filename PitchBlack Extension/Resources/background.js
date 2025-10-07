// Background script for PitchBlack dark mode extension

class PitchBlackBackground {
    constructor() {
        this.init();
    }

    init() {
        console.log('PitchBlack extension loaded');

        // Listen for extension installation/update
        browser.runtime.onInstalled.addListener(this.handleInstalled.bind(this));

        // Listen for messages from content scripts
        browser.runtime.onMessage.addListener(this.handleMessage.bind(this));

        // Handle tab updates to potentially reinitialize dark mode
        browser.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));

        // Listen for keyboard commands
        browser.commands.onCommand.addListener(this.handleCommand.bind(this));
    }

    handleInstalled(details) {
        console.log('PitchBlack extension installed/updated:', details.reason);

        // Set default preferences if this is a fresh install
        if (details.reason === 'install') {
            browser.storage.local.set({
                darkModeEnabled: false,
                effect: 100,
                version: browser.runtime.getManifest().version
            });
        }
    }

    handleMessage(request, sender, sendResponse) {
        console.log('Background received message:', request);

        switch (request.action) {
            case 'getSettings':
                // Return current settings
                browser.storage.local.get(['darkModeEnabled']).then(result => {
                    sendResponse(result);
                });
                return true; // Keep channel open for async response

            case 'updateSettings':
                // Update settings
                browser.storage.local.set(request.settings).then(() => {
                    sendResponse({ success: true });
                });
                return true; // Keep channel open for async response

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Only process when the page has finished loading
        if (changeInfo.status === 'complete' && tab.url) {
            try {
                // Check if dark mode should be applied to this tab
                const result = await browser.storage.local.get(['darkModeEnabled']);
                if (result.darkModeEnabled) {
                    // Send message to content script to apply dark mode
                    browser.tabs.sendMessage(tabId, {
                        action: 'toggleDarkMode',
                        enabled: true
                    }).catch(error => {
                        // Content script might not be loaded yet, which is normal for some tabs
                        console.log('Could not send message to tab:', tabId, error);
                    });
                }
            } catch (error) {
                console.log('Error handling tab update:', error);
            }
        }
    }

    async handleCommand(command) {
        if (command === 'toggle-dark-mode') {
            try {
                // Get current state
                const result = await browser.storage.local.get(['darkModeEnabled', 'effect']);
                const newState = !result.darkModeEnabled;

                // Update storage
                await browser.storage.local.set({ darkModeEnabled: newState });

                // Broadcast to all tabs
                const tabs = await browser.tabs.query({});
                for (const tab of tabs) {
                    try {
                        await browser.tabs.sendMessage(tab.id, {
                            action: 'toggleDarkMode',
                            enabled: newState,
                            effect: result.effect || 100
                        });
                    } catch (error) {
                        // Content script might not be loaded, which is normal
                        console.log('Could not send message to tab:', tab.id, error);
                    }
                }

                console.log('PitchBlack: Dark mode toggled via keyboard shortcut to', newState);
            } catch (error) {
                console.error('Error handling keyboard command:', error);
            }
        }
    }
}

// Initialize the background script
new PitchBlackBackground();
