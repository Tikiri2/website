// Colour metadata and photo URLs live in the existing products.colors JSON.
window.createProductColourEditor = (resolveImageUrl) => {
  const list = document.getElementById('product-colour-list');
  const add = document.getElementById('add-product-colour');
  const empty = document.getElementById('product-colours-empty');
  const types = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  let rows = [];
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const update = () => { empty.hidden = rows.length > 0; add.disabled = rows.length >= 8; };
  const revoke = (row) => {
    if (row.previewURL) URL.revokeObjectURL(row.previewURL);
    row.previewURL = '';
  };
  function normalizeHex(value) {
    const hex = `#${String(value || '').trim().replace(/^#/, '')}`;
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex) ? hex.toLowerCase() : '';
  }
  function toSixDigit(hex) {
    let value = hex.replace('#', '');
    if (value.length <= 4) value = value.slice(0, 3).split('').map((part) => part + part).join('');
    return `#${value.slice(0, 6)}`;
  }
  const toHex = (r, g, b) => `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;

  // Full-size photo overlay: hover to preview, click to pick the colour under the cursor.
  function openPhotoPicker(src, currentHex, onPick, onError) {
    const overlay = node('div', undefined, 'colour-picker-overlay');
    const panel = node('div', undefined, 'colour-picker-panel');
    const heading = node('div', undefined, 'colour-picker-heading');
    const title = node('strong', 'Click the shoe to pick its colour');
    const close = node('button', '×', 'colour-picker-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close colour picker');
    heading.append(title, close);
    const stage = node('div', undefined, 'colour-picker-stage');
    const canvas = node('canvas');
    const loupe = node('span', undefined, 'colour-picker-loupe');
    stage.append(canvas, loupe);
    const footer = node('div', undefined, 'colour-picker-footer');
    const hoverSwatch = node('span', undefined, 'colour-swatch colour-swatch-lg');
    const hoverText = node('span', currentHex, 'colour-picker-value');
    const pickedLabel = node('span', 'Selected:', 'colour-picker-label');
    const pickedSwatch = node('span', undefined, 'colour-swatch colour-swatch-lg');
    const pickedText = node('span', currentHex, 'colour-picker-value');
    const useButton = node('button', 'Use this colour', 'button button-primary');
    useButton.type = 'button';
    footer.append(hoverSwatch, hoverText, pickedLabel, pickedSwatch, pickedText, useButton);
    panel.append(heading, stage, footer);
    overlay.append(panel);
    document.body.append(overlay);

    let picked = normalizeHex(currentHex) || '#d9c9cf';
    hoverSwatch.style.background = pickedSwatch.style.background = picked;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const finish = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (event) => { if (event.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKey);
    close.addEventListener('click', finish);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(); });
    useButton.addEventListener('click', () => { onPick(picked); finish(); });

    const sample = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
      // Average a small 5×5 area so a single noisy pixel doesn't skew the colour.
      const size = 5;
      const sx = Math.max(0, x - 2);
      const sy = Math.max(0, y - 2);
      const data = ctx.getImageData(sx, sy, Math.min(size, canvas.width - sx), Math.min(size, canvas.height - sy)).data;
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      if (!n) return null;
      return { hex: toHex(Math.round(r / n), Math.round(g / n), Math.round(b / n)), x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { ctx.getImageData(0, 0, 1, 1); } catch {
        finish();
        onError('This photo cannot be sampled. Re-upload the photo, then pick the colour.');
        return;
      }
      canvas.addEventListener('pointermove', (event) => {
        const result = sample(event);
        if (!result) return;
        hoverSwatch.style.background = result.hex;
        hoverText.textContent = result.hex;
        loupe.style.left = `${result.x}px`;
        loupe.style.top = `${result.y}px`;
        loupe.style.background = result.hex;
        loupe.hidden = false;
      });
      canvas.addEventListener('pointerleave', () => { loupe.hidden = true; });
      canvas.addEventListener('click', (event) => {
        const result = sample(event);
        if (!result) return;
        picked = result.hex;
        pickedSwatch.style.background = picked;
        pickedText.textContent = picked;
      });
    };
    img.onerror = () => { finish(); onError('Photo could not load for colour picking.'); };
    img.src = src;
    loupe.hidden = true;
  }
  function addRow(source = {}) {
    const row = { source: { ...source }, image: source.image || source.image_url || '', previewURL: '', file: null };
    const card = node('div', undefined, 'product-colour-row');
    const fields = node('div', undefined, 'field-row');
    const nameLabel = node('label', 'Colour name');
    row.name = node('input');
    row.name.value = String(source.name || '');
    row.name.required = true;
    row.name.maxLength = 60;
    row.name.placeholder = 'Rose';
    nameLabel.append(row.name);
    const hexLabel = node('label', 'Colour', 'colour-value-field');
    row.hex = node('input');
    row.hex.value = String(source.hex || source.value || '#d9c9cf');
    row.hex.required = true;
    row.hex.pattern = '#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
    row.hex.placeholder = '#c93728';
    row.hex.className = 'colour-hex-input';
    // Native colour wheel + a large swatch showing the selected colour.
    const picker = node('input');
    picker.type = 'color';
    picker.className = 'colour-wheel';
    picker.title = 'Choose a colour';
    const swatch = node('span', undefined, 'colour-swatch');
    swatch.setAttribute('aria-hidden', 'true');
    const syncSwatch = () => {
      const hex = normalizeHex(row.hex.value);
      swatch.style.background = hex || 'transparent';
      swatch.title = hex || 'Invalid colour';
      if (hex) picker.value = toSixDigit(hex);
    };
    row.hex.addEventListener('input', syncSwatch);
    picker.addEventListener('input', () => { row.hex.value = picker.value; syncSwatch(); });
    hexLabel.append(row.hex, picker, swatch);
    fields.append(nameLabel, hexLabel);
    const preview = node('div', undefined, 'colour-photo-preview');
    const image = node('img');
    image.alt = 'Colour photo preview';
    const photoNote = node('span');
    preview.append(image, photoNote);
    const uploadLabel = node('label', 'Photo (optional)');
    const input = node('input');
    input.type = 'file';
    input.accept = types.join(',');
    uploadLabel.append(input);
    const actions = node('div', undefined, 'row-actions');
    const clearImage = node('button', 'Remove photo', 'text-button');
    const remove = node('button', 'Remove colour', 'text-button delete-button');
    const pickFromPhoto = node('button', '◉ Pick colour from photo', 'text-button colour-pick-button');
    clearImage.type = remove.type = pickFromPhoto.type = 'button';
    actions.append(clearImage, remove, pickFromPhoto);
    const error = node('p', '', 'colour-upload-error');
    error.setAttribute('role', 'status');
    const renderPhoto = () => {
      if (row.previewURL || row.image) {
        image.src = row.previewURL || resolveImageUrl(row.image);
        image.hidden = false;
        photoNote.textContent = row.file ? `Selected: ${row.file.name}` : 'Current colour photo';
      } else {
        image.removeAttribute('src');
        image.hidden = true;
        photoNote.textContent = 'Choose a colour photo';
      }
      preview.className = `colour-photo-preview${row.previewURL || row.image ? ' has-photo' : ''}`;
      photoNote.title = photoNote.textContent;
      image.title = photoNote.textContent;
      clearImage.disabled = !row.file && !row.image;
      pickFromPhoto.disabled = !row.previewURL && !row.image;
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      error.textContent = '';
      if (file && (!types.includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size)) {
        error.textContent = 'Choose a JPG, PNG, WebP or AVIF image, maximum 5 MB.';
        input.value = '';
        return; // Keep the previous valid image/selection intact.
      }
      revoke(row);
      row.file = file || null;
      if (file) row.previewURL = URL.createObjectURL(file);
      renderPhoto();
    });
    clearImage.addEventListener('click', () => {
      revoke(row);
      row.file = null;
      row.image = '';
      input.value = '';
      error.textContent = '';
      renderPhoto();
    });
    remove.addEventListener('click', () => {
      revoke(row);
      rows = rows.filter((item) => item !== row);
      card.remove();
      update();
    });
    image.addEventListener('error', () => { photoNote.textContent = 'Photo preview could not load. You can upload a replacement.'; });
    const openRowPhotoPicker = () => {
      const src = row.previewURL || resolveImageUrl(row.image);
      if (!src) return;
      openPhotoPicker(src, row.hex.value, (hex) => {
        row.hex.value = hex;
        syncSwatch();
        error.textContent = '';
      }, (message) => { error.textContent = message; });
    };
    pickFromPhoto.addEventListener('click', openRowPhotoPicker);
    preview.addEventListener('click', openRowPhotoPicker);
    card.append(fields, preview, uploadLabel, actions, error);
    rows.push(row);
    list.append(card);
    renderPhoto();
    syncSwatch();
    update();
  }
  add.addEventListener('click', () => { if (rows.length < 8) addRow(); });
  update();
  return {
    setValue(colours, existingCover = '') {
      rows.forEach(revoke);
      rows = [];
      list.replaceChildren();
      // Preserve every existing row, even in older products with >8 colours.
      const entries = (Array.isArray(colours) ? colours : [])
        .filter((colour) => colour && typeof colour === 'object').map((colour) => ({ ...colour }));
      // Bring legacy main-only photos into the editor instead of losing them.
      if (existingCover && !entries.some((colour) => colour.image || colour.image_url)) {
        if (entries.length) entries[0].image = existingCover;
        else entries.push({ name: 'Original', hex: '#d9c9cf', image: existingCover });
      }
      entries.forEach(addRow);
      update();
    },
    snapshot() {
      const names = new Set();
      return rows.map((row) => {
        const name = row.name.value.trim();
        const hex = `#${row.hex.value.trim().replace(/^#/, '')}`;
        if (!name) throw new Error('Enter a name for every colour.');
        if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) throw new Error(`Enter a valid hex colour for ${name}.`);
        if (names.has(name.toLowerCase())) throw new Error(`Colour names must be unique: ${name}.`);
        names.add(name.toLowerCase());
        const data = { ...row.source, name, hex, image: row.image };
        delete data.image_url; // Removing a photo must not restore a legacy URL.
        return { data, file: row.file };
      });
    },
    async upload(snapshot, uploadFile) {
      const colours = [];
      for (const entry of snapshot) {
        colours.push({ ...entry.data, image: entry.file ? await uploadFile(entry.file) : entry.data.image });
      }
      return colours;
    },
    coverImage(colours) {
      const image = colours.find((colour) => colour.image)?.image;
      if (!image) throw new Error('Add at least one colour photo before saving this product.');
      return image;
    },
  };
};
