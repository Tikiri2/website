// All reads and updates are protected by the CMS-admin RLS policies.
window.createOrdersManager = (client, setStatus, onCount, openOrders = () => {}, onNewCount = () => {}) => {
  const list = document.getElementById('order-list');
  const message = document.getElementById('orders-message');
  const tabs = document.getElementById('order-status-tabs');
  const statusPanel = document.getElementById('order-status-panel');
  const previous = document.getElementById('orders-prev');
  const next = document.getElementById('orders-next');
  const pageLabel = document.getElementById('orders-page');
  const preview = document.getElementById('cms-order-preview');
  const previewImage = document.getElementById('cms-order-image');
  const previewMessage = document.getElementById('cms-order-preview-message');
  const statuses = ['new', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled'];
  const orderTabs = ['all', ...statuses];
  const canonicalStatus = (value) => ({ making: 'processing', shipped: 'shipping' }[value] || value);
  const statusLabel = (value) => {
    if (value === 'all') return 'All orders';
    const canonical = canonicalStatus(value);
    return canonical[0].toUpperCase() + canonical.slice(1);
  };
  const pageSize = 25;
  let page = 0;
  let generation = 0;
  let previewGeneration = 0;
  let total = 0;
  let overviewGeneration = 0;
  let activeStatus = 'new';
  const statusTabs = new Map();
  let overviewAvailable = true;
  let sessionGeneration = 0;
  const money = (value) => `Rs. ${Number(value).toLocaleString('en-LK')}`;
  const formatOrderNo = (orderId, dateValue) => {
    const date = dateValue ? new Date(dateValue) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const yyyy = safeDate.getFullYear();
    const mm = String(safeDate.getMonth() + 1).padStart(2, '0');
    const dd = String(safeDate.getDate()).padStart(2, '0');
    const shortCode = String(orderId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '01';
    return `VN-${yyyy}${mm}${dd}-${shortCode}`;
  };
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  function updateStatusTabs() {
    statusTabs.forEach(({ button }, value) => {
      const active = value === activeStatus;
      button.setAttribute('aria-selected', String(active));
      button.className = `order-status-tab${active ? ' is-active' : ''}`;
      button.tabIndex = active ? 0 : -1;
    });
    statusPanel.setAttribute('aria-labelledby', `order-tab-${activeStatus}`);
  }

  function selectStatus(value, refresh = true) {
    if (!orderTabs.includes(value)) return;
    activeStatus = value;
    page = 0;
    updateStatusTabs();
    if (refresh) return load();
  }

  orderTabs.forEach((value, index) => {
    const button = node('button');
    const count = node('span', '—', 'order-tab-count');
    button.id = `order-tab-${value}`;
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'order-status-panel');
    button.append(node('span', statusLabel(value)), count);
    button.addEventListener('click', () => selectStatus(value));
    button.addEventListener('keydown', (event) => {
      const target = event.key === 'ArrowRight' ? (index + 1) % orderTabs.length
        : event.key === 'ArrowLeft' ? (index + orderTabs.length - 1) % orderTabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? orderTabs.length - 1 : -1;
      if (target < 0) return;
      event.preventDefault();
      statusTabs.get(orderTabs[target]).button.focus();
      selectStatus(orderTabs[target]);
    });
    tabs.append(button);
    statusTabs.set(value, { button, count });
  });
  updateStatusTabs();

  function withStatus(query, value) {
    if (value === 'all') return query;
    const legacy = { processing: 'making', shipping: 'shipped' }[value];
    return legacy ? query.in('status', [value, legacy]) : query.eq('status', value);
  }

  async function getOrderOverview() {
    if (overviewAvailable) {
      const result = await client.rpc('cms_order_overview');
      if (!result.error) return result.data;
      if (!['PGRST202', '42883'].includes(result.error.code)) throw result.error;
      overviewAvailable = false;
    }
    // Older deployments may not have the aggregate RPC yet. Exact HEAD counts
    // still respect the same admin RLS, without downloading customer records.
    const counts = await Promise.all(statuses.map(async (value) => {
      const { count, error } = await withStatus(client.from('orders')
        .select('id', { count: 'exact', head: true }), value);
      if (error) throw error;
      if (count === null || count === undefined) throw new Error('Order counts are unavailable.');
      return [value, count];
    }));
    const data = Object.fromEntries(counts);
    return { ...data, total: counts.reduce((sum, [, count]) => sum + Number(count), 0), order_value: null };
  }

  async function loadTabCounts(token) {
    try {
      const data = await getOrderOverview();
      if (token !== generation) return;
      statusTabs.forEach(({ count }, value) => { count.textContent = String((value === 'all' ? data.total : data[value]) || 0); });
      onNewCount(data.new || 0);
    } catch {
      if (token === generation) {
        statusTabs.forEach(({ count }) => { count.textContent = '—'; });
        onNewCount(null);
      }
    }
  }

  function showCleanup(count) {
    document.getElementById('order-cleanup-notice').hidden = !count;
    document.getElementById('order-cleanup-message').textContent = count
      ? `${count} deleted order image(s) still need storage cleanup. Deleted orders are no longer accessible through their website links; existing direct image URLs may work until cleanup or expiry. Retry cleanup below.` : '';
  }

  async function adminAction(body) {
    const { data, error } = await client.functions.invoke('delete-order', { body });
    if (error) {
      if (error.context?.status === 404) {
        throw new Error('Order deletion is not enabled yet. Deploy the order-management migration and the delete-order function, then refresh the CMS.');
      }
      let detail;
      try { detail = await error.context?.json(); } catch { /* Keep the original error. */ }
      throw new Error(detail?.error || detail?.message || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadCleanup(token) {
    const { count, error } = await client.from('order_image_cleanup').select('id', { count: 'exact', head: true });
    if (token !== generation) return;
    if (error) {
      document.getElementById('order-cleanup-notice').hidden = false;
      document.getElementById('order-cleanup-message').textContent = 'Order deletion/image cleanup is not ready. Apply the order-management migration and deploy the delete-order function, then refresh.';
      return;
    }
    showCleanup(count || 0);
  }

  async function downloadOrderImage(order, orderNo, button) {
    if (!order.image_path) return;
    const originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Downloading…';
    }
    try {
      const { data, error } = await client.storage.from('order-images').createSignedUrl(order.image_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('Could not generate download link.');
      let href = data.signedUrl;
      let objectUrl = '';
      if (typeof window.fetch === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const response = await window.fetch(data.signedUrl);
        if (!response.ok) throw new Error('Could not download order image.');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        href = objectUrl;
      }
      const link = document.createElement('a');
      link.href = href;
      link.download = `venu-order-${orderNo}.png`;
      if (document.body?.append) document.body.append(link);
      if (typeof link.click === 'function') link.click();
      if (typeof link.remove === 'function') link.remove();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      setStatus(`Downloaded order image ${orderNo}.`);
    } catch (error) {
      setStatus(`Could not download image: ${error.message}`, true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function renderOrder(order) {
    const orderNo = formatOrderNo(order.id, order.created_at);
    const createdDate = new Date(order.created_at);
    const formattedDate = Number.isNaN(createdDate.getTime())
      ? ''
      : createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const card = node('details', undefined, 'order-record');
    const summary = node('summary');

    const thumbWrap = node('span', undefined, 'order-thumb-wrap');
    const thumbImg = node('img', undefined, 'order-thumb');
    thumbImg.alt = `${order.product_name} order image`;
    thumbImg.hidden = true;
    const thumbFallback = node('span', '🛍', 'order-thumb-fallback');
    thumbWrap.append(thumbFallback, thumbImg);

    const quickBar = node('span', undefined, 'order-quick-bar');
    const quickStatus = node('select', undefined, `order-status order-quick-status status-${canonicalStatus(order.status)}`);
    quickStatus.setAttribute('aria-label', `Order status for ${orderNo}`);
    statuses.forEach((value) => {
      const option = node('option', statusLabel(value));
      option.value = value;
      quickStatus.append(option);
    });
    quickStatus.value = canonicalStatus(order.status);
    quickStatus.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const quickDownload = node('button', 'Download ↓', 'order-quick-download');
    quickDownload.type = 'button';
    quickDownload.disabled = !order.image_path;
    quickDownload.title = 'Download order card image';
    quickDownload.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadOrderImage(order, orderNo, quickDownload);
    });

    const expandCaret = node('span', '▾', 'order-expand-caret');
    expandCaret.setAttribute('aria-hidden', 'true');
    quickBar.append(quickStatus, quickDownload, expandCaret);

    summary.append(
      node('strong', `${order.product_name} · ${money(order.total)}`),
      node('span', `${orderNo} · ${order.colour} · EU ${order.shoe_size} · ${order.heel_height} cm · ${order.customer_phone}${formattedDate ? ` · ${formattedDate}` : ''}`, 'order-meta'),
      thumbWrap,
      quickBar
    );
    card.append(summary);

    const openPreviewModal = async () => {
      if (!order.image_path) return;
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
        previewMessage.textContent = `Order ${orderNo}. Private preview link expires in 5 minutes.`;
      } catch (error) {
        if (token === previewGeneration) previewMessage.textContent = `Could not load image: ${error.message}`;
      }
    };

    thumbWrap.addEventListener('click', (event) => {
      if (!order.image_path) return;
      event.preventDefault();
      event.stopPropagation();
      openPreviewModal();
    });

    if (typeof Image === 'function' && order.image_path) {
      const loadToken = generation;
      client.storage.from('order-images').createSignedUrl(order.image_path, 300)
        .then(({ data, error }) => {
          if (loadToken !== generation || error || !data?.signedUrl) return;
          thumbImg.addEventListener('load', () => {
            thumbImg.hidden = false;
            thumbFallback.hidden = true;
          });
          thumbImg.src = data.signedUrl;
        })
        .catch(() => {});
    }

    const body = node('div', undefined, 'order-record-body');
    body.append(node('p', `Order No: ${orderNo} (ID: ${order.id})`),
      node('p', `Colour: ${order.colour} · EU size: ${order.shoe_size} · Heel: ${order.heel_height} cm`),
      node('p', `Product: ${money(order.product_price)} · Courier: ${money(order.courier_fee)} · Total: ${money(order.total)}`));
    const actions = node('div', undefined, 'row-actions');
    const contact = node('a', 'Customer WhatsApp ↗', 'text-button');
    const phone = `94${order.customer_phone.slice(1)}`;
    contact.href = `https://wa.me/${phone}?text=${encodeURIComponent(`Hello! Regarding your VENU Shoues order ${orderNo} (${order.product_name}):`)}`;
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    const view = node('button', 'View order image', 'text-button');
    view.type = 'button';
    view.disabled = !order.image_path;
    view.addEventListener('click', openPreviewModal);
    const remove = node('button', order.status === 'completed' ? 'Delete completed order' : 'Delete order', 'text-button delete-button');
    remove.type = 'button';
    const downloadAction = node('button', 'Download image ↓', 'text-button');
    downloadAction.type = 'button';
    downloadAction.disabled = !order.image_path;
    downloadAction.addEventListener('click', () => downloadOrderImage(order, orderNo, downloadAction));
    actions.append(view, contact, remove, downloadAction);
    body.append(actions);
    if (!order.image_path) body.append(node('p', 'Image upload incomplete. The order details are saved; the customer can retry the same submission.'));
    const form = node('form', undefined, 'stack');
    const statusField = node('label', 'Order status');
    const status = node('select');
    statuses.forEach((value) => {
      const option = node('option', value[0].toUpperCase() + value.slice(1));
      option.value = value;
      status.append(option);
    });
    status.value = canonicalStatus(order.status);
    statusField.append(status);
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
    form.append(statusField, notesLabel, save, feedback);
    let busy = false;
    const setBusy = (value) => {
      busy = value;
      save.disabled = value; remove.disabled = value; status.disabled = value; notes.disabled = value; quickStatus.disabled = value;
    };
    async function saveOrderUpdate(submittedStatus, submittedNotes) {
      if (busy) return;
      setBusy(true);
      feedback.textContent = 'Saving…';
      const token = generation;
      const sessionToken = sessionGeneration;
      try {
        const write = (storedStatus) => client.from('orders').update({ status: storedStatus, admin_notes: submittedNotes })
          .eq('id', order.id).eq('updated_at', order.updated_at).select('id, status, updated_at');
        let result = await write(submittedStatus);
        if (sessionToken !== sessionGeneration) return;
        const legacyStatus = { processing: 'making', shipping: 'shipped' }[submittedStatus];
        if (legacyStatus && result.error?.code === '23514' && result.error.message?.includes('orders_status_check')) {
          // Compatibility with the original schema. The rejected first write is
          // atomic; keep the timestamp guard on the retry to protect newer edits.
          result = await write(legacyStatus);
        }
        const { data, error } = result;
        if (sessionToken !== sessionGeneration) return;
        if (error) throw error;
        if (!data?.length) throw new Error('This order changed in another session. Refresh before saving.');
        if (canonicalStatus(data[0].status) !== submittedStatus) throw new Error('The server did not confirm the selected status. Refresh and check this order before retrying.');
        order.updated_at = data[0].updated_at;
        order.status = canonicalStatus(data[0].status);
        order.admin_notes = submittedNotes;
        status.value = order.status;
        quickStatus.value = order.status;
        quickStatus.className = `order-status order-quick-status status-${order.status}`;
        feedback.textContent = 'Order saved.';
        // A tab switch while the PATCH is in flight must not hide a successful
        // save or leave a previously loaded Completed tab showing stale data.
        if (token === generation && activeStatus !== 'all' && order.status !== activeStatus) await selectStatus(order.status);
        else await load();
        if (sessionToken === sessionGeneration) setStatus(`Order saved as ${statusLabel(order.status)}.`);
      } catch (error) {
        if (sessionToken !== sessionGeneration) return;
        quickStatus.value = canonicalStatus(order.status);
        const text = `Could not save: ${error.message}`;
        if (token === generation) feedback.textContent = text;
        setStatus(text, true);
      } finally {
        setBusy(false);
      }
    }
    quickStatus.addEventListener('change', () => {
      saveOrderUpdate(quickStatus.value, notes.value);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await saveOrderUpdate(status.value, notes.value);
    });
    remove.addEventListener('click', async () => {
      if (busy || !window.confirm(`Permanently delete order ${order.id.slice(0, 8)} for ${order.customer_phone}?\n\nIts details, notes and image will be removed. This cannot be undone. To keep a record, use Cancelled instead.`)) return;
      const token = generation;
      setBusy(true);
      feedback.textContent = 'Deleting order and image…';
      try {
        const result = await adminAction({ action: 'delete', id: order.id, updated_at: order.updated_at });
        if (token !== generation) return;
        await load();
        showCleanup(result.cleanup_pending || 0);
        setStatus(result.cleanup_pending ? 'Order deleted. Image cleanup is pending; retry it in the Orders panel.' : 'Order and image deleted.');
      } catch (error) {
        if (token === generation) feedback.textContent = `Could not delete: ${error.message}`;
      } finally {
        setBusy(false);
      }
    });
    body.append(form);
    card.append(body);
    return card;
  }

  async function load() {
    const token = ++generation;
    statusTabs.forEach(({ count }) => { count.textContent = '…'; });
    loadTabCounts(token);
    loadCleanup(token).catch(() => {
      if (token === generation) {
        document.getElementById('order-cleanup-notice').hidden = false;
        document.getElementById('order-cleanup-message').textContent = 'Could not check pending image cleanup. Please refresh.';
      }
    });
    message.textContent = 'Loading orders…';
    list.replaceChildren();
    previous.disabled = true;
    next.disabled = true;
    try {
      let query = client.from('orders').select('id, product_name, colour, shoe_size, heel_height, customer_phone, product_price, courier_fee, total, image_path, status, admin_notes, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false });
      query = withStatus(query, activeStatus);
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
      message.textContent = data.length ? '' : activeStatus === 'all' ? 'No orders.' : `No ${statusLabel(activeStatus).toLowerCase()} orders.`;
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
  async function loadDashboard() {
    const token = ++overviewGeneration;
    const dashboardMessage = document.getElementById('dashboard-message');
    dashboardMessage.textContent = 'Loading your store overview…';
    document.getElementById('dashboard-orders').textContent = '—';
    document.getElementById('dashboard-value').textContent = '—';
    document.getElementById('dashboard-pipeline').replaceChildren();
    document.getElementById('dashboard-recent-orders').replaceChildren();
    try {
      const [overview, recent] = await Promise.all([
        getOrderOverview(),
        client.from('orders').select('id, product_name, status, total, customer_phone, created_at')
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5),
      ]);
      if (token !== overviewGeneration) return;
      if (recent.error) throw recent.error;
      document.getElementById('dashboard-orders').textContent = String(overview.total);
      document.getElementById('dashboard-value').textContent = overview.order_value === null ? '—' : money(overview.order_value);
      onNewCount(overview.new || 0);
      document.getElementById('dashboard-pipeline').replaceChildren(...statuses.map((value) => {
        const button = node('button', undefined, 'pipeline-button');
        button.type = 'button';
        button.append(node('strong', String(overview[value] || 0)), node('span', statusLabel(value)));
        button.addEventListener('click', () => { selectStatus(value, false); openOrders(); });
        return button;
      }));
      const rows = (recent.data || []).map((order) => {
        const row = node('div', undefined, 'recent-order');
        row.append(node('strong', order.product_name), node('span', statusLabel(order.status), `order-status status-${canonicalStatus(order.status)}`),
          node('small', `${formatOrderNo(order.id, order.created_at)} · ${order.customer_phone}`), node('small', money(order.total)));
        return row;
      });
      document.getElementById('dashboard-recent-orders').replaceChildren(...(rows.length ? rows : [node('p', 'No orders yet. New submissions will appear here.')]));
      dashboardMessage.textContent = '';
    } catch (error) {
      if (token === overviewGeneration) {
        onNewCount(null);
        dashboardMessage.textContent = `Could not load the dashboard: ${error.message}. Apply the order-management migration if needed.`;
      }
    }
  }
  document.getElementById('refresh-dashboard').addEventListener('click', loadDashboard);
  document.getElementById('retry-order-cleanup').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const token = generation;
    button.disabled = true;
    try {
      const result = await adminAction({ action: 'cleanup' });
      if (token === generation) {
        showCleanup(result.cleanup_pending || 0);
        setStatus(result.cleanup_pending ? 'Some images still need cleanup. Please retry later.' : 'Deleted order images cleaned up.');
      }
    } catch (error) {
      if (token === generation) document.getElementById('order-cleanup-message').textContent = `Cleanup failed: ${error.message}`;
    } finally { button.disabled = false; }
  });
  document.getElementById('refresh-orders').addEventListener('click', () => load());
  previous.addEventListener('click', () => { if (page > 0) { page--; load(); } });
  next.addEventListener('click', () => { if ((page + 1) * pageSize < total) { page++; load(); } });
  document.getElementById('close-cms-order-preview').addEventListener('click', () => preview.close());
  preview.addEventListener('close', () => { previewGeneration++; previewImage.removeAttribute('src'); });
  previewImage.addEventListener('error', () => { previewMessage.textContent = 'Image could not load. Close this preview and try again.'; });
  return {
    load,
    selectStatus,
    loadDashboard,
    clear() {
      sessionGeneration++;
      generation++;
      overviewGeneration++;
      previewGeneration++;
      list.replaceChildren();
      preview.close();
      previewImage.removeAttribute('src');
      message.textContent = '';
      document.getElementById('dashboard-pipeline').replaceChildren();
      document.getElementById('dashboard-recent-orders').replaceChildren();
      document.getElementById('dashboard-message').textContent = '';
      document.getElementById('dashboard-orders').textContent = '—';
      document.getElementById('dashboard-value').textContent = '—';
      showCleanup(0);
      selectStatus('new', false);
      statusTabs.forEach(({ count }) => { count.textContent = '—'; });
      page = 0;
      onCount(0);
      onNewCount(null);
    },
  };
};
