/* Keep marketplace discovery fresh without requiring a full page reload. */
(() => {
  let refreshPromise = null;
  let lastRefresh = 0;

  async function refreshMarketplace(force = false) {
    if (!window.AudoraAPI?.listings || typeof listings === 'undefined') return;
    const now = Date.now();
    if (!force && now - lastRefresh < 1500) return;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const data = await window.AudoraAPI.listings();
        if (Array.isArray(data?.results)) {
          listings.splice(0, listings.length, ...data.results);
          if (typeof renderDiscover === 'function') renderDiscover();
          if (typeof renderHome === 'function') renderHome();
          if (typeof renderSaved === 'function') renderSaved();
          lastRefresh = Date.now();
        }
      } catch (error) {
        console.error('[Audora marketplace refresh]', error);
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  window.AudoraRefreshMarketplace = refreshMarketplace;

  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="discover"]')) {
      setTimeout(() => refreshMarketplace(true), 0);
    }
  });

  window.addEventListener('focus', () => {
    const discover = document.querySelector('section[data-view="discover"]');
    if (discover?.classList.contains('active')) refreshMarketplace();
  });
})();
