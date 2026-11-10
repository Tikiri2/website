document.addEventListener('DOMContentLoaded', () => {
  const config = window.SHUES_CMS_CONFIG;
  const setupNotice = document.getElementById('setup-notice');
  const loginPanel = document.getElementById('login-panel');
  const cmsPanel = document.getElementById('cms-panel');
  const signOutButton = document.getElementById('sign-out');
  const loginForm = document.getElementById('login-form');
  const productForm = document.getElementById('product-form');
  const productList = document.getElementById('product-list');
  const adminUserForm = document.getElementById('admin-user-form');
  const addAdminUserButton = document.getElementById('add-admin-user');
  const statusMessage = document.getElementById('status-message');
  const formTitle = document.getElementById('form-title');
  const saveButton = document.getElementById('save-product');
  const cancelEditButton = document.getElementById('cancel-edit');
  const colourEditor = window.createProductColourEditor(resolveImageUrl);
  const panelTitle = document.getElementById('panel-title');
  const panelDescription = document.getElementById('panel-description');
  const panelCount = document.getElementById('panel-count');
  const tabButtons = [...document.querySelectorAll('.cms-tab')];
  const productsTab = document.getElementById('products-tab');
  const homepageTab = document.getElementById('homepage-tab');
  const subtabButtons = [...document.querySelectorAll('.cms-subtab')];
  const imagesTab = document.getElementById('images-tab');
  const cardsTab = document.getElementById('cards-tab');
  const textTab = document.getElementById('text-tab');
  const imageManager = document.getElementById('image-manager');
  const saveImagesButton = document.getElementById('save-images');
  const contentForm = document.getElementById('content-form');
  const contentFields = document.getElementById('content-fields');
  const saveContentButton = document.getElementById('save-content');
  const cardForm = document.getElementById('card-form');
  const cardSection = document.getElementById('card-section');
  const cardList = document.getElementById('card-list');
  const cardImageFileInput = document.getElementById('card-image-file');
  const cardImagePreview = document.getElementById('card-image-preview');
  const cardImagePreviewImage = document.getElementById('card-image-preview-img');
  const cardImagePreviewLabel = document.getElementById('card-image-preview-label');
  const cardFormTitle = document.getElementById('card-form-title');
  const saveCardButton = document.getElementById('save-card');
  const cancelCardEditButton = document.getElementById('cancel-card-edit');
  let client;
  let ordersManager;
  let orderTotal = 0;
  let editingId = null;
  let productEditorVersion = 0;
  let cardEditingId = null;
  let cardEditingImageUrl = '';
  let cardPreviewObjectUrl = '';
  let contentValues = new Map();
  let siteCards = [];
  let imageObjectUrls = [];
  let productTotal = 0;
  let inventoryProducts = [];
  let activeProductCategory = 'all';
  let productCategoryButtons = [...document.querySelectorAll('[data-product-category]')];
  // Categories come from the product_categories table; these defaults keep the
  // CMS usable until the categories migration has been applied.
  let productCategories = [{ slug: 'heels', label: 'Heels' }, { slug: 'sandals', label: 'Sandals' }];
  let productReorder;
  let imageTrash;
  let cardTotal = 0;
  let activeTab = 'dashboard';
  let activeSubtab = 'images';
  let statusTimer;
  const IMAGE_BUCKET = 'product-images';
  const SITE_IMAGE_BUCKET = 'site-images';
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const IMAGE_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };

  const CONTENT_SCHEMA = [
    {
      group: 'Page title & search description',
      fields: [
        { key: 'meta_title', label: 'Browser tab title', type: 'text' },
        { key: 'meta_description', label: 'Search description', type: 'textarea' },
      ],
    },
    {
      group: 'Top announcement bar',
      fields: [
        { key: 'announcement_items', label: 'Announcement items (one per line)', type: 'textarea' },
        { key: 'ticker_items', label: 'Scrolling ticker items (one per line)', type: 'textarea' },
      ],
    },
    {
      group: 'Hero banner',
      fields: [
        { key: 'hero_eyebrow', label: 'Small label', type: 'text' },
        { key: 'hero_title', label: 'Headline (first line)', type: 'text' },
        { key: 'hero_title_accent', label: 'Headline (italic second line)', type: 'text' },
        { key: 'hero_description', label: 'Description', type: 'textarea' },
        { key: 'hero_cta_label', label: 'Button label', type: 'text' },
        { key: 'hero_cta_url', label: 'Button link', type: 'url' },
        { key: 'hero_image_alt', label: 'Hero image description', type: 'text' },
      ],
    },
    {
      group: 'Mood cards heading',
      fields: [
        { key: 'categories_eyebrow', label: 'Small label', type: 'text' },
        { key: 'categories_title', label: 'Heading', type: 'text' },
        { key: 'categories_intro', label: 'Intro text', type: 'textarea' },
      ],
    },
    {
      group: 'Shop heading',
      fields: [
        { key: 'shop_eyebrow', label: 'Small label', type: 'text' },
        { key: 'shop_title', label: 'Heading', type: 'text' },
      ],
    },
    {
      group: 'Our story',
      fields: [
        { key: 'story_eyebrow', label: 'Small label', type: 'text' },
        { key: 'story_title', label: 'Heading (first line)', type: 'text' },
        { key: 'story_title_accent', label: 'Heading (italic second line)', type: 'text' },
        { key: 'story_body', label: 'Story text', type: 'textarea' },
        { key: 'story_link_label', label: 'Link label', type: 'text' },
        { key: 'story_link_url', label: 'Link address', type: 'url' },
        { key: 'story_index', label: 'Corner label', type: 'text' },
        { key: 'story_image_alt', label: 'Story image description', type: 'text' },
      ],
    },
    {
      group: 'Newsletter',
      fields: [
        { key: 'newsletter_eyebrow', label: 'Small label', type: 'text' },
        { key: 'newsletter_title', label: 'Heading (first line)', type: 'text' },
        { key: 'newsletter_title_accent', label: 'Heading (italic second line)', type: 'text' },
        { key: 'newsletter_body', label: 'Intro text', type: 'textarea' },
        { key: 'newsletter_note', label: 'Small note', type: 'text' },
      ],
    },
    {
      group: 'Footer & WhatsApp',
      fields: [
        { key: 'footer_tagline', label: 'Footer tagline', type: 'text' },
        { key: 'footer_location', label: 'Location', type: 'text' },
        { key: 'footer_note', label: 'Footer note', type: 'text' },
        { key: 'whatsapp_url', label: 'WhatsApp link', type: 'url' },
      ],
    },
  ];

  function updatePanelCount() {
    document.getElementById('dashboard-products').textContent = String(productTotal);
    document.getElementById('dashboard-cards').textContent = String(cardTotal);
    document.getElementById('inventory-count').textContent = `${productTotal} product${productTotal === 1 ? '' : 's'}`;
    panelCount.hidden = ['dashboard', 'add-product', 'products', 'users', 'image-trash'].includes(activeTab);
    const count = activeTab === 'orders' ? orderTotal : activeTab === 'products' ? productTotal : cardTotal;
    const label = activeTab === 'orders' ? 'order' : activeTab === 'products' ? 'product' : 'card';
    panelCount.textContent = `${count} ${label}${count === 1 ? '' : 's'}`;
  }

  function setTab(tab) {
    activeTab = tab;
    tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === (tab === 'add-product' ? 'products' : tab);
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    productsTab.hidden = tab !== 'products';
    document.getElementById('add-product-tab').hidden = tab !== 'add-product';
    homepageTab.hidden = tab !== 'homepage';
    document.getElementById('orders-tab').hidden = tab !== 'orders';
    document.getElementById('dashboard-tab').hidden = tab !== 'dashboard';
    document.getElementById('users-tab').hidden = tab !== 'users';
    document.getElementById('image-trash-tab').hidden = tab !== 'image-trash';
    document.getElementById('cms-page-heading').hidden = tab === 'orders' || tab === 'products';
    panelTitle.textContent = tab === 'image-trash' ? 'Image trash' : tab === 'users' ? 'CMS users' : tab === 'add-product' ? (editingId ? 'Edit product' : 'Add product')
      : tab === 'dashboard' ? 'Dashboard' : tab === 'orders' ? 'Orders' : tab === 'products' ? 'Products' : 'Homepage';
    panelDescription.textContent =
      tab === 'image-trash' ? 'Review unused colour photos and permanently remove files you no longer need.'
      : tab === 'users' ? 'Give existing Supabase accounts access to manage your store.'
      : tab === 'add-product' ? 'Add or update a pair, its image, colours and available sizes.'
      : tab === 'dashboard' ? 'Welcome back. Here is what is happening in your store.' : tab === 'products'
        ? "Manage your women's heels and sandals. Published products appear in your online shop."
        : tab === 'orders' ? 'Review order images, contact customers and manage fulfilment.'
        : 'Change the images, cards and words on your homepage. Start with the Images tab.';
    updatePanelCount();
    if (tab === 'orders') ordersManager?.load();
    if (tab === 'dashboard') ordersManager?.loadDashboard();
    if (tab === 'image-trash') imageTrash?.load();
  }

  function setSubTab(tab) {
    activeSubtab = tab;
    subtabButtons.forEach((button) => {
      const isActive = button.dataset.subtab === tab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    imagesTab.hidden = tab !== 'images';
    cardsTab.hidden = tab !== 'cards';
    textTab.hidden = tab !== 'text';
    if (tab === 'images') renderImageManager();
  }

  function releaseImageObjectUrls() {
    imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    imageObjectUrls = [];
  }

  function createImageCard({ badge, title, source, key, imageUrl }) {
    const label = document.createElement('label');
    label.className = 'image-card';

    const preview = document.createElement('span');
    preview.className = 'image-card-preview';
    const image = document.createElement('img');
    image.alt = '';
    if (imageUrl) {
      image.src = resolveImageUrl(imageUrl);
    } else {
      image.hidden = true;
      const empty = document.createElement('span');
      empty.className = 'image-card-empty';
      empty.textContent = 'No image yet';
      preview.append(empty);
    }
    preview.append(image);

    const body = document.createElement('span');
    body.className = 'image-card-body';

    const badgeElement = document.createElement('span');
    badgeElement.className = 'image-card-badge';
    badgeElement.textContent = badge;

    const titleElement = document.createElement('strong');
    titleElement.textContent = title;

    const help = document.createElement('span');
    help.className = 'field-help';
    help.textContent = 'Choose a new image · JPG, PNG, WebP or AVIF · Max 5 MB';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/avif';
    input.dataset.imageSource = source;
    input.dataset.imageKey = key;

    body.append(badgeElement, titleElement, help, input);
    label.append(preview, body);
    return label;
  }

  function renderImageManager() {
    if (!imageManager) return;
    releaseImageObjectUrls();

    const cards = [
      createImageCard({
        badge: 'Hero',
        title: 'Hero banner image',
        source: 'content',
        key: 'hero_image',
        imageUrl: contentValues.get('hero_image'),
      }),
    ];

    siteCards
      .filter((card) => card.section === 'mood')
      .forEach((card) => {
        cards.push(
          createImageCard({
            badge: 'Mood card',
            title: card.title,
            source: 'card',
            key: card.id,
            imageUrl: card.image_url,
          })
        );
      });

    cards.push(
      createImageCard({
        badge: 'Story',
        title: 'Our story image',
        source: 'content',
        key: 'story_image',
        imageUrl: contentValues.get('story_image'),
      })
    );

    imageManager.replaceChildren(...cards);
  }

  imageManager?.addEventListener('change', (event) => {
    const input = event.target.closest('input[type="file"]');
    if (!input) return;
    const image = input.closest('.image-card')?.querySelector('img');
    if (!image) return;

    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    imageObjectUrls.push(url);
    image.hidden = false;
    image.src = url;
  });

  saveImagesButton?.addEventListener('click', async () => {
    const inputs = [...imageManager.querySelectorAll('input[type="file"][data-image-source]')];
    const selected = inputs.filter((input) => input.files?.[0]);
    if (!selected.length) {
      setStatus('Choose at least one new image first.', true);
      return;
    }

    saveImagesButton.disabled = true;
    const uploadedPaths = [];
    const contentUpdates = new Map();
    try {
      for (const input of selected) {
        const uploaded = await uploadImage(input.files[0], SITE_IMAGE_BUCKET);
        uploadedPaths.push(uploaded.path);

        if (input.dataset.imageSource === 'content') {
          contentUpdates.set(input.dataset.imageKey, uploaded.url);
        } else {
          const { error } = await client
            .from('site_cards')
            .update({ image_url: uploaded.url })
            .eq('id', input.dataset.imageKey);
          if (error) throw new Error(error.message);
        }
      }

      if (contentUpdates.size) {
        const rows = [...contentUpdates.entries()].map(([key, value]) => ({ key, value }));
        const { error } = await client.from('site_content').upsert(rows, { onConflict: 'key' });
        if (error) throw new Error(error.message);
        contentUpdates.forEach((value, key) => contentValues.set(key, value));
      }

      setStatus('Homepage images updated.');
      await Promise.all([loadContent(), loadCards()]);
    } catch (error) {
      for (const path of uploadedPaths) {
        try {
          await client.storage.from(SITE_IMAGE_BUCKET).remove([path]);
        } catch (cleanupError) {
          console.error('Could not remove unused uploaded image:', cleanupError);
        }
      }
      setStatus(`Could not update homepage images: ${error.message}`, true);
    } finally {
      saveImagesButton.disabled = false;
    }
  });

  function buildContentForm() {
    const groups = CONTENT_SCHEMA.map((group) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'content-group';

      const legend = document.createElement('legend');
      legend.textContent = group.group;

      const stack = document.createElement('div');
      stack.className = 'stack';

      group.fields.forEach((field) => {
        if (field.type === 'image') {
          const wrapper = document.createElement('label');
          wrapper.className = 'content-image-field';

          const label = document.createElement('span');
          label.textContent = field.label;

          const preview = document.createElement('img');
          preview.alt = '';
          preview.dataset.contentPreview = field.key;
          preview.hidden = true;

          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/jpeg,image/png,image/webp,image/avif';
          input.dataset.contentImage = field.key;

          const help = document.createElement('span');
          help.className = 'field-help';
          help.textContent = 'JPG, PNG, WebP or AVIF · Maximum 5 MB';

          wrapper.append(label, preview, input, help);
          stack.append(wrapper);
          return;
        }

        const label = document.createElement('label');
        label.textContent = field.label;

        const input = document.createElement('input');
        if (field.type === 'textarea') {
          const textarea = document.createElement('textarea');
          textarea.rows = 3;
          textarea.maxLength = 2000;
          textarea.dataset.contentKey = field.key;
          label.append(textarea);
        } else {
          input.type = 'text';
          input.maxLength = 300;
          input.dataset.contentKey = field.key;
          label.append(input);
        }

        stack.append(label);
      });

      fieldset.append(legend, stack);
      return fieldset;
    });

    contentFields.replaceChildren(...groups);
  }

  function setContentImagePreviews() {
    contentFields.querySelectorAll('[data-content-preview]').forEach((image) => {
      const value = contentValues.get(image.dataset.contentPreview);
      if (value) {
        image.src = resolveImageUrl(value);
        image.hidden = false;
      } else {
        image.removeAttribute('src');
        image.hidden = true;
      }
    });
  }

  async function loadContent() {
    const { data, error } = await client.from('site_content').select('key, value');
    if (error) {
      setStatus(`Could not load homepage text: ${error.message}`, true);
      return;
    }

    contentValues = new Map((data || []).map((row) => [row.key, row.value]));
    contentFields.querySelectorAll('[data-content-key]').forEach((input) => {
      input.value = contentValues.get(input.dataset.contentKey) ?? '';
    });
    setContentImagePreviews();
    renderImageManager();
  }

  async function uploadImage(file, bucket) {
    if (!IMAGE_EXTENSIONS[file.type]) {
      throw new Error('Choose a JPG, PNG, WebP or AVIF image.');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error('The image must be 5 MB or smaller.');
    }

    const path = `${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;
    const { error } = await client.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(`Image upload failed: ${error.message}`);

    return { path, url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  }

  contentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new Map(contentValues);

    contentFields.querySelectorAll('[data-content-key]').forEach((input) => {
      values.set(input.dataset.contentKey, input.value);
    });

    saveContentButton.disabled = true;
    const uploadedPaths = [];
    try {
      const imageInputs = [...contentFields.querySelectorAll('[data-content-image]')];
      for (const input of imageInputs) {
        const file = input.files?.[0];
        if (!file) continue;
        const uploaded = await uploadImage(file, SITE_IMAGE_BUCKET);
        uploadedPaths.push(uploaded.path);
        values.set(input.dataset.contentImage, uploaded.url);
        input.value = '';
      }

      const rows = [...values.entries()].map(([key, value]) => ({
        key,
        value: String(value ?? ''),
      }));
      const { error } = await client.from('site_content').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(error.message);

      contentValues = values;
      setContentImagePreviews();
      setStatus('Homepage text saved.');
    } catch (error) {
      for (const path of uploadedPaths) {
        try {
          await client.storage.from(SITE_IMAGE_BUCKET).remove([path]);
        } catch (cleanupError) {
          console.error('Could not remove unused uploaded image:', cleanupError);
        }
      }
      setStatus(`Could not save homepage text: ${error.message}`, true);
    } finally {
      saveContentButton.disabled = false;
    }
  });

  function updateCardFieldVisibility() {
    const section = cardSection.value;
    cardForm.querySelectorAll('[data-card-field]').forEach((field) => {
      field.hidden = field.dataset.cardField !== section;
    });
    cardImageFileInput.required = section === 'mood' && !cardEditingImageUrl;
  }

  function showCardImagePreview(src, label) {
    cardImagePreviewImage.src = src;
    cardImagePreviewLabel.textContent = label;
    cardImagePreview.hidden = false;
  }

  function createCardRow(card) {
    const row = document.createElement('article');
    row.className = 'card-row';

    if (card.section === 'mood' && card.image_url) {
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.src = resolveImageUrl(card.image_url);
      row.append(image);
    } else {
      const number = document.createElement('span');
      number.className = 'card-number';
      number.textContent = card.section === 'mood'
        ? 'IMG'
        : String(card.display_order || 0).padStart(2, '0');
      row.append(number);
    }

    const details = document.createElement('div');
    details.className = 'card-row-details';
    const title = document.createElement('h3');
    title.textContent = card.title;
    const meta = document.createElement('p');
    const sectionLabel = card.section === 'mood' ? 'Mood card' : 'Promise card';
    meta.textContent = `${sectionLabel} · ${card.published ? 'Published' : 'Draft'}`;
    details.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.className = 'text-button';
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => startEditingCard(card));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-button delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteCard(card));
    actions.append(editButton, deleteButton);

    row.append(details, actions);
    return row;
  }

  async function loadCards() {
    const { data, error } = await client
      .from('site_cards')
      .select('id, section, title, body, image_url, image_alt, link_url, link_filter, published, display_order')
      .order('section', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) {
      setStatus(`Could not load homepage cards: ${error.message}`, true);
      return;
    }

    siteCards = data;
    cardTotal = data.length;
    cardList.replaceChildren(...data.map(createCardRow));
    updatePanelCount();
    renderImageManager();
  }

  function startEditingCard(card) {
    cardEditingId = card.id;
    cardEditingImageUrl = card.image_url || '';
    cardForm.elements.namedItem('section').value = card.section;
    cardForm.elements.namedItem('title').value = card.title;
    cardForm.elements.namedItem('body').value = card.body || '';
    cardForm.elements.namedItem('image_alt').value = card.image_alt || '';
    cardForm.elements.namedItem('link_url').value = card.link_url || '#shop';
    cardForm.elements.namedItem('link_filter').value = card.link_filter || '';
    cardForm.elements.namedItem('display_order').value = card.display_order ?? 0;
    cardForm.elements.namedItem('published').checked = Boolean(card.published);
    cardImageFileInput.value = '';
    if (cardEditingImageUrl) {
      showCardImagePreview(resolveImageUrl(cardEditingImageUrl), 'Current card image');
    } else {
      cardImagePreview.hidden = true;
    }
    updateCardFieldVisibility();
    cardFormTitle.textContent = 'Edit card';
    saveCardButton.textContent = 'Save changes';
    cancelCardEditButton.hidden = false;
    cardForm.elements.namedItem('title').focus();
  }

  function resetCardEditor() {
    cardEditingId = null;
    cardEditingImageUrl = '';
    if (cardPreviewObjectUrl) URL.revokeObjectURL(cardPreviewObjectUrl);
    cardPreviewObjectUrl = '';
    cardForm.reset();
    cardForm.elements.namedItem('display_order').value = '0';
    cardImageFileInput.required = false;
    cardImagePreview.hidden = true;
    cardImagePreviewImage.removeAttribute('src');
    cardImagePreviewLabel.textContent = '';
    cardFormTitle.textContent = 'Add a card';
    saveCardButton.textContent = 'Add card';
    cancelCardEditButton.hidden = true;
    updateCardFieldVisibility();
  }

  cardSection.addEventListener('change', updateCardFieldVisibility);

  cardImageFileInput.addEventListener('change', () => {
    const file = cardImageFileInput.files?.[0];
    if (!file) {
      if (cardPreviewObjectUrl) URL.revokeObjectURL(cardPreviewObjectUrl);
      cardPreviewObjectUrl = '';
      if (cardEditingImageUrl) {
        showCardImagePreview(resolveImageUrl(cardEditingImageUrl), 'Current card image');
      } else {
        cardImagePreview.hidden = true;
      }
      return;
    }

    if (cardPreviewObjectUrl) URL.revokeObjectURL(cardPreviewObjectUrl);
    cardPreviewObjectUrl = URL.createObjectURL(file);
    showCardImagePreview(cardPreviewObjectUrl, file.name);
  });

  cardForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(cardForm);
    const section = String(formData.get('section'));
    const imageFile = formData.get('image_file');
    const hasImageFile = imageFile instanceof File && imageFile.size > 0;

    if (section === 'mood' && !hasImageFile && !cardEditingImageUrl) {
      setStatus('Choose a card image to upload.', true);
      return;
    }
    if (hasImageFile && !IMAGE_EXTENSIONS[imageFile.type]) {
      setStatus('Choose a JPG, PNG, WebP or AVIF image.', true);
      return;
    }
    if (hasImageFile && imageFile.size > MAX_IMAGE_SIZE) {
      setStatus('The image must be 5 MB or smaller.', true);
      return;
    }

    const cardFields = {
      section,
      title: String(formData.get('title')).trim(),
      body: String(formData.get('body') || '').trim(),
      image_alt: String(formData.get('image_alt') || '').trim(),
      link_url: String(formData.get('link_url') || '').trim() || '#shop',
      link_filter: String(formData.get('link_filter') || ''),
      display_order: Number(formData.get('display_order')) || 0,
      published: formData.has('published'),
    };

    let uploadedPath = '';
    saveCardButton.disabled = true;
    try {
      let imageUrl = section === 'mood' ? cardEditingImageUrl : '';
      if (hasImageFile) {
        const uploaded = await uploadImage(imageFile, SITE_IMAGE_BUCKET);
        uploadedPath = uploaded.path;
        imageUrl = uploaded.url;
      }

      const card = { ...cardFields, image_url: imageUrl || '' };
      const query = cardEditingId
        ? client.from('site_cards').update(card).eq('id', cardEditingId)
        : client.from('site_cards').insert(card);
      const { error } = await query;
      if (error) throw new Error(error.message);

      setStatus(cardEditingId ? 'Card updated.' : 'Card added.');
      resetCardEditor();
      await loadCards();
    } catch (error) {
      if (uploadedPath) {
        try {
          await client.storage.from(SITE_IMAGE_BUCKET).remove([uploadedPath]);
        } catch (cleanupError) {
          console.error('Could not remove unused uploaded image:', cleanupError);
        }
      }
      setStatus(`Could not save card: ${error.message}`, true);
    } finally {
      saveCardButton.disabled = false;
    }
  });

  async function deleteCard(card) {
    if (!window.confirm(`Delete the card "${card.title}"? This cannot be undone.`)) return;
    try {
      const { error } = await client.from('site_cards').delete().eq('id', card.id);
      if (error) {
        setStatus(`Could not delete card: ${error.message}`, true);
        return;
      }
      if (cardEditingId === card.id) resetCardEditor();
      setStatus('Card deleted.');
      await loadCards();
    } catch (error) {
      setStatus(`Could not delete card: ${error.message}`, true);
    }
  }

  function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('is-error', isError);
    clearTimeout(statusTimer);
    if (message) {
      statusTimer = setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.classList.remove('is-error');
      }, 5000);
    }
  }

  function showSignedOut() {
    imageTrash?.clear();
    productReorder?.clear();
    ordersManager?.clear();
    document.body.classList.remove('is-signed-in');
    loginPanel.hidden = false;
    cmsPanel.hidden = true;
    signOutButton.hidden = true;
  }

  function showSignedIn() {
    document.body.classList.add('is-signed-in');
    loginPanel.hidden = true;
    cmsPanel.hidden = false;
    signOutButton.hidden = false;
  }

  function normalizeAssetPath(path) {
    if (typeof path !== 'string') return '';
    const value = path.trim();
    const githubBlob = value.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+)$/i);
    if (githubBlob) {
      const filePath = githubBlob[3].replace(/^assets\//, 'Backend/assets/');
      return `https://raw.githubusercontent.com/${githubBlob[1]}/${githubBlob[2]}/${filePath}`;
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.hostname === 'raw.githubusercontent.com' && /\/assets\//.test(url.pathname) && !/\/Backend\/assets\//.test(url.pathname)) {
          url.pathname = url.pathname.replace('/assets/', '/Backend/assets/');
          return url.href;
        }
      } catch {
        return value;
      }
      return value;
    }

    const relativePath = value.replace(/^\/+/, '');
    if (relativePath.startsWith('assets/')) return `Backend/${relativePath}`;
    return relativePath;
  }

  function resolveImageUrl(path) {
    const normalizedPath = normalizeAssetPath(path);
    return new URL(normalizedPath, new URL('../', document.baseURI)).href;
  }

  function getImageCandidates(path) {
    const normalizedPath = normalizeAssetPath(path);
    const first = resolveImageUrl(path);
    const candidates = [first];

    if (normalizedPath.startsWith('Backend/assets/')) {
      candidates.push(new URL(normalizedPath.slice('Backend/'.length), new URL('../', document.baseURI)).href);
    } else if (normalizedPath.startsWith('https://raw.githubusercontent.com/')) {
      const url = new URL(normalizedPath);
      if (/\/assets\//.test(url.pathname) && !/\/Backend\/assets\//.test(url.pathname)) {
        url.pathname = url.pathname.replace('/assets/', '/Backend/assets/');
        candidates.push(url.href);
      }
    }

    return [...new Set(candidates)];
  }

  async function verifyAdmin() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) {
      showSignedOut();
      return;
    }

    const { data, error: adminError } = await client
      .from('cms_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!data) {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      showSignedOut();
      setStatus('This account is not allowed to manage products.', true);
      return;
    }

    showSignedIn();
    await Promise.allSettled([loadProducts(), loadContent(), loadCards(), ordersManager.loadDashboard()]);
    if (activeTab === 'orders') ordersManager.load();
  }

  function createProductRow(product) {
    const row = document.createElement('article');
    row.className = 'product-row';

    const image = document.createElement('img');
    image.alt = '';
    image.draggable = false;
    image.loading = 'lazy';
    const imageCandidates = getImageCandidates(product.image_url);
    let imageCandidateIndex = 0;
    image.addEventListener('error', () => {
      imageCandidateIndex += 1;
      if (imageCandidateIndex < imageCandidates.length) {
        image.src = imageCandidates[imageCandidateIndex];
        return;
      }
      row.classList.add('image-unavailable');
      console.warn('Product image could not be loaded:', product.image_url);
    });
    image.src = imageCandidates[0];
    row.append(image);

    const details = document.createElement('div');
    details.className = 'product-row-details';
    const name = document.createElement('h3');
    name.textContent = product.name;
    const meta = document.createElement('p');
    meta.textContent = `${product.category} · Rs. ${Number(product.price).toLocaleString('en-LK')} · ${product.published ? 'Published' : 'Draft'}`;
    details.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.className = 'text-button';
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => startEditing(product));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-button delete-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteProduct(product));
    actions.append(editButton, deleteButton);
    editButton.disabled = deleteButton.disabled = !!productReorder?.busy;

    row.append(details, actions);
    productReorder?.decorate(row, product);
    return row;
  }

  function renderProductInventory(products) {
    inventoryProducts = products;
    productCategoryButtons.forEach((button) => {
      const category = button.dataset.productCategory;
      const active = category === activeProductCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.querySelector('[data-category-count]').textContent = String(category === 'all'
        ? products.length : products.filter((product) => product.category === category).length);
    });
    const visible = activeProductCategory === 'all' ? products : products.filter((product) => product.category === activeProductCategory);
    productList.replaceChildren(...visible.map(createProductRow));
    document.getElementById('product-category-empty').hidden = visible.length > 0;
    document.getElementById('product-category-panel').setAttribute('aria-labelledby', `product-category-${activeProductCategory}`);
  }

  function setProductCategory(category) {
    if (productReorder?.busy || (category !== 'all' && !productCategories.some((item) => item.slug === category))) return;
    activeProductCategory = category;
    productReorder?.setCategory(category === 'all' ? null : category);
    renderProductInventory(inventoryProducts);
  }

  const LOCAL_CATEGORIES_KEY = 'venu.cms.categories';
  const categoryDropdown = document.getElementById('category-dropdown');
  const categoryDropdownTrigger = document.getElementById('category-dropdown-trigger');
  const categoryDropdownLabel = document.getElementById('category-dropdown-label');
  const categoryDropdownMenu = document.getElementById('category-dropdown-menu');
  const categoryDropdownList = document.getElementById('category-dropdown-list');
  const newCategoryInput = document.getElementById('new-category-input');
  const categoryDropdownError = document.getElementById('category-dropdown-error');

  function slugifyCategory(label) {
    return String(label || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  }

  function readLocalCategories() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_CATEGORIES_KEY) || 'null');
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* ignore */ }
    return null;
  }

  function writeLocalCategories(categories) {
    try { localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories)); } catch { /* ignore */ }
  }

  function setCategoryDropdownError(message = '') {
    if (!categoryDropdownError) return;
    categoryDropdownError.textContent = message;
    categoryDropdownError.hidden = !message;
  }

  function setCategoryDropdownOpen(open) {
    if (!categoryDropdownMenu || !categoryDropdownTrigger) return;
    categoryDropdownMenu.hidden = !open;
    categoryDropdownTrigger.setAttribute('aria-expanded', String(open));
    if (!open) setCategoryDropdownError('');
  }

  function syncCategoryDropdownSelection() {
    const select = productForm.elements.namedItem('category');
    const selected = productCategories.find((item) => item.slug === select.value) || productCategories[0];
    if (selected && select.value !== selected.slug) select.value = selected.slug;
    if (categoryDropdownLabel) categoryDropdownLabel.textContent = selected ? selected.label : 'Select category';
    if (!categoryDropdownList) return;
    categoryDropdownList.replaceChildren(...productCategories.map((category) => {
      const isSelected = selected?.slug === category.slug;
      const row = document.createElement('div');
      row.className = `category-dropdown-row${isSelected ? ' is-selected' : ''}`;

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'category-dropdown-select';
      selectBtn.setAttribute('role', 'option');
      selectBtn.setAttribute('aria-selected', String(isSelected));
      const text = document.createElement('span');
      text.textContent = category.label;
      const check = document.createElement('span');
      check.setAttribute('aria-hidden', 'true');
      check.textContent = isSelected ? '✓' : '';
      selectBtn.append(text, check);
      selectBtn.addEventListener('click', () => {
        select.value = category.slug;
        syncCategoryDropdownSelection();
        setCategoryDropdownOpen(false);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'category-dropdown-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = `Delete ${category.label}`;
      deleteBtn.setAttribute('aria-label', `Delete ${category.label}`);
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteCategory(category).catch((error) => setCategoryDropdownError(`Could not delete category: ${error.message}`));
      });

      row.append(selectBtn, deleteBtn);
      return row;
    }));
  }

  function renderCategoryControls() {
    const select = productForm.elements.namedItem('category');
    const current = select.value;
    select.replaceChildren(...productCategories.map((category) => {
      const option = document.createElement('option');
      option.value = category.slug;
      option.textContent = category.label;
      return option;
    }));
    if (productCategories.some((category) => category.slug === current)) select.value = current;
    syncCategoryDropdownSelection();

    const cardFilter = cardForm?.elements.namedItem('link_filter');
    if (cardFilter) {
      const currentFilter = cardFilter.value;
      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = 'No filter';
      cardFilter.replaceChildren(noneOption, ...productCategories.map((category) => {
        const option = document.createElement('option');
        option.value = category.slug;
        option.textContent = category.label;
        return option;
      }));
      cardFilter.value = productCategories.some((category) => category.slug === currentFilter) ? currentFilter : '';
    }

    const tabs = document.querySelector('.product-category-tabs');
    const makeTab = (slug, label) => {
      const button = document.createElement('button');
      button.id = `product-category-${slug}`;
      button.className = 'order-status-tab';
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'product-category-panel');
      button.dataset.productCategory = slug;
      const count = document.createElement('span');
      count.className = 'order-tab-count';
      count.dataset.categoryCount = slug;
      count.textContent = '0';
      button.append(`${label} `, count);
      return button;
    };
    tabs.replaceChildren(makeTab('all', 'All products'), ...productCategories.map((item) => makeTab(item.slug, item.label)));
    productCategoryButtons = [...tabs.querySelectorAll('[data-product-category]')];
    if (activeProductCategory !== 'all' && !productCategories.some((item) => item.slug === activeProductCategory)) {
      activeProductCategory = 'all';
      productReorder?.setCategory(null);
    }
  }

  async function loadCategories() {
    const { data, error } = await client
      .from('product_categories')
      .select('slug, label, display_order')
      .order('display_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) {
      // Table missing (migration not applied yet): use local categories or built-in defaults.
      const local = readLocalCategories();
      if (local) productCategories = local;
    } else if (data.length) {
      productCategories = data;
      writeLocalCategories(data);
    }
    renderCategoryControls();
  }

  async function addCategory() {
    const label = String(newCategoryInput?.value || '').trim().slice(0, 40);
    if (!label) {
      setCategoryDropdownError('Type a category name first.');
      newCategoryInput?.focus();
      return;
    }
    const slug = slugifyCategory(label);
    if (!slug) {
      setCategoryDropdownError('Use letters or numbers in the category name.');
      newCategoryInput?.focus();
      return;
    }
    setCategoryDropdownError('');
    const existing = productCategories.find((item) => item.slug === slug);
    if (!existing) {
      const display_order = Math.max(0, ...productCategories.map((item) => Number(item.display_order) || 0)) + 1;
      const { error } = await client.from('product_categories').insert({ slug, label, display_order });
      if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
        setCategoryDropdownError(`Could not add category: ${error.message}`);
        return;
      }
      if (error) {
        productCategories = [...productCategories, { slug, label, display_order }];
        writeLocalCategories(productCategories);
        renderCategoryControls();
      } else {
        await loadCategories();
      }
      renderProductInventory(inventoryProducts);
      setStatus(`Category "${label}" added.`);
    }
    if (newCategoryInput) newCategoryInput.value = '';
    productForm.elements.namedItem('category').value = slug;
    syncCategoryDropdownSelection();
  }

  async function deleteCategory(category) {
    setCategoryDropdownError('');
    if (productCategories.length <= 1) {
      setCategoryDropdownError('Keep at least one category.');
      return;
    }
    const usedCount = inventoryProducts.filter((product) => product.category === category.slug).length;
    if (usedCount > 0) {
      setCategoryDropdownError(`Cannot delete "${category.label}" while ${usedCount} product(s) use it.`);
      return;
    }
    const { error } = await client.from('product_categories').delete().eq('slug', category.slug);
    if (error && !/relation|does not exist|schema cache/i.test(error.message)) {
      setCategoryDropdownError(`Could not delete category: ${error.message}`);
      return;
    }
    productCategories = productCategories.filter((item) => item.slug !== category.slug);
    writeLocalCategories(productCategories);
    const select = productForm.elements.namedItem('category');
    if (select.value === category.slug && productCategories[0]) {
      select.value = productCategories[0].slug;
    }
    renderCategoryControls();
    renderProductInventory(inventoryProducts);
    setStatus(`Category "${category.label}" deleted.`);
  }

  async function loadProducts() {
    await loadCategories();
    const { data, error } = await client
      .from('products')
      .select('id, name, description, category, price, image_url, image_alt, badge, image_tone, colors, sizes, published, display_order')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      setStatus(`Could not load products: ${error.message}`, true);
      return;
    }

    productTotal = data.length;
    productReorder?.setProducts(data);
    renderProductInventory(data);
    updatePanelCount();
  }

  function formatSizeOptions(sizes) {
    if (!Array.isArray(sizes)) return '';
    return sizes.map((size) => String(size)).filter(Boolean).join(', ');
  }

  function parseSizeOptions(value) {
    return String(value || '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((size) => Number.isFinite(size) && size > 0)
      .slice(0, 20);
  }

  function startEditing(product) {
    productEditorVersion++;
    editingId = product.id;
    for (const [field, value] of Object.entries(product)) {
      const input = productForm.elements.namedItem(field);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = field === 'image_url' ? normalizeAssetPath(value ?? '') : value ?? '';
    }
    colourEditor.setValue(product.colors, product.image_url);
    syncCategoryDropdownSelection();
    setCategoryDropdownOpen(false);
    productForm.elements.namedItem('sizes').value = formatSizeOptions(product.sizes);
    formTitle.textContent = 'Edit product';
    saveButton.textContent = 'Save changes';
    cancelEditButton.hidden = false;
    setTab('add-product');
    productForm.elements.namedItem('name').focus();
  }

  function resetEditor() {
    productEditorVersion++;
    colourEditor.setValue([]);
    editingId = null;
    productForm.reset();
    syncCategoryDropdownSelection();
    setCategoryDropdownOpen(false);
    productForm.elements.namedItem('display_order').value = '0';
    formTitle.textContent = 'Add a product';
    saveButton.textContent = 'Add product';
    cancelEditButton.hidden = true;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(formData.get('email')).trim(),
        password: String(formData.get('password')),
      });
      if (error) {
        setStatus(`Sign-in failed: ${error.message}`, true);
        return;
      }
      loginForm.reset();
      await verifyAdmin();
    } catch (error) {
      setStatus(`Sign-in failed: ${error.message}`, true);
    }
  });

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saveButton.disabled) return;
    const formData = new FormData(productForm);
    let colourSnapshot;
    try {
      colourSnapshot = colourEditor.snapshot();
      if (!colourSnapshot.some((entry) => entry.file || entry.data.image)) {
        throw new Error('Add at least one colour photo before saving this product.');
      }
    }
    catch (error) { setStatus(error.message, true); return; }

    const productFields = {
      name: String(formData.get('name')).trim(),
      description: String(formData.get('description')).trim(),
      category: String(formData.get('category')),
      price: Number(formData.get('price')),
      image_alt: String(formData.get('image_alt')).trim(),
      badge: String(formData.get('badge')).trim(),
      image_tone: String(formData.get('image_tone')),
      sizes: parseSizeOptions(formData.get('sizes')),
      published: formData.has('published'),
      display_order: Number(formData.get('display_order')) || 0,
    };

    const uploadedPaths = [];
    const productIdToSave = editingId;
    const editorVersion = productEditorVersion;
    let productSaved = false;
    const controls = [...productForm.querySelectorAll('input, select, textarea, button')].filter((control) => !control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    saveButton.disabled = true;
    const uploadProductImage = async (file) => {
      const extension = IMAGE_EXTENSIONS[file.type];
      if (!extension || !file.size || file.size > MAX_IMAGE_SIZE) throw new Error('Choose a JPG, PNG, WebP or AVIF image up to 5 MB.');
      const path = `${crypto.randomUUID()}.${extension}`;
      uploadedPaths.push(path);
      const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (error) throw new Error(`Image upload failed: ${error.message}`);
      return client.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    };
    try {
      productFields.colors = await colourEditor.upload(colourSnapshot, uploadProductImage);
      const imageUrl = colourEditor.coverImage(productFields.colors);

      const product = { ...productFields, image_url: imageUrl };
      const query = productIdToSave
        ? client.from('products').update(product).eq('id', productIdToSave)
        : client.from('products').insert(product);
      const { error } = await query;
      if (error) throw new Error(`Could not save product: ${error.message}`);
      productSaved = true;

      setStatus(productIdToSave ? 'Product updated.' : 'Product added.');
      if (editorVersion === productEditorVersion) {
        resetEditor();
        if (activeTab === 'add-product') setTab('products');
      }
      await loadProducts();
    } catch (error) {
      if (!productSaved && uploadedPaths.length) {
        try {
          const { error: cleanupError } = await client.storage.from(IMAGE_BUCKET).remove(uploadedPaths);
          if (cleanupError) console.error('Could not remove unused uploaded image:', cleanupError.message);
        } catch (cleanupError) {
          console.error('Could not remove unused uploaded image:', cleanupError);
        }
      }
      setStatus(`Could not save product: ${error.message}`, true);
    } finally {
      controls.forEach((control) => { control.disabled = false; });
      saveButton.disabled = false;
    }
  });

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await client.from('products').delete().eq('id', product.id);
      if (error) {
        setStatus(`Could not delete product: ${error.message}`, true);
        return;
      }
      if (editingId === product.id) resetEditor();
      setStatus('Product deleted.');
      await loadProducts();
    } catch (error) {
      setStatus(`Could not delete product: ${error.message}`, true);
    }
  }

  cancelEditButton.addEventListener('click', () => {
    resetEditor();
    setTab('products');
  });
  adminUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(adminUserForm);
    const email = String(formData.get('email')).trim();
    addAdminUserButton.disabled = true;
    try {
      const { error } = await client.rpc('add_cms_admin_by_email', {
        p_email: email,
      });
      if (error) {
        setStatus(`Could not give CMS access: ${error.message}`, true);
        return;
      }
      adminUserForm.reset();
      setStatus(`CMS access granted to ${email}. They can now sign in.`);
    } catch (error) {
      setStatus(`Could not give CMS access: ${error.message}`, true);
    } finally {
      addAdminUserButton.disabled = false;
    }
  });

  document.getElementById('refresh-products').addEventListener('click', () => {
    loadProducts().catch((error) => setStatus(`Could not load products: ${error.message}`, true));
  });
  document.getElementById('refresh-content').addEventListener('click', () => {
    loadContent().catch((error) => setStatus(`Could not load homepage text: ${error.message}`, true));
  });
  document.getElementById('refresh-cards').addEventListener('click', () => {
    loadCards().catch((error) => setStatus(`Could not load homepage cards: ${error.message}`, true));
  });
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });
  // Delegated so tabs added for new categories work without re-binding.
  const productCategoryTabs = document.querySelector('.product-category-tabs');
  productCategoryTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-product-category]');
    if (button) setProductCategory(button.dataset.productCategory);
  });
  productCategoryTabs.addEventListener('keydown', (event) => {
    const index = productCategoryButtons.indexOf(event.target.closest('[data-product-category]'));
    if (index < 0 || productReorder?.busy) return;
    const target = event.key === 'ArrowRight' ? (index + 1) % productCategoryButtons.length
      : event.key === 'ArrowLeft' ? (index + productCategoryButtons.length - 1) % productCategoryButtons.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? productCategoryButtons.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    setProductCategory(productCategoryButtons[target].dataset.productCategory);
    productCategoryButtons[target].focus();
  });
  categoryDropdownTrigger?.addEventListener('click', () => {
    setCategoryDropdownOpen(categoryDropdownMenu.hidden);
  });
  document.addEventListener('click', (event) => {
    if (categoryDropdown && !categoryDropdownMenu?.hidden && !categoryDropdown.contains(event.target)) {
      setCategoryDropdownOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !categoryDropdownMenu?.hidden) {
      setCategoryDropdownOpen(false);
      categoryDropdownTrigger?.focus();
    }
  });
  newCategoryInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory().catch((error) => setCategoryDropdownError(`Could not add category: ${error.message}`));
    }
  });
  document.getElementById('add-category').addEventListener('click', () => {
    addCategory().catch((error) => setCategoryDropdownError(`Could not add category: ${error.message}`));
  });
  document.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.goto));
  });
  subtabButtons.forEach((button) => {
    button.addEventListener('click', () => setSubTab(button.dataset.subtab));
  });
  cancelCardEditButton.addEventListener('click', resetCardEditor);
  signOutButton.addEventListener('click', async () => {
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        setStatus(`Could not sign out: ${error.message}`, true);
        return;
      }
      showSignedOut();
    } catch (error) {
      setStatus(`Could not sign out: ${error.message}`, true);
    }
  });

  buildContentForm();
  updateCardFieldVisibility();
  setTab('dashboard');
  setSubTab('images');

  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    setupNotice.hidden = false;
    return;
  }
  if (!window.supabase?.createClient) {
    setStatus('Supabase could not load. Check your internet connection and reload.', true);
    return;
  }

  try {
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    imageTrash = window.createImageTrash(client, setStatus);
    productReorder = window.createProductReorder({
      render: renderProductInventory,
      persist: (products) => window.persistProductOrder(client, products),
      onSaved: () => setStatus('Product order saved. The shop uses this order for its default listing.'),
      onError: async (error) => {
        await loadProducts();
        setStatus(`Could not finish reordering: ${error.message}. Some positions may have saved; refresh before trying again.`, true);
      },
      onBusy: (busy) => {
        productCategoryButtons.forEach((button) => { button.disabled = busy; });
        document.getElementById('refresh-products').disabled = busy;
        document.getElementById('product-reorder-message').textContent = busy ? 'Saving product order…' : '';
      },
    });
    ordersManager = window.createOrdersManager(client, setStatus, (count) => {
      orderTotal = count;
      updatePanelCount();
    }, () => setTab('orders'), (count) => {
      const badge = document.getElementById('new-orders-count');
      badge.textContent = count === null ? '—' : String(count);
      badge.setAttribute('aria-label', count === null ? 'New order count unavailable' : `${count} new orders`);
    });
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') showSignedOut();
    });
  } catch (error) {
    setStatus(`CMS could not start: ${error.message}`, true);
    return;
  }
  verifyAdmin().catch((error) => {
    console.error('CMS initialization failed:', error);
    setStatus(`CMS could not start: ${error.message}`, true);
  });
});
