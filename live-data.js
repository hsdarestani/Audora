/* Keep live marketplace/inbox data honest without requiring full page reloads. */
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
          if (typeof updateFavoriteCounts === 'function') updateFavoriteCounts();
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

  /* Provider mutations must update the customer marketplace immediately after the server confirms them. */
  if (window.AudoraAPI?.deleteProviderListing) {
    const baseDeleteProviderListing = window.AudoraAPI.deleteProviderListing.bind(window.AudoraAPI);
    window.AudoraAPI.deleteProviderListing = async function syncedDeleteProviderListing(id) {
      const result = await baseDeleteProviderListing(id);
      if (typeof listings !== 'undefined') {
        const index = listings.findIndex(item => item.id === id);
        if (index >= 0) listings.splice(index, 1);
      }
      if (typeof favorites !== 'undefined') favorites.delete(id);
      if (typeof renderDiscover === 'function') renderDiscover();
      if (typeof renderHome === 'function') renderHome();
      if (typeof renderSaved === 'function') renderSaved();
      if (typeof updateFavoriteCounts === 'function') updateFavoriteCounts();
      await refreshMarketplace(true);
      return result;
    };
  }

  if (window.AudoraAPI?.createProviderListing) {
    const baseCreateProviderListing = window.AudoraAPI.createProviderListing.bind(window.AudoraAPI);
    window.AudoraAPI.createProviderListing = async function syncedCreateProviderListing(payload) {
      const result = await baseCreateProviderListing(payload);
      await refreshMarketplace(true);
      return result;
    };
  }

  if (window.AudoraAPI?.updateProviderListing) {
    const baseUpdateProviderListing = window.AudoraAPI.updateProviderListing.bind(window.AudoraAPI);
    window.AudoraAPI.updateProviderListing = async function syncedUpdateProviderListing(id, payload) {
      const result = await baseUpdateProviderListing(id, payload);
      await refreshMarketplace(true);
      return result;
    };
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-route="discover"]')) {
      setTimeout(() => refreshMarketplace(true), 0);
    }
  });

  window.addEventListener('focus', () => {
    const discover = document.querySelector('section[data-view="discover"]');
    if (discover?.classList.contains('active')) refreshMarketplace();
  });

  /* A message is only shown as sent after PostgreSQL confirms it. */
  if (typeof sendMessage === 'function' && window.AudoraAPI?.message) {
    sendMessage = async function durableSendMessage(text) {
      const value = String(text || '').trim();
      if (!value) return;
      const chat = typeof conversations !== 'undefined'
        ? conversations.find(item => item.id === activeChat)
        : null;
      if (!chat) {
        if (typeof showToast === 'function') showToast(typeof lang !== 'undefined' && lang === 'de' ? 'Unterhaltung nicht gefunden.' : 'Conversation not found.');
        return;
      }

      const form = document.getElementById('messageForm');
      const input = document.getElementById('messageText');
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      if (input) input.disabled = true;

      try {
        const saved = await window.AudoraAPI.message(activeChat, value);
        const time = typeof formatTime === 'function'
          ? formatTime(saved.time)
          : new Date(saved.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chat.messages.push({ me: true, de: saved.text || value, en: saved.text || value, time, server: true, id: saved.id });
        chat.preview = { de: saved.text || value, en: saved.text || value };
        if (typeof renderConversations === 'function') renderConversations();
        if (typeof renderChat === 'function') renderChat();
        if (typeof showToast === 'function') {
          let message = typeof lang !== 'undefined' && lang === 'de' ? 'Nachricht gesendet.' : 'Message sent.';
          try { if (typeof t === 'function') message = t('toast.message'); } catch (_e) {}
          showToast(message);
        }
      } catch (error) {
        console.error('[Audora message persistence]', error);
        if (typeof showToast === 'function') showToast(typeof lang !== 'undefined' && lang === 'de' ? 'Nachricht konnte nicht gesendet werden.' : 'Message could not be sent.');
      } finally {
        if (submit) submit.disabled = false;
        if (input) { input.disabled = false; input.focus(); }
      }
    };
  }
})();