/* ═══════════════════════════════════════
   FLEXORA — Products List JS v2.0
   Real API integration
═══════════════════════════════════════ */
'use strict';

/* ── Config ── */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'https://fitverseapp.runasp.net';

function authHeaders() {
  const token = localStorage.getItem('flexora_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* ── State ── */
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let totalItems = 0;
let selectedIds = new Set();
let searchTimer = null;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  loadSubcategories();
  loadProducts();
  initFilters();
  initSelectAll();
  loadNotifCount();
  loadUserInfo();
  document.getElementById('refreshBtn')?.addEventListener('click', () => loadProducts(true));
});

/* ══════════════════════════════════════
   API CALLS
══════════════════════════════════════ */
async function loadProducts(showRefreshToast = false) {
  setTableLoading(true);

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const categoryId = document.getElementById('filterCategory')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const sort = document.getElementById('filterSort')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    pageSize: pageSize,
    ...(search && { search }),
    ...(categoryId && { categoryId }),
    ...(status && { status }),
    ...(sort && { sort }),
  });

  try {
    const res = await fetch(`${API_BASE}/Products/GetProducts?${params}`, {
      headers: authHeaders()
    });

    if (res.status === 401) { showToast('error', 'Unauthorized — please log in'); setTableLoading(false); return; }
    if (!res.ok) { throw new Error(`HTTP ${res.status}`); }

    const data = await res.json();
    /* Shape: { items, totalItems, currentPage, pageSize, totalPages } */

    totalPages = data.totalPages || 1;
    totalItems = data.totalItems || 0;
    currentPage = data.currentPage || 1;

    renderStats(data);
    renderTable(data.items || []);
    renderPagination();

    document.getElementById('productCount').textContent =
      `${totalItems.toLocaleString()} product${totalItems !== 1 ? 's' : ''}`;

    if (showRefreshToast) showToast('success', 'Products refreshed');

  } catch (err) {
    console.error('[Flexora Products]', err);
    showTableError('Failed to load products. Check your connection.');
  } finally {
    setTableLoading(false);
  }
}

async function loadSubcategories() {
  try {
    const res = await fetch(`${API_BASE}/Products/allsubcategories`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json(); /* [{ id, name }] */

    const sel = document.getElementById('filterCategory');
    if (!sel) return;

    sel.innerHTML = '<option value="">All Categories</option>' +
      data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  } catch (err) {
    console.warn('[Flexora] Could not load subcategories:', err);
  }
}

/* ══════════════════════════════════════
   STATS ROW  (derived from pagination meta)
══════════════════════════════════════ */
function renderStats(data) {
  /* totalItems comes from the API — the rest we derive from current page items */
  const items = data.items || [];
  const pageStock = items.reduce((s, p) => s + (p.totalStock || 0), 0);
  const pageVariants = items.reduce((s, p) => s + (p.variantsCount || 0), 0);
  const lowCount = items.filter(p => p.totalStock > 0 && p.totalStock < 20).length;

  document.getElementById('statTotal')?.setAttribute('data-value', data.totalItems);
  animateCount('statTotal', data.totalItems);
  animateCount('statVariants', pageVariants);
  animateCount('statStock', pageStock);
  animateCount('statLowStock', lowCount);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  const dur = 600;
  const step = 16;
  const inc = (target - start) / (dur / step);
  let cur = start;
  const t = setInterval(() => {
    cur += inc;
    if ((inc > 0 && cur >= target) || (inc < 0 && cur <= target)) {
      el.textContent = target.toLocaleString();
      clearInterval(t);
    } else {
      el.textContent = Math.round(cur).toLocaleString();
    }
  }, step);
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderTable(items) {
  const tbody = document.getElementById('productsTableBody');
  const empty = document.getElementById('emptyState');
  const pgWrap = document.getElementById('paginationWrap');

  if (!items.length) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    pgWrap.style.display = 'none';
    return;
  }

  empty.classList.add('d-none');
  pgWrap.style.display = 'flex';

  tbody.innerHTML = items.map(p => {
    /* Derive status from API fields */
    const statusKey = getStatusKey(p);
    const statusHtml = getStatusBadge(statusKey);
    const stockClass = p.totalStock === 0 ? 'stock-low' : p.totalStock < 20 ? 'stock-medium' : 'stock-high';
    const stockPct = Math.min(100, (p.totalStock / 500) * 100);
    const checked = selectedIds.has(p.productId) ? 'checked' : '';
    const imgSrc = p.mainImage ? `${IMAGE_BASE}${p.mainImage}` : '';

    return `
    <tr>
      <td><input type="checkbox" class="prod-check row-check" data-id="${p.productId}" ${checked}/></td>
      <td>
        <div class="product-cell">
          ${imgSrc
        ? `<img src="${imgSrc}" class="product-thumb" alt="${p.productName}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
               <div class="product-thumb-placeholder" style="display:none"><i class="bi bi-bag-heart"></i></div>`
        : `<div class="product-thumb-placeholder"><i class="bi bi-bag-heart"></i></div>`
      }
          <div>
            <div class="product-name">${p.productName}</div>
            <div class="product-id">#FLX-${String(p.productId).padStart(4, '0')}</div>
          </div>
        </div>
      </td>
      <td><span class="category-pill"><i class="bi bi-tag me-1"></i>${p.categoryName || '—'}</span></td>
      <td>
        <div class="variant-count">
          <div class="vc-badge">${p.variantsCount}</div>
          <span style="font-size:.78rem;color:var(--text-muted)">${p.variantsCount} variant${p.variantsCount !== 1 ? 's' : ''}</span>
        </div>
      </td>
      <td>
        <span class="price-cell">
          <span class="price-from">from</span>
          ${fmtCurrency(p.basePrice)}
        </span>
      </td>
      <td>
        <div class="stock-cell ${stockClass}">
          <span class="stock-num">
            ${p.totalStock === 0
        ? '<span style="color:var(--rose-500);font-weight:600">Out of stock</span>'
        : p.totalStock.toLocaleString()}
          </span>
          <div class="stock-bar"><div class="stock-bar-fill" style="width:${stockPct}%"></div></div>
        </div>
      </td>
      <td>${statusHtml}</td>
      <td>
        <div class="action-btns">
          <button class="btn-ghost btn-sm btn-icon" title="Edit"
                  onclick="editProduct(${p.productId})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-ghost btn-sm btn-icon" title="View">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn-danger btn-sm btn-icon" title="Delete"
                  onclick="confirmDelete(${p.productId}, \`${escHtml(p.productName)}\`)">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  /* Re-attach row checkbox listeners */
  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', function () {
      const id = parseInt(this.dataset.id);
      this.checked ? selectedIds.add(id) : selectedIds.delete(id);
      updateBulkBar();
    });
  });
}

/* ── Status helpers ── */
function getStatusKey(p) {
  if (!p.isActive) return 'archived';
  if (p.totalStock === 0) return 'outofstock';
  if (p.totalStock < 20) return 'lowstock';
  return 'active';
}

function getStatusBadge(key) {
  const map = {
    active: ['status-active', 'Active'],
    lowstock: ['status-pending', 'Low Stock'],
    outofstock: ['status-cancelled', 'Out of Stock'],
    archived: ['status-archived', 'Archived'],
  };
  const [cls, label] = map[key] || ['status-archived', 'Unknown'];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

/* ══════════════════════════════════════
   PAGINATION
══════════════════════════════════════ */
function renderPagination() {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  document.getElementById('pageInfo').textContent =
    `Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${totalItems.toLocaleString()}`;

  const container = document.getElementById('paginationBtns');
  container.innerHTML = '';

  /* Prev */
  const prev = mkPgBtn('<i class="bi bi-chevron-left"></i>', currentPage === 1, () => {
    currentPage--; loadProducts();
  });
  container.appendChild(prev);

  /* Page numbers with ellipsis */
  const range = buildPageRange(currentPage, totalPages);
  range.forEach(item => {
    if (item === '…') {
      const dots = mkPgBtn('…', true);
      container.appendChild(dots);
    } else {
      const btn = mkPgBtn(item, false, () => { currentPage = item; loadProducts(); });
      if (item === currentPage) btn.classList.add('active');
      container.appendChild(btn);
    }
  });

  /* Next */
  const next = mkPgBtn('<i class="bi bi-chevron-right"></i>', currentPage === totalPages, () => {
    currentPage++; loadProducts();
  });
  container.appendChild(next);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function mkPgBtn(html, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pg-btn';
  btn.innerHTML = html;
  btn.disabled = disabled;
  if (onClick && !disabled) btn.addEventListener('click', onClick);
  return btn;
}

/* ══════════════════════════════════════
   FILTERS  (debounced search, instant selects)
══════════════════════════════════════ */
function initFilters() {
  /* Debounce text search */
  document.getElementById('searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadProducts(); }, 420);
  });

  /* Instant for selects */
  ['filterCategory', 'filterStatus', 'filterSort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      currentPage = 1; loadProducts();
    });
  });

  /* Clear button */
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSort').value = '';
    currentPage = 1;
    loadProducts();
  });
}

/* ══════════════════════════════════════
   SELECT ALL / BULK BAR
══════════════════════════════════════ */
function initSelectAll() {
  document.getElementById('selectAll')?.addEventListener('change', function () {
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = this.checked;
      const id = parseInt(cb.dataset.id);
      this.checked ? selectedIds.add(id) : selectedIds.delete(id);
    });
    updateBulkBar();
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const cnt = document.getElementById('bulkCount');
  if (selectedIds.size > 0) {
    bar.classList.add('show');
    cnt.textContent = `${selectedIds.size} selected`;
  } else {
    bar.classList.remove('show');
  }
}

/* ══════════════════════════════════════
   ACTIONS
══════════════════════════════════════ */
function editProduct(id) {
  localStorage.setItem('flexora_edit_product_id', id);
  window.location.href = 'products-edit.html';
}

/* ──────────────────────────────────────
   DELETE FLOW
   Step 1: confirmDelete()  → show confirm modal
   Step 2: attemptDelete()  → normal DELETE request
   Step 3 (if blocked):     → show blocked modal
   Step 4 (force):          → forceDeleteProduct()
────────────────────────────────────────── */

let _deleteInProgress = false;   // prevent double-clicks

function confirmDelete(id, name) {
  /* Show normal confirm modal first */
  document.getElementById('deleteProductName').textContent = name;

  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-trash me-1"></i> Delete';
  btn.onclick = () => attemptDelete(id, name);

  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function attemptDelete(id, name) {
  if (_deleteInProgress) return;
  _deleteInProgress = true;

  /* Loading state on confirm btn */
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting…';

  try {
    const res = await fetch(`${API_BASE}/Products/DeleteProduct/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    /* 401 → redirect to login */
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    const data = await res.json().catch(() => ({}));

    /* ── SUCCESS ── */
    if (data.success) {
      /* Close confirm modal */
      bootstrap.Modal.getInstance(document.getElementById('deleteModal'))?.hide();

      /* Remove row immediately */
      removeProductRow(id);
      selectedIds.delete(id);
      updateBulkBar();
      showToast('success', `"${name}" deleted successfully`);
      return;
    }

    /* ── BLOCKED ── */
    if (data.canForceDelete !== undefined) {
      bootstrap.Modal.getInstance(document.getElementById('deleteModal'))?.hide();
      showBlockedModal(id, name, data);
      return;
    }

    /* ── OTHER API ERROR ── */
    showToast('error', data.message || 'Failed to delete product');

  } catch (err) {
    console.error('[Flexora] deleteProduct:', err);
    showToast('error', 'Failed to delete product');
  } finally {
    _deleteInProgress = false;
    const b = document.getElementById('confirmDeleteBtn');
    if (b) { b.disabled = false; b.innerHTML = '<i class="bi bi-trash me-1"></i> Delete'; }
  }
}

/* ── Show blocked modal with correct content ── */
function showBlockedModal(id, name, data) {
  const blockingTables = data.blockingTables || [];
  const hasOrders = blockingTables.map(t => t.toLowerCase()).includes('orders');

  /* Icon */
  const iconEl = document.getElementById('blockedModalIcon');
  iconEl.style.background = hasOrders ? 'var(--rose-100)' : 'var(--gold-100)';
  iconEl.style.color = hasOrders ? 'var(--rose-500)' : 'var(--gold-500)';
  iconEl.innerHTML = hasOrders
    ? '<i class="bi bi-exclamation-triangle-fill"></i>'
    : '<i class="bi bi-link-45deg"></i>';

  /* Title */
  document.getElementById('blockedModalTitle').textContent = hasOrders
    ? 'Cannot Delete Product'
    : 'Product Has Linked Data';

  /* Message */
  document.getElementById('blockedModalMsg').textContent = hasOrders
    ? 'This product exists in customer orders and cannot be permanently deleted.'
    : `"${name}" is linked to other data. Force deleting will remove all associations.`;

  /* Blocking tables pills */
  const tablesWrap = document.getElementById('blockedTablesWrap');
  const tablesList = document.getElementById('blockedTablesList');

  if (blockingTables.length) {
    tablesWrap.classList.remove('d-none');
    tablesList.innerHTML = blockingTables.map(t => `
      <span style="
        display:inline-flex;align-items:center;gap:5px;
        padding:4px 12px;border-radius:999px;font-size:.75rem;font-weight:600;
        background:${t.toLowerCase() === 'orders' ? 'var(--rose-100)' : 'var(--gold-100)'};
        color:${t.toLowerCase() === 'orders' ? 'var(--rose-500)' : 'var(--gold-500)'};
        border:1px solid ${t.toLowerCase() === 'orders' ? 'var(--rose-400)' : 'var(--gold-400)'}">
        <i class="bi bi-${t.toLowerCase() === 'orders' ? 'receipt' : 'link'}"></i>
        ${t}
      </span>`).join('');
  } else {
    tablesWrap.classList.add('d-none');
  }

  /* Action buttons */
  const actionsEl = document.getElementById('blockedModalActions');

  if (hasOrders) {
    /* Orders blocking → NO force delete */
    actionsEl.innerHTML = `
      <button class="btn-ghost" data-bs-dismiss="modal">
        <i class="bi bi-x me-1"></i> Close
      </button>`;
  } else {
    /* Other tables blocking → show force delete */
    actionsEl.innerHTML = `
      <button class="btn-ghost" data-bs-dismiss="modal">
        <i class="bi bi-x me-1"></i> Cancel
      </button>
      <button id="forceDeleteBtn"
        style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;
               background:var(--rose-500);color:#fff;border:none;border-radius:10px;
               font-size:.84rem;font-weight:600;font-family:'DM Sans',sans-serif;
               cursor:pointer;transition:all .22s"
        onclick="forceDeleteProduct(${id}, '${escHtml(name)}')">
        <i class="bi bi-lightning-charge-fill"></i> Force Delete
      </button>`;
  }

  new bootstrap.Modal(document.getElementById('blockedDeleteModal')).show();
}

/* ── Force Delete ── */
async function forceDeleteProduct(id, name) {
  if (_deleteInProgress) return;
  _deleteInProgress = true;

  const btn = document.getElementById('forceDeleteBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting…'; }

  try {
    const res = await fetch(`${API_BASE}/Products/DeleteProduct/${id}?forceDelete=true`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById('blockedDeleteModal'))?.hide();
      removeProductRow(id);
      selectedIds.delete(id);
      updateBulkBar();
      showToast('success', `"${name}" force deleted successfully`);
    } else {
      showToast('error', data.message || 'Force delete failed');
    }

  } catch (err) {
    console.error('[Flexora] forceDeleteProduct:', err);
    showToast('error', 'Failed to delete product');
  } finally {
    _deleteInProgress = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-lightning-charge-fill"></i> Force Delete'; }
  }
}

/* ── Remove row from DOM immediately then reload ── */
function removeProductRow(id) {
  /* Animate row out */
  const row = document.querySelector(`[data-id="${id}"]`)?.closest('tr');
  if (row) {
    row.style.transition = 'opacity .3s, transform .3s';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    setTimeout(() => {
      row.remove();
      /* Reload from API to get fresh data + correct pagination */
      loadProducts();
    }, 350);
  } else {
    /* Row not visible on current page — just reload */
    loadProducts();
  }
}

/* ══════════════════════════════════════
   LOADING & ERROR STATES
══════════════════════════════════════ */
function setTableLoading(loading) {
  const tbody = document.getElementById('productsTableBody');
  const badge = document.getElementById('productCount');
  if (loading) {
    tbody.innerHTML = Array.from({ length: pageSize }, (_, i) => `
      <tr>
        ${Array.from({ length: 8 }, () =>
      `<td><div style="height:16px;border-radius:6px;background:linear-gradient(90deg,var(--border) 25%,var(--bg) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite"></div></td>`
    ).join('')}
      </tr>`).join('');
    badge.textContent = 'Loading…';
    document.getElementById('emptyState').classList.add('d-none');
  }
}

function showTableError(msg) {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="8">
        <div style="text-align:center;padding:48px 24px">
          <div style="font-size:2rem;color:var(--rose-400);margin-bottom:12px"><i class="bi bi-wifi-off"></i></div>
          <div style="font-weight:600;color:var(--text-primary);margin-bottom:6px">${msg}</div>
          <button class="btn-ghost btn-sm" onclick="loadProducts()" style="margin-top:8px">
            <i class="bi bi-arrow-clockwise me-1"></i> Retry
          </button>
        </div>
      </td>
    </tr>`;
}

/* ══════════════════════════════════════
   THEME / SIDEBAR (same as dashboard)
══════════════════════════════════════ */
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  toggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  window.addEventListener('resize', () => { if (window.innerWidth >= 992) { sidebar.classList.remove('open'); overlay.classList.remove('show'); } });
}

function initTheme() {
  const btn = document.getElementById('themeToggle');
  const html = document.documentElement;
  const saved = localStorage.getItem('flexora_theme') || 'light';
  html.setAttribute('data-theme', saved);
  if (btn) btn.innerHTML = saved === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
  btn?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('flexora_theme', next);
    if (btn) btn.innerHTML = next === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
  });
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function fmtCurrency(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(n);
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(type, msg) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  t.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'x-circle-fill'}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* Shimmer keyframe (injected once) */
const shimmerStyle = document.createElement('style');
shimmerStyle.textContent = `@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
document.head.appendChild(shimmerStyle);




/* ──────────────────────────────────────────────────
   FETCH WRAPPER FOR FULL-URL ENDPOINTS
────────────────────────────────────────────────── */
async function apiFetchExternal(url) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { console.warn('[Flexora] 401 on', url); return null; }
    if (!res.ok) { console.error(`[Flexora] HTTP ${res.status} on`, url); return null; }
    const json = await res.json();
    if (!json.success) { console.warn('[Flexora] success=false on', url); return null; }
    return json.data;
  } catch (err) {
    console.error('[Flexora] Network error on', url, err);
    return null;
  }
}

/* ──────────────────────────────────────────────────
   NOTIFICATIONS COUNT  —  /notifications-count
────────────────────────────────────────────────── */
async function loadNotifCount() {
  const d = await apiFetchExternal('https://fitverseapp.runasp.net/api/Dashboard/notifications-count');
  console.log('[Flexora] Notifications count:', d);
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const count = d?.count ?? 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count === 0 ? 'none' : '';
}


async function loadUserInfo() {
  const d = await apiFetchExternal('https://fitverseapp.runasp.net/UserInfo');

  const firstName = d?.firstName || 'Admin';
  const lastName = d?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = d?.email || '';
  const avatar = d?.imageUrl ? `https://fitverseapp.runasp.net/${d.imageUrl}` 
  : `https://img.magnific.com/free-vector/blue-circle-with-white-user_78370-4707.jpg?semt=ais_hybrid&w=740&q=80`;

  // Page greeting
  const greetEl = document.getElementById('pageGreeting');
  if (greetEl) greetEl.textContent = `${getGreeting()}, ${firstName} \u2726`;

  // Sidebar
  const sbAvatar = document.getElementById('sidebarUserAvatar');
  const sbName = document.getElementById('sidebarUserName');
  const sbEmail = document.getElementById('sidebarUserEmail');
  if (sbAvatar) sbAvatar.src = avatar;
  if (sbName) sbName.textContent = fullName;
  if (sbEmail) sbEmail.textContent = email;

  // Navbar
  const nbAvatar = document.getElementById('navbarUserAvatar');
  const nbName = document.getElementById('navbarUserName');
  if (nbAvatar) nbAvatar.src = avatar;
  if (nbName) nbName.textContent = fullName;

  // Dropdown header
  const ddName = document.getElementById('dropdownUserName');
  const ddEmail = document.getElementById('dropdownUserEmail');
  if (ddName) ddName.textContent = fullName;
  if (ddEmail) ddEmail.textContent = email;
}