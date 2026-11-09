(() => {
  'use strict';
  const message = document.getElementById('order-view-message');
  const image = document.getElementById('order-view-image');
  const retry = document.getElementById('order-view-retry');
  // Fragment tokens are not sent to the website host or in Referer headers.
  const token = window.location.hash.slice(1);
  const config = window.SHUES_CMS_CONFIG;
  let busy = false;
  async function load() {
    if (busy) return;
    if (!/^[a-f0-9]{32}$/.test(token)) {
      message.textContent = 'This order image link is invalid. Please use the full link from your WhatsApp message.';
      return;
    }
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      message.textContent = 'The order image service is unavailable. Please contact the shop.';
      return;
    }
    busy = true;
    retry.hidden = true;
    image.hidden = true;
    message.textContent = 'Loading your order image…';
    try {
      const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/order-image`, {
        method: 'POST', headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }), cache: 'no-store', referrerPolicy: 'no-referrer',
      });
      const result = await response.json();
      if (!response.ok || !result.image_url) throw new Error(result.error || 'This image is unavailable. Please try again later.');
      image.src = result.image_url;
    } catch (error) {
      message.textContent = error.message || 'Could not load your image. Please try again.';
      retry.hidden = false;
    } finally {
      busy = false;
    }
  }
  image.addEventListener('load', () => { image.hidden = false; message.textContent = 'Your saved order image'; });
  image.addEventListener('error', () => {
    image.hidden = true;
    message.textContent = 'The image could not load. Please try again.';
    retry.hidden = false;
  });
  retry.addEventListener('click', load);
  load();
})();
