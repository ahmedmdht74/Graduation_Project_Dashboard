/* ═══════════════════════════════════════════════════
   FLEXORA — Reviews Management JS  (reviews.js)
   APIs:
     GET    /api/Reviews/GetReviews?page&pageSize&search&rating
     GET    /api/Reviews/GetReviewsStats
     DELETE /api/Reviews/DeleteReview/{id}
═══════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════
   CONFIG
══════════════════════════════════════ */
const API_BASE = 'https://fitverseapp.runasp.net/api';
const IMAGE_BASE = 'https://fitverseapp.runasp.net';

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
const PAGE_SIZE = 10;
let totalCount = 0;
let totalPages = 1;
let searchTimer = null;
let actionBusy = false;

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTheme();
  initFilters();
  loadReviewsStats();
  loadReviews();
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
   FILTERS
══════════════════════════════════════ */
function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; loadReviews(); }, 420);
  });

  document.getElementById('filterRating')?.addEventListener('change', () => {
    currentPage = 1; loadReviews();
  });

  document.getElementById('clearFilters')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterRating').value = '';
    currentPage = 1;
    loadReviews();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    loadReviewsStats();
    loadReviews(true);
  });
}

/* ══════════════════════════════════════
   API #1 — LOAD REVIEWS
══════════════════════════════════════ */
async function loadReviews(showToastMsg = false) {
  setTableLoading(true);

  const search = document.getElementById('searchInput')?.value.trim() || '';
  const rating = document.getElementById('filterRating')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(rating && { rating }),
  });

  try {
    const res = await fetch(`${API_BASE}/Reviews/GetReviews?${params}`, {
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    /* Shape: { items: [], totalCount } */

    totalCount = data.totalCount || 0;
    totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    renderReviewsTable(data.items || []);
    renderPagination();

    document.getElementById('reviewCount').textContent =
      `${totalCount.toLocaleString()} review${totalCount !== 1 ? 's' : ''}`;

    if (showToastMsg) showToast('success', 'Reviews refreshed');

  } catch (err) {
    console.error('[Flexora] loadReviews:', err);
    showTableError('Failed to load reviews. Check your connection.');
  } finally {
    setTableLoading(false);
  }
}

/* ══════════════════════════════════════
   API #2 — STATS
══════════════════════════════════════ */
async function loadReviewsStats() {
  try {
    const res = await fetch(`${API_BASE}/Reviews/GetReviewsStats`, {
      headers: authHeader()
    });
    if (!res.ok) return;
    const data = await res.json();
    /* Shape: { totalReviews, averageRating, fiveStars, lowRatings } */

    animateCount('sTotalReviews', data.totalReviews || 0);
    animateCount('sFiveStars', data.fiveStars || 0);
    animateCount('sLowRatings', data.lowRatings || 0);

    /* Average rating */
    const avg = parseFloat(data.averageRating) || 0;
    const avgEl = document.getElementById('sAvgRating');
    if (avgEl) {
      avgEl.classList.remove('skeleton');
      avgEl.textContent = avg.toFixed(1);
    }

    const starsEl = document.getElementById('sAvgStars');
    if (starsEl) starsEl.innerHTML = renderStars(avg, '.9rem');

  } catch (err) {
    console.error('[Flexora] loadReviewsStats:', err);
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton');
  let cur = 0;
  const dur = 600, step = 16;
  const inc = target / (dur / step);
  const t = setInterval(() => {
    cur += inc;
    if (cur >= target) { el.textContent = target.toLocaleString(); clearInterval(t); }
    else el.textContent = Math.round(cur).toLocaleString();
  }, step);
}

/* ══════════════════════════════════════
   RENDER STARS
══════════════════════════════════════ */
function renderStars(rating, size = '1rem') {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let html = '';
  for (let i = 0; i < full; i++) html += `<i class="bi bi-star-fill star-filled"  style="font-size:${size}"></i>`;
  if (half) html += `<i class="bi bi-star-half star-filled"  style="font-size:${size}"></i>`;
  for (let i = 0; i < empty; i++) html += `<i class="bi bi-star      star-empty"   style="font-size:${size}"></i>`;
  return html;
}

/* Star color class by rating */
function ratingColor(r) {
  if (r >= 5) return '#16a34a';
  if (r >= 4) return '#65a30d';
  if (r >= 3) return '#b45309';
  if (r >= 2) return '#ea580c';
  return '#e8376e';
}

/* ══════════════════════════════════════
   RENDER TABLE
══════════════════════════════════════ */
function renderReviewsTable(items) {
  const tbody = document.getElementById('reviewsTableBody');
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

  tbody.innerHTML = items.map(r => {
    /* User avatar */
    const userImgSrc = r.userImage ? `${IMAGE_BASE}/${r.userImage}` : '';
    const initials = getInitials(r.userName || '');
    const userAvatar = userImgSrc
      ? `<img src="${userImgSrc}" class="rev-avatar" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
              alt="${escHtml(r.userName)}"/>
         <span class="rev-avatar-placeholder" style="display:none">${initials}</span>`
      : `<span class="rev-avatar-placeholder">${initials}</span>`;

    /* Product image */
    const prodImgSrc = r.productImage ? `${IMAGE_BASE}/${r.productImage}` : '';
    const productImg = prodImgSrc
      ? `<img src="${prodImgSrc}" class="rev-product-img" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
              alt="${escHtml(r.productName)}"/>
         <span class="rev-product-img-placeholder" style="display:none"><i class="bi bi-bag-heart"></i></span>`
      : `<span class="rev-product-img-placeholder"><i class="bi bi-bag-heart"></i></span>`;

    /* Rating badge */
    const ratingBadge = `
      <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;
                   background:${r.rating >= 4 ? 'var(--green-100)' : r.rating === 3 ? 'var(--gold-100)' : 'var(--rose-100)'};
                   color:${ratingColor(r.rating)};font-weight:700;font-size:.8rem">
        <i class="bi bi-star-fill" style="font-size:.7rem"></i>
        ${r.rating}/5
      </span>`;

    return `
    <tr>
      <td>
        <div class="cell-with-img">
          ${userAvatar}
          <div class="cell-name">${escHtml(r.userName || '—')}</div>
        </div>
      </td>
      <td>
        <div class="cell-with-img">
          ${productImg}
          <div>
            <div class="cell-name" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escHtml(r.productName || '—')}
            </div>
            <div style="font-size:.72rem;color:var(--text-muted)">ID #${r.productId}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${ratingBadge}
          <div class="stars-display" style="font-size:.75rem">${renderStars(r.rating, '.75rem')}</div>
        </div>
      </td>
      <td>
        <div class="comment-preview" title="${escHtml(r.comment || '')}">
          ${r.comment ? escHtml(r.comment) : '<span style="color:var(--text-muted)">No comment</span>'}
        </div>
      </td>
      <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">
        ${fmtDate(r.createdAt)}
      </td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn-ghost btn-sm btn-icon" title="View Review"
                  onclick="openReviewModal(${r.id})">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn-danger btn-sm btn-icon" title="Delete Review"
                  onclick="confirmDeleteReview(${r.id}, '${escHtml(r.userName || '')}')"
                  style="background:transparent;color:var(--rose-500);border:1px solid var(--rose-400);border-radius:8px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:.88rem">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   VIEW REVIEW MODAL
══════════════════════════════════════ */
function openReviewModal(id) {
  /* Find review in current page items (already fetched) */
  const tbody = document.getElementById('reviewsTableBody');
  const row = tbody.querySelector(`[onclick="openReviewModal(${id})"]`)?.closest('tr');

  /* Open modal immediately, populate from DOM data */
  const modal = new bootstrap.Modal(document.getElementById('viewReviewModal'));
  modal.show();

  /* Re-fetch for full data accuracy */
  fetchAndShowReview(id);
}

async function fetchAndShowReview(id) {
  const body = document.getElementById('viewReviewBody');

  /* We don't have a single-review GET endpoint, so we find it from the current page
     by matching row onclick. Instead, load reviews filtered to build the modal. */

  /* Find the row that has this id */
  const btn = document.querySelector(`[onclick="openReviewModal(${id})"]`);
  if (!btn) return;
  const row = btn.closest('tr');
  const cells = row.querySelectorAll('td');

  /* Extract from DOM */
  const userName = cells[0]?.querySelector('.cell-name')?.textContent?.trim() || '—';
  const userImgEl = cells[0]?.querySelector('img.rev-avatar');
  const productName = cells[1]?.querySelector('.cell-name')?.textContent?.trim() || '—';
  const productId = cells[1]?.querySelector('div:last-child')?.textContent?.replace('ID #', '').trim() || '';
  const prodImgEl = cells[1]?.querySelector('img.rev-product-img');
  const ratingText = cells[2]?.querySelector('span')?.textContent?.trim() || '';
  const rating = parseInt(ratingText) || 0;
  const comment = cells[3]?.querySelector('.comment-preview')?.title || cells[3]?.querySelector('.comment-preview')?.textContent?.trim() || '';
  const date = cells[4]?.textContent?.trim() || '—';

  const userImgSrc = userImgEl?.src || '';
  const prodImgSrc = prodImgEl?.src || '';
  const initials = getInitials(userName);
  body.innerHTML = `
    <!-- Product -->
    <div class="review-modal-product">
      ${prodImgSrc
      ? `<img src="${prodImgSrc}" loading="lazy" onerror="this.style.display='none'" alt="${escHtml(productName)}"/>`
      : `<div style="width:56px;height:56px;border-radius:10px;background:var(--purple-100);display:flex;align-items:center;justify-content:center;color:var(--purple-400);font-size:1.2rem;flex-shrink:0"><i class="bi bi-bag-heart"></i></div>`}
      <div>
        <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px">Product</div>
        <div style="font-weight:700;font-size:.95rem;color:var(--text-primary)">${escHtml(productName)}</div>
        ${productId ? `<div style="font-size:.74rem;color:var(--text-muted)">ID #${escHtml(productId)}</div>` : ''}
      </div>
    </div>

    <!-- User -->
    <div class="review-modal-user">
      ${userImgSrc
      ? `<img src="${userImgSrc}" loading="lazy" onerror="this.style.display='none'" alt="${escHtml(userName)}"/>`
      : `<div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--purple-400),var(--purple-600));display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700">${initials}</div>`}
      <div>
        <div style="font-weight:700;font-size:.95rem;color:var(--text-primary)">${escHtml(userName)}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">${escHtml(date)}</div>
      </div>
      <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:999px;
                     background:${rating >= 4 ? 'var(--green-100)' : rating === 3 ? 'var(--gold-100)' : 'var(--rose-100)'};
                     color:${ratingColor(rating)};font-weight:700;font-size:.85rem">
          <i class="bi bi-star-fill" style="font-size:.75rem"></i>
          ${rating} / 5
        </span>
        <div class="stars-display" style="font-size:.9rem">${renderStars(rating, '.9rem')}</div>
      </div>
    </div>

    <!-- Comment -->
    <div class="review-modal-comment">
      <span style="position:relative;z-index:1">${comment ? escHtml(comment) : '<em style="color:var(--text-muted)">No comment provided</em>'}</span>
    </div>`;
}

/* ══════════════════════════════════════
   DELETE REVIEW
══════════════════════════════════════ */
function confirmDeleteReview(id, userName) {
  document.getElementById('deleteReviewUser').textContent = userName;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-trash me-1"></i> Delete';
  btn.onclick = () => deleteReview(id, userName);
  new bootstrap.Modal(document.getElementById('deleteReviewModal')).show();
}

async function deleteReview(id, userName) {
  if (actionBusy) return;
  actionBusy = true;

  bootstrap.Modal.getInstance(document.getElementById('deleteReviewModal'))?.hide();

  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting…'; }

  try {
    const res = await fetch(`${API_BASE}/Reviews/DeleteReview/${id}`, {
      method: 'DELETE',
      headers: authHeader()
    });

    if (res.status === 401) { window.location.href = 'login.html'; return; }

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      /* Remove row with animation */
      removeReviewRow(id);
      showToast('success', data.message || `Review by "${userName}" deleted`);
      loadReviewsStats();
    } else {
      showToast('error', data.message || `Delete failed (${res.status})`);
    }

  } catch (err) {
    console.error('[Flexora] deleteReview:', err);
    showToast('error', 'Network error');
  } finally {
    actionBusy = false;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-trash me-1"></i> Delete'; }
  }
}

/* ── Remove row with animation then reload ── */
function removeReviewRow(id) {
  /* Find any button in the row that references this id */
  const btn = document.querySelector(`[onclick="openReviewModal(${id})"]`);
  const row = btn?.closest('tr');

  if (row) {
    row.style.transition = 'opacity .3s, transform .3s';
    row.style.opacity = '0';
    row.style.transform = 'translateX(20px)';
    setTimeout(() => {
      row.remove();
      totalCount = Math.max(0, totalCount - 1);
      document.getElementById('reviewCount').textContent =
        `${totalCount.toLocaleString()} review${totalCount !== 1 ? 's' : ''}`;
      /* Reload if page is now empty */
      if (!document.querySelectorAll('#reviewsTableBody tr').length) {
        if (currentPage > 1) currentPage--;
        loadReviews();
      } else {
        renderPagination();
      }
    }, 320);
  } else {
    loadReviews();
  }
}

/* ══════════════════════════════════════
   PAGINATION
══════════════════════════════════════ */
function renderPagination() {
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalCount);

  document.getElementById('pageInfo').textContent =
    totalCount ? `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${totalCount.toLocaleString()}` : 'No results';

  const container = document.getElementById('paginationBtns');
  container.innerHTML = '';

  if (totalPages <= 1) {
    document.getElementById('paginationWrap').style.display = 'none';
    return;
  }
  document.getElementById('paginationWrap').style.display = 'flex';

  container.appendChild(mkBtn('<i class="bi bi-chevron-left"></i>', currentPage === 1, () => { currentPage--; loadReviews(); }));

  buildPageRange(currentPage, totalPages).forEach(item => {
    if (item === '…') { container.appendChild(mkBtn('…', true)); return; }
    const b = mkBtn(item, false, () => { currentPage = item; loadReviews(); });
    if (item === currentPage) b.classList.add('active');
    container.appendChild(b);
  });

  container.appendChild(mkBtn('<i class="bi bi-chevron-right"></i>', currentPage === totalPages, () => { currentPage++; loadReviews(); }));
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
   LOADING / ERROR STATES
══════════════════════════════════════ */
function setTableLoading(loading) {
  const tbody = document.getElementById('reviewsTableBody');
  if (!loading) return;
  tbody.innerHTML = Array.from({ length: PAGE_SIZE }, () => `
    <tr>${Array.from({ length: 6 }, () =>
    `<td><div class="skeleton" style="height:14px;border-radius:5px"></div></td>`
  ).join('')}</tr>`).join('');
  document.getElementById('emptyState').classList.add('d-none');
}

function showTableError(msg) {
  document.getElementById('reviewsTableBody').innerHTML = `
    <tr><td colspan="6" style="text-align:center;padding:48px;color:var(--text-muted)">
      <i class="bi bi-wifi-off" style="font-size:2rem;display:block;margin-bottom:12px"></i>
      ${msg}
      <br><button class="btn-ghost btn-sm" style="margin-top:12px" onclick="loadReviews()">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </td></tr>`;
}

/* ══════════════════════════════════════
   UTILITIES
══════════════════════════════════════ */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function ratingColor(r) {
  if (r >= 5) return '#16a34a';
  if (r >= 4) return '#65a30d';
  if (r >= 3) return '#b45309';
  if (r >= 2) return '#ea580c';
  return '#e8376e';
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
  setTimeout(() => {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3500);
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