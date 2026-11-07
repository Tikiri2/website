document.addEventListener('DOMContentLoaded', () => {
  const config = window.SHUES_CMS_CONFIG;
  const setupNotice = document.getElementById('setup-notice');
  const loginPanel = document.getElementById('login-panel');
  const cmsPanel = document.getElementById('cms-panel');
  const signOutButton = document.getElementById('sign-out');
  const loginForm = document.getElementById('login-form');
  const productForm = document.getElementById('product-form');
  const productList = document.getElementById('product-list');
  const imageFileInput = document.getElementById('image-file');
  const imagePreview = document.getElementById('image-preview');
  const imagePreviewImage = document.getElementById('image-preview-img');
  const imagePreviewLabel = document.getElementById('image-preview-label');
  const statusMessage = document.getElementById('status-message');
  const formTitle = document.getElementById('form-title');
  const saveButton = document.getElementById('save-product');
  const cancelEditButton = document.getElementById('cancel-edit');
  let client;
  let editingId = null;
  let editingImageUrl = '';
  let previewObjectUrl = '';
  let statusTimer;
  const IMAGE_BUCKET = 'product-images';
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const IMAGE_EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };

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
    loginPanel.hidden = false;
    cmsPanel.hidden = true;
    signOutButton.hidden = true;
  }

  function showSignedIn() {
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
    await loadProducts();
  }

  function createProductRow(product) {
    const row = document.createElement('article');
    row.className = 'product-row';

    const image = document.createElement('img');
    image.alt = '';
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

    row.append(details, actions);
    return row;
  }

  async function loadProducts() {
    const { data, error } = await client
      .from('products')
      .select('id, name, description, category, price, image_url, image_alt, badge, image_tone, published, display_order')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      setStatus(`Could not load products: ${error.message}`, true);
      return;
    }

    productList.replaceChildren(...data.map(createProductRow));
    document.getElementById('product-count').textContent = `${data.length} product${data.length === 1 ? '' : 's'}`;
  }

  function startEditing(product) {
    editingId = product.id;
    editingImageUrl = product.image_url;
    for (const [field, value] of Object.entries(product)) {
      const input = productForm.elements.namedItem(field);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = field === 'image_url' ? normalizeAssetPath(value ?? '') : value ?? '';
    }
    imageFileInput.required = false;
    showImagePreview(resolveImageUrl(editingImageUrl), 'Current product image');
    formTitle.textContent = 'Edit product';
    saveButton.textContent = 'Save changes';
    cancelEditButton.hidden = false;
    productForm.elements.namedItem('name').focus();
  }

  function resetEditor() {
    editingId = null;
    editingImageUrl = '';
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
    productForm.reset();
    imageFileInput.required = true;
    imagePreview.hidden = true;
    imagePreviewImage.removeAttribute('src');
    imagePreviewLabel.textContent = '';
    productForm.elements.namedItem('display_order').value = '0';
    formTitle.textContent = 'Add a product';
    saveButton.textContent = 'Add product';
    cancelEditButton.hidden = true;
  }

  function showImagePreview(src, label) {
    imagePreviewImage.src = src;
    imagePreviewLabel.textContent = label;
    imagePreview.hidden = false;
  }

  imageFileInput.addEventListener('change', () => {
    const file = imageFileInput.files?.[0];
    if (!file) {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = '';
      if (editingImageUrl) showImagePreview(resolveImageUrl(editingImageUrl), 'Current product image');
      else imagePreview.hidden = true;
      return;
    }

    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    showImagePreview(previewObjectUrl, file.name);
  });

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
    const formData = new FormData(productForm);
    const imageFile = formData.get('image_file');
    const hasImageFile = imageFile instanceof File && imageFile.size > 0;
    if (!hasImageFile && !editingImageUrl) {
      setStatus('Choose a product image to upload.', true);
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

    const productFields = {
      name: String(formData.get('name')).trim(),
      description: String(formData.get('description')).trim(),
      category: String(formData.get('category')),
      price: Number(formData.get('price')),
      image_alt: String(formData.get('image_alt')).trim(),
      badge: String(formData.get('badge')).trim(),
      image_tone: String(formData.get('image_tone')),
      published: formData.has('published'),
      display_order: Number(formData.get('display_order')) || 0,
    };

    let uploadedPath = '';
    saveButton.disabled = true;
    try {
      let imageUrl = editingImageUrl;
      if (hasImageFile) {
        const extension = IMAGE_EXTENSIONS[imageFile.type];
        uploadedPath = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage
          .from(IMAGE_BUCKET)
          .upload(uploadedPath, imageFile, {
            cacheControl: '3600',
            contentType: imageFile.type,
            upsert: false,
          });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        imageUrl = client.storage.from(IMAGE_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }

      const product = { ...productFields, image_url: imageUrl };
      const query = editingId
        ? client.from('products').update(product).eq('id', editingId)
        : client.from('products').insert(product);
      const { error } = await query;
      if (error) throw new Error(`Could not save product: ${error.message}`);

      setStatus(editingId ? 'Product updated.' : 'Product added.');
      resetEditor();
      await loadProducts();
    } catch (error) {
      if (uploadedPath) {
        try {
          const { error: cleanupError } = await client.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
          if (cleanupError) console.error('Could not remove unused uploaded image:', cleanupError.message);
        } catch (cleanupError) {
          console.error('Could not remove unused uploaded image:', cleanupError);
        }
      }
      setStatus(`Could not save product: ${error.message}`, true);
    } finally {
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

  cancelEditButton.addEventListener('click', resetEditor);
  document.getElementById('refresh-products').addEventListener('click', () => {
    loadProducts().catch((error) => setStatus(`Could not load products: ${error.message}`, true));
  });
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
  } catch (error) {
    setStatus(`CMS could not start: ${error.message}`, true);
    return;
  }
  verifyAdmin().catch((error) => {
    console.error('CMS initialization failed:', error);
    setStatus(`CMS could not start: ${error.message}`, true);
  });
});
