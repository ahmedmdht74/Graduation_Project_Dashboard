/* ═══════════════════════════════════════════════════
   FLEXORA — Order Details JS  (order-details.js)
   APIs:
     GET  /api/Orders/GetOrder/{id}
     PUT  /api/Orders/MarkPaid/{id}
     PUT  /api/Orders/Cancel/{id}
     PUT  /api/Orders/UpdateStatus/{id}  body: { status }
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'https://fitverseapp.runasp.net';

function authHeader() {
  const token = localStorage.getItem('flexora_token');
  return { Authorization: `Bearer ${token}` };
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let orderId = null;
let orderData = null;
let actionInProgress = false;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  loadUserInfo();

  orderId = new URLSearchParams(location.search).get('id');
  if (!orderId) {
    showToast('error', 'No order ID — redirecting…');
    setTimeout(() => window.location.href = 'orders.html', 1500);
    return;
  }

  loadOrderDetails();
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
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992) { sidebar.classList.remove('open'); overlay.classList.remove('show'); }
  });
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
   LOAD ORDER DETAILS
══════════════════════════════════════ */
async function loadOrderDetails() {
  showSkeleton(true);

  try {
    const res = await fetch(`${API_BASE}/Orders/GetOrder/${orderId}`, {
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (res.status === 404) {
      showToast('error', 'Order not found');
      setTimeout(() => window.location.href = 'orders.html', 1500);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    orderData = await res.json();
    populatePage(orderData);

  } catch (err) {
    console.error('[Flexora] loadOrderDetails:', err);
    showToast('error', 'Failed to load order details');
  } finally {
    showSkeleton(false);
  }
}

/* ══════════════════════════════════════
   POPULATE PAGE
══════════════════════════════════════ */
function populatePage(o) {
  /* ── Header ── */
  const code = o.orderCode || `#${o.id}`;
  document.getElementById('pageTitle').textContent = `Order ${code}`;
  document.getElementById('breadcrumbCode').textContent = code;
  document.getElementById('orderStatusBadge').innerHTML =
    `<span class="badge ${statusClass(o.status)}">${escHtml(o.status || '—')}</span>`;

  /* ── Status select ── */
  const statusSel = document.getElementById('statusSelect');
  if (statusSel) statusSel.value = o.status || 'Pending';

  /* ── Customer ── */
  const c = o.customer || {};
  setText('custName', c.name || '—');
  setText('custEmail', c.email || '—');
  setText('custPhone', c.phone || '—');
  setText('custAddress', c.address || '—');
  setText('custCity', c.city || '—');

  /* ── Payment ── */
  const p = o.payment || {};
  setText('payMethod', p.method || '—');
  document.getElementById('payStatus').innerHTML =
    `<span class="badge ${payStatusClass(p.status)}">${escHtml(p.status || '—')}</span>`;
  setText('payRef', p.reference || '—');
  setText('orderDate', fmtDateLong(o.createdDate));

  /* ── Items ── */
  renderItems(o.items || []);
  document.getElementById('itemsCountBadge').textContent =
    `${(o.items || []).length} item${(o.items || []).length !== 1 ? 's' : ''}`;

  /* ── Summary ── */
  setText('summSubtotal', fmtCurrency(o.subtotal));
  setText('summShipping', fmtCurrency(o.shipping));
  setText('summTotal', fmtCurrency(o.total));

  /* ── Show content ── */
  document.getElementById('orderContent').classList.remove('d-none');
}

/* ══════════════════════════════════════
   RENDER ITEMS TABLE
══════════════════════════════════════ */
function renderItems(items) {
  const tbody = document.getElementById('itemsTableBody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">
        No items in this order
      </td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const imgSrc = item.mainImage ? `${IMAGE_BASE}/${item.mainImage}` : '';
    const rowTotal = (item.price || 0) * (item.quantity || 1);

    return `
    <tr>
      <td>
        ${imgSrc
        ? `<img src="${imgSrc}" class="item-img" loading="lazy"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                  alt="${escHtml(item.productName || '')}"/>
             <div class="item-img-placeholder" style="display:none"><i class="bi bi-bag-heart"></i></div>`
        : `<div class="item-img-placeholder"><i class="bi bi-bag-heart"></i></div>`
      }
      </td>
      <td>
        <div style="font-weight:600;font-size:.88rem">${escHtml(item.productName || '—')}</div>
        <div style="font-size:.74rem;color:var(--text-muted)">Variant #${item.variantId || '—'}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:14px;height:14px;border-radius:50%;background:${colorHex(item.color)};border:1.5px solid rgba(0,0,0,.1);display:inline-block;flex-shrink:0"></span>
          ${escHtml(item.color || '—')}
        </div>
      </td>
      <td>
        <span class="badge badge-processing" style="font-size:.72rem">${escHtml(item.size || '—')}</span>
      </td>
      <td style="font-weight:600">× ${item.quantity || 1}</td>
      <td style="color:var(--text-secondary)">${fmtCurrency(item.price)}</td>
      <td>
        <span style="font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:700;color:var(--purple-500)">
          ${fmtCurrency(rowTotal)}
        </span>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   UPDATE STATUS
══════════════════════════════════════ */
async function updateOrderStatus(newStatus) {
  if (!newStatus || actionInProgress) return;
  actionInProgress = true;

  const sel = document.getElementById('statusSelect');
  if (sel) sel.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/Orders/UpdateStatus/${orderId}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (data.success) {
      /* Update badge in header */
      document.getElementById('orderStatusBadge').innerHTML =
        `<span class="badge ${statusClass(newStatus)}">${escHtml(newStatus)}</span>`;
      showToast('success', `Status updated to "${newStatus}"`);
    } else {
      showToast('error', data.message || 'Failed to update status');
      /* Revert select */
      if (sel && orderData) sel.value = orderData.status;
    }

  } catch (err) {
    console.error('[Flexora] updateOrderStatus:', err);
    showToast('error', 'Network error');
    if (sel && orderData) sel.value = orderData.status;
  } finally {
    actionInProgress = false;
    if (sel) sel.disabled = false;
  }
}

/* ══════════════════════════════════════
   MARK AS PAID
══════════════════════════════════════ */
async function markAsPaid() {
  if (actionInProgress) return;
  actionInProgress = true;

  const btn = document.getElementById('markPaidBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Processing…'; }

  try {
    const res = await fetch(`${API_BASE}/Orders/MarkPaid/${orderId}`, {
      method: 'PUT', headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (data.success) {
      /* Update payment status badge */
      document.getElementById('payStatus').innerHTML =
        `<span class="badge badge-paid">Paid</span>`;
      showToast('success', 'Order marked as paid');
    } else {
      showToast('error', data.message || 'Failed to mark as paid');
    }

  } catch (err) {
    console.error('[Flexora] markAsPaid:', err);
    showToast('error', 'Network error');
  } finally {
    actionInProgress = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Mark as Paid'; }
  }
}

/* ══════════════════════════════════════
   CANCEL ORDER
══════════════════════════════════════ */
function showCancelModal() {
  const btn = document.getElementById('confirmCancelBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-x-circle me-1"></i> Yes, Cancel';
  btn.onclick = () => cancelOrder();
  new bootstrap.Modal(document.getElementById('cancelModal')).show();
}

async function cancelOrder() {
  if (actionInProgress) return;
  actionInProgress = true;

  bootstrap.Modal.getInstance(document.getElementById('cancelModal'))?.hide();

  const cancelBtnEl = document.getElementById('cancelBtn');
  if (cancelBtnEl) { cancelBtnEl.disabled = true; cancelBtnEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Cancelling…'; }

  try {
    const res = await fetch(`${API_BASE}/Orders/Cancel/${orderId}`, {
      method: 'PUT', headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (data.success) {
      /* Update status badge + select */
      document.getElementById('orderStatusBadge').innerHTML =
        `<span class="badge badge-cancelled">Cancelled</span>`;
      const sel = document.getElementById('statusSelect');
      if (sel) sel.value = 'Cancelled';
      showToast('success', 'Order cancelled successfully');
    } else {
      showToast('error', data.message || 'Failed to cancel order');
    }

  } catch (err) {
    console.error('[Flexora] cancelOrder:', err);
    showToast('error', 'Network error');
  } finally {
    actionInProgress = false;
    if (cancelBtnEl) { cancelBtnEl.disabled = false; cancelBtnEl.innerHTML = '<i class="bi bi-x-circle me-1"></i> Cancel Order'; }
  }
}

/* ══════════════════════════════════════
   SKELETON
══════════════════════════════════════ */
function showSkeleton(show) {
  const skeleton = document.getElementById('loadingSkeleton');
  const content = document.getElementById('orderContent');
  if (show) {
    skeleton?.classList.remove('d-none');
    content?.classList.add('d-none');
  } else {
    skeleton?.classList.add('d-none');
  }
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function statusClass(s) {
  const m = { pending: 'badge-pending', processing: 'badge-processing', shipped: 'badge-shipped', delivered: 'badge-delivered', cancelled: 'badge-cancelled' };
  return m[(s || '').toLowerCase()] || 'badge-pending';
}

function payStatusClass(s) {
  const m = { paid: 'badge-paid', pending: 'badge-unpaid', refunded: 'badge-refunded' };
  return m[(s || '').toLowerCase()] || 'badge-unpaid';
}

const COLOR_HEX_MAP = {
  black: '#1a1a1a', white: '#f5f5f5', navy: '#1e3a5f', camel: '#c19a6b',
  olive: '#6b7c45', burgundy: '#800020', blush: '#f5b8b4', grey: '#708090',
  gray: '#708090', red: '#dc2626', blue: '#2563eb', green: '#16a34a',
  pink: '#ec4899', yellow: '#eab308', orange: '#f97316', brown: '#92400e',
  beige: '#d4b896', cream: '#fffdd0', khaki: '#c3b091', purple: '#7c3aed',
};
function colorHex(name) {
  return COLOR_HEX_MAP[(name || '').toLowerCase()] || '#9ca3af';
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return 'EGP ' + Number(n).toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateLong(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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