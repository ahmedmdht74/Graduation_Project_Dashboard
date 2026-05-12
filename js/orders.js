/* ═══════════════════════════════════════════════════
   FLEXORA — Orders JS  (orders.js)
   APIs:
     GET  /api/Orders
     PUT  /api/Orders/MarkPaid/{id}
     PUT  /api/Orders/Cancel/{id}
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'http://fitverseapp.runasp.net';

function authHeader() {
  const token = localStorage.getItem('flexora_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentPage = 1;
const pageSize = 10;
let totalCount = 0;
let totalPages = 1;
let searchTimer = null;
let actionInProgress = false;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  initFilters();
  loadOrders();
  loadNotifCount();
  loadUserInfo();
});

/* ══════════════════════════════════════
   SIDEBAR & THEME
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
   FILTERS
══════════════════════════════════════ */
function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadOrders(); }, 420);
  });

  ['filterStatus', 'filterPaymentMethod', 'filterPaymentStatus'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { currentPage = 1; loadOrders(); });
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPaymentMethod').value = '';
    document.getElementById('filterPaymentStatus').value = '';
    currentPage = 1;
    loadOrders();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', () => loadOrders(true));
}

/* ══════════════════════════════════════
   LOAD ORDERS
══════════════════════════════════════ */
async function loadOrders(showRefreshToast = false) {
  setTableLoading(true);

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const paymentMethod = document.getElementById('filterPaymentMethod')?.value || '';
  const paymentStatus = document.getElementById('filterPaymentStatus')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    pageSize,
    ...(search && { search }),
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...(paymentStatus && { paymentStatus }),
  });

  try {
    const res = await fetch(`${API_BASE}/Orders?${params}`, { headers: authHeader() });

    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    /* Shape: { totalCount, page, pageSize, orders: [] } */

    totalCount = data.totalCount || 0;
    totalPages = Math.ceil(totalCount / pageSize) || 1;

    renderStats(data.orders || []);
    renderTable(data.orders || []);
    renderPagination();

    document.getElementById('orderCount').textContent =
      `${totalCount.toLocaleString()} order${totalCount !== 1 ? 's' : ''}`;

    if (showRefreshToast) showToast('success', 'Orders refreshed');

  } catch (err) {
    console.error('[Flexora Orders]', err);
    showTableError('Failed to load orders. Check your connection.');
  } finally {
    setTableLoading(false);
  }
}

/* ══════════════════════════════════════
   STATS  (derived from current page)
══════════════════════════════════════ */
function renderStats(orders) {
  const pending = orders.filter(o => o.status === 'Pending').length;
  const paid = orders.filter(o => o.paymentStatus === 'Paid').length;
  const cash = orders.filter(o => o.paymentMethod === 'cash').length;
  const revenue = orders.reduce((s, o) => s + (o.totalPrice || 0), 0);

  animateCount('statTotal', totalCount);
  animateCount('statPending', pending);
  animateCount('statPaid', paid);
  animateCount('statCash', cash);

  const revEl = document.getElementById('statRevenue');
  if (revEl) {
    revEl.classList.remove('skeleton');
    revEl.textContent = fmtCurrency(revenue);
  }

  ['statTotal', 'statPending', 'statPaid', 'statCash'].forEach(id => {
    document.getElementById(id)?.classList.remove('skeleton');
  });
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  const start = 0, dur = 600, step = 16;
  const inc = (target - start) / (dur / step);
  let cur = start;
  const t = setInterval(() => {
    cur += inc;
    if (cur >= target) { el.textContent = target.toLocaleString(); clearInterval(t); }
    else el.textContent = Math.round(cur).toLocaleString();
  }, step);
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  const empty = document.getElementById('emptyState');
  const pgWrap = document.getElementById('paginationWrap');

  if (!orders.length) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    pgWrap.style.display = 'none';
    return;
  }

  empty.classList.add('d-none');
  pgWrap.style.display = 'flex';

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span class="order-code">${escHtml(o.orderCode || `#${o.id}`)}</span></td>
      <td>
        <div class="customer-cell">
          <span class="customer-name">${escHtml(o.customerName || '—')}</span>
          <span class="customer-email">${escHtml(o.customerEmail || '')}</span>
        </div>
      </td>
      <td style="font-size:.8rem;color:var(--text-secondary)">${fmtDate(o.createdDate)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:4px;font-weight:600">
          <i class="bi bi-bag" style="color:var(--purple-400);font-size:.8rem"></i>
          ${o.itemsCount || 0}
        </span>
      </td>
      <td><span class="price-cell">${fmtCurrency(o.totalPrice)}</span></td>
      <td><span class="badge badge-${(o.paymentMethod || '').toLowerCase()}">${escHtml(o.paymentMethod || '—')}</span></td>
      <td><span class="badge ${payStatusClass(o.paymentStatus)}">${escHtml(o.paymentStatus || '—')}</span></td>
      <td><span class="badge ${statusClass(o.status)}">${escHtml(o.status || '—')}</span></td>
      <td>
        <div class="dropdown actions-dropdown">
          <button class="btn-ghost btn-sm btn-icon dropdown-toggle"
                  data-bs-toggle="dropdown" style="border:none">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <button class="action-item" onclick="viewOrder(${o.id})">
                <i class="bi bi-eye"></i> View Details
              </button>
            </li>
            <li>
              <button class="action-item" onclick="markPaid(${o.id}, '${escHtml(o.orderCode || '')}')">
                <i class="bi bi-check-circle"></i> Mark As Paid
              </button>
            </li>
            <li><hr class="dropdown-divider" style="margin:4px 8px"/></li>
            <li>
              <button class="action-item danger" onclick="showCancelConfirm(${o.id}, '${escHtml(o.orderCode || '')}')">
                <i class="bi bi-x-circle"></i> Cancel Order
              </button>
            </li>
          </ul>
        </div>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════
   PAGINATION
══════════════════════════════════════ */
function renderPagination() {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  document.getElementById('pageInfo').textContent =
    `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}`;

  const container = document.getElementById('paginationBtns');
  container.innerHTML = '';

  const prev = mkBtn('<i class="bi bi-chevron-left"></i>', currentPage === 1, () => { currentPage--; loadOrders(); });
  container.appendChild(prev);

  buildPageRange(currentPage, totalPages).forEach(item => {
    if (item === '…') {
      const d = mkBtn('…', true); container.appendChild(d);
    } else {
      const b = mkBtn(item, false, () => { currentPage = item; loadOrders(); });
      if (item === currentPage) b.classList.add('active');
      container.appendChild(b);
    }
  });

  const next = mkBtn('<i class="bi bi-chevron-right"></i>', currentPage === totalPages, () => { currentPage++; loadOrders(); });
  container.appendChild(next);
}

function buildPageRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const p = [1];
  if (cur > 3) p.push('…');
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) p.push(i);
  if (cur < total - 2) p.push('…');
  p.push(total);
  return p;
}

function mkBtn(html, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'pg-btn';
  btn.innerHTML = html;
  btn.disabled = disabled;
  if (onClick && !disabled) btn.addEventListener('click', onClick);
  return btn;
}

/* ══════════════════════════════════════
   ACTIONS
══════════════════════════════════════ */
function viewOrder(id) {
  window.location.href = `order-details.html?id=${id}`;
}

async function markPaid(id, code) {
  if (actionInProgress) return;
  actionInProgress = true;
  try {
    const res = await fetch(`${API_BASE}/Orders/MarkPaid/${id}`, {
      method: 'PUT', headers: authHeader()
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      showToast('success', `${code} marked as paid`);
      loadOrders();
    } else {
      showToast('error', data.message || 'Failed to mark as paid');
    }
  } catch (err) {
    console.error('[Flexora] markPaid:', err);
    showToast('error', 'Network error');
  } finally {
    actionInProgress = false;
  }
}

function showCancelConfirm(id, code) {
  document.getElementById('cancelOrderCode').textContent = code;
  document.getElementById('confirmCancelBtn').onclick = () => cancelOrder(id, code);
  new bootstrap.Modal(document.getElementById('cancelModal')).show();
}

async function cancelOrder(id, code) {
  if (actionInProgress) return;
  actionInProgress = true;
  bootstrap.Modal.getInstance(document.getElementById('cancelModal'))?.hide();
  try {
    const res = await fetch(`${API_BASE}/Orders/Cancel/${id}`, {
      method: 'PUT', headers: authHeader()
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      showToast('success', `${code} cancelled`);
      loadOrders();
    } else {
      showToast('error', data.message || 'Failed to cancel order');
    }
  } catch (err) {
    console.error('[Flexora] cancelOrder:', err);
    showToast('error', 'Network error');
  } finally {
    actionInProgress = false;
  }
}

/* ══════════════════════════════════════
   LOADING / ERROR STATES
══════════════════════════════════════ */
function setTableLoading(loading) {
  const tbody = document.getElementById('ordersTableBody');
  if (loading) {
    tbody.innerHTML = Array.from({ length: pageSize }, () => `
      <tr>${Array.from({ length: 9 }, () =>
      `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`
    ).join('')}</tr>`).join('');
    document.getElementById('emptyState').classList.add('d-none');
  }
}

function showTableError(msg) {
  document.getElementById('ordersTableBody').innerHTML = `
    <tr><td colspan="9" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      ${msg}
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadOrders()">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </td></tr>`;
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function statusClass(s) {
  const m = { pending: 'badge-pending', processing: 'badge-processing', shipped: 'badge-shipped', delivered: 'badge-delivered', cancelled: 'badge-cancelled' };
  return m[(s || '').toLowerCase()] || 'badge-pending';
}

function payStatusClass(s) {
  const m = { paid: 'badge-paid', pending: 'badge-unpaid', refunded: 'badge-refunded' };
  return m[(s || '').toLowerCase()] || 'badge-unpaid';
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return 'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const icons = { success: 'check-circle-fill', error: 'x-circle-fill', info: 'info-circle-fill' };
  t.innerHTML = `<i class="bi bi-${icons[type] || 'info-circle-fill'}"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}






/* ──────────────────────────────────────────────────
   FETCH WRAPPER FOR FULL-URL ENDPOINTS
────────────────────────────────────────────────── */
async function apiFetchExternal(url) {
  try {
    const res = await fetch(url, { headers: authHeader() });
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