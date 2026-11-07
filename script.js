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
    filterProducts();
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

  document.querySelectorAll('[data-nav-filter]').forEach((link) => {
    link.addEventListener('click', () => {
      const matchingButton = categoryButtons.find((button) => button.dataset.filter === link.dataset.navFilter);
      matchingButton?.click();
      closeMenu();
    });
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
    showToast('You are on the list — welcome to shues');
    newsletterForm.reset();
  });

  /* ---------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------- */
  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  document.querySelectorAll('.product-card').forEach((card, index) => {
    card.style.setProperty('--i', index);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.01 }
    );
    revealTargets.forEach((element) => observer.observe(element));
  }

  updateCart();

  async function loadCmsProducts() {
    if (new URLSearchParams(window.location.search).get('preview') === '1') return;

    const config = window.SHUES_CMS_CONFIG;
    if (!config?.supabaseUrl || !config?.supabaseAnonKey) return;
    if (!window.supabase?.createClient) {
      console.error('Supabase client library did not load.');
      showToast('Products could not be refreshed. Please reload the page.');
      return;
    }

    const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data, error } = await client
      .from('products')
      .select('id, name, description, category, price, image_url, image_alt, badge, image_tone')
      .eq('published', true)
      .in('category', ['heels', 'sandals'])
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Could not load products from Supabase:', error.message);
      showToast('Products could not be refreshed. Please reload the page.');
      return;
    }
    renderProducts(data);
  }

  loadCmsProducts().catch((error) => {
    console.error('Could not load products from Supabase:', error);
    showToast('Products could not be refreshed. Please reload the page.');
  });
});
