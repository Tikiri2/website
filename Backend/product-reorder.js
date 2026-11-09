// Reuse existing product update permissions; no new database function is needed.
window.persistProductOrder = async (client, products) => {
  const saved = [];
  for (const [index, product] of products.entries()) {
    const displayOrder = index + 1;
    if (product.display_order !== displayOrder) {
      const { data, error } = await client.from('products').update({ display_order: displayOrder })
        .eq('id', product.id).eq('display_order', product.display_order).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('The inventory changed in another session. Refresh before reordering.');
    }
    saved.push({ ...product, display_order: displayOrder });
  }
  return saved;
};

window.createProductReorder = ({ render, persist, onSaved, onError, onBusy }) => {
  let products = [];
  let draggedId = null;
  let busy = false;
  let session = 0;
  const markers = new Set();
  const clearMarkers = () => { markers.forEach((row) => row.classList.remove('drop-before', 'drop-after')); markers.clear(); };

  async function move(id, targetId, after) {
    if (busy || id === targetId) return;
    const previous = products;
    const from = previous.findIndex((item) => item.id === id);
    if (from < 0 || !previous.some((item) => item.id === targetId)) return;
    const next = [...previous];
    const [item] = next.splice(from, 1);
    next.splice(next.findIndex((entry) => entry.id === targetId) + (after ? 1 : 0), 0, item);
    if (next.every((entry, index) => entry.id === previous[index].id)) return;
    const token = session;
    products = next;
    busy = true;
    onBusy(true);
    render(products);
    try {
      const saved = await persist(next, previous);
      if (token !== session) return;
      products = saved;
      onSaved();
    } catch (error) {
      if (token === session) await onError(error);
    } finally {
      busy = false;
      if (token === session) {
        onBusy(false);
        render(products);
      }
    }
  }

  return {
    get busy() { return busy; },
    setProducts(items) { products = items; },
    clear() { session++; products = []; draggedId = null; clearMarkers(); onBusy(false); },
    decorate(row, product) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'product-drag-handle';
      handle.textContent = '⠿';
      handle.draggable = !busy;
      handle.disabled = busy;
      handle.title = 'Drag to reorder. You can also use the up/down arrow keys.';
      handle.setAttribute('aria-label', `Reorder ${product.name}`);
      handle.addEventListener('dragstart', (event) => {
        if (busy) { event.preventDefault(); return; }
        draggedId = product.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', product.id);
        event.dataTransfer.setDragImage?.(row, 20, 20);
        row.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => { draggedId = null; clearMarkers(); row.classList.remove('is-dragging'); });
      row.addEventListener('dragover', (event) => {
        if (busy || !draggedId || draggedId === product.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        clearMarkers();
        const bounds = row.getBoundingClientRect();
        row.classList.add(event.clientY >= bounds.top + bounds.height / 2 ? 'drop-after' : 'drop-before');
        markers.add(row);
      });
      row.addEventListener('drop', (event) => {
        if (busy || !draggedId) return;
        event.preventDefault();
        const id = draggedId;
        draggedId = null;
        clearMarkers();
        const bounds = row.getBoundingClientRect();
        return move(id, product.id, event.clientY >= bounds.top + bounds.height / 2);
      });
      handle.addEventListener('keydown', async (event) => {
        if (busy || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const index = products.findIndex((item) => item.id === product.id);
        const target = products[index + (event.key === 'ArrowUp' ? -1 : 1)];
        if (!target) return;
        await move(product.id, target.id, event.key === 'ArrowDown');
        if (tokenSession === session) document.getElementById(`product-handle-${product.id}`)?.focus();
      });
      const tokenSession = session;
      handle.id = `product-handle-${product.id}`;
      row.prepend(handle);
    },
  };
};
