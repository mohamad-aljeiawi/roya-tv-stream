/* ══════════════════════════════════════
   pwa.js — Service Worker + Install Banner
   ══════════════════════════════════════ */

/* ── Register Service Worker ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] SW registered, scope:', reg.scope);

        // Auto-update check every 30 minutes
        setInterval(() => reg.update(), 30 * 60 * 1000);

        // Notify on new version
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available');
            }
          });
        });
      })
      .catch((err) => console.warn('[PWA] SW registration failed:', err));
  });
}

/* ── Install Banner (A2HS) ── */
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
const installBtn    = document.getElementById('installBtn');
const installClose  = document.getElementById('installClose');

// Capture the install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Don't show if user dismissed before
  if (localStorage.getItem('roya-pwa-dismissed')) return;

  // Show banner after 3 seconds
  setTimeout(() => {
    installBanner.classList.add('visible');
  }, 3000);
});

// Install button
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBanner.classList.remove('visible');
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  console.log('[PWA] Install result:', result.outcome);
  deferredPrompt = null;
});

// Close button
installClose.addEventListener('click', () => {
  installBanner.classList.remove('visible');
  localStorage.setItem('roya-pwa-dismissed', '1');
});

// Hide if already installed
window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('visible');
  deferredPrompt = null;
  console.log('[PWA] App installed!');
});
