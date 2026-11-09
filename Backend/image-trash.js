window.createImageTrash = (client, setStatus) => {
  const list = document.getElementById('image-trash-list');
  const message = document.getElementById('image-trash-message');
  const countLabel = document.getElementById('image-trash-count');
  const removeShown = document.getElementById('delete-shown-images');
  const previous = document.getElementById('image-trash-prev');
  const next = document.getElementById('image-trash-next');
  const pageLabel = document.getElementById('image-trash-page');
  let page = 0; let generation = 0; let busy = false; let total = 0; let shown = [];
  const pageSize = 25;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function render() {
    list.replaceChildren(...shown.map((photo) => {
      const card = node('article', undefined, 'trash-image-card');
      const image = node('img');
      image.alt = 'Unused product photo';
      image.loading = 'lazy';
      // Always use this project's bucket, never an arbitrary stored URL.
      image.src = client.storage.from('product-images').getPublicUrl(photo.image_path).data.publicUrl;
      const name = node('p', photo.image_path.split('/').pop(), 'trash-image-name');
      name.title = photo.image_path;
      const date = node('small', `Unused since ${new Date(photo.created_at).toLocaleString()}${photo.state === 'deleting' ? '. Cleanup in progress; if interrupted, retry after 10 minutes.' : ''}`);
      const remove = node('button', photo.state === 'deleting' ? 'Retry delete' : 'Delete permanently', 'text-button delete-button');
      remove.type = 'button';
      remove.disabled = busy;
      remove.addEventListener('click', () => removeImages([photo.id]));
      image.addEventListener('error', () => { image.hidden = true; name.textContent = `${photo.image_path.split('/').pop()} (preview unavailable)`; });
      card.append(image, name, date, remove);
      return card;
    }));
    removeShown.disabled = busy || !shown.length;
    previous.disabled = busy || page === 0;
    next.disabled = busy || (page + 1) * pageSize >= total;
  }
  async function load() {
    if (busy) return;
    const token = ++generation;
    message.textContent = 'Loading image trash…';
    list.replaceChildren(); removeShown.disabled = true; previous.disabled = true; next.disabled = true;
    try {
      const { data, count, error } = await client.from('product_image_trash')
        .select('id, image_path, state, created_at', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (token !== generation) return;
      if (error) throw error;
      total = count || 0;
      if (page && page * pageSize >= total) { page = Math.max(0, Math.ceil(total / pageSize) - 1); return load(); }
      shown = data;
      countLabel.textContent = `${total} image${total === 1 ? '' : 's'}`;
      pageLabel.textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(total / pageSize))}`;
      render();
      message.textContent = shown.length ? '' : 'Trash is empty.';
    } catch (error) {
      if (token !== generation) return;
      shown = []; total = 0;
      countLabel.textContent = 'Unavailable'; pageLabel.textContent = '';
      message.textContent = `Could not load image trash: ${error.message}. Apply the product-image-trash migration and deploy delete-product-images first.`;
    }
  }
  async function removeImages(ids) {
    if (busy || !ids.length || !window.confirm(`Permanently delete ${ids.length} unused product image(s)? This cannot be undone. Images still used by a product or homepage will be protected.`)) return;
    const token = generation;
    busy = true;
    render();
    message.textContent = 'Deleting unused images…';
    try {
      const { data, error } = await client.functions.invoke('delete-product-images', { body: { ids } });
      if (token !== generation) return;
      if (error) {
        if (error.context?.status === 404) throw new Error('Deploy the delete-product-images function before deleting images.');
        let detail;
        try { detail = await error.context?.json(); } catch { /* Use the SDK error. */ }
        throw new Error(detail?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);
      busy = false;
      await load();
      setStatus(`${data.deleted} image(s) deleted. ${data.skipped} protected/busy/already removed. ${data.failed} failed. If cleanup was interrupted, wait 10 minutes before retrying.`, data.failed > 0);
    } catch (error) {
      if (token !== generation) return;
      message.textContent = `Could not delete images: ${error.message}`;
    } finally {
      busy = false;
      if (token === generation) render();
    }
  }
  document.getElementById('refresh-image-trash').addEventListener('click', load);
  removeShown.addEventListener('click', () => removeImages(shown.map((photo) => photo.id)));
  previous.addEventListener('click', () => { if (!busy && page) { page--; load(); } });
  next.addEventListener('click', () => { if (!busy && (page + 1) * pageSize < total) { page++; load(); } });
  return {
    load,
    clear() { generation++; shown = []; total = 0; page = 0; list.replaceChildren(); message.textContent = ''; countLabel.textContent = '—'; pageLabel.textContent = ''; removeShown.disabled = true; previous.disabled = true; next.disabled = true; },
  };
};
