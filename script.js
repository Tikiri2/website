if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-reveal');
}

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------------------------------------------------
     Elements
     --------------------------------------------------------- */
  let cards = [...document.querySelectorAll('.product-card')];
  let categoryButtons = [...document.querySelectorAll('.category-button')];
  const sortSelect = document.getElementById('product-sort');
  const productGrid = document.getElementById('product-grid');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const cartCount = document.querySelector('.cart-count');
  const menuTrigger = document.querySelector('.menu-trigger');
  const mainNav = document.querySelector('.main-nav');
  const header = document.getElementById('site-header');
  const drawer = document.querySelector('.cart-drawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  const cartItems = document.querySelector('.cart-items');
  const cartEmpty = document.querySelector('.cart-empty');
  const cartSummary = document.querySelector('.cart-summary');
  const drawerCount = document.querySelector('.drawer-count');
  const toast = document.querySelector('.toast');
  const shippingMeter = document.querySelector('.shipping-meter');
  const shippingBar = document.querySelector('.shipping-bar span');
  const shippingNote = document.querySelector('.shipping-note');
  const newsletterForm = document.querySelector('.newsletter-form');

  const FREE_DELIVERY = 10000;
  const STORAGE = { cart: 'shues.cart.v1' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeFilter = 'all';
  let toastTimer;

  const heroImages = [...document.querySelectorAll('.hero-image')];
  const moodGrid = document.querySelector('[data-cms-cards="mood"]');
  const promiseGrid = document.querySelector('[data-cms-cards="promise"]');
  let heroSlideshowCleanup = null;

  function getMoodSlidesFromDom() {
    return [...document.querySelectorAll('.category-tile')]
      .map((tile) => {
        const image = tile.querySelector('img');
        if (!image) return null;
        return {
          image: image.getAttribute('src'),
          alt: image.alt,
          label: tile.querySelector('span')?.firstChild?.textContent.trim() || '',
        };
      })
      .filter(Boolean);
  }

  // Keep the hand-written mood cards available when the CMS has fewer entries.
  const defaultMoodCards = [...document.querySelectorAll('[data-cms-cards="mood"] .category-tile')]
    .map((tile) => {
      const image = tile.querySelector('img');
      if (!image) return null;
      return {
        title: tile.querySelector('span')?.firstChild?.textContent.trim() || '',
        image_url: image.getAttribute('src'),
        image_alt: image.alt,
        link_url: tile.getAttribute('href') || '#shop',
        link_filter: tile.dataset.navFilter || '',
      };
    })
    .filter(Boolean);

  function initHeroSlideshow(slides) {
    if (heroImages.length !== 2 || !slides.length) return;

    if (heroSlideshowCleanup) {
      heroSlideshowCleanup();
      heroSlideshowCleanup = null;
    }

    const [firstImage, secondImage] = heroImages;
    let activeLayer = firstImage.classList.contains('is-visible') ? 0 : 1;
    let activeSlide = -1;
    let timer;
    let isHovered = false;
    let isLoading = false;
    const controller = new AbortController();
    const { signal } = controller;

    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };

    const start = () => {
      stop();
      if (reduceMotion || isHovered || document.hidden || slides.length < 2) return;
      timer = window.setInterval(() => {
        if (isLoading) return;
        const nextSlide = (activeSlide + 1) % slides.length;
        const nextLayer = 1 - activeLayer;
        const preload = new Image();
        isLoading = true;
        preload.onload = () => {
          const currentImage = heroImages[activeLayer];
          const nextImage = heroImages[nextLayer];
          nextImage.src = slides[nextSlide].image;
          nextImage.alt = slides[nextSlide].alt || '';
          nextImage.removeAttribute('aria-hidden');
          currentImage.setAttribute('aria-hidden', 'true');
          requestAnimationFrame(() => {
            nextImage.classList.add('is-visible');
            currentImage.classList.remove('is-visible');
          });
          activeLayer = nextLayer;
          activeSlide = nextSlide;
          isLoading = false;
        };
        preload.onerror = () => {
          activeSlide = nextSlide;
          isLoading = false;
        };
        preload.src = slides[nextSlide].image;
      }, 5000);
    };

    const pauseOnHover = () => {
      isHovered = true;
      stop();
    };
    const resumeAfterHover = () => {
      isHovered = false;
      start();
    };

    heroImages[0].parentElement.addEventListener('mouseenter', pauseOnHover, { signal });
    heroImages[0].parentElement.addEventListener('mouseleave', resumeAfterHover, { signal });
    document.addEventListener('visibilitychange', start, { signal });
    start();

    heroSlideshowCleanup = () => {
      stop();
      controller.abort();
    };
  }

  /* ---------------------------------------------------------
     Small helpers
     --------------------------------------------------------- */
  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — the site still works in-memory */
    }
  };

  const formatPrice = (amount) => `Rs. ${Math.round(amount).toLocaleString('en-LK')}`;
  const normalizeAssetPath = (path) =>
    typeof path === 'string' && path.startsWith('assets/') ? `Backend/${path}` : path;

  /* ---------------------------------------------------------
     State
     --------------------------------------------------------- */
  const cart = new Map();
  const savedCart = readJSON(STORAGE.cart, []);
  if (Array.isArray(savedCart)) {
    savedCart.forEach((item) => {
      if (item && item.id && Number(item.quantity) > 0) {
        cart.set(item.id, {
          id: item.id,
          name: String(item.name),
          price: Number(item.price) || 0,
          image: normalizeAssetPath(String(item.image || '')),
          quantity: Number(item.quantity),
        });
      }
    });
  }

  document.getElementById('year').textContent = new Date().getFullYear();

  function normalizeColorOptions(colors) {
    if (!Array.isArray(colors)) return [];
    return colors
      .map((color) => {
        if (!color || typeof color !== 'object') return null;
        const name = String(color.name || '').trim();
        let hex = String(color.hex || '').trim();
        if (hex && !hex.startsWith('#')) hex = `#${hex}`;
        if (!/^#[0-9a-f]{3,8}$/i.test(hex)) return null;
        return { name: name || 'Colour', hex };
      })
      .filter(Boolean);
  }

  function isProductInStock(product) {
    if (typeof product?.in_stock === 'boolean') return product.in_stock;
    if (Array.isArray(product?.colors) && typeof product.colors[0]?.in_stock === 'boolean') {
      return product.colors[0].in_stock;
    }
    return true;
  }

  function openProductPage(card) {
    const url = new URL('product.html', window.location.href);
    if (card.dataset.id) url.searchParams.set('id', card.dataset.id);
    else if (card.dataset.name) url.searchParams.set('name', card.dataset.name);
    try {
      sessionStorage.setItem('venu.return.scroll', String(window.scrollY));
      sessionStorage.setItem(
        'venu.product',
        JSON.stringify({
          id: card.dataset.id || '',
          name: card.dataset.name || '',
          price: Number(card.dataset.price) || 0,
          category: card.dataset.category || '',
          in_stock: card.dataset.inStock !== 'false',
          description: card.querySelector('.product-info p')?.textContent || '',
          image_url: card.querySelector('img')?.getAttribute('src') || '',
          image_alt: card.querySelector('img')?.alt || '',
        })
      );
    } catch {
      /* storage unavailable — history back still restores the page */
    }
    window.location.href = url.href;
  }

  function decorateProductCard(card) {
    const imageWrap = card.querySelector('.product-image');
    if (!imageWrap) return;

    const inStock = card.dataset.inStock !== 'false';
    card.classList.toggle('is-out-of-stock', !inStock);

    if (!card.hasAttribute('tabindex')) {
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', `Order ${card.dataset.name || 'this pair'}`);
    }

    let inner = card.querySelector(':scope > .product-card-inner');
    if (!inner) {
      inner = document.createElement('div');
      inner.className = 'product-card-inner';
      while (card.firstChild) inner.append(card.firstChild);
      card.append(inner);
    }

    let orderButton = card.querySelector('.order-now-button');
    if (!orderButton) {
      orderButton = document.createElement('button');
      orderButton.type = 'button';
      orderButton.className = 'order-now-button';
      imageWrap.insertAdjacentElement('afterend', orderButton);
    }
    orderButton.textContent = inStock ? 'Order Now' : 'Pre order now';

    let meta = inner.querySelector('.product-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'product-meta';
      inner.append(meta);
    }
    let stockBadge = meta.querySelector('.product-stock');
    if (!stockBadge) {
      stockBadge = document.createElement('span');
      meta.append(stockBadge);
    }
    stockBadge.className = `product-stock ${inStock ? 'is-in' : 'is-out'}`;
    stockBadge.textContent = inStock ? 'In stock' : 'Out of stock';

    if (imageWrap.querySelector('.product-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'product-actions';

    const addButton = imageWrap.querySelector('.quick-add') || document.createElement('button');
    addButton.className = 'quick-add';
    addButton.type = 'button';
    addButton.setAttribute('aria-label', `Add ${card.dataset.name || 'this pair'} to bag`);
    addButton.title = 'Add to bag';
    addButton.replaceChildren();
    const plus = document.createElement('span');
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';
    addButton.append(plus);

    actions.append(addButton);
    imageWrap.append(actions);
  }

  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.dataset.category = product.category;
    card.dataset.name = product.name;
    card.dataset.price = product.price;
    card.dataset.inStock = String(isProductInStock(product));
    card.dataset.reveal = '';

    const inner = document.createElement('div');
    inner.className = 'product-card-inner';

    const imageWrap = document.createElement('div');
    imageWrap.className = `product-image image-${product.image_tone || 'coral'}`;

    if (product.badge) {
      const badge = document.createElement('span');
      badge.className = 'product-tag';
      badge.textContent = product.badge;
      imageWrap.append(badge);
    }

    const image = document.createElement('img');
    image.src = normalizeAssetPath(product.image_url);
    image.alt = product.image_alt || product.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    imageWrap.append(image);
    inner.append(imageWrap);

    const info = document.createElement('div');
    info.className = 'product-info';
    const details = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = product.name;
    const description = document.createElement('p');
    description.textContent = product.description || '';
    details.append(name, description);
    const price = document.createElement('strong');
    price.textContent = formatPrice(product.price);
    info.append(details, price);
    inner.append(info);

    const colors = normalizeColorOptions(product.colors);
    if (colors.length) {
      const meta = document.createElement('div');
      meta.className = 'product-meta';
      colors.slice(0, 4).forEach((color) => {
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = color.hex;
        swatch.setAttribute('aria-label', color.name);
        swatch.title = color.name;
        meta.append(swatch);
      });
      const count = document.createElement('span');
      count.className = 'color-count';
      count.textContent = `${colors.length} ${colors.length === 1 ? 'colour' : 'colours'}`;
      meta.append(count);
      inner.append(meta);
    }

    card.append(inner);
    decorateProductCard(card);
    return card;
  }

  function renderProducts(products) {
    productGrid.replaceChildren(...products.map(createProductCard));
    cards = [...productGrid.querySelectorAll('.product-card')];
    registerReveal(cards);
    filterProducts();
  }

  function renderMoodCards(items) {
    if (!moodGrid) return;
    const seen = new Set();
    const merged = [...items, ...defaultMoodCards].filter((item) => {
      const key = String(item.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const tiles = merged.slice(0, 4).map((item) => {
      const tile = document.createElement('a');
      tile.className = 'category-tile';
      tile.href = item.link_url || '#shop';
      tile.dataset.reveal = '';
      if (item.link_filter) tile.dataset.navFilter = item.link_filter;

      const image = document.createElement('img');
      image.src = normalizeAssetPath(item.image_url);
      image.alt = item.image_alt || item.title;
      image.loading = 'lazy';

      const label = document.createElement('span');
      label.textContent = item.title;

      tile.append(image, label);
      return tile;
    });
    moodGrid.replaceChildren(...tiles);
    registerReveal(tiles);
  }

  function renderPromiseCards(items) {
    if (!promiseGrid) return;
    const cards = items.map((item, index) => {
      const card = document.createElement('div');
      card.className = 'promise-item';
      card.dataset.reveal = '';

      const number = document.createElement('span');
      number.className = 'promise-number';
      number.textContent = String(index + 1).padStart(2, '0');

      const title = document.createElement('h3');
      title.textContent = item.title;

      const body = document.createElement('p');
      body.textContent = item.body || '';

      card.append(number, title, body);
      return card;
    });
    promiseGrid.replaceChildren(...cards);
    registerReveal(cards);
  }

  const splitLines = (value) =>
    typeof value === 'string'
      ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : [];

  function renderAnnouncement(items) {
    const track = document.querySelector('[data-cms-list="announcement"]');
    if (!track || !items.length) return;
    const groups = [0, 1].map(() => {
      const group = document.createElement('div');
      group.className = 'announcement-group';
      items.forEach((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        const star = document.createElement('i');
        star.textContent = '✦';
        group.append(span, star);
      });
      return group;
    });
    track.replaceChildren(...groups);
  }

  function applySiteContent(rows) {
    const content = new Map(rows.map((row) => [row.key, row.value]));

    document.querySelectorAll('[data-cms]').forEach((element) => {
      const value = content.get(element.dataset.cms);
      if (value !== undefined) element.textContent = value;
    });

    document.querySelectorAll('[data-cms-image]').forEach((image) => {
      const value = content.get(image.dataset.cmsImage);
      if (value) image.src = normalizeAssetPath(value);
      const altValue = content.get(image.dataset.cmsAlt);
      if (altValue) image.alt = altValue;
    });

    document.querySelectorAll('[data-cms-href]').forEach((link) => {
      const value = content.get(link.dataset.cmsHref);
      if (value) link.href = value;
    });

    const title = content.get('meta_title');
    if (title) document.title = title;

    const description = content.get('meta_description');
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.content = description;
    }

    renderAnnouncement(splitLines(content.get('announcement_items')));
  }

  /* ---------------------------------------------------------
     Shop: filter + sort
     --------------------------------------------------------- */
  function filterProducts() {
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
      card.hidden = !matchesCategory;
      if (!card.hidden) visibleCount += 1;
    });

    resultCount.textContent = visibleCount;
    emptyState.hidden = visibleCount !== 0;
  }

  const categoryList = document.querySelector('.category-list');
  function setActiveFilter(filter) {
    activeFilter = filter;
    categoryButtons.forEach((item) => {
      const isActive = item.dataset.filter === filter;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    filterProducts();
  }

  // Delegated so buttons added for CMS categories work too.
  categoryList?.addEventListener('click', (event) => {
    const button = event.target.closest('.category-button');
    if (button) setActiveFilter(button.dataset.filter);
  });

  function renderCategoryButtons(categories) {
    if (!categoryList || !categories.length) return;
    const make = (slug, label) => {
      const button = document.createElement('button');
      button.className = 'category-button';
      button.type = 'button';
      button.dataset.filter = slug;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = label;
      return button;
    };
    // Only show categories that currently have products, so empty filters don't appear.
    const used = new Set(cards.map((card) => card.dataset.category));
    const visible = categories.filter((category) => used.has(category.slug));
    categoryList.replaceChildren(make('all', 'All styles'), ...visible.map((category) => make(category.slug, category.label)));
    categoryButtons = [...categoryList.querySelectorAll('.category-button')];
    setActiveFilter(categoryButtons.some((button) => button.dataset.filter === activeFilter) ? activeFilter : 'all');
  }

  const closeMenu = () => {
    mainNav.classList.remove('is-open');
    menuTrigger.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-nav-filter]');
    if (!link) return;
    const matchingButton = categoryButtons.find((button) => button.dataset.filter === link.dataset.navFilter);
    if (matchingButton) setActiveFilter(matchingButton.dataset.filter);
    closeMenu();
  });

  menuTrigger.addEventListener('click', () => {
    const isOpen = menuTrigger.getAttribute('aria-expanded') === 'true';
    menuTrigger.setAttribute('aria-expanded', String(!isOpen));
    mainNav.classList.toggle('is-open', !isOpen);
  });

  const sortDropdown = document.getElementById('sort-dropdown');
  const sortToggle = document.getElementById('sort-toggle');
  const sortMenu = document.getElementById('sort-menu');
  const sortLabel = document.getElementById('sort-current-label');
  const sortOptions = sortMenu ? [...sortMenu.querySelectorAll('.sort-option')] : [];

  function closeSortMenu() {
    if (!sortDropdown || !sortMenu) return;
    sortDropdown.classList.remove('is-open');
    sortMenu.hidden = true;
    sortToggle?.setAttribute('aria-expanded', 'false');
  }

  function openSortMenu() {
    if (!sortDropdown || !sortMenu) return;
    sortDropdown.classList.add('is-open');
    sortMenu.hidden = false;
    sortToggle?.setAttribute('aria-expanded', 'true');
    sortMenu.style.left = '';
    sortMenu.style.right = '';
    const rect = sortMenu.getBoundingClientRect();
    if (rect.left < 10) {
      sortMenu.style.left = '0';
      sortMenu.style.right = 'auto';
    } else if (rect.right > window.innerWidth - 10) {
      sortMenu.style.left = 'auto';
      sortMenu.style.right = '0';
    }
    const active = sortMenu.querySelector('.sort-option.is-active') || sortOptions[0];
    active?.focus();
  }

  if (sortToggle && sortMenu) {
    sortToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = sortDropdown.classList.contains('is-open');
      if (isOpen) closeSortMenu();
      else openSortMenu();
    });

    sortOptions.forEach((option) => {
      const choose = () => {
        const value = option.dataset.value;
        const text = option.querySelector('span')?.textContent || option.textContent.trim();
        if (sortLabel) sortLabel.textContent = text;
        sortOptions.forEach((opt) => {
          const isSelected = opt === option;
          opt.classList.toggle('is-active', isSelected);
          opt.setAttribute('aria-selected', String(isSelected));
          opt.tabIndex = isSelected ? 0 : -1;
        });
        closeSortMenu();
        sortToggle?.focus();
        if (sortSelect && sortSelect.value !== value) {
          sortSelect.value = value;
          sortSelect.dispatchEvent(new Event('change'));
        }
      };

      option.addEventListener('click', (event) => {
        event.stopPropagation();
        choose();
      });

      option.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose();
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (sortDropdown && !sortDropdown.contains(event.target)) {
        closeSortMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!sortDropdown?.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSortMenu();
        sortToggle?.focus();
        return;
      }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        const currentIndex = sortOptions.indexOf(document.activeElement);
        let nextIndex;
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < sortOptions.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : sortOptions.length - 1;
        }
        sortOptions[nextIndex]?.focus();
      }
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const sortedCards = [...cards].sort((first, second) => {
        const difference = Number(first.dataset.price) - Number(second.dataset.price);
        if (sortSelect.value === 'low-high') return difference;
        if (sortSelect.value === 'high-low') return -difference;
        return cards.indexOf(first) - cards.indexOf(second);
      });
      sortedCards.forEach((card) => productGrid.append(card));
    });
  }

  productGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const card = event.target.closest('.product-card');
    if (!card) return;

    if (!button) {
      openProductPage(card);
      return;
    }

    if (button.classList.contains('quick-add')) {
      const id = card.dataset.id || card.dataset.name;
      const item = cart.get(id) || {
        id,
        name: card.dataset.name,
        price: Number(card.dataset.price),
        image: card.querySelector('img').src,
        quantity: 0,
      };
      item.quantity += 1;
      cart.set(id, item);
      updateCart();
      bumpCart();
      showToast(`${item.name} added to your bag`);
      return;
    }

    if (button.classList.contains('order-now-button')) {
      openProductPage(card);
    }
  });

  productGrid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('button')) return;
    const card = event.target.closest('.product-card');
    if (!card) return;
    event.preventDefault();
    openProductPage(card);
  });

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  /* ---------------------------------------------------------
     Cart
     --------------------------------------------------------- */
  function updateCart() {
    const entries = [...cart.values()];
    const totalQuantity = entries.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = entries.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (cartCount) cartCount.textContent = totalQuantity;
    drawerCount.textContent = `(${totalQuantity})`;

    cartItems.replaceChildren();
    entries.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-line';
      const image = document.createElement('img');
      image.className = 'cart-line-image';
      image.src = item.image;
      image.alt = '';

      const details = document.createElement('div');
      const name = document.createElement('h3');
      name.className = 'cart-line-title';
      name.textContent = item.name;
      const price = document.createElement('p');
      price.className = 'cart-line-price';
      price.textContent = formatPrice(item.price);
      const quantity = document.createElement('div');
      quantity.className = 'quantity-control';
      quantity.setAttribute('aria-label', `Quantity for ${item.name}`);

      const decrease = document.createElement('button');
      decrease.type = 'button';
      decrease.dataset.cartAction = 'decrease';
      decrease.dataset.productId = item.id;
      decrease.setAttribute('aria-label', `Remove one ${item.name}`);
      decrease.textContent = '−';
      const quantityValue = document.createElement('span');
      quantityValue.textContent = item.quantity;
      const increase = document.createElement('button');
      increase.type = 'button';
      increase.dataset.cartAction = 'increase';
      increase.dataset.productId = item.id;
      increase.setAttribute('aria-label', `Add one ${item.name}`);
      increase.textContent = '+';
      quantity.append(decrease, quantityValue, increase);
      details.append(name, price, quantity);

      const total = document.createElement('strong');
      total.className = 'cart-line-total';
      total.textContent = formatPrice(item.price * item.quantity);
      row.append(image, details, total);
      cartItems.append(row);
    });

    cartEmpty.hidden = totalQuantity > 0;
    cartSummary.hidden = totalQuantity === 0;
    cartSummary.querySelector('.subtotal-row strong').textContent = formatPrice(subtotal);

    const remaining = Math.max(0, FREE_DELIVERY - subtotal);
    const progress = Math.min(100, (subtotal / FREE_DELIVERY) * 100);
    if (shippingBar) shippingBar.style.width = `${progress}%`;
    if (shippingNote) {
      shippingNote.textContent =
        remaining > 0 ? `${formatPrice(remaining)} away from free delivery` : 'Free delivery unlocked ✦';
    }
    shippingMeter?.classList.toggle('is-unlocked', remaining === 0 && subtotal > 0);

    writeJSON(STORAGE.cart, entries);
  }

  function bumpCart() {
    if (!cartCount) return;
    cartCount.classList.remove('is-bumped');
    void cartCount.offsetWidth;
    cartCount.classList.add('is-bumped');
  }

  function openCart() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
    drawer.querySelector('.close-cart').focus();
  }

  function closeCart() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    document.body.classList.remove('drawer-open');
    document.querySelector('.quick-add:focus')?.focus();
  }

  cartItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    const item = cart.get(button.dataset.productId);
    if (!item) return;
    item.quantity += button.dataset.cartAction === 'increase' ? 1 : -1;
    if (item.quantity <= 0) cart.delete(item.id);
    updateCart();
  });

  document.querySelector('.close-cart').addEventListener('click', closeCart);
  document.querySelector('.continue-shopping').addEventListener('click', closeCart);
  backdrop.addEventListener('click', closeCart);

  document.querySelector('.checkout-button').addEventListener('click', () => {
    showToast('Checkout is not connected yet');
  });

  /* ---------------------------------------------------------
     Favourites (persisted)
     --------------------------------------------------------- */
  /* ---------------------------------------------------------
     Keyboard + header
     --------------------------------------------------------- */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (drawer.classList.contains('is-open')) closeCart();
    if (mainNav.classList.contains('is-open')) {
      closeMenu();
      menuTrigger.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!mainNav.classList.contains('is-open')) return;
    if (header.contains(event.target)) return;
    closeMenu();
  });

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------
     Newsletter
     --------------------------------------------------------- */
  newsletterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = newsletterForm.querySelector('input');
    if (!input.value.trim() || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    showToast('You are on the list — welcome to VENU Shoues');
    newsletterForm.reset();
  });

  /* ---------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------- */
  let revealObserver = null;

  function registerReveal(elements) {
    const list = [...elements];
    list.forEach((element, index) => {
      if (!element.style.getPropertyValue('--i')) element.style.setProperty('--i', index);
    });
    if (reduceMotion || !revealObserver) {
      list.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    list.forEach((element) => revealObserver.observe(element));
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.01 }
    );
  }

  registerReveal(document.querySelectorAll('[data-reveal]'));
  cards.forEach(decorateProductCard);

  updateCart();

  /* ---------------------------------------------------------
     Supabase CMS
     --------------------------------------------------------- */
  function getCmsClient() {
    const config = window.SHUES_CMS_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) return null;
    if (!window.supabase?.createClient) {
      console.error('Supabase client library did not load.');
      return null;
    }
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async function loadCmsProducts(client) {
    const [{ data, error }, categoriesResult] = await Promise.all([
      client
        .from('products')
        .select('*')
        .eq('published', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),
      client
        .from('product_categories')
        .select('slug, label, display_order')
        .order('display_order', { ascending: true }),
    ]);

    if (error) throw new Error(`Products: ${error.message}`);
    renderProducts(data || []);
    // Before the categories migration runs, fall back to the built-in filters.
    const categories = categoriesResult.error || !categoriesResult.data?.length
      ? [{ slug: 'heels', label: 'Heels' }, { slug: 'sandals', label: 'Sandals' }]
      : categoriesResult.data;
    renderCategoryButtons(categories);
  }

  async function loadSiteContent(client) {
    const { data, error } = await client.from('site_content').select('key, value');
    if (error) throw new Error(`Homepage text: ${error.message}`);
    applySiteContent(data || []);
  }

  async function loadSiteCards(client) {
    const { data, error } = await client
      .from('site_cards')
      .select('id, section, title, body, image_url, image_alt, link_url, link_filter, display_order')
      .eq('published', true)
      .order('section', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) throw new Error(`Homepage cards: ${error.message}`);

    const cards = data || [];
    const moodCards = cards.filter((card) => card.section === 'mood');
    const promiseCards = cards.filter((card) => card.section === 'promise');
    if (moodCards.length) renderMoodCards(moodCards);
    if (promiseCards.length) renderPromiseCards(promiseCards);
  }

  async function initCms() {
    try {
      if (new URLSearchParams(window.location.search).get('preview') === '1') return;
      const client = getCmsClient();
      if (!client) return;

      const results = await Promise.allSettled([
        loadCmsProducts(client),
        loadSiteContent(client),
        loadSiteCards(client),
      ]);

      const failed = results.filter((result) => result.status === 'rejected');
      failed.forEach((result) => console.error('Could not load CMS data:', result.reason));
      if (results[0].status === 'rejected') {
        showToast('Products could not be refreshed. Please reload the page.');
      }
    } finally {
      initHeroSlideshow(getMoodSlidesFromDom());
    }
  }

  initHeroSlideshow(getMoodSlidesFromDom());

  try {
    const returnScroll = sessionStorage.getItem('venu.return.scroll');
    if (returnScroll !== null) {
      sessionStorage.removeItem('venu.return.scroll');
      const top = Number(returnScroll);
      if (Number.isFinite(top)) {
        window.addEventListener('load', () => window.scrollTo({ top }), { once: true });
      }
    }
  } catch {
    /* storage unavailable — browser history still restores the scroll position */
  }

  initCms().catch((error) => {
    console.error('Could not load CMS data:', error);
    showToast('Some shop content could not be refreshed. Please reload the page.');
  });
});
