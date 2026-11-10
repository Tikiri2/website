(() => {
  'use strict';

  const WHATSAPP_NUMBER = '94775356524';
  const STORE_NAME = 'VENU Shoues';
  const COURIER_FEE = 250;
  let orderFile = null;
  let orderImageURL = '';
  let savedOrder = null;
  let orderRequestKey = '';
  let orderFingerprint = '';
  const orderDialog = document.getElementById('order-dialog');
  const saveOrderButton = document.getElementById('save-order');
  const shareOrderButton = document.getElementById('share-order');
  const shareNote = document.getElementById('share-note');

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id') || '';
  const productName = params.get('name') || '';

  const els = {
    preview: document.getElementById('preview-image'),
    previewTint: document.getElementById('preview-tint'),
    colourList: document.getElementById('colour-list'),
    name: document.getElementById('product-name'),
    price: document.getElementById('product-price'),
    desc: document.getElementById('product-desc'),
    summary: document.getElementById('fit-summary'),
    sizeInput: document.getElementById('size-input'),
    sizeNote: document.getElementById('size-note'),
    heelInput: document.getElementById('heel-input'),
    heelNote: document.getElementById('heel-note'),
    form: document.getElementById('order-form'),
    phone: document.getElementById('phone-input'),
    message: document.getElementById('form-message'),
    orderButton: document.getElementById('order-button'),
    backToShop: document.getElementById('back-to-shop'),
  };

  const state = {
    product: null,
    colours: [],
    sizes: [36, 37, 38, 39, 40],
    colour: null,
    size: 38,
    heel: 5,
  };

  /* ---------------------------------------------------------
     Products
     --------------------------------------------------------- */

  const DEFAULT_COLOURS = {
    heels: [
      { name: 'Soft Blush', hex: '#e5b3ac' },
      { name: 'Deep Wine', hex: '#6f2136' },
      { name: 'Classic Black', hex: '#2b2b2b' },
      { name: 'Champagne Gold', hex: '#c9a227' },
      { name: 'Ivory', hex: '#eee9dc' },
    ],
    sandals: [
      { name: 'Tan / Peach', hex: '#c98a63' },
      { name: 'Classic Black', hex: '#2b2b2b' },
      { name: 'Soft Blush', hex: '#e5b3ac' },
      { name: 'Deep Wine', hex: '#6f2136' },
      { name: 'Sage Green', hex: '#9aa87c' },
    ],
  };

  const CATALOG = [
    {
      name: 'Golden Hour Heel',
      category: 'heels',
      description: 'A touch of gold for your evening plans',
      price: 12900,
      image_url: 'Backend/assets/heel-golden-hour.jpg',
      image_alt: 'Gold strappy women’s heel sandal',
      colours: [
        { name: 'Rose', hex: '#c93728' },
        { name: 'Gold', hex: '#c9a227' },
        { name: 'Ivory', hex: '#eee9dc' },
        { name: 'Black', hex: '#2b2b2b' },
        { name: 'Wine', hex: '#6f2136' },
      ],
    },
    {
      name: 'Ruby Ribbon Heel',
      category: 'heels',
      description: 'A playful pop of red for going out',
      price: 10900,
      image_url: 'Backend/assets/heel-red-ribbon.jpg',
      image_alt: 'Red women’s heels with ribbon-style straps',
      colours: [
        { name: 'Ruby', hex: '#b3202a' },
        { name: 'Ivory', hex: '#eee9dc' },
        { name: 'Black', hex: '#2b2b2b' },
        { name: 'Blush', hex: '#e5b3ac' },
        { name: 'Gold', hex: '#c9a227' },
      ],
    },
    {
      name: 'Golden Arch Heel',
      category: 'heels',
      description: 'A little shimmer, made for celebrations',
      price: 11900,
      image_url: 'Backend/assets/heel-gold-arch.jpg',
      image_alt: 'Gold open-toe women’s occasion heels',
      colours: [
        { name: 'Gold', hex: '#c9a227' },
        { name: 'Rose', hex: '#c93728' },
        { name: 'Lilac', hex: '#b9a7d6' },
        { name: 'Ivory', hex: '#eee9dc' },
        { name: 'Wine', hex: '#6f2136' },
      ],
    },
    {
      name: 'Floral Footbed Sandal',
      category: 'sandals',
      description: 'Easy, pretty and ready for everyday',
      price: 5900,
      image_url: 'Backend/assets/sandal-black-flower.jpg',
      image_alt: 'Printed women’s flat sandals with flower detail',
      colours: [
        { name: 'Maroon', hex: '#7d2b34' },
        { name: 'Cream', hex: '#eee9dc' },
        { name: 'Black', hex: '#2b2b2b' },
        { name: 'Blush', hex: '#e5b3ac' },
        { name: 'Olive', hex: '#7d8c5c' },
      ],
    },
    {
      name: 'Sunset Strap Sandal',
      category: 'sandals',
      description: 'Your comfy favourite for sunny days',
      price: 6900,
      image_url: 'Backend/assets/sandal-orange-strap.jpg',
      image_alt: 'Orange and cream women’s strap sandals',
      colours: [
        { name: 'Sand', hex: '#d9b382' },
        { name: 'Olive', hex: '#7d8c5c' },
        { name: 'Cream', hex: '#eee9dc' },
        { name: 'Black', hex: '#2b2b2b' },
        { name: 'Wine', hex: '#6f2136' },
      ],
    },
    {
      name: 'Blush Charm Sandal',
      category: 'sandals',
      description: 'Pretty little details for everyday wear',
      price: 7900,
      image_url: 'Backend/assets/sandal-brown-charm.jpg',
      image_alt: 'Women’s sandals with decorative charm straps',
      colours: [
        { name: 'Blue', hex: '#8096ae' },
        { name: 'Cream', hex: '#eee9dc' },
        { name: 'Tan', hex: '#a9775a' },
        { name: 'Blush', hex: '#e5b3ac' },
        { name: 'Black', hex: '#2b2b2b' },
      ],
    },
  ];

  function normalizeAssetPath(path) {
    if (typeof path !== 'string') return '';
    if (!path) return '';
    return path.startsWith('assets/') ? `Backend/${path}` : path;
  }

  function formatPrice(amount) {
    return `Rs. ${Math.round(amount).toLocaleString('en-LK')}`;
  }

  function hexToHsl(hex) {
    let value = String(hex || '').replace('#', '');
    if (value.length === 3) value = value.split('').map((part) => part + part).join('');
    if (!/^[0-9a-f]{6}$/i.test(value)) return { h: 20, s: 0.3, l: 0.5 };
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
  }

  function colourStyles(hex) {
    const { l } = hexToHsl(hex);
    if (l < 0.2) {
      return { filter: 'grayscale(1) brightness(0.58) contrast(1.06)', tint: '', opacity: 0 };
    }
    if (l > 0.88) {
      return { filter: 'grayscale(0.65) brightness(1.12)', tint: hex, opacity: 0.32 };
    }
    const brightness = (0.55 + l * 0.9).toFixed(2);
    return { filter: `grayscale(1) contrast(1.04) brightness(${brightness})`, tint: hex, opacity: 0.95 };
  }

  function normalizeColours(raw, product) {
    const defaults = CATALOG.find((item) => item.name === product.name)?.colours
      || DEFAULT_COLOURS[product.category]
      || DEFAULT_COLOURS.heels;

    if (!Array.isArray(raw) || !raw.length) {
      return defaults.map((colour) => ({ ...colour, image: '' }));
    }

    const normalized = raw
      .map((colour) => {
        if (!colour || typeof colour !== 'object') return null;
        const name = String(colour.name || '').trim();
        let hex = String(colour.hex || colour.value || '').trim();
        if (hex && !hex.startsWith('#')) hex = `#${hex}`;
        if (!/^#[0-9a-f]{3,8}$/i.test(hex)) return null;
        const match = defaults.find((item) => item.name.toLowerCase() === name.toLowerCase());
        return {
          name: name || 'Colour',
          hex,
          image: normalizeAssetPath(colour.image || colour.image_url || match?.image || ''),
        };
      })
      .filter(Boolean);

    return normalized.length ? normalized : defaults.map((colour) => ({ ...colour, image: '' }));
  }

  function normalizeSizes(raw) {
    if (!Array.isArray(raw)) return [36, 37, 38, 39, 40];
    const sizes = [...new Set(raw.map(Number).filter((size) => Number.isFinite(size) && size > 0 && size <= 60))]
      .sort((a, b) => a - b);
    return sizes.length ? sizes : [36, 37, 38, 39, 40];
  }
  async function fetchProduct() {
    const config = window.SHUES_CMS_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) return null;
    if (!productId && !productName) return null;

    const query = new URLSearchParams({ select: '*', published: 'eq.true', limit: '1' });
    if (productId) query.set('id', `eq.${productId}`);
    else query.set('name', `eq.${productName}`);

    const response = await fetch(`${config.supabaseUrl}/rest/v1/products?${query}`, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });
    if (!response.ok) throw new Error(`Product request failed (${response.status})`);
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  function fallbackProduct() {
    let stored = null;
    try {
      stored = JSON.parse(sessionStorage.getItem('venu.product') || 'null');
    } catch {
      stored = null;
    }
    const wantedName = productName || stored?.name || '';
    const match = CATALOG.find((item) => item.name === wantedName)
      || CATALOG.find((item) => item.name === 'Golden Hour Heel');
    return {
      ...match,
      ...(stored && (!wantedName || stored.name === wantedName) ? stored : {}),
      id: productId || stored?.id || 'fallback',
    };
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */

  function setPreviewColour(colour) {
    const productImage = normalizeAssetPath(state.product.image_url);
    const image = colour?.image || productImage;
    const styles = colour?.image ? null : colourStyles(colour?.hex);
    els.preview.src = image;
    els.preview.alt = `${state.product.name} in ${colour?.name || 'your chosen colour'}`;
    els.preview.style.filter = styles?.filter || 'none';
    els.previewTint.style.background = styles?.tint || 'transparent';
    els.previewTint.style.opacity = String(styles?.opacity || 0);
  }

  function updateSummary() {
    if (!state.product) return;
    els.summary.textContent = `${state.colour?.name || 'Colour'} · EU ${state.size} · ${state.heel} cm heel`;
  }

  function selectColour(index) {
    const colour = state.colours[index];
    if (!colour) return;
    state.colour = colour;
    [...els.colourList.children].forEach((button, buttonIndex) => {
      const selected = buttonIndex === index;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    setPreviewColour(colour);
    updateSummary();
  }

  function renderColours() {
    els.colourList.replaceChildren();
    state.colours.forEach((colour, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'colour-option';
      button.dataset.colour = colour.name;
      button.setAttribute('aria-pressed', 'false');

      const thumb = document.createElement('span');
      thumb.className = 'colour-thumb';
      const image = document.createElement('img');
      const productImage = normalizeAssetPath(state.product.image_url);
      image.src = colour.image || productImage;
      image.alt = '';
      image.loading = 'lazy';
      const styles = colour.image ? null : colourStyles(colour.hex);
      if (styles) image.style.filter = styles.filter;
      thumb.append(image);
      if (styles?.tint) {
        const tint = document.createElement('span');
        tint.className = 'colour-tint';
        tint.style.background = styles.tint;
        tint.style.opacity = String(styles.opacity);
        thumb.append(tint);
      }

      const label = document.createElement('span');
      label.className = 'colour-name';
      label.textContent = colour.name;

      button.append(thumb, label);
      button.addEventListener('click', () => selectColour(index));
      els.colourList.append(button);
    });
    selectColour(0);
  }

  function renderProduct(product) {
    state.product = product;
    state.colours = normalizeColours(product.colors, product);
    state.sizes = normalizeSizes(product.sizes);
    els.sizeInput.min = String(state.sizes[0]);
    els.sizeInput.max = String(state.sizes[state.sizes.length - 1]);
    els.sizeInput.step = '1';
    els.sizeInput.value = String(state.sizes.includes(state.size) ? state.size : state.sizes[0]);
    els.sizeInput.dispatchEvent(new Event('change', { bubbles: true }));

    els.name.textContent = product.name || 'Your pair';
    els.price.textContent = formatPrice(Number(product.price) || 0);
    els.desc.textContent = product.description || '';

    const productImage = normalizeAssetPath(product.image_url);
    els.preview.src = productImage;
    els.preview.alt = product.image_alt || product.name || 'Selected shoe';
    els.preview.style.filter = 'none';

    document.title = `Customize ${product.name || 'your pair'} — ${STORE_NAME}`;
    renderColours();
  }

  /* ---------------------------------------------------------
     Size + heel steppers
     --------------------------------------------------------- */

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function sizeNote(size) {
    return `EU ${size}`;
  }

  function heelNote(cm) {
    if (cm <= 2) return 'Flat';
    if (cm <= 4.5) return 'Low heel';
    if (cm <= 7) return 'Mid heel';
    return 'High heel';
  }

  function setupStepper(input, note, onChange) {
    const step = Number(input.step) || 0.5;
    const wheel = document.createElement('div');
    wheel.className = 'value-wheel';
    wheel.setAttribute('role', 'group');
    wheel.setAttribute('aria-label', input.getAttribute('aria-label'));
    input.closest('.stepper').append(wheel);
    input.tabIndex = -1;
    let values = [];
    let valuesKey = '';
    let scrollTimer;
    let lastWheel = 0;

    const syncWheel = (value, move) => {
      const next = input === els.sizeInput ? state.sizes : Array.from(
        { length: Math.round((Number(input.max) - Number(input.min)) / step) + 1 },
        (_, index) => Number((Number(input.min) + index * step).toFixed(1))
      );
      const key = next.join(',');
      if (key !== valuesKey) {
        values = next;
        valuesKey = key;
        wheel.replaceChildren(...values.map((item) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'wheel-option';
          button.textContent = item;
          button.setAttribute('aria-label', input === els.sizeInput ? `EU ${item}` : `${item} centimetres`);
          button.addEventListener('click', () => apply(item));
          return button;
        }));
      }
      [...wheel.children].forEach((button, index) => {
        const selected = values[index] === value;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      if (move) wheel.scrollTop = Math.max(0, values.indexOf(value)) * 36;
    };

    const apply = (raw, move = true) => {
      if (input.disabled) return;
      const number = Number(raw);
      const bounded = clamp(Number.isFinite(number) ? number : Number(input.min), Number(input.min), Number(input.max));
      const availableSizes = input === els.sizeInput ? state.sizes : null;
      const value = availableSizes
        ? availableSizes.reduce((closest, candidate) =>
          Math.abs(candidate - bounded) < Math.abs(closest - bounded) ? candidate : closest
        , availableSizes[0])
        : clamp(Math.round(bounded / step) * step, Number(input.min), Number(input.max));
      input.value = Number(value.toFixed(1)).toString();
      note.textContent = onChange(value);
      syncWheel(value, move);
    };

    wheel.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        const index = clamp(Math.round(wheel.scrollTop / 36), 0, values.length - 1);
        apply(values[index], false);
      }, 80);
    });
    wheel.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (!event.deltaY || Date.now() - lastWheel < 110) return;
      lastWheel = Date.now();
      const index = values.indexOf(Number(input.value));
      apply(values[clamp(index + Math.sign(event.deltaY), 0, values.length - 1)]);
    }, { passive: false });

    input.addEventListener('change', () => apply(input.value));
    input.addEventListener('blur', () => apply(input.value));

    apply(input.value);
    return {
      get value() {
        return Number(input.value);
      },
    };
  }

  /* ---------------------------------------------------------
     Order via WhatsApp
     --------------------------------------------------------- */

  function normalizePhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('0094')) digits = digits.slice(2);
    if (digits.startsWith('94') && digits.length === 11) digits = `0${digits.slice(2)}`;
    return digits;
  }

  function showMessage(text) {
    els.message.textContent = text;
    els.message.classList.add('is-error');
  }

  function clearMessage() {
    els.message.textContent = '';
    els.message.classList.remove('is-error');
  }

  function loadOrderImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), 8000);
      image.crossOrigin = 'anonymous';
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = src;
    });
  }

  async function createOrderCard(phone) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    const image = await loadOrderImage(els.preview.currentSrc || els.preview.src);
    ctx.fillStyle = '#fffaf7';
    ctx.fillRect(0, 0, 900, 1280);
    ctx.fillStyle = '#382934';
    ctx.fillRect(0, 0, 900, 124);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Georgia';
    ctx.fillText(STORE_NAME, 60, 60);
    ctx.fillStyle = '#e8bdcf';
    ctx.font = '17px sans-serif';
    ctx.fillText('YOUR CUSTOM ORDER  /  MADE FOR YOU', 60, 96);
    if (image) {
      const boxWidth = 820;
      const boxHeight = 416;
      const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (900 - width) / 2;
      const y = 148 + (boxHeight - height) / 2;
      ctx.save();
      ctx.filter = els.preview.style.filter || 'none';
      ctx.drawImage(image, x, y, width, height);
      ctx.restore();
      if (Number(els.previewTint.style.opacity) > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.globalAlpha = Number(els.previewTint.style.opacity);
        ctx.fillStyle = els.previewTint.style.background;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#897a83';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Product image unavailable', 450, 356);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#a54d70';
    ctx.font = '16px sans-serif';
    ctx.fillText('ORDER SUMMARY', 60, 602);
    ctx.fillStyle = '#382934';
    ctx.font = '38px Georgia';
    // Fit long CMS product names without clipping the order details.
    const words = String(state.product.name || 'Your pair').split(/\s+/);
    const lines = [''];
    words.forEach((word) => {
      const index = lines.length - 1;
      const candidate = `${lines[index]} ${word}`.trim();
      if (ctx.measureText(candidate).width > 780 && lines[index]) lines.push(word);
      else lines[index] = candidate;
    });
    lines.slice(0, 2).forEach((line, index) => ctx.fillText(line, 60, 648 + index * 42, 780));
    const row = (label, value, y, bold = false) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#897a83';
      ctx.font = '22px sans-serif';
      ctx.fillText(label, 60, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#382934';
      ctx.font = `${bold ? 'bold ' : ''}24px sans-serif`;
      ctx.fillText(String(value), 840, y, 560);
      ctx.textAlign = 'left';
    };
    row('Colour', state.colour?.name || '—', 744);
    row('Shoe size', `EU ${state.size}`, 788);
    row('Heel height', `${state.heel} cm`, 832);
    ctx.fillStyle = '#e6d8df';
    ctx.fillRect(60, 862, 780, 1);
    const price = Number(state.product.price) || 0;
    row('Product price', formatPrice(price), 906);
    row('Courier delivery', formatPrice(COURIER_FEE), 950);
    ctx.fillStyle = '#f0dfe7';
    ctx.fillRect(40, 980, 820, 78);
    row('TOTAL', formatPrice(price + COURIER_FEE), 1028, true);
    row('Customer phone', phone, 1112);
    ctx.fillStyle = '#897a83';
    ctx.font = '18px sans-serif';
    ctx.fillText('Order enquiry · Confirm availability & delivery on WhatsApp', 60, 1184);
    ctx.fillText(`WhatsApp: +${WHATSAPP_NUMBER}`, 60, 1218);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image export failed')), 'image/png');
    });
    return { file: new File([blob], 'venu-order.png', { type: 'image/png' }), hasImage: !!image };
  }

  document.getElementById('close-order').addEventListener('click', () => orderDialog.close());

  let saveFeedbackTimer;
  function triggerImageDownload() {
    if (!orderImageURL) return;
    const link = document.createElement('a');
    link.href = orderImageURL;
    link.download = `venu-order-${savedOrder?.id ? savedOrder.id.slice(0, 8) : 'card'}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    saveOrderButton.textContent = 'Saved ✓';
    clearTimeout(saveFeedbackTimer);
    saveFeedbackTimer = window.setTimeout(() => {
      saveOrderButton.textContent = 'Save image ↓';
    }, 1800);
  }

  saveOrderButton.addEventListener('click', async () => {
    if (!orderFile || !orderImageURL) return;
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // On iOS/iPadOS, `<a download>` opens a preview tab instead of saving to Photos;
    // the OS share sheet lets the user tap "Save Image" straight into their gallery.
    if (isAppleMobile && navigator.canShare?.({ files: [orderFile] })) {
      try {
        await navigator.share({
          files: [orderFile],
          title: `${STORE_NAME} Order`,
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    triggerImageDownload();
  });

  shareOrderButton.addEventListener('click', () => {
    if (!savedOrder) return;
    const message = [
      `Hi ${STORE_NAME}, I'd like to order this custom pair.`,
      `Order: ${savedOrder.id}`,
      `Order image (link valid for 7 days):`,
      savedOrder.share_url || savedOrder.image_url,
    ].join('\n');
    // Navigate directly from the click, without asynchronous popup blocking.
    window.location.assign(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
  });

  async function saveOrder(phone, file) {
    const config = window.SHUES_CMS_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) throw new Error('Ordering is not configured. Please contact the shop.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state.product.id || '')) throw new Error('This is a preview product. Open a live product from the shop to place an order.');
    const details = {
      product_id: state.product.id, phone, colour: state.colour?.name || 'Original',
      size: state.size, heel: state.heel, expected_price: Number(state.product.price),
    };
    const fingerprint = JSON.stringify(details);
    if (fingerprint !== orderFingerprint) {
      orderRequestKey = crypto.randomUUID();
      orderFingerprint = fingerprint;
    }
    const body = new FormData();
    body.append('order', JSON.stringify({ ...details, request_key: orderRequestKey }));
    body.append('image', file);
    const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/create-order`, {
      method: 'POST', headers: { apikey: config.supabaseAnonKey }, body,
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('The order service is unavailable. Please try again later.'); }
    if (!response.ok || !result.id || !result.image_url) throw new Error(result.error || 'Could not save your order. Please try again.');
    if (/^[a-f0-9]{32}$/.test(result.share_token || '')) {
      const link = new URL('order.html', window.location.href);
      link.hash = result.share_token;
      result.share_url = link.href;
    }
    return result;
  }

  const sizeStepper = setupStepper(els.sizeInput, els.sizeNote, (value) => {
    state.size = value;
    updateSummary();
    return sizeNote(value);
  });
  const heelStepper = setupStepper(els.heelInput, els.heelNote, (value) => {
    state.heel = value;
    updateSummary();
    return heelNote(value);
  });

  state.size = sizeStepper.value;
  state.heel = heelStepper.value;

  els.backToShop.addEventListener('click', () => {
    window.location.href = 'index.html#shop';
  });

  els.phone.addEventListener('input', () => {
    if (els.phone.getAttribute('aria-invalid') === 'true' && normalizePhone(els.phone.value).length >= 10) {
      els.phone.removeAttribute('aria-invalid');
      clearMessage();
    }
  });

  // Keep the phone field above the software keyboard. The page now scrolls on
  // mobile instead of squeezing the two panels, and the visual viewport tells
  // us how much room the keyboard has left.
  const keepPhoneVisible = () => {
    if (document.activeElement !== els.phone) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const rect = els.phone.getBoundingClientRect();
    const top = viewport.offsetTop + 16;
    const bottom = viewport.offsetTop + viewport.height - 16;
    if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
    else if (rect.top < top) window.scrollBy(0, rect.top - top);
  };
  els.phone.addEventListener('focus', () => requestAnimationFrame(keepPhoneVisible));
  window.visualViewport?.addEventListener('resize', keepPhoneVisible);

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phone = normalizePhone(els.phone.value);
    if (!/^0\d{9}$/.test(phone)) {
      els.phone.setAttribute('aria-invalid', 'true');
      showMessage('Enter a valid phone number, e.g. 077 123 4567.');
      els.phone.focus();
      return;
    }

    els.phone.removeAttribute('aria-invalid');
    if (!state.product || els.orderButton.disabled) return;
    clearMessage();
    savedOrder = null;
    els.orderButton.disabled = true;
    els.orderButton.setAttribute('aria-busy', 'true');
    const controls = [...document.querySelectorAll('input, .stepper button, #colour-list button')]
      .filter((control) => !control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    try {
      const result = await createOrderCard(phone);
      orderFile = result.file;
      savedOrder = await saveOrder(phone, orderFile);
      if (orderImageURL) URL.revokeObjectURL(orderImageURL);
      orderImageURL = URL.createObjectURL(orderFile);
      document.getElementById('order-card-image').src = orderImageURL;
      saveOrderButton.textContent = 'Save image ↓';
      shareOrderButton.textContent = 'Continue to WhatsApp ↗';
      shareNote.textContent = `Order ${savedOrder.id.slice(0, 8)} saved. Continue to WhatsApp and tap Send to send your order image link to the shop. The link expires in 7 days. Your order is confirmed only after the shop replies.`;
      if (!result.hasImage) shareNote.textContent += ' Product photo could not load; your order details are included.';
      orderDialog.showModal();
    } catch (error) {
      console.warn('Order card could not be created:', error);
      showMessage(error.message || 'Could not save your order. Please try again.');
    } finally {
      controls.forEach((control) => { control.disabled = false; });
      els.orderButton.disabled = false;
      els.orderButton.removeAttribute('aria-busy');
    }
  });

  (async () => {
    let product = null;
    try {
      product = await fetchProduct();
    } catch (error) {
      console.warn('Using local catalogue:', error);
    }
    renderProduct(product || fallbackProduct());
  })();
})();






