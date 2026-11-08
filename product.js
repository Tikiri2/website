(() => {
  'use strict';

  const WHATSAPP_NUMBER = '94775356524';
  const STORE_NAME = 'VENU Shoues';

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id') || '';
  const productName = params.get('name') || '';

  const els = {
    preview: document.getElementById('preview-image'),
    previewTint: document.getElementById('preview-tint'),
    previewColour: document.getElementById('preview-colour'),
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
    els.previewColour.textContent = colour?.name || 'Colour';
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

    const apply = (raw) => {
      const bounded = clamp(Number(raw), Number(input.min), Number(input.max));
      const availableSizes = input === els.sizeInput ? state.sizes : null;
      const value = availableSizes
        ? availableSizes.reduce((closest, candidate) =>
          Math.abs(candidate - bounded) < Math.abs(closest - bounded) ? candidate : closest
        , availableSizes[0])
        : clamp(Math.round(bounded / step) * step, Number(input.min), Number(input.max));
      input.value = Number(value.toFixed(1)).toString();
      note.textContent = onChange(value);
    };

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

  function orderSummary(phone) {
    return [
      `Hi ${STORE_NAME}, I'd like to order this custom pair:`,
      `Style: ${state.product.name}`,
      `Colour: ${state.colour?.name || '—'}`,
      `Size: EU ${state.size}`,
      `Heel height: ${state.heel} cm`,
      `Price: ${formatPrice(Number(state.product.price) || 0)}`,
      `Phone: ${phone}`,
    ].join('\n');
  }

  function showMessage(text) {
    els.message.textContent = text;
    els.message.classList.add('is-error');
  }

  function clearMessage() {
    els.message.textContent = '';
    els.message.classList.remove('is-error');
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

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const phone = normalizePhone(els.phone.value);
    if (!/^0\d{9}$/.test(phone)) {
      els.phone.setAttribute('aria-invalid', 'true');
      showMessage('Enter a valid phone number, e.g. 077 123 4567.');
      els.phone.focus();
      return;
    }

    els.phone.removeAttribute('aria-invalid');
    const summary = orderSummary(phone);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(summary)}`;
    window.location.assign(url);
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
