if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-reveal');
}

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------------------------------------------------
     Elements
     --------------------------------------------------------- */
  let cards = [...document.querySelectorAll('.product-card')];
  const categoryButtons = [...document.querySelectorAll('.category-button')];
  const searchInput = document.getElementById('product-search');
  const sortSelect = document.getElementById('product-sort');
  const productGrid = document.getElementById('product-grid');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const cartTrigger = document.querySelector('.cart-trigger');
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
  const STORAGE = { cart: 'shues.cart.v1', favorites: 'shues.favorites.v1' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeFilter = 'all';
  let toastTimer;

  const heroGallery = document.querySelector('.hero-fashion-gallery');
  const heroCarouselToggle = document.querySelector('.hero-carousel-toggle');
  const moodGrid = document.querySelector('[data-cms-cards="mood"]');
  const promiseGrid = document.querySelector('[data-cms-cards="promise"]');
  let heroCleanup = null;

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

  function initHeroCarousel(slides) {
    if (!heroGallery || !heroCarouselToggle || !slides.length) return;

    if (heroCleanup) {
      heroCleanup();
      heroCleanup = null;
    }

    heroGallery.querySelectorAll('[data-hero-slide]').forEach((slide) => slide.remove());

    const visibleSlides = slides.slice(0, 4);
    const slideElements = visibleSlides.map((slide) => {
      const figure = document.createElement('figure');
      figure.className = 'hero-fashion-card';
      figure.dataset.heroSlide = '';

      const image = document.createElement('img');
      image.src = slide.image;
      image.alt = slide.alt || '';

      const caption = document.createElement('figcaption');
      caption.textContent = slide.label;

      figure.append(image, caption);
      heroGallery.insertBefore(figure, heroCarouselToggle);
      return figure;
    });

    const positionsByCount = {
      1: ['is-center'],
      2: ['is-center', 'is-right'],
      3: ['is-center', 'is-right', 'is-left'],
      4: ['is-center', 'is-right', 'is-back', 'is-left'],
    };
    const slidePositions = positionsByCount[slideElements.length] || positionsByCount[4];
    const allPositions = ['is-center', 'is-right', 'is-back', 'is-left'];
    let activeSlide = 0;
    let carouselTimer;
    let isPaused = false;
    let isHovered = false;
    let isFocused = false;

    const renderHeroSlides = () => {
      slideElements.forEach((slide, index) => {
        allPositions.forEach((position) => slide.classList.remove(position));
        const position = (index - activeSlide + slideElements.length) % slideElements.length;
        slide.classList.add(slidePositions[position]);
      });
    };

    const updateCarouselToggle = () => {
      heroCarouselToggle.setAttribute('aria-pressed', String(isPaused));
      heroCarouselToggle.setAttribute(
        'aria-label',
        isPaused ? 'Resume featured heels' : 'Pause featured heels'
      );
      heroCarouselToggle.textContent = isPaused ? '▶' : 'Ⅱ';
    };

    const stopCarousel = () => {
      window.clearInterval(carouselTimer);
      carouselTimer = undefined;
    };

    const startCarousel = () => {
      stopCarousel();
      if (reduceMotion || isPaused || isHovered || isFocused || document.hidden) return;
      carouselTimer = window.setInterval(() => {
        activeSlide = (activeSlide + 1) % slideElements.length;
        renderHeroSlides();
      }, 3600);
    };

    const controller = new AbortController();
    const { signal } = controller;

    renderHeroSlides();
    heroCarouselToggle.hidden = reduceMotion;
    updateCarouselToggle();

    if (!reduceMotion) {
      heroCarouselToggle.addEventListener('click', () => {
        isPaused = !isPaused;
        updateCarouselToggle();
        startCarousel();
      }, { signal });
      heroGallery.addEventListener('mouseenter', () => {
        isHovered = true;
        stopCarousel();
      }, { signal });
      heroGallery.addEventListener('mouseleave', () => {
        isHovered = false;
        startCarousel();
      }, { signal });
      heroGallery.addEventListener('focusin', () => {
        isFocused = true;
        stopCarousel();
      }, { signal });
      heroGallery.addEventListener('focusout', (event) => {
        if (heroGallery.contains(event.relatedTarget)) return;
        isFocused = false;
        startCarousel();
      }, { signal });
      document.addEventListener('visibilitychange', startCarousel, { signal });
      startCarousel();
    }

    heroCleanup = () => {
      stopCarousel();
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

  const favorites = new Set(
    (readJSON(STORAGE.favorites, []) || []).filter((name) => typeof name === 'string')
  );

  document.getElementById('year').textContent = new Date().getFullYear();

  function createProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.id = product.id;
    card.dataset.category = product.category;
    card.dataset.name = product.name;
    card.dataset.price = product.price;
    card.dataset.reveal = '';

    const imageWrap = document.createElement('div');
    imageWrap.className = `product-image image-${product.image_tone || 'coral'}`;

    if (product.badge) {
      const badge = document.createElement('span');
      badge.className = 'product-tag';
      badge.textContent = product.badge;
      imageWrap.append(badge);
    }

    const favorite = document.createElement('button');
    favorite.className = 'favorite-button';
    favorite.type = 'button';
    favorite.setAttribute('aria-label', `Save ${product.name}`);
    favorite.setAttribute('aria-pressed', String(favorites.has(product.name)));
    favorite.textContent = favorites.has(product.name) ? '♥' : '♡';
    imageWrap.append(favorite);

    const image = document.createElement('img');
    image.src = normalizeAssetPath(product.image_url);
    image.alt = product.image_alt || product.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    imageWrap.append(image);

    const addButton = document.createElement('button');
    addButton.className = 'quick-add';
    addButton.type = 'button';
    addButton.append(document.createTextNode('Add to bag '));
    const plus = document.createElement('span');
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';
    addButton.append(plus);
    imageWrap.append(addButton);
    card.append(imageWrap);

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
    card.append(info);
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
    const tiles = items.slice(0, 4).map((item) => {
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
      label.append(document.createTextNode(`${item.title} `));
      const arrow = document.createElement('b');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      label.append(arrow);

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

  function renderTicker(items) {
    const track = document.querySelector('[data-cms-list="ticker"]');
    if (!track || !items.length) return;
    const children = [];
    [0, 1].forEach(() => {
      items.forEach((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        const star = document.createElement('i');
        star.textContent = '✦';
        children.push(span, star);
      });
    });
    track.replaceChildren(...children);
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
    renderTicker(splitLines(content.get('ticker_items')));
  }

  /* ---------------------------------------------------------
     Shop: filter + search + sort
     --------------------------------------------------------- */
  function filterProducts() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach((card) => {
      const description = card.querySelector('.product-info p')?.textContent || '';
      const haystack = `${card.dataset.name} ${card.dataset.category} ${description}`.toLowerCase();
      const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
      const matchesSearch = haystack.includes(query);
      card.hidden = !matchesCategory || !matchesSearch;
      if (!card.hidden) visibleCount += 1;
    });

    resultCount.textContent = visibleCount;
    emptyState.hidden = visibleCount !== 0;
  }

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter;
      categoryButtons.forEach((item) => {
        const isActive = item === button;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      filterProducts();
    });
  });

  const closeMenu = () => {
    mainNav.classList.remove('is-open');
    menuTrigger.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-nav-filter]');
    if (!link) return;
    const matchingButton = categoryButtons.find((button) => button.dataset.filter === link.dataset.navFilter);
    matchingButton?.click();
    closeMenu();
  });

  searchInput.addEventListener('input', filterProducts);

  menuTrigger.addEventListener('click', () => {
    const isOpen = menuTrigger.getAttribute('aria-expanded') === 'true';
    menuTrigger.setAttribute('aria-expanded', String(!isOpen));
    mainNav.classList.toggle('is-open', !isOpen);
  });

  document.querySelector('.search-trigger').addEventListener('click', () => {
    document.getElementById('shop').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    searchInput.focus({ preventScroll: true });
  });

  sortSelect.addEventListener('change', () => {
    const sortedCards = [...cards].sort((first, second) => {
      const difference = Number(first.dataset.price) - Number(second.dataset.price);
      if (sortSelect.value === 'low-high') return difference;
      if (sortSelect.value === 'high-low') return -difference;
      return cards.indexOf(first) - cards.indexOf(second);
    });
    sortedCards.forEach((card) => productGrid.append(card));
  });

  productGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const card = button.closest('.product-card');
    if (!card) return;

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

    if (button.classList.contains('favorite-button')) {
      const name = card.dataset.name;
      const isFavorite = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', String(!isFavorite));
      button.textContent = isFavorite ? '♡' : '♥';
      if (isFavorite) favorites.delete(name);
      else favorites.add(name);
      writeJSON(STORAGE.favorites, [...favorites]);
      showToast(isFavorite ? 'Removed from saved pairs' : 'Pair saved for later');
    }
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

    cartCount.textContent = totalQuantity;
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
    cartTrigger.focus();
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

  cartTrigger.addEventListener('click', openCart);
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
    const { data, error } = await client
      .from('products')
      .select('id, name, description, category, price, image_url, image_alt, badge, image_tone')
      .eq('published', true)
      .in('category', ['heels', 'sandals'])
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Products: ${error.message}`);
    renderProducts(data || []);
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
      initHeroCarousel(getMoodSlidesFromDom());
    }
  }

  initHeroCarousel(getMoodSlidesFromDom());

  initCms().catch((error) => {
    console.error('Could not load CMS data:', error);
    showToast('Some shop content could not be refreshed. Please reload the page.');
  });
});
