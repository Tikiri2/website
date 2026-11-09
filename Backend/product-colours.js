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
    const hexLabel = node('label', 'Colour hex');
    row.hex = node('input');
    row.hex.value = String(source.hex || source.value || '#d9c9cf');
    row.hex.required = true;
    row.hex.pattern = '#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
    row.hex.placeholder = '#c93728';
    hexLabel.append(row.hex);
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
    clearImage.type = remove.type = 'button';
    actions.append(clearImage, remove);
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
    card.append(fields, preview, uploadLabel, actions, error);
    rows.push(row);
    list.append(card);
    renderPhoto();
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
