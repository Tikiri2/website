// All reads and updates are protected by the CMS-admin RLS policies.
window.createOrdersManager = (client, setStatus, onCount) => {
  const list = document.getElementById('order-list');
  const message = document.getElementById('orders-message');
  const filter = document.getElementById('order-status-filter');
  const search = document.getElementById('order-search');
  const previous = document.getElementById('orders-prev');
  const next = document.getElementById('orders-next');
  const pageLabel = document.getElementById('orders-page');
  const preview = document.getElementById('cms-order-preview');
  const previewImage = document.getElementById('cms-order-image');
  const previewMessage = document.getElementById('cms-order-preview-message');
  const statuses = ['new', 'confirmed', 'making', 'shipped', 'completed', 'cancelled'];
  const pageSize = 25;
  let page = 0;
  let generation = 0;
  let previewGeneration = 0;
  let total = 0;
  const money = (value) => `Rs. ${Number(value).toLocaleString('en-LK')}`;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  function renderOrder(order) {
    const card = node('details', undefined, 'order-record');
    const summary = node('summary');
    summary.append(node('strong', `${order.product_name} · ${money(order.total)}`),
      node('span', `${order.status.toUpperCase()} · ${order.customer_phone} · ${new Date(order.created_at).toLocaleString()}`));
    card.append(summary);
    const body = node('div', undefined, 'order-record-body');
    body.append(node('p', `Order reference: ${order.id}`),
      node('p', `Colour: ${order.colour} · EU size: ${order.shoe_size} · Heel: ${order.heel_height} cm`),
      node('p', `Product: ${money(order.product_price)} · Courier: ${money(order.courier_fee)} · Total: ${money(order.total)}`));
    const actions = node('div', undefined, 'row-actions');
    const contact = node('a', 'Customer WhatsApp ↗', 'text-button');
    const phone = `94${order.customer_phone.slice(1)}`;
    contact.href = `https://wa.me/${phone}?text=${encodeURIComponent(`Hi, about your VENU Shoues order ${order.id}: ${order.product_name}.`)}`;
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    const view = node('button', 'View order image', 'text-button');
    view.type = 'button';
    view.disabled = !order.image_path;
    view.addEventListener('click', async () => {
      const token = ++previewGeneration;
      previewImage.removeAttribute('src');
      previewImage.hidden = true;
      previewMessage.textContent = 'Loading private order image…';
      preview.showModal();
      try {
        const { data, error } = await client.storage.from('order-images').createSignedUrl(order.image_path, 300);
        if (token !== previewGeneration) return;
        if (error) throw error;
        previewImage.src = data.signedUrl;
        previewImage.hidden = false;
        previewMessage.textContent = `Order ${order.id}. Private preview link expires in 5 minutes.`;
      } catch (error) {
        if (token === previewGeneration) previewMessage.textContent = `Could not load image: ${error.message}`;
      }
    });
    actions.append(view, contact);
    body.append(actions);
    if (!order.image_path) body.append(node('p', 'Image upload incomplete. The order details are saved; the customer can retry the same submission.'));
    const form = node('form', undefined, 'stack');
    const statusLabel = node('label', 'Order status');
    const status = node('select');
    statuses.forEach((value) => {
      const option = node('option', value[0].toUpperCase() + value.slice(1));
      option.value = value;
      status.append(option);
    });
    status.value = order.status;
    statusLabel.append(status);
    const notesLabel = node('label', 'Internal notes (CMS only)');
    const notes = node('textarea');
    notes.value = order.admin_notes;
    notes.maxLength = 4000;
    notes.rows = 3;
    notesLabel.append(notes);
    const save = node('button', 'Save order', 'button button-primary');
    save.type = 'submit';
    const feedback = node('p');
    feedback.setAttribute('role', 'status');
    form.append(statusLabel, notesLabel, save, feedback);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      feedback.textContent = 'Saving…';
      const token = generation;
      try {
        const { data, error } = await client.from('orders').update({ status: status.value, admin_notes: notes.value })
          .eq('id', order.id).eq('updated_at', order.updated_at).select('updated_at');
        if (token !== generation) return;
        if (error) throw error;
        if (!data.length) throw new Error('This order changed in another session. Refresh before saving.');
        order.updated_at = data[0].updated_at;
        order.status = status.value;
        summary.lastChild.textContent = `${order.status.toUpperCase()} · ${order.customer_phone} · ${new Date(order.created_at).toLocaleString()}`;
        feedback.textContent = 'Order saved.';
      } catch (error) {
        if (token === generation) feedback.textContent = `Could not save: ${error.message}`;
      } finally {
        save.disabled = false;
      }
    });
    body.append(form);
    card.append(body);
    return card;
  }

  async function load() {
    const token = ++generation;
    message.textContent = 'Loading orders…';
    list.replaceChildren();
    previous.disabled = true;
    next.disabled = true;
    try {
      let query = client.from('orders').select('id, product_name, colour, shoe_size, heel_height, customer_phone, product_price, courier_fee, total, image_path, status, admin_notes, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false });
      if (filter.value) query = query.eq('status', filter.value);
      const digits = search.value.replace(/\D/g, '');
      if (search.value.trim() && !digits) throw new Error('Enter a customer phone number to search.');
      if (digits) query = query.ilike('customer_phone', `%${digits}%`);
      const { data, count, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      if (token !== generation) return;
      if (error) throw error;
      total = count || 0;
      onCount(total);
      if (page > 0 && page * pageSize >= total) {
        page = Math.max(0, Math.ceil(total / pageSize) - 1);
        return load();
      }
      list.replaceChildren(...data.map(renderOrder));
      message.textContent = data.length ? `${total} matching order${total === 1 ? '' : 's'}.` : 'No orders found.';
      pageLabel.textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(total / pageSize))}`;
      previous.disabled = page === 0;
      next.disabled = (page + 1) * pageSize >= total;
    } catch (error) {
      if (token !== generation) return;
      onCount(0);
      pageLabel.textContent = '';
      message.textContent = `Could not load orders: ${error.message}. Check that the orders migration has been applied.`;
      setStatus('Could not load orders. See the Orders panel for details.', true);
    }
  }
  document.getElementById('order-filters').addEventListener('submit', (event) => {
    event.preventDefault(); page = 0; load();
  });
  document.getElementById('refresh-orders').addEventListener('click', () => load());
  previous.addEventListener('click', () => { if (page > 0) { page--; load(); } });
  next.addEventListener('click', () => { if ((page + 1) * pageSize < total) { page++; load(); } });
  document.getElementById('close-cms-order-preview').addEventListener('click', () => preview.close());
  preview.addEventListener('close', () => { previewGeneration++; previewImage.removeAttribute('src'); });
  previewImage.addEventListener('error', () => { previewMessage.textContent = 'Image could not load. Close this preview and try again.'; });
  return {
    load,
    clear() {
      generation++;
      previewGeneration++;
      list.replaceChildren();
      preview.close();
      previewImage.removeAttribute('src');
      message.textContent = '';
      page = 0;
      onCount(0);
    },
  };
};
