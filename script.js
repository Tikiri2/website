if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('js-reveal');
}

document.addEventListener('DOMContentLoaded', () => {
  /* ---------------------------------------------------------
     Elements
     --------------------------------------------------------- */
  const cards = [...document.querySelectorAll('.product-card')];
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
          image: String(item.image || ''),
          quantity: Number(item.quantity),
        });
      }
    });
  }

  const favorites = new Set(
    (readJSON(STORAGE.favorites, []) || []).filter((name) => typeof name === 'string')
  );

  document.getElementById('year').textContent = new Date().getFullYear();

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
      row.innerHTML = `
        <img class="cart-line-image" src="${item.image}" alt="" />
        <div>
          <h3 class="cart-line-title">${item.name}</h3>
          <p class="cart-line-price">${formatPrice(item.price)}</p>
          <div class="quantity-control" aria-label="Quantity for ${item.name}">
            <button type="button" data-cart-action="decrease" data-product-id="${item.id}" aria-label="Remove one ${item.name}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-cart-action="increase" data-product-id="${item.id}" aria-label="Add one ${item.name}">+</button>
          </div>
        </div>
        <strong class="cart-line-total">${formatPrice(item.price * item.quantity)}</strong>`;
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

  document.querySelectorAll('.quick-add').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.product-card');
      const id = card.dataset.name;
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
    });
  });

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
  document.querySelectorAll('.favorite-button').forEach((button) => {
    const name = button.closest('.product-card').dataset.name;

    if (favorites.has(name)) {
      button.setAttribute('aria-pressed', 'true');
      button.textContent = '♥';
    }

    button.addEventListener('click', () => {
      const isFavorite = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', String(!isFavorite));
      button.textContent = isFavorite ? '♡' : '♥';
      if (isFavorite) favorites.delete(name);
      else favorites.add(name);
      writeJSON(STORAGE.favorites, [...favorites]);
      showToast(isFavorite ? 'Removed from saved pairs' : 'Pair saved for later');
    });
  });

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
});
