/**
 * Kuthbukhana Anwariyya - Mobile PWA & App Helper
 * Manages service worker registration, install prompts, and mobile app download
 */

(function () {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('[PWA] Service Worker registered with scope:', reg.scope);
                })
                .catch(err => {
                    console.warn('[PWA] Service Worker registration failed:', err);
                });
        });
    }

    // 2. Capture Install Prompt for PWA
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtns = document.querySelectorAll('.pwa-install-btn');
        installBtns.forEach(btn => {
            btn.style.display = 'inline-flex';
        });
    });

    window.installPWA = function () {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('[PWA] User accepted the install prompt');
                }
                deferredPrompt = null;
                const installBtns = document.querySelectorAll('.pwa-install-btn');
                installBtns.forEach(btn => btn.style.display = 'none');
            });
        } else {
            alert('To install this app on your phone:\n\n• On Android (Chrome): Tap the three dots (⋮) in the top-right corner and select "Install app" or "Add to Home screen".\n• On iPhone (Safari): Tap the Share button (⎋) at the bottom and select "Add to Home Screen".');
        }
    };

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] Kuthbukhana Library App installed successfully!');
        deferredPrompt = null;
    });
})();
